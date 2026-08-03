import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { publicBaseUrl } from "@/lib/env";
import { SITE } from "@/lib/site";

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

export const metadata: Metadata = {
  metadataBase: new URL(publicBaseUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name }],
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
      className={`${beVietnamPro.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
