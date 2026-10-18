"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copyText } from "@/components/tracking-link";

/**
 * Kết quả ngay sau khi tạo chiến dịch: link theo dõi to, rõ, đã được thử sao chép sẵn.
 *
 * Tự sao chép là "cố gắng chứ không hứa": trình duyệt chỉ cho ghi clipboard khi trang đang được focus và thường
 * cần một thao tác của người dùng, nên sau một lần chuyển trang nó có thể bị từ chối. Bị từ chối thì KHÔNG báo lỗi —
 * nút "Sao chép" bên cạnh luôn dùng được và chữ trên panel nói đúng điều đã xảy ra (đã tự chép / bấm để chép), chứ
 * không khẳng định đã chép khi chưa.
 */
export function CreatedLinkPanel({
  url,
  name,
  editHref,
  reactivated,
}: {
  url: string;
  name: string;
  editHref: string;
  reactivated: number;
}) {
  const [state, setState] = useState<"auto" | "copied" | "failed" | "idle">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void copyText(url).then((ok) => {
      if (!cancelled && ok) setState("auto");
    });
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [url]);

  async function onCopy() {
    const ok = await copyText(url);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(ok ? "auto" : "idle"), 2500);
  }

  return (
    <section
      aria-label="Link vừa tạo"
      className="rounded-xl border border-success bg-success/10 p-4 text-card-foreground"
    >
      <p className="text-sm font-semibold text-success">
        Đã tạo &ldquo;{name}&rdquo; — đang chạy.{" "}
        {state === "auto" ? "Link đã được sao chép sẵn, dán đi dùng luôn." : "Sao chép link bên dưới rồi đem đi đăng."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở link này cũng được tính là một click thật trong báo cáo"
          className="min-w-0 flex-1 cursor-pointer font-mono text-sm font-medium break-all text-primary underline underline-offset-2"
        >
          {url}
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 cursor-pointer rounded-lg border border-primary bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary"
        >
          {state === "copied" ? "Đã sao chép" : state === "failed" ? "Không chép được — bôi đen link để chép" : "Sao chép link"}
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {state === "auto" || state === "copied" ? "Đã sao chép link theo dõi" : ""}
      </p>

      {reactivated > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Đã bật lại {reactivated} URL đích đang tạm dừng vì chiến dịch này dùng chúng.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Mở link bằng cách bấm cũng được tính là một click thật. Muốn đổi tên, tiêu đề, thẻ chia sẻ thì{" "}
        <Link href={editHref} className="cursor-pointer text-primary underline">
          sửa chiến dịch
        </Link>
        .
      </p>
    </section>
  );
}
