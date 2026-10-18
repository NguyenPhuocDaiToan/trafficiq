"use client";

import { useEffect, useRef, useState } from "react";
import { buttonSecondaryClass } from "@/components/ui";

/**
 * Chép văn bản vào clipboard. `navigator.clipboard` chỉ có ở ngữ cảnh an toàn (HTTPS/localhost) và có thể bị từ
 * chối quyền; rơi về `execCommand("copy")` qua một textarea tạm để nút vẫn chạy khi trang mở qua HTTP hoặc
 * trong trình duyệt cũ. Trả `true` nếu chép được.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // rơi xuống cách dự phòng bên dưới
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Link theo dõi dạng liên kết bấm được + nút "Sao chép".
 *
 * Bấm vào link mở `/go/<token>` trong tab mới — và đó là một lượt click THẬT: nó được ghi vào `clickEvents` và
 * redirect sang đối tác như mọi người dùng khác, nên lần admin tự thử link sẽ nằm trong báo cáo. Vì vậy link có
 * `title` nói rõ điều đó. Muốn xem trang mà không tạo click thì dùng nút "Xem trước" của chiến dịch.
 *
 * Dùng được bên trong `<summary>` của `<details>`: bấm vào link hay nút thì chỉ phần tử đó nhận thao tác,
 * không làm bung/thu dòng (trình duyệt chọn phần tử kích hoạt gần nhất, là <a>/<button>, chứ không phải <summary>).
 */
export function TrackingLink({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onCopy() {
    const ok = await copyText(url);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Mở link này cũng được tính là một click thật trong báo cáo"
        className="min-w-0 cursor-pointer font-mono text-xs break-all text-primary underline underline-offset-2"
      >
        {url}
      </a>
      <button type="button" onClick={onCopy} className={`${buttonSecondaryClass} shrink-0`}>
        {state === "copied" ? "Đã sao chép" : state === "failed" ? "Không chép được" : "Sao chép"}
      </button>
      {/* Thông báo cho trình đọc màn hình; chữ trên nút đã đổi nên không cần hiện thêm ở đây. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Đã sao chép link theo dõi" : state === "failed" ? "Không sao chép được link" : ""}
      </span>
    </span>
  );
}
