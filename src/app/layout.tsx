import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";

/*
 * Typography chốt trong design-system/trafficiq/MASTER.md:
 *   Body    = Fira Sans
 *   Heading = Fira Code (mono) — cũng dùng cho mọi cột số liệu, vì mono làm số
 *             thẳng hàng trong bảng metrics, đúng mood "dashboard, data, precise".
 *
 * Dùng next/font (self-host lúc build) thay vì @import CSS như MASTER.md gợi ý:
 * tránh request sang fonts.googleapis.com trên hot path và không bị FOUT.
 */
const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "TrafficIQ", template: "%s" },
  description: "Campaign landing + tracking platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
