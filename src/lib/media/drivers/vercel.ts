import { put } from "@vercel/blob";
import { StorageNotConfiguredError } from "@/lib/media/storage-config";

/**
 * Driver `vercel`: Vercel Blob. Trả URL công khai tuyệt đối của blob.
 *
 * Tên blob = tên file (sha256 của nội dung) nên cùng một ảnh tải hai lần ra cùng một URL.
 * `allowOverwrite`: cùng tên = cùng byte; thiếu cờ này thì tải lại ảnh đã có sẽ ném lỗi "đã tồn tại".
 * `addRandomSuffix: false`: tên đã gắn với nội dung, thêm hậu tố chỉ làm một ảnh có nhiều URL.
 *
 * Store phải được tạo ở chế độ PUBLIC — store private không có URL xem được cho người đọc landing.
 * Chế độ này chọn lúc tạo store; chọn nhầm Private thì mọi `put` public bị từ chối với
 * "Cannot use public access on a private store", và lỗi đó được dịch thành hướng dẫn rõ ràng
 * bên dưới thay vì rơi vào nhánh "lỗi máy chủ" chung — admin không có gì để làm với câu đó.
 */
export async function saveToVercelBlob(
  token: string,
  file: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  try {
    const blob = await put(`campaign-images/${file}`, data, {
      access: "public",
      token,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  } catch (err) {
    if (err instanceof Error && /private store/i.test(err.message)) {
      throw new StorageNotConfiguredError(
        "Vercel Blob store đang ở chế độ Private nên không dùng được cho ảnh công khai. Tạo một Blob store ở chế độ Public, Connect vào project, cập nhật BLOB_READ_WRITE_TOKEN rồi redeploy.",
      );
    }
    throw err;
  }
}
