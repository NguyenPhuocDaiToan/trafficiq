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
      /*
       * Crawler tạo Social Card (Twitterbot…) TÔN TRỌNG robots.txt — nếu
       * `/go/` bị chặn ở rule "*", nó từ chối fetch link luôn, không bao giờ
       * chạm tới bước `isBotRequest()` redirect sang `/c/[slug]` trong
       * `app/go/[token]/route.ts`. Route đó đã tự lo việc không tính click
       * giả cho các UA này, nên mở lại `/go/` riêng cho chúng ở đây — không
       * mở cho `Googlebot`/`Bingbot`: hai bot đó không cần Card preview và
       * vẫn nên bị chặn index theo rule "*" phía trên.
       *
       * facebookexternalhit và WhatsApp trong thực tế KHÔNG tôn trọng
       * robots.txt (đã tự tìm hiểu lại card preview vẫn hoạt động dù bị
       * chặn), nhưng khai rõ ở đây để không ai phải đoán lại lần sau.
       */
      {
        userAgent: [
          "Twitterbot",
          "facebookexternalhit",
          "Facebot",
          "TelegramBot",
          "LinkedInBot",
          "WhatsApp",
          "Slackbot",
          "Discordbot",
          "Pinterest",
          "Quora Link Preview",
        ],
        allow: "/go/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
