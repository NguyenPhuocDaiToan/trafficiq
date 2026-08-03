import type { MetadataRoute } from "next";
import { allPosts } from "@/content";
import { CATEGORIES } from "@/content/taxonomy";
import { publicBaseUrl } from "@/lib/env";

/**
 * Sitemap chỉ gồm nội dung công khai muốn được index.
 *
 * KHÔNG đưa `/c/[slug]` vào: đó là trang đích của traffic quảng cáo, không phải
 * trang nhắm tìm kiếm tự nhiên. Đưa vào sitemap sẽ báo với search engine rằng
 * chúng là nội dung chính của site — sai tín hiệu, và với chiến dịch đã tạm dừng
 * thì còn tạo hàng loạt URL chết. Nó cũng bắt sitemap phải truy vấn DB mỗi lần
 * được gọi, trong khi cả sitemap này hiện là tĩnh.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = publicBaseUrl();
  const posts = allPosts();

  /** Mốc thời gian mới nhất trong toàn bộ bài — dùng cho trang danh sách. */
  const newestPostDate = posts[0]?.updatedAt ?? posts[0]?.publishedAt;

  return [
    {
      url: baseUrl,
      lastModified: newestPostDate,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: newestPostDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt ?? post.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...CATEGORIES.map((category) => ({
      url: `${baseUrl}/chuyen-muc/${category.slug}`,
      lastModified: newestPostDate,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Trang tĩnh: đổi rất ít nhưng phải index được — ad network và người đọc đều
    // tìm chúng, và search engine dùng chúng làm tín hiệu site thật.
    ...["/gioi-thieu", "/lien-he", "/dieu-khoan", "/chinh-sach-bao-mat", "/tiet-lo-lien-ket"].map(
      (path) => ({
        url: `${baseUrl}${path}`,
        changeFrequency: "yearly" as const,
        priority: 0.4,
      }),
    ),
  ];
}
