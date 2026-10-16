import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadPath } from "@/lib/media/path";

/**
 * Driver `disk`: ghi ảnh ra đĩa của máy chạy app. Trên VM, `UPLOAD_DIR` PHẢI nằm ngoài thư mục
 * deploy (ví dụ `/var/lib/trafficiq/uploads`) — để trong thư mục code thì mỗi lần deploy lại
 * (xoá và dựng lại thư mục) là mất ảnh.
 *
 * Trả đường dẫn tương đối `/uploads/<tên>`, phục vụ bởi `app/uploads/[file]/route.ts` (hoặc nginx).
 */
export async function saveToDisk(dir: string, file: string, data: Buffer): Promise<string> {
  const target = path.join(dir, file);

  await mkdir(dir, { recursive: true });

  // Tên gắn với nội dung nên file đã có là file đúng — khỏi ghi lại.
  const exists = await stat(target).then(
    () => true,
    () => false,
  );

  if (!exists) {
    // Ghi ra tên tạm rồi `rename`: rename trong cùng thư mục là nguyên tử, nên request đọc đúng
    // lúc đó thấy file đầy đủ hoặc 404, không bao giờ thấy file cụt.
    const tmp = path.join(dir, `.${file}.${randomUUID()}.tmp`);
    try {
      // `wx`: không bao giờ ghi đè hay đi theo một file/symlink có sẵn dưới tên tạm (tên chứa
      // UUID nên không đoán được, nhưng cờ này làm điều đó thành bất biến chứ không phải may mắn).
      await writeFile(tmp, data, { flag: "wx", mode: 0o644 });
      await rename(tmp, target);
    } catch (err) {
      // Đĩa đầy giữa chừng hay rename lỗi không được để lại file tạm mồ côi: lặp lại nhiều lần
      // thì chính các file rác đó làm đầy đĩa.
      await unlink(tmp).catch(() => {});
      throw err;
    }
  }

  return uploadPath(file);
}

/** Đọc lại một file đã lưu, cho route `/uploads/[file]`. `null` khi không có. */
export async function readFromDisk(dir: string, file: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(dir, file));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
