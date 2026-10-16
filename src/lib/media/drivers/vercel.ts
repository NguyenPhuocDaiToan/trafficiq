import { put } from "@vercel/blob";

/**
 * Driver `vercel`: Vercel Blob. Trả URL công khai tuyệt đối của blob.
 *
 * Tên blob = tên file (sha256 của nội dung) nên cùng một ảnh tải hai lần ra cùng một URL.
 * `allowOverwrite`: cùng tên = cùng byte; thiếu cờ này thì tải lại ảnh đã có sẽ ném lỗi "đã tồn tại".
 * `addRandomSuffix: false`: tên đã gắn với nội dung, thêm hậu tố chỉ làm một ảnh có nhiều URL.
 *
 * Store phải được tạo ở chế độ PUBLIC — store private không có URL xem được cho người đọc landing.
 */
export async function saveToVercelBlob(
  token: string,
  file: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const blob = await put(`campaign-images/${file}`, data, {
    access: "public",
    token,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return blob.url;
}
