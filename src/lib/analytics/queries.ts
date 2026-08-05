import type { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";
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

/**
 * Múi giờ báo cáo — dashboard là công cụ nội bộ của người ngồi ở VN, nên
 * "hôm nay" và nhãn giờ trên biểu đồ phải theo giờ VN.
 *
 * Dùng offset cố định `+07:00` chứ KHÔNG dùng Olson id "Asia/Ho_Chi_Minh":
 * `$dateToString` với Olson id cần tzdata trong server Mongo, còn VN không có
 * DST từ 1975 nên offset cố định luôn cho cùng kết quả mà không phụ thuộc gì.
 */
export const REPORT_TZ = "+07:00";
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * 00:00 giờ VN của ngày chứa `now`, trả về dưới dạng Date (mốc UTC thật).
 *
 * Cố tình chỉ dùng accessor UTC + offset tường minh, KHÔNG dùng `getHours()`:
 * giờ local của process không liên quan gì ở đây — Vercel chạy UTC, máy dev có
 * thể là múi bất kỳ, và kết quả phải giống nhau ở mọi nơi.
 */
function startOfDayInReportTz(now: Date): Date {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TZ_OFFSET_MS);
}

/**
 * Khoảng báo cáo theo NGÀY LỊCH giờ VN, không phải cửa sổ trượt.
 *
 * `days = 1` là "từ 00:00 hôm nay tới bây giờ" — đúng nghĩa "hôm nay" mà người
 * dùng mong đợi khi mở dashboard, thay vì "24 giờ gần nhất" (bản cũ) vốn gộp
 * cả nửa ngày hôm qua và làm số "hôm nay" không bao giờ khớp với báo cáo của
 * advertiser. `days = 7` gồm hôm nay + 6 ngày trước đó.
 */
export function rangeForDays(days: number): DateRange {
  const to = new Date();
  const startToday = startOfDayInReportTz(to);
  const from = new Date(startToday.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Bot/crawler (kể cả FB, Slack, Telegram fetch OG) không phải traffic thật.
 *
 * Export để `analytics/click-log.ts` dùng chung đúng một định nghĩa. Nếu nhật ký
 * và dashboard tự viết điều kiện riêng thì chỉ cần một bên đổi là bảng log và ô
 * "Lượt click" nói hai con số khác nhau về cùng một tập dữ liệu.
 */
export const EXCLUDE_BOTS = { device: { $ne: "bot" } } as const;

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

/**
 * Bot BỊ CHẶN, tách theo lý do — nghịch đảo của mọi hàm khác trong file này.
 *
 * KHÔNG dùng `clickMatch()`: hàm đó gắn sẵn `EXCLUDE_BOTS`, tức lọc đi đúng thứ
 * ta muốn đếm ở đây. Match phải viết tay với `device: "bot"`.
 *
 * `_id` có thể `null` với bản ghi bot không kèm `botReason`. Trên lý thuyết
 * không có: đường ghi duy nhất (`app/go/[token]/route.ts`) luôn set field này.
 * Nhưng schema để nó optional, nên gộp về "unknown" thay vì để rơi mất khỏi
 * bảng — tổng của bảng phải khớp với ô "đã loại N lượt bot", nếu không thì
 * người đọc mất niềm tin vào cả hai con số.
 */
export async function getBotReasonBreakdown(range: DateRange): Promise<DimensionRow[]> {
  const col = await clickEvents();

  const rows = await col
    .aggregate<{ _id: string | null; clicks: number }>([
      { $match: { ts: { $gte: range.from, $lte: range.to }, device: "bot" } },
      { $group: { _id: "$botReason", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
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
          _id: { $dateToString: { format, date: "$ts", timezone: REPORT_TZ } },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map((r) => ({ bucket: r._id, clicks: r.clicks }));
}

export interface DashboardSnapshot {
  overview: Overview;
  campaignRows: CampaignRow[];
  sources: DimensionRow[];
  countries: DimensionRow[];
  devices: DimensionRow[];
  botReasons: DimensionRow[];
  series: TimeseriesPoint[];
}

/**
 * Dashboard không cần realtime (quyết định chủ dự án) — cache 30s để chuyển
 * tab qua lại không chạy lại 7 aggregation mỗi lần.
 *
 * Cache theo `days`, KHÔNG theo `range`: `range.to` là `new Date()` tại thời
 * điểm gọi nên nếu đưa `range` vào key thì mỗi lần gọi ra key khác, cache không
 * bao giờ trúng. `rangeForDays(days)` chạy lại bên trong hàm được cache, nên
 * `to` cố định theo đúng lúc cache được ghi, không phải lúc đọc.
 */
export const getDashboardSnapshot = unstable_cache(
  async (days: number): Promise<DashboardSnapshot> => {
    const range = rangeForDays(days);
    const [overview, campaignRows, sources, countries, devices, botReasons, series] =
      await Promise.all([
        getOverview(range),
        getCampaignBreakdown(range),
        getDimensionBreakdown(range, "source"),
        getDimensionBreakdown(range, "country"),
        getDimensionBreakdown(range, "device"),
        getBotReasonBreakdown(range),
        getClicksTimeseries(range, days === 1 ? "hour" : "day"),
      ]);
    return { overview, campaignRows, sources, countries, devices, botReasons, series };
  },
  ["dashboard-snapshot"],
  { revalidate: 30 },
);
