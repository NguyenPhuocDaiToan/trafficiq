import type { Metadata } from "next";
import { pageTitle } from "@/lib/site";
import type { CampaignOg } from "@/lib/types";

/**
 * NGUỒN SỰ THẬT DUY NHẤT cho Social Card của một campaign.
 *
 * Card được phục vụ ở HAI nơi khác nhau về kỹ thuật:
 *   - `/c/[slug]`  → qua `generateMetadata()` của Next (React, có layout)
 *   - `/go/[token]`→ qua HTML thô trả thẳng từ route handler (không có React)
 *
 * Hai đường render, nhưng PHẢI ra cùng một card — nếu không thì cùng một
 * campaign share lên X qua hai link lại hiện hai preview khác nhau, và không
 * ai phát hiện ra cho tới khi khách hàng hỏi.
 *
 * Vì vậy hai mapper bên dưới cố tình nằm cạnh nhau trong cùng file: thêm một
 * thẻ vào `ogCardMetadata()` mà quên `ogCardHeadHtml()` là thấy ngay khi đọc,
 * chứ không phải phát hiện sau vài tuần. Đừng tách chúng ra hai file.
 */
export interface OgCard {
  title: string;
  description: string;
  imageUrl?: string;
  /**
   * URL chuẩn của card — LUÔN là landing `/c/[slug]`, kể cả khi card đang được
   * phục vụ tại `/go/[token]`. `/go` là endpoint đo click, không phải một trang
   * nội dung để index.
   */
  url: string;
  /** Campaign chưa active = bản preview → không cho index. */
  index: boolean;
}

export function buildOgCard(params: {
  og: CampaignOg;
  slug: string;
  baseUrl: string;
  index: boolean;
}): OgCard {
  return {
    title: params.og.title,
    description: params.og.description,
    // Crawler không hiểu đường dẫn tương đối — ảnh OG phải là absolute URL.
    imageUrl: params.og.imageUrl,
    url: `${params.baseUrl}/c/${params.slug}`,
    index: params.index,
  };
}

/** Mapper 1 — cho `generateMetadata()` ở `/c/[slug]`. */
export function ogCardMetadata(card: OgCard): Metadata {
  const images = card.imageUrl ? [{ url: card.imageUrl }] : undefined;

  return {
    title: card.title,
    description: card.description,
    alternates: { canonical: card.url },
    robots: card.index ? undefined : { index: false, follow: false },
    openGraph: {
      type: "website",
      url: card.url,
      title: card.title,
      description: card.description,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: card.title,
      description: card.description,
      images: card.imageUrl ? [card.imageUrl] : undefined,
    },
  };
}

/** Escape cho giá trị nằm trong attribute HTML có dấu nháy kép. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mapper 2 — HTML thô cho `/go/[token]`, phải khớp mapper 1 ở trên.
 *
 * Có `<meta http-equiv="refresh">` + một link nhìn thấy được: nếu `botReason()`
 * chấm nhầm một người thật, họ vẫn tới được landing thay vì nhìn trang trắng.
 * Crawler nào đi theo refresh thì cũng chỉ tới `/c/[slug]` — đúng chỗ nó tới
 * bằng 302 trước đây, nên không tệ hơn bản cũ.
 */
export function ogCardHeadHtml(card: OgCard): string {
  const twitterCard = card.imageUrl ? "summary_large_image" : "summary";

  const tags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    // `pageTitle()` chứ không phải `card.title` trần: root layout áp template
    // `%s · SITE.name` cho `/c/[slug]`, nên không gọi thì hai đường lệch <title>.
    `<title>${esc(pageTitle(card.title))}</title>`,
    `<meta name="description" content="${esc(card.description)}">`,
    `<link rel="canonical" href="${esc(card.url)}">`,
    card.index ? "" : `<meta name="robots" content="noindex, nofollow">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(card.url)}">`,
    `<meta property="og:title" content="${esc(card.title)}">`,
    `<meta property="og:description" content="${esc(card.description)}">`,
    card.imageUrl ? `<meta property="og:image" content="${esc(card.imageUrl)}">` : "",
    `<meta name="twitter:card" content="${twitterCard}">`,
    `<meta name="twitter:title" content="${esc(card.title)}">`,
    `<meta name="twitter:description" content="${esc(card.description)}">`,
    card.imageUrl ? `<meta name="twitter:image" content="${esc(card.imageUrl)}">` : "",
    `<meta http-equiv="refresh" content="0;url=${esc(card.url)}">`,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="vi">
<head>
${tags.map((t) => `  ${t}`).join("\n")}
</head>
<body>
  <a href="${esc(card.url)}">${esc(card.title)}</a>
</body>
</html>`;
}
