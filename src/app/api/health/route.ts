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
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json(
      { ok: true, db: "up", latencyMs: Date.now() - startedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
