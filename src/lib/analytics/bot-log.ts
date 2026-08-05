import type { Filter, ObjectId } from "mongodb";
import type { DateRange } from "@/lib/analytics/queries";
import { campaigns, clickEvents } from "@/lib/db/collections";
import type { BotReason, ClickEvent } from "@/lib/types";

/**
 * Đọc TỪNG LƯỢT bot bị chặn, cho `/admin/nhat-ky-bot`.
 *
 * Tách khỏi `analytics/queries.ts` vì hai file có hợp đồng ngược nhau:
 *   - `queries.ts` là BÁO CÁO: gắn sẵn `EXCLUDE_BOTS`, gộp thành số, và được
 *     `unstable_cache` giữ 30s.
 *   - File này là NHẬT KÝ: chỉ đọc `device: "bot"`, trả về từng bản ghi, và
 *     KHÔNG cache. Người mở nhật ký thường đang thử một link ngay lúc đó rồi
 *     F5 để xem nó rơi vào đâu; cache 30s ở đây làm họ tưởng hệ thống không ghi.
 *
 * VỀ INDEX: cố ý KHÔNG thêm index cho truy vấn này. Nó dùng index `{ ts: -1,
 * source: 1 }` sẵn có để cắt khoảng thời gian rồi lọc `device` trong bộ nhớ.
 * Kém tối ưu, nhưng đây là trang chẩn đoán mở vài lần một ngày, còn index mới
 * thì đánh vào MỌI lượt ghi của hot path `/go` và tốn dung lượng trên M0 512MB.
 * Nếu về sau nó chậm thật, index đúng để thêm là `{ device: 1, ts: -1 }`.
 */

export const BOT_LOG_PAGE_SIZE = 50;

export interface BotLogRow {
  clickId: string;
  ts: Date;
  reason: string;
  /** Tên chiến dịch; `null` nếu campaign đã bị xoá sau khi click được ghi. */
  campaignName: string | null;
  campaignId: string;
  source: string;
  country: string;
  userAgent: string | null;
}

export interface BotLogPage {
  rows: BotLogRow[];
  total: number;
  /** 1-based, đã kẹp vào khoảng hợp lệ. */
  page: number;
  pageCount: number;
}

export interface BotLogFilter {
  range: DateRange;
  reason?: BotReason;
  campaignId?: ObjectId;
  page: number;
}

export async function listBotClicks(filter: BotLogFilter): Promise<BotLogPage> {
  const col = await clickEvents();

  const match: Filter<ClickEvent> = {
    ts: { $gte: filter.range.from, $lte: filter.range.to },
    device: "bot",
    ...(filter.reason ? { botReason: filter.reason } : {}),
    ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
  };

  const total = await col.countDocuments(match);
  const pageCount = Math.max(1, Math.ceil(total / BOT_LOG_PAGE_SIZE));
  // Kẹp SAU khi biết total: `?page=999` phải rơi về trang cuối, không phải ra
  // bảng rỗng — bảng rỗng ở trang chẩn đoán đọc ra như "không có bot nào".
  const page = Math.min(Math.max(1, filter.page), pageCount);

  const docs = await col
    .find(match, {
      projection: {
        clickId: 1,
        ts: 1,
        botReason: 1,
        campaignId: 1,
        source: 1,
        "geo.country": 1,
        userAgent: 1,
      },
    })
    .sort({ ts: -1 })
    .skip((page - 1) * BOT_LOG_PAGE_SIZE)
    .limit(BOT_LOG_PAGE_SIZE)
    .toArray();

  const names = await campaignNames(docs.map((d) => d.campaignId));

  return {
    rows: docs.map((doc) => ({
      clickId: doc.clickId,
      ts: doc.ts,
      reason: doc.botReason ?? "unknown",
      campaignId: doc.campaignId.toString(),
      campaignName: names.get(doc.campaignId.toString()) ?? null,
      source: doc.source,
      country: doc.geo?.country ?? "unknown",
      userAgent: doc.userAgent ?? null,
    })),
    total,
    page,
    pageCount,
  };
}

/**
 * Chỉ nạp tên của các campaign THỰC SỰ có trên trang hiện tại ($in theo id đã
 * dedupe), không nạp cả collection: trang này phân trang nên số id tối đa là
 * `BOT_LOG_PAGE_SIZE`, còn collection campaigns thì không có trần.
 */
async function campaignNames(ids: ObjectId[]): Promise<Map<string, string>> {
  const unique = [...new Map(ids.map((id) => [id.toString(), id])).values()];
  if (unique.length === 0) return new Map();

  const col = await campaigns();
  const docs = await col
    .find({ _id: { $in: unique } }, { projection: { name: 1 } })
    .toArray();

  return new Map(docs.map((doc) => [doc._id.toString(), doc.name]));
}

export interface CampaignChoice {
  id: string;
  name: string;
}

/** Cho ô lọc theo chiến dịch. Gồm cả campaign đã tạm dừng — bot vẫn crawl chúng. */
export async function listCampaignChoices(): Promise<CampaignChoice[]> {
  const col = await campaigns();
  const docs = await col
    .find({}, { projection: { name: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((doc) => ({ id: doc._id.toString(), name: doc.name }));
}
