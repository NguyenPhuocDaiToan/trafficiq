import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { secretMatches } from "@/lib/auth/secret";
import { clickEvents, conversions } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/tracking/emit";
import { postbackSecret } from "@/lib/env";
import type { Conversion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostbackSchema = z.object({
  click_id: z.string().min(8).max(64),
  payout: z.coerce.number().min(0).max(1_000_000).default(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(["approved", "pending", "rejected"]).default("approved"),
  transaction_id: z.string().max(128).optional(),
});

/**
 * Postback conversion. Advertiser gọi:
 *   GET /api/postback?secret=...&click_id={click_id}&payout=1.50
 *
 * IDEMPOTENT: unique index trên conversions.clickId. Gọi lại cùng click_id
 * trả 200 + duplicate:true, không đếm 2 lần. Network nào cũng retry postback,
 * nên đây không phải tính năng tùy chọn.
 */
export async function GET(request: NextRequest) {
  return handle(request, Object.fromEntries(request.nextUrl.searchParams));
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown>;

  if (contentType.includes("application/json")) {
    payload = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData().catch(() => null);
    payload = form ? Object.fromEntries(form) : {};
  }

  // Cho phép secret ở query hoặc header, vì body có thể do network định dạng cứng.
  return handle(request, { ...Object.fromEntries(request.nextUrl.searchParams), ...payload });
}

async function handle(request: NextRequest, payload: Record<string, unknown>) {
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-postback-secret");

  if (!secretMatches(provided, postbackSecret())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = PostbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Denormalize campaign/source từ click để dashboard không cần $lookup.
  // Click có thể đã bị TTL xóa (conversion về sau 30 ngày) — vẫn ghi nhận.
  const clicksCol = await clickEvents();
  const click = await clicksCol.findOne(
    { clickId: data.click_id },
    { projection: { campaignId: 1, source: 1 } },
  );

  const conversion: Conversion = {
    clickId: data.click_id,
    ts: new Date(),
    payout: data.payout,
    currency: data.currency.toUpperCase(),
    status: data.status,
    transactionId: data.transaction_id,
    campaignId: click?.campaignId,
    source: click?.source,
  };

  try {
    const col = await conversions();
    await col.insertOne(conversion);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    console.error("[postback] insert thất bại", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    duplicate: false,
    matchedClick: Boolean(click),
  });
}
