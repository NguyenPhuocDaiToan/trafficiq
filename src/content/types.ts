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

export type CategorySlug = "do-luong" | "toi-uu" | "van-hanh";

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
  tags: string[];
  /** Thân bài. Trang chi tiết bọc trong <div class="prose">. */
  body: () => ReactNode;
}
