/**
 * NGUỒN DUY NHẤT của structured data (JSON-LD) và của cặp canonical + RSS.
 *
 * Vì sao gom về một file thay vì viết tại từng trang: các node schema tham chiếu
 * lẫn nhau bằng `@id` (bài viết trỏ tới `#person` và `#website`). Viết tay ở từng
 * trang thì chỉ cần một trang đổi `@id` là cả graph đứt liên kết mà build vẫn
 * xanh và không có gate nào bắt được — sai loại này chỉ hiện ra ở Search Console
 * vài tuần sau.
 *
 * ⚠️ Mọi giá trị ở đây phải KHỚP với thứ hiện trên trang. Structured data sai sự
 * thật (khai Organization khi site là một người, khai `SearchAction` khi site
 * không có ô tìm kiếm) là đúng thứ Google hạ tín nhiệm ở nội dung review/affiliate
 * — xem bất biến #13 trong AGENTS.md.
 */

import type { Metadata } from "next";
import { AUTHORS, CATEGORIES, categoryName, getAuthor } from "@/content/taxonomy";
import type { Post } from "@/content/types";
import { publicBaseUrl } from "@/lib/env";
import { SITE } from "@/lib/site";

/** Đường dẫn tuyệt đối. Schema.org yêu cầu URL đầy đủ, không phải path. */
function abs(path: string): string {
  const base = publicBaseUrl();
  return path === "/" ? base : `${base}${path}`;
}

/**
 * `@id` của hai node dùng lại ở mọi trang. Dạng `<base>/#<tên>` là quy ước phổ
 * biến: nó là URI tuyệt đối, không trùng với URL của bất kỳ trang thật nào.
 */
function ids() {
  const base = publicBaseUrl();
  return { website: `${base}/#website`, person: `${base}/#person` } as const;
}

/**
 * `alternates` cho mọi trang của surface công khai: canonical + link tới RSS.
 *
 * Vì sao là helper chứ không đặt một lần ở layout: Next THAY THẾ cả field
 * `alternates` khi trang con khai lại nó, không trộn sâu. Mọi trang con đều khai
 * `canonical`, nên `types` đặt ở layout sẽ bị xoá đúng ở những trang cần nó nhất.
 *
 * `/admin` và `/c/[slug]` KHÔNG dùng helper này: chúng không phải nội dung để
 * theo dõi bằng trình đọc RSS.
 */
export function publicAlternates(path: string): Metadata["alternates"] {
  return {
    canonical: path,
    types: { "application/rss+xml": "/feed.xml" },
  };
}

/** Bọc các node rời thành một graph — một thẻ `<script>` cho cả trang. */
export function graph(...nodes: object[]): object {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * Người chịu trách nhiệm nội dung. `Person`, không phải `Organization`: site chạy
 * dưới thương hiệu cá nhân (bất biến #13).
 *
 * `knowsAbout` lấy từ `CATEGORIES` nên nó không thể mô tả một chuyên môn mà site
 * không thật sự có bài về.
 */
export function personNode(): object {
  const author = AUTHORS[0];

  return {
    "@type": "Person",
    "@id": ids().person,
    name: author.name,
    url: abs("/gioi-thieu"),
    jobTitle: author.role,
    description: author.bio,
    knowsAbout: CATEGORIES.map((category) => category.name),
  };
}

/**
 * Node site. KHÔNG khai `potentialAction`/`SearchAction`: site chưa có trang kết
 * quả tìm kiếm nào, khai ra là mô tả một chức năng không tồn tại. Có ô tìm kiếm
 * thật thì thêm vào đây, đừng thêm ở trang riêng lẻ.
 */
export function webSiteNode(): object {
  return {
    "@type": "WebSite",
    "@id": ids().website,
    url: abs("/"),
    name: SITE.name,
    alternateName: SITE.tagline,
    description: SITE.description,
    inLanguage: SITE.locale,
    publisher: { "@id": ids().person },
  };
}

export function blogPostingNode(post: Post): object {
  const url = abs(`/blog/${post.slug}`);
  const author = getAuthor(post.authorId);

  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: SITE.locale,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": ids().website },
    ...(post.cover ? { image: [abs(post.cover.src)] } : {}),
    /*
     * Cùng một `@id` với `personNode()` chứ không lặp lại tên: đây là cách nói
     * "tác giả bài này CHÍNH LÀ người đã khai ở node kia", thay vì để crawler
     * đoán hai cái tên giống nhau có phải một người hay không.
     *
     * Khi nào có người viết thứ hai (`AUTHORS` dài hơn 1) thì bài của họ khai
     * `Person` rời tại chỗ — `#person` chỉ đại diện đúng một người, dùng nó cho
     * mọi bài là gán sai tác giả.
     */
    author:
      author && author.id === AUTHORS[0].id
        ? { "@id": ids().person }
        : { "@type": "Person", name: author?.name ?? SITE.owner },
    publisher: { "@id": ids().person },
    articleSection: categoryName(post.category),
    keywords: post.tags.join(", "),
    /* Phút đọc do người viết điền (xem `Post.readingMinutes`) nên đây là ước
       lượng — `timeRequired` đúng nghĩa "thời gian cần để dùng nội dung này". */
    timeRequired: `PT${post.readingMinutes}M`,
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * `BreadcrumbList` — thứ Google dùng để in đường dẫn thay cho URL trong kết quả
 * tìm kiếm. Phải KHỚP với breadcrumb hiện trên trang: `Breadcrumb`
 * (`components/site.tsx`) và hàm này luôn nhận cùng một mảng `Crumb`.
 */
export function breadcrumbNode(trail: Crumb[]): object {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: abs(crumb.path),
    })),
  };
}

/**
 * Trang danh sách (`/blog`, `/chuyen-muc/[slug]`). `mainEntity` là `ItemList` các
 * bài ĐANG hiện trên trang — không phải toàn bộ bài của site, vì đó là nội dung
 * mà crawler thấy ở URL này.
 */
export function collectionPageNode({
  path,
  name,
  description,
  posts,
}: {
  path: string;
  name: string;
  description: string;
  posts: Post[];
}): object {
  const url = abs(path);

  return {
    "@type": "CollectionPage",
    "@id": url,
    url,
    name,
    description,
    inLanguage: SITE.locale,
    isPartOf: { "@id": ids().website },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: abs(`/blog/${post.slug}`),
        name: post.title,
      })),
    },
  };
}

/**
 * `/gioi-thieu` là trang tiểu sử của người viết → `ProfilePage` bọc quanh chính
 * `personNode()`. Đây là chỗ duy nhất trên site khai `mainEntity` là người, và là
 * đích của `author.url` trong mọi bài.
 */
export function profilePageNode(): object {
  const url = abs("/gioi-thieu");

  return {
    "@type": "ProfilePage",
    "@id": url,
    url,
    inLanguage: SITE.locale,
    isPartOf: { "@id": ids().website },
    mainEntity: { "@id": ids().person },
  };
}
