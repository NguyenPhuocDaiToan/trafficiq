/**
 * Thông tin site công khai — NGUỒN DUY NHẤT.
 *
 * Mọi trang public (trang chủ, blog, giới thiệu, liên hệ, điều khoản, privacy,
 * sitemap, RSS) đọc từ đây. Đổi tên/email/pháp nhân thì sửa đúng một chỗ này.
 *
 * ⚠️ TRƯỚC KHI CHẠY TRAFFIC THẬT: các field trong `legal` là CHỖ TRỐNG, không
 * phải dữ liệu thật. Ad network và cơ quan quản lý đều kiểm mục này. Điền tên
 * pháp nhân, địa chỉ, mã số thuế thật rồi cho legal review — đặc biệt phần
 * privacy nếu có traffic EU (GDPR) hoặc Singapore (PDPA).
 */

export const SITE = {
  name: "TrafficIQ",
  tagline: "Blog về affiliate và performance marketing",
  description:
    "Ghi chép thực chiến về affiliate marketing, đo lường chuyển đổi và tối ưu " +
    "chi phí traffic — viết từ góc nhìn người tự dựng hệ thống tracking.",

  /** Dùng cho hreflang, RSS, JSON-LD. */
  locale: "vi-VN",

  /**
   * Email liên hệ. Đặt qua env để deploy thật không phải sửa code.
   * Fallback chỉ để dev chạy được, KHÔNG phải hộp thư thật.
   */
  get contactEmail(): string {
    return process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "lien-he@example.com";
  },

  legal: {
    /** null = chưa điền. Trang điều khoản/privacy sẽ hiện cảnh báo thay vì bịa. */
    entityName: process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? null,
    address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? null,
    taxId: process.env.NEXT_PUBLIC_LEGAL_TAX_ID ?? null,
  },

  /** Ngày hiệu lực của điều khoản & privacy. Cập nhật khi sửa nội dung. */
  policyUpdatedAt: "2026-08-03",
} as const;

/** Điều hướng chính trên header. Thứ tự có ý nghĩa. */
export const MAIN_NAV = [
  { href: "/blog", label: "Bài viết" },
  { href: "/chuyen-muc/do-luong", label: "Đo lường" },
  { href: "/chuyen-muc/toi-uu", label: "Tối ưu" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
] as const;

/** Footer chia cột — nhóm theo mục đích, không phải một hàng link rời rạc. */
export const FOOTER_NAV = [
  {
    heading: "Nội dung",
    links: [
      { href: "/blog", label: "Tất cả bài viết" },
      { href: "/chuyen-muc/do-luong", label: "Đo lường & tracking" },
      { href: "/chuyen-muc/toi-uu", label: "Tối ưu chiến dịch" },
      { href: "/chuyen-muc/van-hanh", label: "Vận hành & chi phí" },
    ],
  },
  {
    heading: "Về site",
    links: [
      { href: "/gioi-thieu", label: "Giới thiệu" },
      { href: "/lien-he", label: "Liên hệ" },
      { href: "/feed.xml", label: "RSS" },
    ],
  },
  {
    heading: "Pháp lý",
    links: [
      { href: "/chinh-sach-bao-mat", label: "Chính sách quyền riêng tư" },
      { href: "/dieu-khoan", label: "Điều khoản sử dụng" },
      { href: "/tiet-lo-lien-ket", label: "Tiết lộ liên kết affiliate" },
    ],
  },
] as const;
