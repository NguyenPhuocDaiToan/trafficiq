import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildTargetUrl,
  pickCandidate,
  resolveToken,
} from "@/lib/redirect/resolve";
import { emit } from "@/lib/tracking/emit";
import { readClickContext } from "@/lib/tracking/request-context";
import { isBotRequest } from "@/lib/tracking/ua";

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

  // 🤖 Nếu là Bot (Twitterbot, Facebook, Google...), redirect sang campaign SSR gốc
  // để bot cào Open Graph Card và KHÔNG ghi nhận click rác vào báo cáo.
  if (isBotRequest(request)) {
    return NextResponse.redirect(new URL(`/c/${route.slug}`, request.url), {
      status: 302,
      headers: NO_STORE,
    });
  }

  const candidate = pickCandidate(route.candidates);
  const clickId = randomUUID();
  const context = readClickContext(request);

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
  });

  return NextResponse.redirect(target, { status: 302, headers: NO_STORE });
}
