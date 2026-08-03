import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedCard, PostCard } from "@/components/site";
import { allPosts, featuredPost } from "@/content";
import { CATEGORIES } from "@/content/taxonomy";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: "/",
  },
};

/**
 * Trang chủ — pattern "Content-First Index" (xem pages/blog.md).
 *
 * KHÔNG có form đăng ký email, dù output của skill đề xuất pattern
 * "Newsletter / Content First": dự án không có hệ thống gửi mail, dựng form không
 * xử lý được là lừa người đọc. Lý do đầy đủ trong pages/blog.md.
 *
 * Tĩnh hoàn toàn: nội dung đến từ `src/content`, không truy vấn DB → render lúc
 * build, 0 compute mỗi lượt xem.
 */
export default function HomePage() {
  const featured = featuredPost();
  const rest = allPosts().filter((post) => post.slug !== featured.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* 1. Hero — nói rõ site viết về gì, không hứa hẹn chung chung. */}
      <section className="py-14 sm:py-20">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          {SITE.tagline}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Ghi chép thực chiến về đo lường và tối ưu traffic
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Những gì học được khi tự dựng hệ thống tracking affiliate: chỗ nào số liệu
          sai và vì sao, chỗ nào tài liệu của nhà cung cấp không khớp thực tế, và
          những giới hạn hạ tầng chỉ lộ ra khi đã chạy traffic thật.
        </p>
        {/*
          Chỉ dùng link/outline ở đây. CTA màu --accent duy nhất trên view này nằm
          ở ô bài nổi bật bên dưới — hai CTA accent cùng một trang là sai luật
          MASTER.md § Color Palette.
        */}
        <div className="mt-7 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/blog"
            className="cursor-pointer rounded-lg border border-primary px-4 py-2 font-semibold text-primary hover:bg-primary hover:text-on-primary"
          >
            Xem tất cả bài viết
          </Link>
          <Link
            href="/gioi-thieu"
            className="cursor-pointer text-muted-foreground underline hover:text-foreground"
          >
            Site này là gì
          </Link>
        </div>
      </section>

      {/* 2. Bài nổi bật */}
      <section aria-labelledby="noi-bat">
        <h2 id="noi-bat" className="sr-only">
          Bài nổi bật
        </h2>
        <FeaturedCard post={featured} />
      </section>

      {/* 3. Bài mới nhất */}
      {rest.length > 0 ? (
        <section aria-labelledby="moi-nhat" className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="moi-nhat" className="text-2xl font-bold tracking-tight">
              Bài mới nhất
            </h2>
            <Link
              href="/blog"
              className="cursor-pointer text-sm text-primary underline hover:no-underline"
            >
              Tất cả {allPosts().length} bài
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Chuyên mục */}
      <section aria-labelledby="chuyen-muc" className="mt-14">
        <h2 id="chuyen-muc" className="text-2xl font-bold tracking-tight">
          Chuyên mục
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/chuyen-muc/${category.slug}`}
              className="cursor-pointer rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-(--shadow-md)"
            >
              <p className="font-semibold">{category.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
