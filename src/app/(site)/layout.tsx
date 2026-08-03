import { SiteFooter, SiteHeader } from "@/components/site";

/**
 * Shell của surface công khai: trang chủ, blog, chuyên mục, và các trang tĩnh.
 *
 * `(site)` là route group — dấu ngoặc nên nó KHÔNG xuất hiện trong URL. Mục đích
 * duy nhất là để nhóm này có header/footer riêng, tách khỏi `/admin/**` (shell
 * dashboard) và `/c/[slug]`, `/go/[token]`, `/link-unavailable` (không có shell:
 * landing phải sạch, một CTA, không nav để không rò rỉ click ra chỗ khác).
 *
 * UI theo design-system/trafficiq/pages/blog.md.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Skip link: người dùng bàn phím không phải tab qua toàn bộ nav mỗi trang.
        Ẩn tới khi được focus — không dùng `hidden` vì như vậy sẽ không focus được.
      */}
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Bỏ qua, tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" className="flex-1">
        {children}
      </main>

      <SiteFooter />
    </>
  );
}
