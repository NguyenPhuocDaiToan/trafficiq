import type { Metadata } from "next";
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { publicBaseUrl } from "@/lib/env";
import { SITE, TITLE_TEMPLATE } from "@/lib/site";

/*
 * Typography — chốt trong design-system/trafficiq/MASTER.md § Typography.
 *
 * VÌ SAO KHÔNG CÒN Fira Code / Fira Sans:
 * Fira Code KHÔNG có subset `vietnamese` (kiểm: next/font font-data.json, và
 * chính typography.csv của skill cũng cờ nó là no-VI). Mọi heading admin dùng
 * `font-mono` nên chữ có dấu (ạ ả ấ ầ ế ệ ộ ớ ợ ữ — khối U+1EA0–1EF9) rơi sang
 * font hệ thống ngay giữa từ: "Trạng thái" render bằng hai font khác nhau.
 * Đó là lý do thật của cảm giác "font chưa thân thiện", không phải chuyện gu.
 *
 *   Sans = Be Vietnam Pro — thiết kế riêng cho tiếng Việt, humanist, dấu gọn.
 *          Dùng cho body VÀ heading của cả ba surface.
 *   Mono = JetBrains Mono — CÓ subset vietnamese, chỉ dùng cho cột số liệu
 *          (tabular-nums), code, token/URL. KHÔNG dùng cho heading nữa.
 *
 * Chỉ nạp 2 subset: `latin` + `vietnamese`. Không cần `latin-ext` vì Ăă Đđ Ơơ Ưư
 * đã nằm trong subset vietnamese (U+0102-0103, U+0110-0111, U+01A0-01A1, U+01AF-01B0).
 */
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  // Italic cho <em> trong bài viết — thiếu nó browser tự nghiêng giả, dấu bị méo.
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  // Không khai `weight` => lấy bản variable: 1 file cho mọi độ đậm.
  display: "swap",
});

/*
 * Display = Fraunces, CHỈ cho tiêu đề của surface công khai (`.theme-editorial`).
 *
 * Vì sao thêm họ chữ thứ ba dù AGENTS.md trước đây chốt "mọi heading dùng
 * font-sans": site này cố ý không có ảnh (ràng buộc bandwidth Hobby ~100GB/tháng),
 * nên chữ là phương tiện tạo hình DUY NHẤT. Một site editorial mà tiêu đề và thân
 * bài cùng một họ sans thì không có tương phản nào giữa "nhan đề" và "văn bản" —
 * đó là phần lớn cảm giác trang trông phẳng và tạm bợ.
 *
 * Điều kiện để được thêm (kiểm trước khi nạp, đúng luật AGENTS.md):
 *   node -e "console.log(require('next/dist/compiled/@next/font/dist/google/font-data.json')['Fraunces'].subsets.join(','))"
 *   -> latin,latin-ext,vietnamese   ✓ có subset vietnamese
 *
 * Chi phí giữ ở mức tối thiểu: ĐÚNG MỘT weight (700) và chỉ subset `latin` +
 * `vietnamese`. `/admin` KHÔNG dùng font này.
 *
 * Vì sao một weight chứ không phải 600 + 700: đo trên bản build, mỗi weight của
 * Fraunces tốn ~44KB cho một trang tiếng Việt (latin 32.9KB + vietnamese 11.3KB —
 * browser tải theo `unicode-range` nên một câu có dấu sẽ kéo cả hai file). Hai
 * weight là ~88KB chỉ để có hai độ đậm của cùng một họ chữ, trong khi bố cục
 * editorial dựng thứ bậc bằng CỠ CHỮ. Vì vậy mọi nhan đề dùng `font-bold`; đừng
 * thêm `font-semibold` lên `font-display` — browser sẽ phải giả độ đậm.
 * Đo lại sau khi build:
 *   node -e "..."  # xem @font-face của Fraunces trong .next/static/chunks/*.css
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "vietnamese"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicBaseUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: TITLE_TEMPLATE },
  description: SITE.description,
  applicationName: SITE.name,
  /* Người, không phải tên site: `authors` sinh ra `<meta name="author">`, và mục đó
     phải khớp byline hiện trên bài (bất biến #13). Trang bài khai lại `authors` của
     riêng nó — đây là mặc định cho các trang không có tác giả riêng. */
  authors: [{ name: SITE.owner, url: "/gioi-thieu" }],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "vi_VN",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
