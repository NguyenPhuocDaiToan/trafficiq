import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/ui";
import { changeOwnPassword } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/current-user";
import { PASSWORD_MIN } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tài khoản của tôi" };

export default async function AccountPage() {
  const me = await requireUser();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tài khoản của tôi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.name} · <span className="font-mono text-xs">{me.email}</span> ·{" "}
          {me.role === "owner" ? "Owner" : "Thành viên"}
        </p>
      </div>

      <Card
        title="Đổi mật khẩu"
        description="Đổi xong, mọi thiết bị khác của bạn bị đăng xuất; thiết bị này giữ nguyên phiên."
      >
        <ActionForm action={changeOwnPassword} submitLabel="Đổi mật khẩu" className="grid gap-3">
          <Field label="Mật khẩu hiện tại">
            <input type="password" name="current" required autoComplete="current-password" className={inputClass} />
          </Field>
          <Field label="Mật khẩu mới" hint={`tối thiểu ${PASSWORD_MIN} ký tự`}>
            <input
              type="password"
              name="next"
              required
              minLength={PASSWORD_MIN}
              maxLength={200}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <input
              type="password"
              name="confirm"
              required
              minLength={PASSWORD_MIN}
              maxLength={200}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
