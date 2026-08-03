import Link from "next/link";
import { FOOTER_NAV, MAIN_NAV, SITE } from "@/lib/site";
import { categoryName } from "@/content/taxonomy";
import { formatDate } from "@/lib/labels";
import type { Post } from "@/content/types";

/*
 * Primitive cho surface công khai — theo design-system/trafficiq/pages/blog.md
 * (Editorial Grid / Magazine, density 3/10).
 *
 * Tách riêng khỏi `components/ui.tsx` (dashboard, density 8/10) vì hai surface có
 * hai bộ luật khác nhau: bên kia nén chặt để nhìn nhiều số, bên này thoáng để đọc
 * chữ dài. Trộn vào một file là đường ngắn nhất tới việc dùng lẫn spacing.
 *
 * Luật token vẫn tuyệt đối: không hex, không `neutral-*`.
 */

/** Heroicons (outline) — không dùng emoji làm icon (anti-pattern MASTER.md). */
function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M13.5 4.5 21 12l-7.5 7.5M21 12H3" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    // sticky: header 56px theo --header-height. Không che nội dung vì main có
    // padding-top riêng và không có phần tử nào dựa vào scroll offset.
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="cursor-pointer text-base font-bold tracking-tight hover:text-primary"
        >
          {SITE.name}
        </Link>

        <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/lien-he"
          className="ml-auto cursor-pointer rounded-lg border border-primary px-3 py-1 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary"
        >
          Liên hệ
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-bold tracking-tight">{SITE.name}</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{SITE.tagline}</p>
          </div>

          {FOOTER_NAV.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-xs font-semibold tracking-wide uppercase">
                {column.heading}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          {/*
            Dòng tiết lộ affiliate ở footer là YÊU CẦU, không phải trang trí — nó
            phải xuất hiện trên mọi trang, không chỉ trang có link tài trợ.
          */}
          <p>
            Một số liên kết trên site này là liên kết tài trợ: nếu bạn dùng chúng,
            chúng tôi có thể nhận hoa hồng mà bạn không phải trả thêm.{" "}
            <Link href="/tiet-lo-lien-ket" className="cursor-pointer underline">
              Chi tiết
            </Link>
            .
          </p>
          <p className="mt-3">
            © {year} {SITE.legal.entityName ?? SITE.name}. Nội dung mang tính tham
            khảo, không phải tư vấn đầu tư hay tư vấn pháp lý.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Nhãn chuyên mục, dẫn tới trang chuyên mục. */
export function CategoryTag({ category }: { category: Post["category"] }) {
  return (
    <Link
      href={`/chuyen-muc/${category}`}
      className="cursor-pointer text-xs font-semibold tracking-wide text-accent uppercase hover:underline"
    >
      {categoryName(category)}
    </Link>
  );
}

/** Dòng thông tin dưới tiêu đề bài: ngày + thời gian đọc. */
export function PostMetaLine({ post }: { post: Post }) {
  return (
    <p className="text-sm text-muted-foreground">
      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      <span aria-hidden="true"> · </span>
      <span>{post.readingMinutes} phút đọc</span>
    </p>
  );
}

/**
 * Thẻ bài viết. KHÔNG có ảnh — cover là kiểu chữ.
 * Lý do trong pages/blog.md: bandwidth Hobby ~100GB/tháng, và Editorial Grid vốn
 * đã dựa vào phân cấp chữ chứ không dựa vào hình.
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-(--shadow-md)">
      <CategoryTag category={post.category} />

      <h3 className="mt-3 text-lg font-semibold">
        <Link
          href={`/blog/${post.slug}`}
          className="cursor-pointer hover:text-primary"
        >
          {post.title}
        </Link>
      </h3>

      <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.description}</p>

      <div className="mt-4">
        <PostMetaLine post={post} />
      </div>
    </article>
  );
}

/** Ô bài nổi bật trên trang chủ — chiếm cả 12 cột. */
export function FeaturedCard({ post }: { post: Post }) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <CategoryTag category={post.category} />

      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        <Link href={`/blog/${post.slug}`} className="cursor-pointer hover:text-primary">
          {post.title}
        </Link>
      </h2>

      <p className="mt-3 max-w-2xl text-base text-muted-foreground">{post.description}</p>

      <div className="mt-4">
        <PostMetaLine post={post} />
      </div>

      <Link
        href={`/blog/${post.slug}`}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
      >
        Đọc bài này
        <ArrowRightIcon />
      </Link>
    </article>
  );
}

/** Tiêu đề trang cho các trang không phải bài viết. */
export function PageHeader({
  title,
  intro,
}: {
  title: string;
  intro?: string;
}) {
  return (
    <header className="border-b border-border pb-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {intro ? (
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">{intro}</p>
      ) : null}
    </header>
  );
}

/**
 * Cảnh báo hiện trên trang pháp lý khi `SITE.legal` chưa được điền.
 *
 * Cố ý hiện ra thay vì im lặng: một trang điều khoản không có tên pháp nhân là
 * trang chưa dùng được, và im lặng thì rất dễ deploy thật mà không ai nhớ. Điền
 * `NEXT_PUBLIC_LEGAL_ENTITY` là khối này tự biến mất.
 */
export function LegalGapNotice() {
  if (SITE.legal.entityName) return null;

  return (
    <div className="rounded-xl border border-border bg-warning/10 px-4 py-3 text-sm text-warning">
      <p className="font-semibold">Bản nháp — chưa dùng được cho pháp lý</p>
      <p className="mt-1">
        Chưa điền tên pháp nhân, địa chỉ và mã số thuế. Đặt các biến môi trường{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_LEGAL_ENTITY</code>,{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_LEGAL_ADDRESS</code>,{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_LEGAL_TAX_ID</code> và cho
        luật sư soát lại trước khi chạy traffic trả tiền.
      </p>
    </div>
  );
}

/**
 * Bọc văn bản dài. Style thật nằm ở `.prose` trong globals.css.
 * `max-w` do .prose tự lo (68ch) — đừng thêm max-w ở đây, sẽ chồng nhau.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose">{children}</div>;
}
