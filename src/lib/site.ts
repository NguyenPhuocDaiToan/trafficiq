/**
 * Thông tin site công khai — NGUỒN DUY NHẤT.
 *
 * Mọi trang public (trang chủ, blog, giới thiệu, liên hệ, điều khoản, privacy,
 * sitemap, RSS) đọc từ đây. Đổi tên/email/pháp nhân thì sửa đúng một chỗ này.
 *
 * ⚠️ HAI CÁI TÊN, ĐỪNG TRỘN:
 *   - `SITE.name` = tên **thương hiệu công khai** của website nội dung (hiện:
 *     "InsightDaily"). Đây là tên người đọc và search engine thấy: header,
 *     footer, OG, RSS, JSON-LD.
 *   - **TrafficIQ** = tên **nội bộ** của hệ thống (repo, `/admin/**`, tài liệu
 *     kỹ thuật). Cố ý không hiện ra ngoài: người đọc một bài về điện thoại không
 *     có lý do gì phải thấy tên một công cụ tracking, và để tên đó ở surface công
 *     khai làm site trông như trang thu traffic thay vì trang nội dung.
 * Vì vậy `/admin/**` hard-code "TrafficIQ" là ĐÚNG, không phải chỗ bỏ sót.
 *
 * ⚠️ TRƯỚC KHI CHẠY TRAFFIC THẬT: các field trong `legal` là CHỖ TRỐNG, không
 * phải dữ liệu thật. Ad network và cơ quan quản lý đều kiểm mục này. Điền tên
 * pháp nhân, địa chỉ, mã số thuế thật rồi cho legal review — đặc biệt phần
 * privacy nếu có traffic EU (GDPR) hoặc Singapore (PDPA).
 */

export const SITE = {
  /*
   * `name` = tên thương hiệu của website. `owner` = tên người viết, hiện ở byline
   * mỗi bài và ở JSON-LD `author`/`publisher` (`"@type": "Person"`). Hai field
   * riêng vì đây là hai vai khác nhau: tên site có thể đổi mà byline không đổi.
   * Đổi tên thì sửa đúng ở đây, không rắc tên vào component.
   *
   * ⚠️ HAI RỦI RO ĐÃ BIẾT CỦA TÊN NÀY — chủ dự án chọn và chấp nhận, ghi lại để
   * sau không ai tưởng là chỗ bỏ sót:
   *
   * 1. Tên tiếng Anh có chữ "Insight" trên một site nội dung tiếng Việt đọc ra
   *    như tên một công cụ analytics/marketing. Đó chính là tín hiệu mà bất biến
   *    #13 trong AGENTS.md muốn tránh khi tách tên công khai khỏi "TrafficIQ".
   * 2. "Daily" hứa ra bài hằng ngày. Nhịp thật hiện tại là theo tuần. Nếu nhịp
   *    không lên hằng ngày thì đừng viết thêm câu nào khẳng định "mỗi ngày một
   *    bài" ở UI hay metadata — một cái tên đã đủ rủi ro, thêm câu quảng cáo sai
   *    sự thật là chuyện khác.
   *
   * Hiển thị dạng một từ ("InsightDaily") theo đúng cách chủ dự án viết. Muốn
   * masthead trông giống tên một tờ báo hơn thì đổi thành "Insight Daily" —
   * sửa đúng dòng dưới, không có chỗ nào khác phụ thuộc vào dạng viết liền.
   */
  name: "InsightDaily",
  owner: "Toàn",
  tagline: "Tính kỹ một lần, dùng được lâu",
  description:
    "Ghi chép dùng được ngay về công nghệ, tiền bạc và đời sống: chọn đồ thế nào, " +
    "khoản phí nào bỏ được, và những việc nhỏ làm được hôm nay.",

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

/**
 * Điều hướng chính trên header. Thứ tự có ý nghĩa: mục dày bài đứng trước.
 *
 * KHÔNG liệt kê cả bảy chuyên mục ở đây. Dải nav là `overflow-x-auto` nên nó
 * không phá layout, nhưng một dải phải cuộn mới thấy hết thì mục cuối coi như
 * không tồn tại với phần lớn người đọc. Bốn chuyên mục dày nhất + "Bài viết" là
 * đủ; ba mục còn lại vào footer và vào dải chuyên mục ở trang chủ.
 */
export const MAIN_NAV = [
  { href: "/blog", label: "Bài viết" },
  { href: "/chuyen-muc/cong-nghe", label: "Công nghệ" },
  { href: "/chuyen-muc/tai-chinh", label: "Tiền bạc" },
  { href: "/chuyen-muc/nha-cua", label: "Nhà cửa" },
  { href: "/chuyen-muc/bep", label: "Bếp" },
] as const;

/**
 * Footer chia cột — nhóm theo mục đích, không phải một hàng link rời rạc.
 *
 * Cột "Nội dung" liệt kê ĐỦ bảy chuyên mục: đây là chỗ duy nhất trên site mà
 * người đọc thấy được toàn bộ bản đồ nội dung, và cũng là đường để crawler tới
 * được mọi trang chuyên mục từ bất kỳ trang nào.
 */
export const FOOTER_NAV = [
  {
    heading: "Chuyên mục",
    links: [
      { href: "/blog", label: "Tất cả bài viết" },
      { href: "/chuyen-muc/cong-nghe", label: "Công nghệ & thiết bị" },
      { href: "/chuyen-muc/tai-chinh", label: "Tiền bạc & chi tiêu" },
      { href: "/chuyen-muc/nha-cua", label: "Nhà cửa & gia dụng" },
      { href: "/chuyen-muc/bep", label: "Bếp & thực phẩm" },
      { href: "/chuyen-muc/di-chuyen", label: "Đi lại & xe cộ" },
      { href: "/chuyen-muc/lam-viec", label: "Làm việc & học tập" },
      { href: "/chuyen-muc/doi-song", label: "Đời sống & kỹ năng" },
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
    ],
  },
] as const;

/**
 * Template tiêu đề trang, dùng ở HAI nơi phải khớp nhau:
 *   - `metadata.title.template` của root layout — Next tự thay `%s`.
 *   - `ogCardHeadHtml()` (lib/landing/og-card.ts) — dựng `<title>` bằng HTML
 *     thô cho `/go/[token]`, không có Next thay hộ nên phải tự gọi `pageTitle()`.
 *
 * Giữ chuỗi ở một chỗ vì hai đường đó từng lệch nhau: `/c/[slug]` ra
 * "… · InsightDaily" còn `/go` ra tiêu đề trần.
 */
export const TITLE_TEMPLATE = `%s · ${SITE.name}` as const;

export function pageTitle(title: string): string {
  return TITLE_TEMPLATE.replace("%s", title);
}
