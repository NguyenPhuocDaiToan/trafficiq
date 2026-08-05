import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumb, PageHeader, PostCard } from "@/components/site";
import { postsByCategory } from "@/content";
import { CATEGORIES, getCategory } from "@/content/taxonomy";
import {
  breadcrumbNode,
  collectionPageNode,
  graph,
  personNode,
  publicAlternates,
  webSiteNode,
  type Crumb,
} from "@/lib/seo";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams(): { slug: string }[] {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Không tìm thấy chuyên mục" };

  return {
    title: category.name,
    description: category.description,
    alternates: publicAlternates(`/chuyen-muc/${category.slug}`),
    openGraph: {
      title: `${category.name} · ${SITE.name}`,
      description: category.description,
      url: `/chuyen-muc/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const posts = postsByCategory(category.slug);

  const others = CATEGORIES.filter((item) => item.slug !== category.slug);

  const path = `/chuyen-muc/${category.slug}`;
  const trail: Crumb[] = [
    { name: "Trang chủ", path: "/" },
    { name: "Bài viết", path: "/blog" },
    { name: category.name, path },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Hai node gốc đi kèm vì `isPartOf` trỏ tới `#website` — tham chiếu `@id` chỉ
          phân giải trong graph của cùng một trang. Xem ghi chú ở `/blog`. */}
      <JsonLd
        data={graph(
          webSiteNode(),
          personNode(),
          collectionPageNode({
            path,
            name: category.name,
            description: category.description,
            posts,
          }),
          breadcrumbNode(trail),
        )}
      />

      <div className="mb-8">
        <Breadcrumb trail={trail} />
      </div>

      <PageHeader
        eyebrow="Chuyên mục"
        title={category.name}
        intro={category.description}
      />

      {posts.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Chuyên mục này chưa có bài nào.{" "}
          <Link href="/blog" className="cursor-pointer text-primary underline">
            Xem tất cả bài viết
          </Link>
          .
        </p>
      ) : (
        /* gap-x rộng — xem ghi chú ở PostCard: thẻ phân cách bằng gạch trên. */
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {/* Dải chuyên mục còn lại: hết trang thì có chỗ đi tiếp, không phải ngõ cụt. */}
      <nav aria-label="Chuyên mục khác" className="mt-16 border-t border-border pt-6">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Chuyên mục khác
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {others.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/chuyen-muc/${item.slug}`}
                className="cursor-pointer text-primary underline hover:no-underline"
              >
                {item.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/blog"
              className="cursor-pointer text-primary underline hover:no-underline"
            >
              Tất cả bài viết
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
