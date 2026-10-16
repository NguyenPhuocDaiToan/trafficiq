"use client";

import { useSyncExternalStore } from "react";
import { parseDone, readRaw, resetDone, subscribeProgress } from "@/lib/guide/progress";

/**
 * Các mảnh nhỏ của hub hướng dẫn cần đọc tiến độ từ trình duyệt. Tách riêng để phần còn lại của trang
 * (rất nhiều chữ) vẫn là server component và render được khi JS chưa tải.
 *
 * `getServerSnapshot` trả "" nên server và lần render hydrate đầu tiên khớp nhau (chưa có gì "đã xem");
 * sau hydrate React tự cập nhật theo `localStorage` mà không cảnh báo lệch.
 */
function useDoneIds(): string[] {
  const raw = useSyncExternalStore(subscribeProgress, readRaw, () => "");
  return parseDone(raw);
}

/** Dấu "Đã xem" trên thẻ bài học. Có chữ chứ không chỉ màu (WCAG 1.4.1). */
export function LessonDoneBadge({ id }: { id: string }) {
  const done = useDoneIds().includes(id);
  if (!done) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-3.5">
        <path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Đã xem
    </span>
  );
}

/** "2/5 bài đã xem" + nút làm lại. `ids` là danh sách bài cần đếm (ví dụ lộ trình bắt đầu nhanh). */
export function ProgressSummary({ ids }: { ids: readonly string[] }) {
  const done = useDoneIds();
  const count = ids.filter((id) => done.includes(id)).length;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>
        <span className="font-medium tabular-nums text-foreground">{count}</span>/
        <span className="tabular-nums">{ids.length}</span> bài đã xem
      </span>
      {count > 0 ? (
        <button
          type="button"
          onClick={resetDone}
          className="cursor-pointer text-xs underline underline-offset-2 hover:text-foreground"
        >
          Đặt lại tiến độ
        </button>
      ) : null}
    </p>
  );
}
