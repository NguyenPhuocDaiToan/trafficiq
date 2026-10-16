/**
 * Đường dẫn ảnh admin đã tải lên. Tách khỏi `store.ts` (import `node:fs`) để schema
 * zod và các nơi khác dùng được mà không kéo cả module đĩa vào.
 *
 * Tên file = sha256 (hex) của chính byte ảnh đã xử lý + đuôi. Hệ quả có chủ đích:
 *  - Cùng một ảnh tải hai lần ra cùng một URL, chỉ có một file.
 *  - Nội dung KHÔNG BAO GIỜ đổi dưới một URL → phục vụ được với `immutable`, sửa ảnh
 *    = tên mới = URL mới, không cần purge cache.
 *  - Tên file chỉ có thể khớp regex này, nên không có `..`, `/`, `\` nào lọt vào
 *    đường dẫn đĩa — đây là toàn bộ phòng thủ path traversal của route phục vụ.
 */
export const UPLOAD_FILE_RE = /^[a-f0-9]{64}\.(?:webp|jpg)$/;

const UPLOAD_PATH_RE = /^\/uploads\/[a-f0-9]{64}\.(?:webp|jpg)$/;

export function uploadPath(file: string): string {
  return `/uploads/${file}`;
}

/** Giá trị field ảnh có phải ảnh do site này lưu (đường dẫn tương đối)? */
export function isUploadPath(value: string): boolean {
  return UPLOAD_PATH_RE.test(value);
}

/**
 * Crawler không hiểu đường dẫn tương đối — og:image phải là URL tuyệt đối. Ảnh tải
 * lên được lưu dạng tương đối để đổi domain không làm hỏng ảnh đã lưu, nên chỗ nào
 * xuất ra ngoài (thẻ OG) phải qua hàm này.
 */
export function absoluteImageUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  return isUploadPath(value) ? `${baseUrl}${value}` : value;
}
