"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LandingView } from "@/components/landing-view";
import { StatusBadge } from "@/components/ui";
import type { CampaignLanding, EntityStatus } from "@/lib/types";

interface CampaignPreviewDrawerProps {
  campaign: {
    id: string;
    name: string;
    slug: string;
    status: EntityStatus;
    hasContent: boolean;
  };
  frameSrc: string;
  baseUrl: string;
  onClose?: () => void;
  /**
   * Dữ liệu landing thời gian thực (Live Preview).
   * Khi truyền prop này, drawer sẽ render trực tiếp nội dung đang chỉnh sửa 
   * tức thì mà không cần bấm Lưu hay tải lại iframe.
   */
  liveLanding?: CampaignLanding;
}

type PreviewMode = "phone" | "laptop";

/**
 * Slider sidebar xem trước trang giới thiệu chiến dịch từ bên phải sang.
 *
 * Cho phép chuyển đổi linh hoạt giữa chế độ Điện thoại (375px) và Máy tính / Laptop (1440px).
 * Mặc định mở ở chế độ Điện thoại (phone mode). Hỗ trợ Live Preview trực tiếp khi chỉnh sửa.
 */
export function CampaignPreviewDrawer({
  campaign,
  frameSrc,
  baseUrl,
  onClose,
  liveLanding,
}: CampaignPreviewDrawerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PreviewMode>("phone");
  const [useLive, setUseLive] = useState<boolean>(Boolean(liveLanding));
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Kích hoạt slide-in animation sau khi mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    const timer = setTimeout(() => {
      if (onClose) {
        onClose();
      } else if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/admin/campaigns");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [onClose, router]);

  // Phím Escape để đóng sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  // Khóa scroll trang chính khi sidebar mở
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const isOpen = mounted && !isClosing;
  const currentLanding = useLive && liveLanding ? liveLanding : null;

  return (
    <div aria-live="polite">
      {/* Dynamic Overlay Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-40 bg-background/80 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Slider Sidebar Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Xem trước chiến dịch ${campaign.name}`}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-card text-card-foreground shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${
          mode === "phone"
            ? "w-full max-w-xl"
            : "w-full max-w-[95vw] xl:max-w-6xl"
        }`}
      >
        {/* Drawer Header */}
        <header className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="truncate text-base font-semibold">
                Xem trước: {campaign.name}
              </h2>
              <StatusBadge status={campaign.status} />
              {liveLanding && (
                <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              aria-label="Đóng bảng xem trước"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Controls Bar: Mode Switcher & Navigation Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Device Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center rounded-lg border border-border bg-muted p-1"
                role="tablist"
                aria-label="Chọn thiết bị xem trước"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "phone"}
                  onClick={() => setMode("phone")}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    mode === "phone"
                      ? "bg-accent text-on-accent shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PhoneIcon />
                  <span>Điện thoại</span>
                  <span className="font-mono text-[10px] opacity-80">(375px)</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "laptop"}
                  onClick={() => setMode("laptop")}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    mode === "laptop"
                      ? "bg-accent text-on-accent shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LaptopIcon />
                  <span>Máy tính / Laptop</span>
                </button>
              </div>

              {/* Source Switcher (Live vs Frame) */}
              {liveLanding && (
                <button
                  type="button"
                  onClick={() => setUseLive(!useLive)}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    useLive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {useLive ? "⚡ Đang xem LIVE" : "💾 Xem bản đã lưu"}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={`/admin/campaigns/${campaign.id}/edit`}
                className="cursor-pointer rounded-lg border border-primary px-2.5 py-1 font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary"
              >
                Sửa nội dung
              </Link>
              {campaign.status !== "paused" && (
                <Link
                  href={`/c/${campaign.slug}`}
                  target="_blank"
                  className="inline-flex cursor-pointer items-center gap-1 font-medium text-primary underline"
                >
                  <span>Mở trang thật</span>
                  <ExternalLinkIcon />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Info Notices inside Drawer */}
        {campaign.status === "paused" ? (
          <div className="bg-muted/60 px-4 py-2 text-xs text-muted-foreground border-b border-border">
            Chiến dịch đang tạm dừng nên <code className="font-mono text-xs">/c/{campaign.slug}</code> trả 404 với người ngoài. Khung dưới đây vẫn xem được.
          </div>
        ) : null}

        {campaign.status === "pending" ? (
          <div className="bg-warning/10 px-4 py-2 text-xs text-warning border-b border-border">
            Chiến dịch chờ duyệt: link theo dõi chưa chạy. Cần kích hoạt ở danh sách chiến dịch.
          </div>
        ) : null}

        {!campaign.hasContent && !currentLanding?.bodyHtml ? (
          <div className="bg-warning/10 px-4 py-2 text-xs text-warning border-b border-border">
            Chưa có thân bài — trang chỉ có tiêu đề và nút bấm. Thêm luận điểm ở trang sửa.
          </div>
        ) : null}

        {/* Drawer Body Frame Container */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start bg-muted/30">
          {mode === "phone" ? (
            /* Phone Viewport Frame */
            <div className="flex flex-col items-center w-full my-auto py-2">
              {/* Phone Device Shell Mockup */}
              <div className="relative w-[375px] max-w-full rounded-[2.5rem] border-4 border-input bg-background shadow-2xl overflow-hidden flex flex-col">
                {/* Speaker Notch */}
                <div className="flex justify-center bg-card py-2 border-b border-border shrink-0">
                  <div className="h-3 w-20 rounded-full bg-muted border border-border" />
                </div>
                
                {/* Frame Content */}
                <div className="w-full h-[667px] overflow-y-auto bg-background theme-editorial">
                  {currentLanding ? (
                    <LandingView landing={currentLanding} />
                  ) : (
                    <iframe
                      src={frameSrc}
                      title={`Xem trước trên điện thoại: ${campaign.name}`}
                      width={375}
                      height={667}
                      className="block w-full h-full border-none bg-background"
                      loading="eager"
                    />
                  )}
                </div>

                {/* Home Bar Indicator */}
                <div className="flex justify-center bg-card py-2 border-t border-border shrink-0">
                  <div className="h-1 w-28 rounded-full bg-muted-foreground/30" />
                </div>
              </div>
              <span className="mt-3 font-mono text-xs text-muted-foreground tabular-nums">
                Viewport Width: 375px {currentLanding ? "(Live Real-time)" : ""}
              </span>
            </div>
          ) : (
            /* Laptop / Desktop Viewport Frame */
            <div className="w-full h-full flex flex-col rounded-xl border border-input bg-background shadow-xl overflow-hidden min-h-[600px]">
              {/* Browser Bar */}
              <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <div className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <div className="size-2.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="mx-auto flex max-w-md flex-1 items-center justify-center rounded-md border border-input bg-background px-3 py-1 text-xs text-muted-foreground font-mono truncate">
                  {baseUrl}/c/{campaign.slug}
                </div>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  Responsive Viewport {currentLanding ? "(Live Real-time)" : ""}
                </span>
              </div>
              {/* Content */}
              <div className="flex-1 w-full min-h-[600px] overflow-y-auto bg-background theme-editorial">
                {currentLanding ? (
                  <LandingView landing={currentLanding} />
                ) : (
                  <iframe
                    src={frameSrc}
                    title={`Xem trước trên máy tính: ${campaign.name}`}
                    className="block w-full h-full min-h-[600px] border-none bg-background"
                    loading="eager"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function LaptopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M20 16V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11m16 0s1 0 1 2v1H3v-1c0-2 1-2 1-2m16 0H4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
