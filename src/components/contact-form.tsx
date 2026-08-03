"use client";

import { useActionState } from "react";
import { submitContactMessage } from "@/lib/contact/actions";
import { HONEYPOT_FIELD } from "@/lib/contact/schema";

/*
 * Input của surface công khai cao hơn của dashboard (48px so với 36px): người
 * dùng ở đây nhập trên điện thoại, không phải nhập số liệu hàng loạt.
 * Viền dùng `border-input` (đạt 3:1) chứ KHÔNG dùng `border-border` — cùng luật
 * với dashboard, xem comment trong components/ui.tsx.
 */
const field =
  "w-full rounded-lg border border-input bg-card px-4 py-3 text-base text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none";

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold">
      {children}
    </label>
  );
}

/**
 * Form liên hệ.
 *
 * `submitContactMessage` được truyền TRỰC TIẾP vào `useActionState` — không bọc
 * closure. Nhờ vậy React render được form action thật, nên form vẫn gửi được khi
 * JS bị chặn (chỉ mất phần hiện thông báo tại chỗ). Đây là lỗi đã từng làm cả
 * control plane chỉ chạy khi có JS; xem components/action-form.tsx.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactMessage, null);

  return (
    <form
      action={formAction}
      className="space-y-5"
      /* Gửi thành công thì remount để xóa sạch các field đã nhập. */
      key={state?.ok ? state.message : "form"}
    >
      <div>
        <Label htmlFor="name">Tên của bạn</Label>
        <div className="mt-2">
          <input id="name" name="name" required autoComplete="name" className={field} />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <div className="mt-2">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
            placeholder="ban@congty.com"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Chỉ dùng để trả lời bạn. Chúng tôi không đưa vào danh sách gửi thư nào.
        </p>
      </div>

      <div>
        <Label htmlFor="subject">Tiêu đề</Label>
        <div className="mt-2">
          <input
            id="subject"
            name="subject"
            required
            className={field}
            placeholder="Hợp tác / Góp ý nội dung / Báo lỗi"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="message">Nội dung</Label>
        <div className="mt-2">
          <textarea id="message" name="message" required rows={7} className={field} />
        </div>
      </div>

      {/*
        Bẫy bot. Người thật không thấy và không tab vào được; bot đọc HTML sẽ điền.
        Không dùng `type="hidden"` vì bot bỏ qua field hidden — cần nó trông như
        field thật trong DOM.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang gửi…" : "Gửi tin nhắn"}
        </button>

        {/* role=status để screen reader đọc kết quả, không chỉ đổi màu chữ. */}
        <p role="status" aria-live="polite" className="mt-3 text-sm">
          {state && !state.ok ? (
            <span className="text-destructive">{state.error}</span>
          ) : null}
          {state?.ok ? <span className="text-success">{state.message}</span> : null}
        </p>
      </div>
    </form>
  );
}
