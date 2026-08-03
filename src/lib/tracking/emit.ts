import { after } from "next/server";
import { clickEvents } from "@/lib/db/collections";
import type { ClickEvent } from "@/lib/types";

/**
 * GOTCHA 4.1 — async tracking trên serverless.
 *
 * Không có background worker in-process: hàm serverless bị đóng băng ngay sau
 * khi response gửi đi, nên "đẩy vào queue in-memory rồi batch flush" sẽ mất
 * dữ liệu. Cơ chế đúng là `after()` của Next (chạy trên waitUntil của Vercel):
 * response 302 ra trước, việc ghi Mongo chạy sau và KHÔNG chặn redirect.
 *
 * Mọi nơi khác trong app chỉ được biết interface `emit()`. Khi cần thay bằng
 * queue thật (QStash/SQS/Kafka) thì chỉ sửa file này.
 */
export function emit(event: ClickEvent): void {
  after(async () => {
    await writeClickEvent(event);
  });
}

/** Bản await được — dùng trong script, test, hoặc context không có `after()`. */
export async function writeClickEvent(event: ClickEvent): Promise<void> {
  try {
    const col = await clickEvents();
    await col.insertOne(event);
  } catch (err) {
    // Trùng clickId (unique index) = retry của cùng một click → không phải lỗi.
    if (isDuplicateKeyError(err)) return;
    // Tracking KHÔNG BAO GIỜ được làm gãy request. Chỉ log.
    console.error("[tracking] ghi clickEvent thất bại", {
      clickId: event.clickId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}
