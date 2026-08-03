import { getDb } from "@/lib/db/client";
import { clickTtlDays } from "@/lib/env";
import {
  COLLECTIONS,
  advertisers,
  campaigns,
  clickEvents,
  contactMessages,
  conversions,
  destinations,
  offers,
  rollups,
} from "@/lib/db/collections";

const TTL_INDEX_NAME = "ts_ttl";

/**
 * TTL index xử lý riêng vì `expireAfterSeconds` thay đổi theo CLICK_TTL_DAYS.
 * createIndex với cùng tên nhưng khác option sẽ throw IndexOptionsConflict
 * (code 85), nên khi đó phải dùng collMod để sửa index đang tồn tại.
 */
async function ensureTtlIndex(): Promise<string> {
  const expireAfterSeconds = clickTtlDays() * 24 * 60 * 60;
  const col = await clickEvents();

  try {
    return await col.createIndex(
      { ts: 1 },
      { name: TTL_INDEX_NAME, expireAfterSeconds },
    );
  } catch (err) {
    const code = (err as { code?: number }).code;
    // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
    if (code !== 85 && code !== 86) throw err;

    const db = await getDb();
    await db.command({
      collMod: COLLECTIONS.clickEvents,
      index: { name: TTL_INDEX_NAME, expireAfterSeconds },
    });
    return `${TTL_INDEX_NAME} (đã cập nhật → ${expireAfterSeconds}s)`;
  }
}

/**
 * Tạo toàn bộ index. Idempotent — createIndex bỏ qua nếu index đã tồn tại
 * với cùng spec, nên chạy lại bao nhiêu lần cũng được.
 *
 * Chạy bằng: npm run setup:indexes
 */
export async function ensureIndexes(): Promise<string[]> {
  const created: string[] = [];
  const log = (name: string) => created.push(name);

  const advertisersCol = await advertisers();
  log(await advertisersCol.createIndex({ status: 1 }));

  const destinationsCol = await destinations();
  log(await destinationsCol.createIndex({ url: 1 }, { unique: true }));
  log(await destinationsCol.createIndex({ status: 1 }));
  log(await destinationsCol.createIndex({ advertiserId: 1, status: 1 }));

  const campaignsCol = await campaigns();
  // Token mờ của redirect — hot path, phải unique + index.
  log(await campaignsCol.createIndex({ token: 1 }, { unique: true }));
  log(await campaignsCol.createIndex({ slug: 1 }, { unique: true }));
  log(await campaignsCol.createIndex({ status: 1 }));

  const offersCol = await offers();
  log(await offersCol.createIndex({ campaignId: 1, status: 1 }));

  const clickEventsCol = await clickEvents();
  // GOTCHA 4.5 — TTL index. Không có cái này thì M0 512MB đầy trong 2–4 tuần.
  log(await ensureTtlIndex());
  // Chống ghi trùng click (retry của emit).
  log(await clickEventsCol.createIndex({ clickId: 1 }, { unique: true }));
  // Cho aggregation dashboard.
  log(await clickEventsCol.createIndex({ campaignId: 1, ts: -1 }));
  log(await clickEventsCol.createIndex({ ts: -1, source: 1 }));

  const conversionsCol = await conversions();
  // IDEMPOTENT POSTBACK — advertiser gửi lại cùng click_id thì insert fail
  // với duplicate key, ta trả 200 và không đếm 2 lần.
  log(await conversionsCol.createIndex({ clickId: 1 }, { unique: true }));
  log(await conversionsCol.createIndex({ ts: -1 }));
  log(await conversionsCol.createIndex({ campaignId: 1, ts: -1 }));

  const rollupsCol = await rollups();
  log(
    await rollupsCol.createIndex(
      { hour: 1, campaignId: 1, source: 1, country: 1 },
      { unique: true },
    ),
  );
  log(await rollupsCol.createIndex({ hour: -1 }));

  const contactCol = await contactMessages();
  // Hộp thư admin sắp theo mới nhất trước.
  log(await contactCol.createIndex({ createdAt: -1 }));
  // Lọc "chưa xử lý" — mặc định của hộp thư.
  log(await contactCol.createIndex({ handled: 1, createdAt: -1 }));
  // Giới hạn tần suất gửi trong submitContactMessage đếm theo cặp này.
  log(await contactCol.createIndex({ ipHash: 1, createdAt: -1 }));
  // KHÔNG đặt TTL ở collection này: đây là thư người thật gửi, không phải log.

  return created;
}
