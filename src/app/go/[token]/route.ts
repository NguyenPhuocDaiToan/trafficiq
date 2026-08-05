import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/env";
import { buildOgCard, ogCardHeadHtml } from "@/lib/landing/og-card";
import {
  buildTargetUrl,
  pickCandidate,
  resolveToken,
} from "@/lib/redirect/resolve";
import { emit } from "@/lib/tracking/emit";
import { readClickContext } from "@/lib/tracking/request-context";
import { botReason, weakSignals } from "@/lib/tracking/ua";

/**
 * Hot path: /go/[token] → 302.
 *
 * Node runtime vì cần driver Mongo. Routing map được cache ở module scope
 * (xem lib/redirect/resolve.ts) nên instance warm không chạm DB.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  // Không để CDN/browser cache 302 — mỗi click phải được đếm.
  "cache-control": "no-store, no-cache, must-revalidate",
  // Không rò referrer của ta sang advertiser.
  "referrer-policy": "no-referrer",
} as const;

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  const route = await resolveToken(token);
  if (!route) {
    return NextResponse.redirect(new URL("/link-unavailable", request.url), {
      status: 302,
      headers: NO_STORE,
    });
  }

  const context = readClickContext(request);

  // Bot (Twitterbot, Facebook, Telegram…) → trả THẲNG Social Card, 200 HTML.
  //
  // Trước đây chỗ này 302 sang `/c/[slug]`, tức mỗi lượt crawl tốn HAI lượt gọi
  // serverless (redirect, rồi SSR landing), mỗi lượt đều có thể dính cold start.
  // Crawler có timeout: quá hạn là link dán lên X hiện thành URL trần, không
  // ảnh, không tiêu đề. Giờ chỉ còn một response, và không thêm query Mongo nào
  // vì `og` đã đi kèm trong chính aggregation resolve token (xem ResolvedRoute).
  //
  // Vẫn GHI một clickEvent device:"bot" + botReason. Bản ghi này bị EXCLUDE_BOTS
  // (lib/analytics/queries.ts) loại khỏi mọi số liệu click nên không làm bẩn báo
  // cáo — nhưng nó là thứ DUY NHẤT cho biết bao nhiêu request đang bị chặn và vì
  // lý do gì. Bỏ emit đi là traffic bị chặn lại biến mất im lặng và ô "đã loại N
  // lượt bot" ở dashboard vĩnh viễn bằng 0.
  const reason = botReason(request);
  if (reason) {
    emit({
      clickId: randomUUID(),
      ts: new Date(),
      campaignId: route.campaignId,
      // Không có offerId/destinationId: chưa qua pickCandidate, bot không đi
      // tới destination nào cả (xem comment ở ClickEvent trong lib/types.ts).
      source: context.source,
      geo: context.geo,
      device: "bot",
      browser: context.browser,
      os: context.os,
      referrer: context.referrer,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      botReason: reason,
    });

    const card = buildOgCard({
      og: route.og,
      slug: route.slug,
      baseUrl: publicBaseUrl(),
      // resolveToken chỉ khớp campaign `active`, nên tới được đây là active.
      index: true,
    });

    return new Response(ogCardHeadHtml(card), {
      status: 200,
      headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8" },
    });
  }

  const candidate = pickCandidate(route.candidates);
  const clickId = randomUUID();
  const weak = weakSignals(request);

  const target = buildTargetUrl(candidate.url, {
    clickId,
    source: context.source,
    subIds: context.subIds,
  });

  // Ghi tracking SAU khi response đã gửi (xem lib/tracking/emit.ts).
  // Gọi trước khi return chỉ để đăng ký callback — nó không await gì cả.
  emit({
    clickId,
    ts: new Date(),
    campaignId: route.campaignId,
    offerId: candidate.offerId,
    destinationId: candidate.destinationId,
    source: context.source,
    ...context.subIds,
    geo: context.geo,
    device: context.device,
    browser: context.browser,
    os: context.os,
    referrer: context.referrer,
    ipHash: context.ipHash,
    userAgent: context.userAgent,
    // Bỏ trắng khi rỗng — đỡ tốn dung lượng doc trên M0 512MB.
    ...(weak.length > 0 ? { weakSignals: weak } : {}),
  });

  return NextResponse.redirect(target, { status: 302, headers: NO_STORE });
}
