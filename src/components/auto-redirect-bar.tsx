"use client";

import { useEffect, useState } from "react";

interface AutoRedirectBarProps {
  ctaHref: string;
  seconds: number;
}

/**
 * Client component hiển thị thanh đếm ngược tự động chuyển hướng người dùng sang trang đối tác
 * sau `seconds` giây (Presell Page Auto-Redirect Strategy).
 */
export function AutoRedirectBar({ ctaHref, seconds }: AutoRedirectBarProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (seconds <= 0 || cancelled) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = ctaHref;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ctaHref, seconds, cancelled]);

  if (seconds <= 0 || cancelled) return null;

  return (
    <aside
      role="region"
      aria-label="Tự động chuyển hướng"
      className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-accent/30 bg-card p-4 shadow-2xl backdrop-blur-md text-card-foreground transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-sm">
            <span className="animate-pulse">{timeLeft}s</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">
              Đang chuyển hướng tới ưu đãi...
            </span>
            <span className="text-[11px] text-muted-foreground">
              Tự động nhảy trang sau {timeLeft} giây
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={ctaHref}
            className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition-opacity hover:opacity-90 shrink-0"
          >
            Chuyển ngay
          </a>
          <button
            type="button"
            onClick={() => setCancelled(true)}
            title="Tắt tự động chuyển hướng"
            className="cursor-pointer rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground shrink-0"
          >
            Ở lại
          </button>
        </div>
      </div>
    </aside>
  );
}
