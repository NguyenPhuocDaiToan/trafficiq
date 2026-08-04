import type { ObjectId } from "mongodb";
import { campaigns, clickEvents, conversions } from "@/lib/db/collections";

/**
 * GOTCHA 4.4 — không có cron mỗi phút trên free tier.
 *
 * Dashboard tính ON-DEMAND bằng aggregation pipeline trực tiếp trên
 * clickEvents/conversions. Ở volume MVP (vài chục nghìn doc/ngày) với index
 * { campaignId, ts } và { ts, source } thì đây là chuyện nhẹ.
 *
 * Rollup job chỉ cần khi aggregation bắt đầu chậm — xem app/api/rollup.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export function rangeForDays(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Bot/crawler (kể cả FB, Slack, Telegram fetch OG) không phải traffic thật. */
const EXCLUDE_BOTS = { device: { $ne: "bot" } };

function clickMatch(range: DateRange, campaignId?: ObjectId) {
  return {
    ts: { $gte: range.from, $lte: range.to },
    ...EXCLUDE_BOTS,
    ...(campaignId ? { campaignId } : {}),
  };
}

/*
 * KHÔNG có payout/EPC ở đây — cố ý.
 *
 * `conversions.payout` vẫn được postback ghi xuống (xem app/api/postback), nhưng
 * con số đó là advertiser tự khai: không đối soát được, không sửa được, không
 * biết đã trả hay chưa. Đưa nó lên dashboard thành ra một cột "doanh thu" trông
 * như sự thật kế toán trong khi nó chỉ là ước tính. Muốn hiển thị lại thì phải
 * có chỗ quản lý đối soát trước, không phải chỉ thêm lại cột.
 */
export interface Overview {
  clicks: number;
  uniqueVisitors: number;
  botClicks: number;
  conversions: number;
  /** conversions / clicks */
  cr: number;
}

export async function getOverview(
  range: DateRange,
  campaignId?: ObjectId,
): Promise<Overview> {
  const clicksCol = await clickEvents();
  const conversionsCol = await conversions();

  const [clickStats, uniqueStats, conversionStats] = await Promise.all([
    clicksCol
      .aggregate<{ clicks: number; botClicks: number }>([
        {
          $match: {
            ts: { $gte: range.from, $lte: range.to },
            ...(campaignId ? { campaignId } : {}),
          },
        },
        {
          $group: {
            _id: null,
            clicks: { $sum: { $cond: [{ $eq: ["$device", "bot"] }, 0, 1] } },
            botClicks: { $sum: { $cond: [{ $eq: ["$device", "bot"] }, 1, 0] } },
          },
        },
      ])
      .toArray(),

    // Đếm distinct bằng $group theo ipHash rồi $count.
    // KHÔNG dùng $addToSet: một group tích cả set hash sẽ vượt giới hạn 100MB
    // của $group khi dữ liệu lên tới hàng trăm nghìn click.
    // KHÔNG dùng allowDiskUse: Atlas shared tier (M0/M2/M5) không hỗ trợ.
    // Vì vậy giữ range dashboard có giới hạn (mặc định 7 ngày).
    clicksCol
      .aggregate<{ n: number }>([
        { $match: clickMatch(range, campaignId) },
        { $group: { _id: "$ipHash" } },
        { $count: "n" },
      ])
      .toArray(),

    conversionsCol
      .aggregate<{ conversions: number }>([
        {
          $match: {
            ts: { $gte: range.from, $lte: range.to },
            status: { $ne: "rejected" },
            ...(campaignId ? { campaignId } : {}),
          },
        },
        { $group: { _id: null, conversions: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const clicks = clickStats[0]?.clicks ?? 0;
  const convs = conversionStats[0]?.conversions ?? 0;

  return {
    clicks,
    uniqueVisitors: uniqueStats[0]?.n ?? 0,
    botClicks: clickStats[0]?.botClicks ?? 0,
    conversions: convs,
    cr: clicks > 0 ? convs / clicks : 0,
  };
}

/** Không có payout/EPC — cùng lý do đã ghi ở `Overview`. */
export interface CampaignRow {
  campaignId: string;
  name: string;
  slug: string;
  token: string;
  status: string;
  clicks: number;
  conversions: number;
  cr: number;
}

export async function getCampaignBreakdown(range: DateRange): Promise<CampaignRow[]> {
  const campaignsCol = await campaigns();
  const clicksCol = await clickEvents();
  const conversionsCol = await conversions();

  const [allCampaigns, clickRows, conversionRows] = await Promise.all([
    campaignsCol
      .find({}, { projection: { name: 1, slug: 1, token: 1, status: 1 } })
      .sort({ createdAt: -1 })
      .toArray(),
    clicksCol
      .aggregate<{ _id: ObjectId; clicks: number }>([
        { $match: clickMatch(range) },
        { $group: { _id: "$campaignId", clicks: { $sum: 1 } } },
      ])
      .toArray(),
    conversionsCol
      .aggregate<{ _id: ObjectId | null; conversions: number }>([
        {
          $match: {
            ts: { $gte: range.from, $lte: range.to },
            status: { $ne: "rejected" },
          },
        },
        { $group: { _id: "$campaignId", conversions: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const clicksByCampaign = new Map(clickRows.map((r) => [r._id?.toString(), r.clicks]));
  const convsByCampaign = new Map(
    conversionRows.map((r) => [r._id?.toString(), r]),
  );

  return allCampaigns
    .map((campaign) => {
      const id = campaign._id.toString();
      const clicks = clicksByCampaign.get(id) ?? 0;
      const convCount = convsByCampaign.get(id)?.conversions ?? 0;
      return {
        campaignId: id,
        name: campaign.name,
        slug: campaign.slug,
        token: campaign.token,
        status: campaign.status,
        clicks,
        conversions: convCount,
        cr: clicks > 0 ? convCount / clicks : 0,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);
}

export type Dimension = "source" | "country" | "device" | "browser" | "os";

export interface DimensionRow {
  key: string;
  clicks: number;
}

export async function getDimensionBreakdown(
  range: DateRange,
  dimension: Dimension,
  limit = 10,
): Promise<DimensionRow[]> {
  const field = dimension === "country" ? "$geo.country" : `$${dimension}`;
  const col = await clickEvents();

  const rows = await col
    .aggregate<{ _id: string | null; clicks: number }>([
      { $match: clickMatch(range) },
      { $group: { _id: field, clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({ key: r._id ?? "unknown", clicks: r.clicks }));
}

export interface TimeseriesPoint {
  bucket: string;
  clicks: number;
}

export async function getClicksTimeseries(
  range: DateRange,
  granularity: "hour" | "day" = "day",
): Promise<TimeseriesPoint[]> {
  const col = await clickEvents();
  const format = granularity === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";

  const rows = await col
    .aggregate<{ _id: string; clicks: number }>([
      { $match: clickMatch(range) },
      {
        $group: {
          _id: { $dateToString: { format, date: "$ts", timezone: "UTC" } },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map((r) => ({ bucket: r._id, clicks: r.clicks }));
}
