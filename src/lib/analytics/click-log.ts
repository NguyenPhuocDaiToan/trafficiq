import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import type { DateRange } from "@/lib/analytics/queries";
import { EXCLUDE_BOTS } from "@/lib/analytics/queries";
import { campaigns, clickEvents } from "@/lib/db/collections";
import type { BotReason, ClickEvent, WeakSignal } from "@/lib/types";

/**
 * Đọc TỪNG LƯỢT click, cho `/admin/nhat-ky`. Hai nhánh: bot bị chặn và click
 * thường.
 *
 * Tách khỏi `analytics/queries.ts` vì hai file có hợp đồng ngược nhau:
 *   - `queries.ts` là BÁO CÁO: gộp thành số, và được `unstable_cache` giữ 30s.
 *   - File này là NHẬT KÝ: trả về từng bản ghi, và KHÔNG cache. Người mở nhật ký
 *     thường đang thử một link ngay lúc đó rồi F5 để xem nó rơi vào đâu; cache
 *     30s ở đây làm họ tưởng hệ thống không ghi.
 *
 * Điều kiện "không phải bot" lấy từ `EXCLUDE_BOTS` của queries.ts chứ không viết
 * lại — nhật ký và dashboard phải nói cùng một con số về cùng một tập dữ liệu.
 *
 * VỀ INDEX: cố ý KHÔNG thêm index cho hai truy vấn này. Chúng dùng index
 * `{ ts: -1, source: 1 }` sẵn có để cắt khoảng thời gian rồi lọc `device` trong
 * bộ nhớ. Kém tối ưu, nhưng đây là trang chẩn đoán mở vài lần một ngày, còn
 * index mới thì đánh vào MỌI lượt ghi của hot path `/go` và tốn dung lượng trên
 * M0 512MB. Nếu về sau chậm thật, index đúng để thêm là `{ device: 1, ts: -1 }`.
 */

export const LOG_PAGE_SIZE = 50;

/** Field chung của hai loại dòng log. */
interface BaseLogRow {
  clickId: string;
  ts: Date;
  /** Tên chiến dịch; `null` nếu campaign đã bị xoá sau khi click được ghi. */
  campaignName: string | null;
  campaignId: string;
  source: string;
  country: string;
  userAgent: string | null;
}

export interface BotLogRow extends BaseLogRow {
  reason: string;
}

export interface HumanLogRow extends BaseLogRow {
  device: string;
  browser: string;
  os: string;
  /** Tín hiệu đáng ngờ nhưng KHÔNG chặn — xem `weakSignals()` trong tracking/ua.ts. */
  weakSignals: WeakSignal[];
}

// ---------------------------------------------------------------------------
// Bot bị chặn — phân trang có số trang
// ---------------------------------------------------------------------------

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
  const pageCount = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  // Kẹp SAU khi biết total: `?trang=999` phải rơi về trang cuối, không phải ra
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
    .skip((page - 1) * LOG_PAGE_SIZE)
    .limit(LOG_PAGE_SIZE)
    .toArray();

  const names = await campaignNames(docs.map((d) => d.campaignId));

  return {
    rows: docs.map((doc) => ({
      ...baseRow(doc, names),
      reason: doc.botReason ?? "unknown",
    })),
    total,
    page,
    pageCount,
  };
}

// ---------------------------------------------------------------------------
// Click thường — con trỏ, chỉ đi tới
// ---------------------------------------------------------------------------

export interface HumanLogPage {
  rows: HumanLogRow[];
  /** Con trỏ cho trang kế; `null` nghĩa là hết. */
  nextCursor: string | null;
}

export interface HumanLogFilter {
  range: DateRange;
  campaignId?: ObjectId;
  /** Con trỏ từ `nextCursor` của lần gọi trước. Không hợp lệ thì bỏ qua. */
  cursor?: string;
}

/**
 * Click của người thật — KHÔNG có số trang, chỉ có "trang sau".
 *
 * Khác nhánh bot một cách có chủ đích. Click thường là tập đông hơn bot hàng
 * chục lần và còn tăng theo traffic, nên hai thứ mà phân trang kiểu số trang bắt
 * buộc phải có đều thành gánh nặng vô ích ở đây:
 *   - `countDocuments` quét toàn bộ khoảng thời gian chỉ để in ra một con số
 *     tổng mà không ai dùng để làm gì.
 *   - `skip(n)` bắt Mongo duyệt rồi bỏ đi n document mỗi lần sang trang, càng đi
 *     sâu càng chậm.
 * Con trỏ không có cả hai: mỗi trang là một range scan bắt đầu đúng chỗ dừng.
 *
 * CON TRỎ LÀ CẶP `(ts, _id)`, không phải riêng `ts`. Hai click trùng nhau tới
 * millisecond là chuyện có thật khi nhiều request đập vào cùng lúc; con trỏ chỉ
 * có `ts` thì `$lt` NUỐT MẤT bản ghi cùng mốc, còn `$lte` thì lặp lại nó ở trang
 * sau. Nuốt mất một dòng đúng là lỗi mà người ta mở log ra để tìm.
 */
export async function listHumanClicks(filter: HumanLogFilter): Promise<HumanLogPage> {
  const col = await clickEvents();
  const after = decodeCursor(filter.cursor);

  const match: Filter<ClickEvent> = {
    ts: { $gte: filter.range.from, $lte: filter.range.to },
    ...EXCLUDE_BOTS,
    ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
    ...(after
      ? { $or: [{ ts: { $lt: after.ts } }, { ts: after.ts, _id: { $lt: after.id } }] }
      : {}),
  };

  // Lấy dư MỘT dòng để biết còn trang sau hay không, thay vì chạy thêm một
  // count. Dòng dư bị cắt trước khi trả về.
  const docs = await col
    .find(match, {
      projection: {
        clickId: 1,
        ts: 1,
        campaignId: 1,
        source: 1,
        "geo.country": 1,
        device: 1,
        browser: 1,
        os: 1,
        weakSignals: 1,
        userAgent: 1,
      },
    })
    .sort({ ts: -1, _id: -1 })
    .limit(LOG_PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > LOG_PAGE_SIZE;
  const page = hasMore ? docs.slice(0, LOG_PAGE_SIZE) : docs;
  const names = await campaignNames(page.map((d) => d.campaignId));
  const last = page.at(-1);

  return {
    rows: page.map((doc) => ({
      ...baseRow(doc, names),
      device: doc.device,
      browser: doc.browser,
      os: doc.os,
      weakSignals: doc.weakSignals ?? [],
    })),
    nextCursor: hasMore && last ? encodeCursor(last.ts, last._id) : null,
  };
}

// ---------------------------------------------------------------------------

function baseRow(
  doc: Pick<ClickEvent, "clickId" | "ts" | "campaignId" | "source" | "geo" | "userAgent">,
  names: Map<string, string>,
): BaseLogRow {
  return {
    clickId: doc.clickId,
    ts: doc.ts,
    campaignId: doc.campaignId.toString(),
    campaignName: names.get(doc.campaignId.toString()) ?? null,
    source: doc.source,
    country: doc.geo?.country ?? "unknown",
    userAgent: doc.userAgent ?? null,
  };
}

/** `<epoch ms>_<ObjectId hex>` — cả hai phần đều an toàn trong query string. */
function encodeCursor(ts: Date, id: ObjectId): string {
  return `${ts.getTime()}_${id.toHexString()}`;
}

/**
 * Con trỏ đến từ URL nên phải coi là chuỗi người dùng gõ tay. Sai định dạng thì
 * trả `undefined` (= về đầu danh sách) chứ KHÔNG throw: một ký tự rơi rụng khi
 * copy link không được thành trang lỗi 500. Regex 24 hex chạy TRƯỚC constructor
 * chính vì `new ObjectId()` throw với chuỗi sai dạng.
 */
function decodeCursor(raw: string | undefined): { ts: Date; id: ObjectId } | undefined {
  if (!raw) return undefined;

  const [msPart, idPart] = raw.split("_");
  const ms = Number(msPart);
  if (!msPart || !Number.isSafeInteger(ms) || !idPart || !/^[0-9a-f]{24}$/i.test(idPart)) {
    return undefined;
  }

  return { ts: new Date(ms), id: new ObjectId(idPart) };
}

/**
 * Chỉ nạp tên của các campaign THỰC SỰ có trên trang hiện tại ($in theo id đã
 * dedupe), không nạp cả collection: một trang tối đa `LOG_PAGE_SIZE` dòng nên số
 * id cũng chỉ tới đó, còn collection campaigns thì không có trần.
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
