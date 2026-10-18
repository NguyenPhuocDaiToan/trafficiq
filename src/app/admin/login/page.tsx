import { buttonPrimaryClass, inputClass } from "@/components/ui";
import { login } from "@/lib/auth/actions";

export const metadata = { title: "Đăng nhập · TrafficIQ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Quản trị TrafficIQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Đăng nhập bằng tài khoản quản trị của bạn.
      </p>

      <form action={login} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/admin/campaigns"} />
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="username"
          className={inputClass}
          placeholder="Email"
        />
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="Mật khẩu"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Email hoặc mật khẩu không đúng, hoặc tài khoản đang bị khoá tạm. Thử lại sau vài phút nếu
            bạn chắc chắn mình nhập đúng.
          </p>
        ) : null}
        <button type="submit" className={buttonPrimaryClass}>
          Đăng nhập
        </button>
      </form>
    </main>
  );
}
