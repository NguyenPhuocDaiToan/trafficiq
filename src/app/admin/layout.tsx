import Link from "next/link";

export const metadata = {
  title: "Quản trị TrafficIQ",
  // Control plane không bao giờ được index.
  robots: { index: false, follow: false },
};

/**
 * Nhãn tiếng Việt. Toàn bộ control plane dùng tiếng Việt vì người vận hành là
 * người Việt — thuật ngữ nào là danh từ riêng của ngành thì giữ nguyên trong
 * ngoặc để đối chiếu với tài liệu ad network (postback, offer, destination…).
 */
const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/campaigns", label: "Chiến dịch" },
  { href: "/admin/destinations", label: "URL đích" },
  { href: "/admin/advertisers", label: "Đối tác" },
  { href: "/admin/lien-he", label: "Hộp thư" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* header-height: 56px (Data-Dense Dashboard variable) */}
      <header className="border-b border-border bg-card">
        <nav className="mx-auto flex h-14 max-w-350 flex-wrap items-center gap-4 px-4 text-sm">
          {/* Logo dùng font-sans như mọi heading khác — xem MASTER.md § Typography. */}
          <span className="font-semibold tracking-tight">TrafficIQ</span>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
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
