import type { ReactNode } from "react";

/**
 * Nội dung blog dạng MODULE TSX, không phải bản ghi trong MongoDB.
 *
 * Vì sao chọn cách này:
 * - Trang blog render tĩnh lúc build → 0 truy vấn DB, 0 compute lúc chạy. Quan
 *   trọng với ràng buộc chi phí trong AGENTS.md (Hobby ~100GB bandwidth).
 * - Bài viết vào git → có history, có diff, review được như code.
 * - Thân bài là JSX nên nhúng được component thật (`PromoBox` có
 *   `rel="nofollow sponsored"`) thay vì phải bịa cú pháp markdown riêng.
 *
 * ĐÁNH ĐỔI phải biết: người không biết code KHÔNG tự đăng bài được — mỗi bài là
 * một commit + một lần deploy. Nếu sau này cần người ngoài viết bài, chuyển sang
 * collection `posts` trong Mongo + CRUD trong admin; lúc đó nhớ giữ ISR để không
 * bắn truy vấn DB mỗi lượt xem.
 */

/**
 * Chuyên mục của website nội dung. Bảy mục cố ý phủ nhiều mảng khác nhau — đây là
 * site tổng hợp, không phải blog một ngành.
 *
 * Đổi/thêm slug ở đây thì phải sửa đồng thời: `CATEGORIES` trong `taxonomy.ts`,
 * `MAIN_NAV`/`FOOTER_NAV` trong `lib/site.ts`, `COVER_MOTIF` trong
 * `components/site.tsx` (mỗi chuyên mục có một hình bìa riêng), và `category` của
 * từng bài. TypeScript bắt được tất cả nên đừng bỏ qua lỗi build.
 *
 * KHÔNG thêm chuyên mục về y tế/thuốc, đầu tư/chứng khoán, pháp lý hay chính trị:
 * đó là các mảng "nhạy cảm" mà site này cố ý không viết (xem `Post.kind` và
 * `/dieu-khoan`). Nội dung ở đây là đồ đạc, chi tiêu trong nhà và việc thường ngày.
 */
export type CategorySlug =
  | "cong-nghe"
  | "tai-chinh"
  | "doi-song"
  | "nha-cua"
  | "bep"
  | "di-chuyen"
  | "lam-viec";

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Dùng cho meta description của trang chuyên mục. */
  description: string;
}

export interface Author {
  id: string;
  name: string;
  role: string;
  bio: string;
}

export interface PostCoverImage {
  /** Đường dẫn ảnh (WebP <= 200KB, relative hoac absolute URL). */
  src: string;
  /** Alt text mô tả ảnh cho screen reader và SEO. */
  alt: string;
}

export interface Post {
  /** Đường dẫn: /blog/<slug>. Chỉ a-z, 0-9, gạch ngang. */
  slug: string;
  title: string;
  /** Vừa là meta description, vừa là đoạn dẫn trên thẻ bài. Giữ 120–160 ký tự. */
  description: string;
  category: CategorySlug;
  /** ISO date (YYYY-MM-DD). Dùng cho sitemap, RSS, JSON-LD. */
  publishedAt: string;
  updatedAt?: string;
  authorId: string;
  /**
   * Số phút đọc — do người viết tự điền, không tính tự động (thân bài là JSX
   * nên không đếm được chữ mà không render). Ước lượng ~200 từ/phút.
   */
  readingMinutes: number;
  /** Đúng MỘT bài được đặt true — bài này chiếm ô lớn trên trang chủ. */
  featured?: boolean;

  /**
   * Dạng bài. Mặc định `"guide"` (hướng dẫn làm một việc).
   *
   * `"review"` = bài giúp CHỌN một món đồ: tiêu chí, so sánh nhóm sản phẩm, chi phí
   * dài hạn. Trang chủ có dải riêng cho nhóm này.
   *
   * ⚠️ RÀNG BUỘC BẮT BUỘC cho `kind: "review"` — đọc trước khi viết bài mới:
   * bài review ở site này **không được kể trải nghiệm không có thật**. Không viết
   * "tôi đã dùng ba tháng", không cho điểm số kiểu 8.5/10, không so sánh hai model
   * cụ thể bằng số đo mà mình không tự đo. Bịa trải nghiệm là cách mất uy tín nhanh
   * nhất với cả người đọc lẫn ad network — và nó vô hiệu hoá đúng thứ site này đang
   * cố xây. Thay vào đó: so sánh theo NHÓM (kiểu máy, tầm giá), nói rõ cơ sở bằng
   * `<MethodNote>`, và luôn kèm cách người đọc tự kiểm trên món đồ trước mặt họ.
   * Khi nào có bài dùng thật thì mới được viết ở ngôi "tôi đã dùng".
   */
  kind?: "guide" | "review";

  /** Ảnh bìa thật nếu có. Nếu không có, hệ thống tự render art SVG theo slug hoặc category. */
  cover?: PostCoverImage;

  tags: string[];
  /** Thân bài. Trang chi tiết bọc trong <div class="prose">. */
  body: () => ReactNode;
}
