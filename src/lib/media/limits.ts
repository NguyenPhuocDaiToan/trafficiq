/**
 * Giới hạn upload ảnh, dùng chung cho server (`process.ts`, route upload) và client
 * (`image-url-field.tsx`). Tách riêng khỏi `process.ts` vì file đó import `sharp` — một module
 * native không được phép lọt vào bundle của trình duyệt.
 */

/**
 * Trần của file GỬI LÊN. Vercel cắt body request của Function ở 4,5MB (không nâng được), nên 4MB
 * là con số lớn nhất còn trả được lỗi có số liệu thay vì lỗi 413 trần của nền tảng.
 *
 * Ảnh chụp từ điện thoại thường 3–12MB, vượt trần này — vì vậy client tự thu nhỏ ảnh trước khi
 * gửi (`client-shrink.ts`) thay vì bắt admin đi nén tay. Server vẫn là nơi quyết định cuối cùng.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Dư một chút cho phần đóng gói multipart (boundary, tên field) ngoài chính file. */
export const MULTIPART_OVERHEAD = 64 * 1024;

/** Ảnh lớn hơn mức này được thu nhỏ trong trình duyệt trước khi gửi. */
export const CLIENT_SHRINK_ABOVE_BYTES = 2 * 1024 * 1024;

/**
 * Cạnh dài tối đa khi thu nhỏ ở client: gấp đôi ảnh lớn nhất server xuất ra (hero 1400px), nên
 * bước thu nhỏ cuối cùng vẫn do Lanczos của sharp làm từ ảnh còn dư độ phân giải — lần nén ở client
 * không ảnh hưởng độ nét của kết quả cuối.
 */
export const CLIENT_MAX_SIDE = 2800;

/** "6,2MB", "840KB", "512B" — dấu phẩy thập phân theo tiếng Việt. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")}MB`;
}
