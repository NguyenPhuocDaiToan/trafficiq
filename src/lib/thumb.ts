/**
 * Quy ước đường dẫn + kích thước của thumbnail ảnh bìa.
 *
 * NGUỒN DUY NHẤT cho ba chỗ phải khớp nhau: `scripts/generate-thumbs.ts` (sinh
 * file), `PostThumb` trong `components/site.tsx` (đọc file), và
 * `scripts/check-content.ts` (gác việc file có tồn tại và đúng cỡ). Ba chỗ tự viết
 * lại đường dẫn là ba chỗ có thể lệch nhau, và kiểu lệch đó chỉ hiện ra bằng một ô
 * trống trên trang chủ.
 *
 * VÌ SAO CẦN FILE RIÊNG chứ không dùng luôn ảnh bìa co nhỏ bằng CSS: bất biến trong
 * AGENTS.md cấm đi qua Image Optimization của Next, nên `<img>` trỏ vào ảnh gốc sẽ
 * tải đủ 1200×675 (54–181KB) rồi mới co xuống 80px. Dải "Theo chuyên mục" có tới 21
 * dòng — đó là cách biến trang chủ từ 282KB thành 1,2MB để hiện những ô bé.
 */

/**
 * Cỡ file thật. Gấp đôi cỡ hiển thị (`THUMB_DISPLAY_WIDTH`) để màn hình mật độ 2x
 * không bị nhoè — đúng 2x, không phải 1,67x: ảnh gốc là 16:9 chằn chặn (1200×675)
 * nên 160×90 là thu nhỏ thuần, không crop, không lệch tỉ lệ so với `aspect-video`
 * mà `PostCover` dùng ở mọi chỗ khác.
 */
export const THUMB_WIDTH = 160;
export const THUMB_HEIGHT = 90;

/** Cỡ hiển thị trong danh sách. Xem ghi chú bố cục ở `PostThumb`. */
export const THUMB_DISPLAY_WIDTH = 80;
export const THUMB_DISPLAY_HEIGHT = 45;

/** Thư mục con của thumbnail, tính từ `public/`. */
const THUMB_DIR = "/images/blog/thumb";

/**
 * Đổi đường dẫn ảnh bìa sang đường dẫn thumbnail tương ứng.
 * Trả `null` cho ảnh không nằm trong `public/images/blog` (ví dụ URL tuyệt đối tới
 * CDN): những ảnh đó không có thumbnail sinh sẵn, và chỗ gọi phải tự lo fallback
 * thay vì trỏ vào một file chắc chắn không tồn tại.
 */
export function thumbSrc(coverSrc: string): string | null {
  const match = /^\/images\/blog\/([a-z0-9-]+\.webp)$/.exec(coverSrc);
  return match ? `${THUMB_DIR}/${match[1]}` : null;
}
