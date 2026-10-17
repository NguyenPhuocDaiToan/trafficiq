import type { Metadata } from "next";
import Script from "next/script";
import { SiteFooter, SiteHeader } from "@/components/site";
import { AD_NETWORK_VERIFICATION, SKIMLINKS_SRC } from "@/lib/monetization";

/**
 * Thẻ xác minh mạng quảng cáo chỉ có trên bề mặt công khai. `other` được các trang con thừa kế vì không trang
 * nào khai lại field `other` (Next gộp metadata theo từng field cấp một).
 */
export const metadata: Metadata = {
  other: { [AD_NETWORK_VERIFICATION.name]: AD_NETWORK_VERIFICATION.content },
};

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
    /*
     * `theme-editorial` = tầng token riêng của surface công khai (định nghĩa trong
     * globals.css). Đặt ở ĐÂY, không ở <html>, vì /admin và /c/[slug] phải giữ bộ
     * token nền — đó là cả mục đích của việc tách scope.
     *
     * Phải tự khai `bg-background text-foreground` lần nữa dù <body> đã có: hai
     * class đó ở <body> phân giải bằng token NỀN (body nằm ngoài scope này), nên
     * không có div này thì nền trang vẫn là nền của /admin.
     *
     * `flex flex-1 flex-col` để chuỗi header → main flex-1 → footer vẫn đẩy được
     * footer xuống đáy: <body> là flex column, div này là item duy nhất của nó.
     */
    <div className="theme-editorial flex flex-1 flex-col bg-background text-foreground">
      {/*
        Skip link: người dùng bàn phím không phải tab qua toàn bộ nav mỗi trang.
        Ẩn tới khi được focus — không dùng `hidden` vì như vậy sẽ không focus được.
      */}
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:border focus:border-primary focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Bỏ qua, tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" className="flex-1">
        {children}
      </main>

      <SiteFooter />

      {/*
        Skimlinks — script affiliate bên thứ ba, CHỈ ở bề mặt công khai và CHỈ ở production. Nó đặt cookie và
        ghi nhận liên kết ra ngoài được bấm, nên `/chinh-sach-bao-mat`, `/tiet-lo-lien-ket` và `/gioi-thieu`
        phải nói đúng điều đó (bất biến 11 và 22). `afterInteractive`: không chặn render, vẫn kịp chạy trước
        khi người đọc bấm liên kết.
      */}
      {process.env.NODE_ENV === "production" ? (
        <Script src={SKIMLINKS_SRC} strategy="afterInteractive" />
      ) : null}
    </div>
  );
}
