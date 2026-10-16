import { createHash } from "node:crypto";
import type { ProcessedImage } from "@/lib/media/process";
import {
  readStorageConfig,
  StorageNotConfiguredError,
  type StorageConfig,
} from "@/lib/media/storage-config";

/**
 * Lưu ảnh đã xử lý và trả về chuỗi để ghi vào field ảnh của campaign. MongoDB chỉ giữ chuỗi này,
 * không giữ byte ảnh.
 *
 * Nơi lưu chọn bằng `STORAGE_DRIVER=disk|vercel|s3` (xem `storage-config.ts`); mỗi driver là một
 * module riêng trong `drivers/` và CHỈ driver được chọn mới được nạp — VM dùng `disk` không phải
 * kéo AWS SDK vào bộ nhớ, và Vercel không đụng tới `node:fs`. Đây là chỗ DUY NHẤT biết ảnh nằm ở
 * đâu: thêm một nơi lưu mới = thêm một driver + một nhánh ở `saveImage`.
 *
 * Tên file = sha256 của byte đã nén + đuôi, dùng chung cho cả ba driver:
 *  - Cùng một ảnh tải hai lần ra cùng một URL, chỉ có một object.
 *  - Nội dung KHÔNG BAO GIỜ đổi dưới một URL → cache được vô thời hạn, sửa ảnh là URL mới.
 *  - Tên không chứa gì do client khai nên không có path traversal / ghi đè object của người khác.
 */

export { StorageNotConfiguredError };

export interface StoredImage {
  /**
   * Giá trị lưu vào field ảnh: `/uploads/<tên>` (disk) hoặc URL tuyệt đối (vercel, s3).
   * Schema nhận cả hai nên đổi driver giữa chừng không làm hỏng campaign cũ.
   */
  url: string;
  bytes: number;
  width: number;
  height: number;
}

const EXTENSION = { "image/webp": "webp", "image/jpeg": "jpg" } as const;

export const CONTENT_TYPE_BY_EXT = { webp: "image/webp", jpg: "image/jpeg" } as const;

export async function saveImage(
  image: ProcessedImage,
  config: StorageConfig = readStorageConfig(),
): Promise<StoredImage> {
  const hash = createHash("sha256").update(image.data).digest("hex");
  const file = `${hash}.${EXTENSION[image.contentType]}`;

  let url: string;
  switch (config.driver) {
    case "disk": {
      const { saveToDisk } = await import("@/lib/media/drivers/disk");
      url = await saveToDisk(config.dir, file, image.data);
      break;
    }
    case "vercel": {
      const { saveToVercelBlob } = await import("@/lib/media/drivers/vercel");
      url = await saveToVercelBlob(config.token, file, image.data, image.contentType);
      break;
    }
    case "s3": {
      const { saveToS3 } = await import("@/lib/media/drivers/s3");
      url = await saveToS3(config, file, image.data, image.contentType);
      break;
    }
  }

  return { url, bytes: image.data.length, width: image.width, height: image.height };
}

/**
 * Thư mục để route `/uploads/[file]` đọc ảnh, hoặc `null` nếu không có gì để phục vụ.
 *
 *  - `disk`: thư mục đang ghi.
 *  - `vercel`/`s3`: ảnh nằm ngoài, route này vô dụng — TRỪ khi `UPLOAD_DIR` được đặt tường minh,
 *    nghĩa là còn ảnh cũ trên đĩa từ lúc dùng `disk` (campaign vẫn trỏ `/uploads/…`). Không đặt
 *    thì trả `null` → 404, thay vì ném lỗi cấu hình trên một route công khai.
 */
function diskDirForServing(env: Record<string, string | undefined> = process.env): string | null {
  try {
    const config = readStorageConfig(env);
    if (config.driver === "disk") return config.dir;
  } catch {
    // cấu hình sai: rơi xuống nhánh `UPLOAD_DIR` tường minh bên dưới
  }
  return env.UPLOAD_DIR?.trim() || null;
}

export async function readUpload(file: string): Promise<Buffer | null> {
  const dir = diskDirForServing();
  if (!dir) return null;
  const { readFromDisk } = await import("@/lib/media/drivers/disk");
  return readFromDisk(dir, file);
}
