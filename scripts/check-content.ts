/**
 * Gate nội dung blog. Chạy: `npm run check:content`.
 *
 * Vì sao cần một gate riêng thay vì tin vào review bằng mắt: những thứ nó kiểm đều
 * là loại sai **lặng** — build vẫn xanh, trang vẫn render, chỉ có Google và người
 * đọc thấy hậu quả vài tuần sau. Cụ thể:
 *
 *   - Link nội bộ trỏ vào slug đã đổi tên → 404 giữa thân bài.
 *   - Bài không có link nào trỏ tới (orphan) → crawler chỉ tới được nó qua trang
 *     danh sách, và nó là bài đầu tiên bị bỏ khi ngân sách crawl hẹp.
 *   - `cover.src` trỏ vào file không tồn tại → thẻ OG rỗng khi chia sẻ, không có
 *     lỗi nào ở build.
 *   - Mô tả quá dài/quá ngắn → bị cắt giữa câu trên trang kết quả tìm kiếm.
 *
 * Đọc thẳng `src/content` bằng `tsx` (không phân tích chuỗi TSX bằng regex): dữ liệu
 * kiểm phải là chính dữ liệu trang dùng, nếu không gate sẽ đúng với một bản sao
 * tưởng tượng của nội dung.
 */

import { existsSync, statSync } from "node:fs";
import { isValidElement, Children } from "react";
import type { ReactElement, ReactNode } from "react";
import sharp from "sharp";
import { allPosts } from "../src/content";
import { withHeadingAnchors } from "../src/content/headings";
import { CATEGORIES } from "../src/content/taxonomy";
import type { Post } from "../src/content/types";
import { THUMB_HEIGHT, THUMB_WIDTH, thumbSrc } from "../src/lib/thumb";

/**
 * Khoảng độ dài mô tả. Không phải con số của Google (Google cắt theo pixel, không
 * theo ký tự) — đây là khoảng an toàn cho tiếng Việt: dưới 120 thì bỏ trống chỗ mô
 * tả vốn là chỗ thuyết phục người ta bấm, trên 165 thì gần chắc chắn bị cắt.
 */
const DESC_MIN = 120;
const DESC_MAX = 165;

/** Cảnh báo (không fail) khi tiêu đề dài tới mức bị cắt trên SERP. */
const TITLE_WARN = 72;

/**
 * Hôm nay theo giờ VN (UTC+7) — cùng múi giờ với dashboard. Cắt bằng `sv-SE` vì
 * locale đó cho ra đúng dạng `YYYY-MM-DD`, so chuỗi được với `publishedAt`.
 */
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh",
}).format(new Date());

const errors: string[] = [];
const warnings: string[] = [];

function fail(post: Post, message: string): void {
  errors.push(`${post.slug}: ${message}`);
}

function warn(post: Post, message: string): void {
  warnings.push(`${post.slug}: ${message}`);
}

type AnyElement = ReactElement<{ children?: ReactNode; href?: string; rel?: string }>;

/**
 * Gom mọi `href` trong thân bài. Bắt cả `<Link>` và `<a>` bằng cách nhận diện
 * PROP chứ không nhận diện loại thẻ: nếu sau này bài dùng một component link khác,
 * gate vẫn thấy — điều kiện duy nhất là nó nhận `href`.
 */
function collectLinks(node: ReactNode, out: { href: string; rel?: string }[]): void {
  if (Array.isArray(node)) {
    Children.forEach(node, (child) => collectLinks(child, out));
    return;
  }
  if (!isValidElement(node)) return;

  const element = node as AnyElement;
  const { href, rel, children } = element.props;
  if (typeof href === "string") out.push({ href, rel });

  /*
   * Đi vào children của MỌI element, kể cả component (`Callout`, `MethodNote`).
   * Khác với `withHeadingAnchors()` — nơi cố ý dừng ở component — vì ở đây children
   * đã là cây element dựng sẵn khi JSX được tạo, và một link trong `Callout` là
   * link thật trên trang. Bản đầu dừng ở component nên báo nhầm bài
   * `phi-am-tham-…` là "không có link nội bộ" trong khi link nằm trong `Callout`.
   */
  collectLinks(children, out);
}

const posts = allPosts();
const slugs = new Set(posts.map((post) => post.slug));
/** Bài có ảnh bìa — kiểm thumbnail sau vòng lặp vì việc đó cần `await`. */
const thumbChecks: Post[] = [];
/* `Set<string>` tường minh: `CATEGORIES` cho ra `CategorySlug`, và `.has()` với một
   chuỗi bắt từ href sẽ không typecheck — đúng chỗ này cần so chuỗi thô. */
const categorySlugs = new Set<string>(CATEGORIES.map((category) => category.slug));
const incoming = new Map<string, number>(posts.map((post) => [post.slug, 0]));

for (const post of posts) {
  // --- Metadata ---
  if (post.description.length < DESC_MIN || post.description.length > DESC_MAX) {
    fail(
      post,
      `mô tả dài ${post.description.length} ký tự, cần ${DESC_MIN}–${DESC_MAX}`,
    );
  }
  if (post.title.length > TITLE_WARN) {
    warn(post, `tiêu đề ${post.title.length} ký tự — sẽ bị cắt trên SERP`);
  }
  if (post.tags.length === 0) fail(post, "không có tag nào");
  if (post.readingMinutes < 1) fail(post, "readingMinutes phải ≥ 1");

  /*
   * Ngày: `dateModified` sớm hơn `datePublished` là structured data tự mâu thuẫn, và
   * ngày ở tương lai là thứ Google đọc ra như cố làm bài trông mới hơn thực tế. Cả
   * hai đều không có gì trên trang để nhìn ra bằng mắt.
   */
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO.test(post.publishedAt)) {
    fail(post, `publishedAt phải dạng YYYY-MM-DD, đang là "${post.publishedAt}"`);
  }
  if (post.updatedAt !== undefined) {
    if (!ISO.test(post.updatedAt)) {
      fail(post, `updatedAt phải dạng YYYY-MM-DD, đang là "${post.updatedAt}"`);
    } else if (post.updatedAt < post.publishedAt) {
      fail(post, `updatedAt (${post.updatedAt}) sớm hơn publishedAt (${post.publishedAt})`);
    } else if (post.updatedAt > today) {
      fail(post, `updatedAt (${post.updatedAt}) ở tương lai`);
    }
  }

  // --- Ảnh bìa ---
  if (post.cover) {
    if (!existsSync(`public${post.cover.src}`)) {
      fail(post, `cover.src trỏ vào file không tồn tại: ${post.cover.src}`);
    }
    if (post.cover.alt.trim().length === 0) {
      fail(post, "cover.alt rỗng — ảnh không có mô tả cho screen reader");
    }
    thumbChecks.push(post);
  }

  // --- Heading và mục lục ---
  const { toc } = withHeadingAnchors(post.body());
  if (!toc.some((entry) => entry.level === 2)) {
    fail(post, "không có <h2> nào — bài dài phải chia mục");
  }
  const ids = new Set(toc.map((entry) => entry.id));
  if (ids.size !== toc.length) {
    fail(post, "có anchor trùng nhau sau khi sinh id (lỗi ở withHeadingAnchors)");
  }

  // --- Link trong thân bài ---
  const links: { href: string; rel?: string }[] = [];
  collectLinks(post.body(), links);

  let internal = 0;
  for (const { href, rel } of links) {
    const blogMatch = /^\/blog\/([a-z0-9-]+)$/.exec(href);
    if (blogMatch) {
      const target = blogMatch[1];
      internal += 1;
      if (!slugs.has(target)) fail(post, `link tới bài không tồn tại: ${href}`);
      else if (target === post.slug) fail(post, "link trỏ về chính nó");
      else incoming.set(target, (incoming.get(target) ?? 0) + 1);
      continue;
    }

    const categoryMatch = /^\/chuyen-muc\/([a-z0-9-]+)$/.exec(href);
    if (categoryMatch) {
      internal += 1;
      if (!categorySlugs.has(categoryMatch[1])) {
        fail(post, `link tới chuyên mục không tồn tại: ${href}`);
      }
      continue;
    }

    if (href.startsWith("/")) {
      internal += 1;
      continue;
    }

    /*
     * Link ra ngoài. Không fail: bài có thể cần dẫn nguồn thật. Nhưng nhắc, vì
     * blog.md ràng link affiliate phải qua `PromoBox` (có sẵn
     * `rel="nofollow sponsored"` + nhãn tiết lộ) — một `<a>` viết tay trỏ ra ngoài
     * là chỗ dễ quên hai thứ đó nhất.
     */
    if (/^https?:\/\//.test(href) && !(rel ?? "").includes("nofollow")) {
      warn(post, `link ra ngoài không có rel="nofollow": ${href}`);
    }
  }

  if (internal === 0) {
    fail(post, "không có link nội bộ nào trong thân bài");
  }
}

for (const [slug, count] of incoming) {
  if (count === 0) {
    errors.push(
      `${slug}: không bài nào trỏ tới (orphan) — thêm một link từ bài liên quan`,
    );
  }
}

/*
 * Thumbnail: file sinh sẵn bởi `npm run gen:thumbs`, dùng ở `PostThumb` trong hai dải
 * danh sách của trang chủ. Đây là loại sai lặng điển hình — thêm bài có ảnh bìa mà
 * quên chạy `gen:thumbs` thì trang chủ hiện một ô xám, build vẫn xanh.
 *
 * Kiểm cả KÍCH THƯỚC, không chỉ sự tồn tại: cách "sửa" sai nhất là copy ảnh gốc vào
 * thư mục thumb — file có, trang hiện đúng, và trang chủ âm thầm tải 1,2MB.
 */
const THUMB_MAX_BYTES = 20 * 1024;

/**
 * Phần duy nhất cần `await` (đọc metadata ảnh), nên nó nằm trong hàm: `tsx` biên dịch
 * ra CJS, top-level await là lỗi transform — cùng lý do như `scripts/seed.ts`.
 */
async function checkThumbs(): Promise<void> {
  for (const post of thumbChecks) {
    const rel = thumbSrc(post.cover!.src);
    if (!rel) {
      warn(post, `ảnh bìa ngoài /images/blog nên không có thumbnail: ${post.cover!.src}`);
      continue;
    }

    const file = `public${rel}`;
    if (!existsSync(file)) {
      fail(post, `thiếu thumbnail ${rel} — chạy \`npm run gen:thumbs\``);
      continue;
    }

    const { size } = statSync(file);
    if (size > THUMB_MAX_BYTES) {
      fail(
        post,
        `thumbnail ${rel} nặng ${(size / 1024).toFixed(1)}KB (trần ${THUMB_MAX_BYTES / 1024}KB) — ` +
          "có phải đã copy ảnh gốc vào đây?",
      );
      continue;
    }

    const meta = await sharp(file).metadata();
    if (meta.width !== THUMB_WIDTH || meta.height !== THUMB_HEIGHT) {
      fail(
        post,
        `thumbnail ${rel} cỡ ${meta.width}×${meta.height}, cần ${THUMB_WIDTH}×${THUMB_HEIGHT} — ` +
          "chạy lại `npm run gen:thumbs` (ảnh bìa lệch 16:9 thì sửa ảnh gốc)",
      );
    }
  }
}

function report(): void {
  console.log(`Đã kiểm ${posts.length} bài.\n`);

  if (warnings.length > 0) {
    console.log("CẢNH BÁO (không chặn):");
    for (const line of warnings) console.log(`  ! ${line}`);
    console.log("");
  }

  if (errors.length > 0) {
    console.log("LỖI:");
    for (const line of errors) console.log(`  ✗ ${line}`);
    console.log(`\n${errors.length} lỗi. Sửa trước khi coi là xong.`);
    process.exit(1);
  }

  console.log(
    "Toàn bộ bài đạt: metadata, ảnh bìa, thumbnail, anchor, và liên kết nội bộ.",
  );
}

checkThumbs()
  .then(report)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
