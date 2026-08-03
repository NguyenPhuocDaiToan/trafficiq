import Link from "next/link";

export const metadata = {
  title: "TrafficIQ Admin",
  // Control plane không bao giờ được index.
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/destinations", label: "Destinations" },
  { href: "/admin/advertisers", label: "Advertisers" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* header-height: 56px (Data-Dense Dashboard variable) */}
      <header className="border-b border-border bg-card">
        <nav className="mx-auto flex h-14 max-w-350 flex-wrap items-center gap-4 px-4 text-sm">
          <span className="font-mono font-semibold">TrafficIQ</span>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {/* Dashboard max-width 1400px theo pages/dashboard.md */}
      <main className="mx-auto max-w-350 px-4 py-6">{children}</main>
    </div>
  );
}
