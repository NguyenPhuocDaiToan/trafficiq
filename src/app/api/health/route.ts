import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check cho uptime monitor.
 *
 * Ping cả DB, vì redirect chết chủ yếu do Mongo (hết connection, IP không được
 * whitelist trong Atlas) chứ không phải do app. Trả 503 khi DB không phản hồi để
 * monitor bắn alert thật.
 *
 * `app: "trafficiq"` là dấu nhận diện cho `lib/domains/verify.ts`: owner thêm một tên miền, hệ thống gọi
 * `https://<tên miền>/api/health` và đòi thấy dấu này để biết tên miền thật sự dẫn tới ứng dụng. Đừng bỏ field.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json(
      { app: "trafficiq", ok: true, db: "up", latencyMs: Date.now() - startedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        app: "trafficiq",
        ok: false,
        db: "down",
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
