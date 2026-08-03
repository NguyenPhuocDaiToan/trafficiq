import type { Metadata } from "next";
import { PageHeader, PostCard } from "@/components/site";
import { allPosts } from "@/content";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Tất cả bài viết",
  description: `Toàn bộ bài viết trên ${SITE.name} về đo lường, tối ưu chiến dịch và vận hành hệ thống affiliate.`,
  alternates: { canonical: "/blog" },
  openGraph: { title: `Tất cả bài viết · ${SITE.name}`, url: "/blog" },
};

export default function BlogIndexPage() {
  const posts = allPosts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Tất cả bài viết"
        intro={`${posts.length} bài, mới nhất trước. Mỗi bài viết ra từ một vấn đề gặp thật khi chạy hệ thống, không phải tổng hợp lại từ nơi khác.`}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
