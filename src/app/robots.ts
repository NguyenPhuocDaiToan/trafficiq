import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/env";

/**
 * robots.txt sinh từ code để base URL luôn khớp môi trường đang deploy.
 *
 * Nguyên tắc: chỉ chặn những gì crawler không nên tiêu ngân sách crawl vào.
 * KHÔNG chặn `/c/` — trang giới thiệu chiến dịch tự quyết định bằng thẻ meta
 * robots (chiến dịch chưa chạy thì noindex, xem app/c/[slug]/page.tsx). Chặn ở
 * đây sẽ khiến crawler không đọc được thẻ đó.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Control plane — không bao giờ công khai.
          "/admin",
          // Endpoint chuyển hướng: không có nội dung, và crawl vào đây sẽ tạo
          // lượt bấm giả trong số liệu.
          "/go/",
          // API không phải nội dung để index.
          "/api/",
          // Trang báo link hết hiệu lực.
          "/link-unavailable",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
