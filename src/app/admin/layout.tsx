import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { GuideTour } from "@/components/guide-tour";
import { logout } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "Quản trị TrafficIQ",
  // Control plane không bao giờ được index.
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /*
   * Lớp kiểm thứ hai sau proxy: proxy chỉ biết cookie do ta ký, layout biết tài khoản còn hoạt động không
   * (xem `lib/auth/current-user.ts`). Layout không đọc được pathname nên proxy truyền nó qua `x-tiq-path`.
   *
   * Thiếu header (proxy không chạy) được coi là trang CẦN đăng nhập — mặc định an toàn: chỉ đúng chuỗi
   * "/admin/login" mới được bỏ qua, nên không có đường nào "quên header là mở cửa".
   */
  const path = (await headers()).get("x-tiq-path");
  const user = await getCurrentUser();
  if (path !== "/admin/login" && !user) redirect("/admin/login");

  return (
    <div className="min-h-screen">
      {/*
       * header-height: 56px (Data-Dense Dashboard variable) — dùng min-h thay vì
       * h cố định vì nav wrap xuống dòng ở mobile, h-14 sẽ cắt mất hàng thứ hai.
       */}
      {user ? (
        <header className="border-b border-border bg-card">
          <nav className="mx-auto flex min-h-14 max-w-350 flex-wrap items-center gap-4 px-4 py-2 text-sm">
            {/* Logo dùng font-sans như mọi heading khác — xem MASTER.md § Typography. */}
            <span className="font-semibold tracking-tight">TrafficIQ</span>
            <AdminNav isOwner={user.role === "owner"} />
            <div className="ml-auto flex flex-wrap items-center gap-4">
              <Link
                href="/"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                Xem website
              </Link>
              <Link
                href="/admin/tai-khoan"
                title={user.email}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {user.name}
                {user.role === "owner" ? " (owner)" : ""}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          </nav>
        </header>
      ) : null}
      {/* Dashboard max-width 1400px theo pages/dashboard.md */}
      <main className={user ? "mx-auto max-w-350 px-4 py-6" : undefined}>{children}</main>
      {/*
        Coach mark + nút "Hướng dẫn trang này". Gắn một lần ở đây để mọi trang admin có, và để
        `?huongdan=<bài>` chạy được trên bất kỳ trang nào mà không trang nào phải tự nhớ. `Suspense` vì
        `useSearchParams` buộc phải có ranh giới này; không có gì để hiện trong lúc chờ nên fallback là null.
      */}
      {user ? (
        <Suspense fallback={null}>
          <GuideTour />
        </Suspense>
      ) : null}
    </div>
  );
}
