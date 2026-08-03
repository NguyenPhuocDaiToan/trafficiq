import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PostCard } from "@/components/site";
import { postsByCategory } from "@/content";
import { CATEGORIES, getCategory } from "@/content/taxonomy";
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
    alternates: { canonical: `/chuyen-muc/${category.slug}` },
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={category.name} intro={category.description} />

      {posts.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Chuyên mục này chưa có bài nào.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
