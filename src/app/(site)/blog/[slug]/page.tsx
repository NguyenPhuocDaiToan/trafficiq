import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTag, PostCard, PostMetaLine, Prose } from "@/components/site";
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
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
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
    author: { "@type": "Organization", name: author?.name ?? SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
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
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {post.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <PostMetaLine post={post} />
            {author ? (
              <p className="text-sm text-muted-foreground">
                <span aria-hidden="true">· </span>
                {author.name}
              </p>
            ) : null}
          </div>
        </header>

        <div className="mt-10">
          <Prose>{post.body()}</Prose>
        </div>

        {post.tags.length > 0 ? (
          <footer className="mt-12 border-t border-border pt-6">
            <h2 className="text-xs font-semibold tracking-wide uppercase">Chủ đề</h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-lg bg-muted px-3 py-1 text-muted-foreground"
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
          <h2 id="lien-quan" className="text-2xl font-bold tracking-tight">
            Đọc tiếp
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <PostCard key={item.slug} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
