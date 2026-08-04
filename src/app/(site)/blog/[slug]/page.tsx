import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTag, PostCard, PostCover, PostMetaLine, Prose } from "@/components/site";
import { allPosts, getPost, relatedPosts } from "@/content";
import { categoryName, getAuthor } from "@/content/taxonomy";
import { publicBaseUrl } from "@/lib/env";
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
    alternates: { canonical: url },
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

  const author = getAuthor(post.authorId);
  const related = relatedPosts(post);
  const baseUrl = publicBaseUrl();

  /*
   * JSON-LD BlogPosting — yêu cầu trong checklist của pages/blog.md.
   * Đặt trong HTML server-render để crawler không cần chạy JS mới thấy.
   * `dangerouslySetInnerHTML` ở đây an toàn: dữ liệu là hằng số trong repo, không
   * phải input của người dùng.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: SITE.locale,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}/blog/${post.slug}` },
    ...(post.cover ? { image: [`${baseUrl}${post.cover.src}`] } : {}),
    /*
     * `Person`, không phải `Organization`: site chạy dưới thương hiệu cá nhân
     * (`SITE.owner`) và mục tác giả trong JSON-LD phải khớp với byline hiện trên
     * trang — khai một tổ chức không tồn tại là dữ liệu có cấu trúc sai sự thật,
     * đúng thứ Google hạ tín nhiệm ở nội dung review/affiliate.
     */
    author: { "@type": "Person", name: author?.name ?? SITE.owner },
    publisher: { "@type": "Person", name: SITE.owner },
    articleSection: categoryName(post.category),
    keywords: post.tags.join(", "),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb: người đọc tới từ Google cần biết mình đang ở đâu. */}
      <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="cursor-pointer hover:text-foreground">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/blog" className="cursor-pointer hover:text-foreground">
              Bài viết
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/chuyen-muc/${post.category}`}
              className="cursor-pointer hover:text-foreground"
            >
              {categoryName(post.category)}
            </Link>
          </li>
        </ol>
      </nav>

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
            <PostMetaLine post={post} withByline />
          </div>
          <div className="mt-6">
            <PostCover post={post} size="lg" />
          </div>
        </header>

        <div className="mt-10">
          <Prose>{post.body()}</Prose>
        </div>

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
