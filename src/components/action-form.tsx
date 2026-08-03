"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/control-plane/schemas";
import { buttonPrimaryClass, buttonSecondaryClass } from "@/components/ui";

/**
 * Signature khớp đúng thứ `useActionState` cần, nên server action được truyền
 * TRỰC TIẾP vào nó — không bọc qua closure phía client.
 *
 * Vì sao quan trọng: nếu bọc bằng closure `(prev, fd) => action(fd)` thì cái
 * React đăng ký là hàm client, form mất field `$ACTION_ID_` và **control plane
 * chỉ chạy khi có JS**. Truyền trực tiếp thì React render được form action thật
 * → submit không cần JS vẫn ghi được dữ liệu (chỉ mất phần hiện message).
 */
type ServerAction = (
  prevState: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  resetOnSuccess = true,
}: {
  action: ServerAction;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state?.ok ? state.message : "form"}
    >
      {children}

      <div className="col-span-full">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Đang lưu…" : submitLabel}
        </button>

        {/* role=status để screen reader đọc kết quả action, không chỉ hiện màu. */}
        <p role="status" aria-live="polite" className="mt-2 text-sm">
          {state && !state.ok ? (
            <span className="text-destructive">{state.error}</span>
          ) : null}
          {state?.ok ? <span className="text-success">{state.message}</span> : null}
        </p>
      </div>
    </form>
  );
}

/**
 * Nút submit một form nhỏ với các field ẩn tuỳ ý.
 *
 * Dùng khi giá trị cần gửi không phải `EntityStatus` — ví dụ đánh dấu tin nhắn
 * liên hệ đã xử lý (`handled: "true" | "false"`). Vẫn truyền server action trực
 * tiếp vào `useActionState` như `StatusButton`, nên vẫn chạy khi không có JS.
 */
export function FieldsButton({
  action,
  fields,
  label,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  label: string;
}) {
  const [, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={buttonSecondaryClass}>
        {pending ? "…" : label}
      </button>
    </form>
  );
}

/** Nút đổi trạng thái: 1 form nhỏ, không cần JS state. */
export function StatusButton({
  action,
  id,
  status,
  label,
}: {
  action: ServerAction;
  id: string;
  status: "pending" | "active" | "paused";
  label: string;
}) {
  const [, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" disabled={pending} className={buttonSecondaryClass}>
        {pending ? "…" : label}
      </button>
    </form>
  );
}
