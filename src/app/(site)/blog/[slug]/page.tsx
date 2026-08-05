import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import {
  AuthorCard,
  Breadcrumb,
  CategoryTag,
  PostCard,
  PostCover,
  PostMetaLine,
  Prose,
  TableOfContents,
} from "@/components/site";
import { allPosts, getPost, relatedPosts } from "@/content";
import { withHeadingAnchors } from "@/content/headings";
import { categoryName, getAuthor } from "@/content/taxonomy";
import {
  blogPostingNode,
  breadcrumbNode,
  graph,
  personNode,
  publicAlternates,
  webSiteNode,
  type Crumb,
} from "@/lib/seo";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

/**
 * Bài viết được sinh TĨNH lúc build. Khác hẳn `/c/[slug]` (force-dynamic, đọc DB):
 * nội dung ở đây nằm trong `src/content` nên không có gì để đọc lúc chạy.
 * Hệ quả: 0 truy vấn DB, 0 compute mỗi lượt xem — đúng ràng buộc chi phí.
 */
export function generateStaticParams(): { slug: string }[] {
  return allPosts().map((post) => ({ slug: post.slug }));
}

/** Slug không có trong registry thì 404 thật, không render trang rỗng. */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Không tìm thấy bài viết" };

  const url = `/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    /* Byline ở metadata phải là NGƯỜI viết bài, không phải tên site — cùng lý do
       như `author` trong JSON-LD (bất biến #13). */
    authors: [{ name: getAuthor(post.authorId)?.name ?? SITE.owner, url: "/gioi-thieu" }],
    alternates: publicAlternates(url),
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [getAuthor(post.authorId)?.name ?? SITE.name],
      tags: [...post.tags],
      ...(post.cover ? { images: [{ url: post.cover.src, alt: post.cover.alt }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(post.cover ? { images: [post.cover.src] } : {}),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = relatedPosts(post);

  /*
   * Thân bài đi qua `withHeadingAnchors()` một lần: nó gắn `id` vào từng h2/h3 và
   * trả về mục lục của chính những `id` đó. Chạy lúc build (trang này static).
   */
  const { content, toc } = withHeadingAnchors(post.body());

  /*
   * Breadcrumb: một mảng, hai đích — khối hiện trên trang và `BreadcrumbList`
   * trong JSON-LD. Mục cuối là bài đang mở, `Breadcrumb` in nó thành chữ thường.
   */
  const trail: Crumb[] = [
    { name: "Trang chủ", path: "/" },
    { name: "Bài viết", path: "/blog" },
    { name: categoryName(post.category), path: `/chuyen-muc/${post.category}` },
    { name: post.title, path: `/blog/${post.slug}` },
  ];

  /*
   * Một graph cho cả trang thay vì nhiều thẻ script rời: `BlogPosting` trỏ tới
   * `#person` và `#website` bằng `@id`, nên hai node đó phải có mặt trong cùng
   * graph — thiếu chúng thì tham chiếu treo và Google chỉ thấy một bài viết không
   * biết ai viết. Chi tiết ở `lib/seo.ts`.
   */
  const jsonLd = graph(
    webSiteNode(),
    personNode(),
    blogPostingNode(post),
    breadcrumbNode(trail),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <JsonLd data={jsonLd} />

      <Breadcrumb trail={trail} />

      <article className="mt-8">
        <header className="border-b border-border pb-8">
          <CategoryTag category={post.category} />
          {/* leading 1.15: nhan đề serif cỡ lớn bằng tiếng Việt cần khoảng dòng
              thoáng hơn mặc định — dấu nằm ở cả hai phía của dòng chữ. */}
          <h1 className="mt-3 max-w-4xl font-display text-3xl leading-[1.15] font-bold tracking-tight sm:text-[2.5rem]">
            {post.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {post.description}
          </p>
          {/* Byline gộp vào `PostMetaLine` (`withByline`) thay vì ghép thêm một <p>
              rời: bản trước để tên người viết ở thẻ riêng nên dấu "·" phải viết tay
              và khi tắt CSS thì thứ tự đọc ra là "ngày · phút · · tên". */}
          <div className="mt-5">
            <PostMetaLine post={post} withByline withUpdated />
          </div>
          <div className="mt-6">
            <PostCover post={post} size="lg" />
          </div>
        </header>

        {/* Mục lục đứng TRƯỚC thân bài và tự ẩn khi bài ít mục — xem ngưỡng ở
            `TableOfContents`. */}
        <div className="mt-8">
          <TableOfContents entries={toc} />
        </div>

        <div className="mt-10">
          <Prose>{content}</Prose>
        </div>

        <div className="mt-12">
          <AuthorCard authorId={post.authorId} />
        </div>

        {/*
          Tag là NHÃN, cố ý không phải link — và cố ý không có trang `/the/[tag]`.
          Với 12 bài, mỗi tag sẽ ra một trang một-hai bài: đó là thin content, và
          một site nội dung mới bị đánh giá bằng tỉ lệ trang mỏng của nó. Chức năng
          "đọc thêm bài cùng mảng" đã có hai đường thật: `relatedPosts()` bên dưới
          và trang chuyên mục. Có đủ bài cho mỗi tag (khoảng 5+) thì mới mở trang
          tag, và lúc đó nhớ chuẩn hoá tag về một danh sách cố định như `CATEGORIES`
          — hiện `tags` là chuỗi tự do nên "điện thoại" và "dien thoai" là hai tag.
        */}
        {post.tags.length > 0 ? (
          <footer className="mt-12 border-t border-border pt-6">
            <h2 className="text-[0.6875rem] font-bold tracking-[0.18em] uppercase">
              Chủ đề
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="bg-muted px-3 py-1 text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </footer>
        ) : null}
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="lien-quan" className="mt-16">
          {/* Nhãn section cùng mô-típ với `SectionHeading` trên trang chủ: chữ nhỏ
              + gạch kẻ, để tiêu đề bài bên dưới là thứ to nhất. */}
          <h2
            id="lien-quan"
            className="border-b border-border pb-2 text-[0.6875rem] font-bold tracking-[0.18em] uppercase"
          >
            Đọc tiếp
          </h2>
          {/* gap-x rộng — xem ghi chú ở PostCard: thẻ phân cách bằng gạch trên. */}
          <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <PostCard key={item.slug} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
