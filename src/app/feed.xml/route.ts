import { allPosts, lastContentUpdate } from "@/content";
import { getAuthor } from "@/content/taxonomy";
import { publicBaseUrl } from "@/lib/env";
import { SITE } from "@/lib/site";

/**
 * RSS 2.0.
 *
 * Feed chỉ chứa phần mô tả, KHÔNG chứa toàn văn: thân bài là JSX nên muốn có
 * toàn văn phải render ra HTML rồi làm sạch — thêm một tầng có thể sai mà lợi ích
 * thì nhỏ. Người đọc bấm vào đọc trên site.
 *
 * Tĩnh: `allPosts()` đọc từ `src/content`, không truy vấn DB → Next render sẵn
 * lúc build, không tốn compute mỗi lần trình đọc RSS gọi tới.
 */
export const dynamic = "force-static";

/**
 * Escape cho nội dung XML. Bắt buộc: tiêu đề bài có thể chứa `&` hoặc dấu ngoặc
 * kép, và một ký tự chưa escape làm cả feed thành XML không hợp lệ — trình đọc RSS
 * sẽ bỏ toàn bộ chứ không bỏ riêng bài đó.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS yêu cầu định dạng ngày RFC 822. */
function toRfc822(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00+07:00`).toUTCString();
}

export function GET(): Response {
  const baseUrl = publicBaseUrl();
  const posts = allPosts();

  const items = posts
    .map((post) => {
      const url = `${baseUrl}/blog/${post.slug}`;
      const author = getAuthor(post.authorId)?.name ?? SITE.name;

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${toRfc822(post.publishedAt)}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
${post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  /* MAX qua mọi bài, không phải `posts[0]`: một bài cũ được sửa cũng là feed có thay
     đổi. Xem `lastContentUpdate()` trong `src/content/index.ts`. */
  const latest = lastContentUpdate();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(`${SITE.name} — ${SITE.tagline}`)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>vi</language>
    <atom:link href="${escapeXml(`${baseUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
${latest ? `    <lastBuildDate>${toRfc822(latest)}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      // Trình đọc RSS gọi lại thường xuyên — cho cache 1 giờ để không tốn băng thông.
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
