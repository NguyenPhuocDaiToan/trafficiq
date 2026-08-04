import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPassword } from "@/lib/env";
import { SESSION_COOKIE, sessionValueFor } from "@/lib/auth/session";
import { buttonPrimaryClass, inputClass } from "@/components/ui";

export const metadata = { title: "Đăng nhập · TrafficIQ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const provided = String(formData.get("password") ?? "");
    const target = String(formData.get("next") ?? "/admin/campaigns");

    const expected = adminPassword();
    if (provided !== expected) {
      redirect(`/admin/login?error=1&next=${encodeURIComponent(target)}`);
    }

    const store = await cookies();
    store.set(SESSION_COOKIE, await sessionValueFor(expected), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // Chỉ nhận đường dẫn nội bộ — chặn open-redirect qua ?next=
    redirect(target.startsWith("/admin") ? target : "/admin/campaigns");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Quản trị TrafficIQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nhập mật khẩu quản trị để vào trang điều hành.
      </p>

      <form action={login} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/admin/campaigns"} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          className={inputClass}
          placeholder="Mật khẩu"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Mật khẩu không đúng.
          </p>
        ) : null}
        <button type="submit" className={buttonPrimaryClass}>
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
