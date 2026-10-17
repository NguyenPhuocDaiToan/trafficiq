/**
 * Mã xác minh và script của mạng quảng cáo / affiliate gắn trên SITE CÔNG KHAI.
 *
 * CHỈ gắn ở `(site)/layout.tsx`. Không gắn vào `/admin` (không phải nội dung công khai), `/c/[slug]`
 * (landing không có gì ngoài một CTA — bất biến 12 — và không cần thêm script bên thứ ba), hay `/go/[token]`
 * (route đo click, trả HTML thô).
 *
 * ⚠️ MỖI mục ở đây là một script/thẻ bên thứ ba ảnh hưởng tới dữ liệu người đọc, nên đổi nó thì PHẢI sửa cùng
 * lúc `/chinh-sach-bao-mat`, `/tiet-lo-lien-ket` và `/gioi-thieu` (bất biến 11). Đã từng có câu "không đặt cookie
 * nào, không có mã theo dõi của bên thứ ba" ở cả ba trang — thêm script mà không sửa là tuyên bố sai sự thật
 * với người đọc. Xem bất biến 22 trong AGENTS.md.
 */

/**
 * Thẻ xác minh website của mạng quảng cáo (hiện thành `<meta name="clckd" content="…">` trong `<head>`).
 * Mã này công khai theo thiết kế — nó phải nằm trong HTML để nhà cung cấp quét được.
 */
export const AD_NETWORK_VERIFICATION = {
  name: "clckd",
  content: "f86cd3a3be80bd3822b4f26f7b3f2dc6",
} as const;

/**
 * Skimlinks: dịch vụ affiliate tự động, chuyển các liên kết ra ngoài tới nhà bán nằm trong mạng của họ thành
 * liên kết có hoa hồng NGAY LÚC BẤM. Chỉ nạp ở bản production (xem layout) để dev/test không phát sinh
 * lượt bấm và cookie giả.
 */
export const SKIMLINKS_SRC = "https://s.skimresources.com/js/311224X1799722.skimlinks.js";
