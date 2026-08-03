import { type NextRequest, NextResponse } from "next/server";
import type { AnyBulkWriteOperation, ObjectId } from "mongodb";
import { secretMatches } from "@/lib/auth/secret";
import { clickEvents, conversions, rollups } from "@/lib/db/collections";
import { postbackSecret } from "@/lib/env";
import type { Rollup } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Rollup nặng hơn redirect nhiều — cho nó thêm thời gian. */
export const maxDuration = 60;

/**
 * GOTCHA 4.4 — Vercel Cron free tier không chạy mỗi phút.
 *
 * Ở MVP, dashboard tính on-demand nên endpoint này KHÔNG BẮT BUỘC. Nó có sẵn cho
 * lúc aggregation bắt đầu chậm: gọi định kỳ bằng cron miễn phí bên ngoài
 * (GitHub Actions — xem .github/workflows/rollup.yml — hoặc cron-job.org).
 *
 * Ghi rollup có ý nghĩa thứ hai: clickEvents bị TTL xóa sau 30 ngày, nên đây là
 * cách duy nhất giữ số liệu lịch sử dài hơn retention.
 *
 * Idempotent: upsert theo khóa (hour, campaignId, source, country) nên chạy lại
 * cùng khoảng thời gian chỉ ghi đè bằng giá trị đã tính lại.
 */
export async function GET(request: NextRequest) {
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secretMatches(provided, postbackSecret())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const hoursBack = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("hours") ?? 3), 1),
    168,
  );

  const to = new Date();
  const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000);
  // Bắt đầu từ đầu giờ, nếu không bucket đầu tiên sẽ bị tính thiếu.
  from.setUTCMinutes(0, 0, 0);

  const [clicksCol, conversionsCol, rollupsCol] = await Promise.all([
    clickEvents(),
    conversions(),
    rollups(),
  ]);

  type GroupKey = {
    hour: Date;
    campaignId: ObjectId;
    source: string | null;
    country: string | null;
  };

  const bucket = { $dateTrunc: { date: "$ts", unit: "hour" } };

  const [clickGroups, conversionGroups] = await Promise.all([
    clicksCol
      .aggregate<{ _id: GroupKey; clicks: number }>([
        {
          $match: {
            ts: { $gte: from, $lte: to },
            device: { $ne: "bot" },
          },
        },
        {
          $group: {
            _id: {
              hour: bucket,
              campaignId: "$campaignId",
              source: "$source",
              country: "$geo.country",
            },
            clicks: { $sum: 1 },
          },
        },
      ])
      .toArray(),

    conversionsCol
      .aggregate<{ _id: GroupKey; conversions: number; payout: number }>([
        {
          $match: {
            ts: { $gte: from, $lte: to },
            status: { $ne: "rejected" },
            campaignId: { $ne: null },
          },
        },
        {
          $group: {
            _id: {
              hour: bucket,
              campaignId: "$campaignId",
              source: "$source",
              // conversions không có geo — rollup theo country "unknown".
              country: null,
            },
            conversions: { $sum: 1 },
            payout: { $sum: "$payout" },
          },
        },
      ])
      .toArray(),
  ]);

  const now = new Date();
  const merged = new Map<string, Rollup>();

  const keyOf = (group: GroupKey) =>
    [
      group.hour.toISOString(),
      group.campaignId.toString(),
      group.source ?? "unknown",
      group.country ?? "unknown",
    ].join("|");

  const ensure = (group: GroupKey): Rollup => {
    const key = keyOf(group);
    let row = merged.get(key);
    if (!row) {
      row = {
        hour: group.hour,
        campaignId: group.campaignId,
        source: group.source ?? "unknown",
        country: group.country ?? "unknown",
        clicks: 0,
        conversions: 0,
        payout: 0,
        updatedAt: now,
      };
      merged.set(key, row);
    }
    return row;
  };

  for (const group of clickGroups) {
    ensure(group._id).clicks += group.clicks;
  }
  for (const group of conversionGroups) {
    const row = ensure(group._id);
    row.conversions += group.conversions;
    row.payout += group.payout;
  }

  if (merged.size === 0) {
    return NextResponse.json({ ok: true, buckets: 0, from, to });
  }

  // Upsert thay vì $merge: Atlas shared tier (M0/M2/M5) không hỗ trợ $merge/$out.
  const operations: AnyBulkWriteOperation<Rollup>[] = Array.from(merged.values()).map(
    (row) => ({
      updateOne: {
        filter: {
          hour: row.hour,
          campaignId: row.campaignId,
          source: row.source,
          country: row.country,
        },
        update: {
          $set: {
            clicks: row.clicks,
            conversions: row.conversions,
            payout: row.payout,
            updatedAt: row.updatedAt,
          },
        },
        upsert: true,
      },
    }),
  );

  const result = await rollupsCol.bulkWrite(operations, { ordered: false });

  return NextResponse.json({
    ok: true,
    from,
    to,
    buckets: merged.size,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  });
}
