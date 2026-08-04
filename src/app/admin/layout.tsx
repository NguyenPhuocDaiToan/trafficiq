import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";

export const metadata = {
  title: "Quản trị TrafficIQ",
  // Control plane không bao giờ được index.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/*
       * header-height: 56px (Data-Dense Dashboard variable) — dùng min-h thay vì
       * h cố định vì nav wrap xuống dòng ở mobile, h-14 sẽ cắt mất hàng thứ hai.
       */}
      <header className="border-b border-border bg-card">
        <nav className="mx-auto flex min-h-14 max-w-350 flex-wrap items-center gap-4 px-4 py-2 text-sm">
          {/* Logo dùng font-sans như mọi heading khác — xem MASTER.md § Typography. */}
          <span className="font-semibold tracking-tight">TrafficIQ</span>
          <AdminNav />
          <Link
            href="/"
            className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Xem website
          </Link>
        </nav>
      </header>
      {/* Dashboard max-width 1400px theo pages/dashboard.md */}
      <main className="mx-auto max-w-350 px-4 py-6">{children}</main>
    </div>
  );
}
