"use client";

import { useCallback, useState } from "react";
import { CampaignPreviewDrawer } from "@/components/campaign-preview-drawer";
import { LandingView } from "@/components/landing-view";
import type { CampaignLanding, CampaignOg, EntityStatus } from "@/lib/types";

interface CampaignEditLivePreviewProps {
  campaign?: {
    id: string;
    name: string;
    slug: string;
    status: EntityStatus;
    landing: CampaignLanding;
    og?: CampaignOg;
  };
  baseUrl: string;
  children: React.ReactNode;
}

const DEFAULT_LANDING: CampaignLanding = {
  headline: "Tiêu đề trang giới thiệu",
  subheadline: "Tiêu đề phụ giới thiệu ngắn về ưu đãi...",
  ctaLabel: "Nhận ưu đãi ngay",
  bodyHtml: "<p>Nội dung chi tiết trang giới thiệu sẽ xuất hiện tại đây theo thời gian thực khi bạn soạn thảo.</p>",
};

/**
 * Client component bọc form tạo/sửa chiến dịch để hiển thị Live Preview bên cột phải (Side-by-side column)
 * tương tự như WhatsApp Template builder / Facebook Ads builder.
 *
 * - Cột trái: Form nhập liệu
 * - Cột phải (Sticky): Khung xem trước trực tiếp thời gian thực trên Điện thoại (375px), Máy tính, hoặc Thẻ chia sẻ Social (Open Graph Card).
 */
export function CampaignEditLivePreview({
  campaign,
  baseUrl,
  children,
}: CampaignEditLivePreviewProps) {
  const initialLanding = campaign?.landing ?? DEFAULT_LANDING;
  const initialName = campaign?.name ?? "Chiến dịch mới";
  const initialSlug = campaign?.slug ?? "chien-dich-moi";
  const initialStatus = campaign?.status ?? "pending";
  const campaignId = campaign?.id ?? "preview-new";

  const [showDrawer, setShowDrawer] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"phone" | "desktop" | "social">("phone");
  const [liveLanding, setLiveLanding] = useState<CampaignLanding>(initialLanding);
  const [liveName, setLiveName] = useState(initialName);
  const [liveSlug, setLiveSlug] = useState(initialSlug);
  const [liveOg, setLiveOg] = useState<CampaignOg>({
    title: campaign?.og?.title ?? initialLanding.headline ?? initialName,
    description: campaign?.og?.description ?? initialLanding.subheadline ?? "",
    imageUrl: campaign?.og?.imageUrl ?? initialLanding.heroImageUrl,
  });

  // Lắng nghe thay đổi trên form theo thời gian thực (0ms delay)
  const handleFormInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      const form = target.closest("form");
      if (!form) return;

      const formData = new FormData(form);

      const headline = (formData.get("headline") as string) || initialLanding.headline;
      const subheadline = (formData.get("subheadline") as string) || initialLanding.subheadline;
      const ctaLabel = (formData.get("ctaLabel") as string) || initialLanding.ctaLabel;
      const heroImageUrl = (formData.get("heroImageUrl") as string) || initialLanding.heroImageUrl;
      const bodyHtml = (formData.get("bodyHtml") as string) || initialLanding.bodyHtml;
      const name = (formData.get("name") as string) || initialName;
      const slug = (formData.get("slug") as string) || initialSlug;

      const ogTitle = (formData.get("ogTitle") as string) || headline || name;
      const ogDescription = (formData.get("ogDescription") as string) || subheadline || "";
      const ogImageUrl = (formData.get("ogImageUrl") as string) || heroImageUrl || undefined;

      const autoRedirectSeconds = Number(formData.get("autoRedirectSeconds")) || 0;

      setLiveLanding({
        headline,
        subheadline: subheadline || undefined,
        ctaLabel,
        heroImageUrl: heroImageUrl || undefined,
        bodyHtml: bodyHtml || undefined,
        bodyText: initialLanding.bodyText,
        autoRedirectSeconds: autoRedirectSeconds > 0 ? autoRedirectSeconds : undefined,
      });
      setLiveName(name);
      setLiveSlug(slug);
      setLiveOg({
        title: ogTitle,
        description: ogDescription,
        imageUrl: ogImageUrl || undefined,
      });
    },
    [initialLanding, initialName, initialSlug]
  );

  const frameSrc = campaign?.id ? `/campaign-preview/${campaign.id}` : "";

  return (
    <div className="space-y-4">
      {/* Split Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Edit Form */}
        <div
          className="space-y-6 lg:col-span-7 xl:col-span-7"
          onInput={handleFormInput}
          onChange={handleFormInput}
        >
          {children}
        </div>

        {/* Right Column: Sticky Live Preview Panel (WhatsApp Template Style) */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:col-span-5 xl:col-span-5">
          <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Xem trước Live</span>
                <span className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  LIVE
                </span>
              </div>

              {/* Viewport & Expand Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg border border-border bg-muted p-0.5">
                  <button
                    type="button"
                    title="Chế độ Điện thoại (375px)"
                    onClick={() => setPreviewDevice("phone")}
                    className={`cursor-pointer rounded-md p-1.5 transition-colors duration-150 ${
                      previewDevice === "phone"
                        ? "bg-accent text-on-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <PhoneIcon />
                  </button>
                  <button
                    type="button"
                    title="Chế độ Máy tính"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`cursor-pointer rounded-md p-1.5 transition-colors duration-150 ${
                      previewDevice === "desktop"
                        ? "bg-accent text-on-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LaptopIcon />
                  </button>
                  <button
                    type="button"
                    title="Thẻ chia sẻ Social (Facebook / Twitter Card)"
                    onClick={() => setPreviewDevice("social")}
                    className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 flex items-center gap-1 ${
                      previewDevice === "social"
                        ? "bg-accent text-on-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShareIcon />
                    <span className="hidden sm:inline">Social</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDrawer(true)}
                  title="Mở toàn màn hình"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground"
                >
                  <MaximizeIcon />
                  <span className="hidden sm:inline">Toàn màn hình</span>
                </button>
              </div>
            </div>

            {/* Live Preview Display Box */}
            <div className="mt-3 flex flex-col items-center justify-center bg-muted/40 p-2 sm:p-4 rounded-lg">
              {previewDevice === "phone" ? (
                /* Mobile Phone Shell Mockup */
                <div className="relative w-full max-w-[375px] rounded-[2rem] border-4 border-input bg-background shadow-xl overflow-hidden flex flex-col my-1">
                  {/* Phone Notch */}
                  <div className="flex justify-center bg-card py-1.5 border-b border-border shrink-0">
                    <div className="h-2.5 w-16 rounded-full bg-muted border border-border" />
                  </div>

                  {/* Scrollable Phone Screen Content */}
                  <div className="w-full h-[560px] overflow-y-auto bg-background theme-editorial text-foreground">
                    <LandingView landing={liveLanding} />
                  </div>

                  {/* Home Bar */}
                  <div className="flex justify-center bg-card py-1.5 border-t border-border shrink-0">
                    <div className="h-1 w-24 rounded-full bg-muted-foreground/30" />
                  </div>
                </div>
              ) : previewDevice === "desktop" ? (
                /* Laptop/Desktop Inline Frame Mockup */
                <div className="w-full rounded-lg border border-input bg-background shadow-md overflow-hidden flex flex-col my-1">
                  <div className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2 text-xs">
                    <div className="size-2 rounded-full bg-muted-foreground/30" />
                    <div className="size-2 rounded-full bg-muted-foreground/30" />
                    <div className="size-2 rounded-full bg-muted-foreground/30" />
                    <div className="ml-2 truncate font-mono text-[11px] text-muted-foreground">
                      {baseUrl}/c/{liveSlug}
                    </div>
                  </div>
                  <div className="w-full h-[560px] overflow-y-auto bg-background theme-editorial text-foreground">
                    <LandingView landing={liveLanding} />
                  </div>
                </div>
              ) : (
                /* Social Share Card Mockup (Facebook / Twitter Card Preview) */
                <div className="w-full max-w-[420px] rounded-xl border border-border bg-card overflow-hidden shadow-lg my-1">
                  {/* Header of post */}
                  <div className="flex items-center gap-2.5 p-3 border-b border-border/50 bg-muted/20">
                    <div className="size-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                      ID
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">InsightDaily</span>
                      <span className="text-[10px] text-muted-foreground font-mono">Đã chia sẻ liên kết • Preview Social Card</span>
                    </div>
                  </div>

                  {/* Card Banner Image */}
                  <div className="relative aspect-[1200/630] w-full bg-muted flex items-center justify-center overflow-hidden border-b border-border">
                    {liveOg.imageUrl ? (
                      <img
                        src={liveOg.imageUrl}
                        alt={liveOg.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                        <ImageIcon />
                        <span className="text-xs font-medium mt-1">Chưa nhập "Ảnh khi chia sẻ" (ogImageUrl)</span>
                        <span className="text-[10px] text-muted-foreground/70">Kích thước chuẩn: 1200 × 630 px</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Area */}
                  <div className="p-3.5 space-y-1 bg-card">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                      {baseUrl.replace(/^https?:\/\//, "")}/c/{liveSlug}
                    </div>
                    <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                      {liveOg.title || liveLanding.headline || liveName}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {liveOg.description || liveLanding.subheadline || "Mô tả xem trước khi chia sẻ link lên Facebook, Zalo, Twitter..."}
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-2 text-center text-xs text-muted-foreground font-mono">
                {previewDevice === "phone"
                  ? "Mobile Viewport (375px)"
                  : previewDevice === "desktop"
                  ? "Desktop Viewport"
                  : "Facebook / Twitter Open Graph Card Preview"}{" "}
                — Cập nhật trực tiếp khi gõ
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Slide-over Overlay Drawer for Full Screen preview */}
      {showDrawer && (
        <CampaignPreviewDrawer
          campaign={{
            id: campaignId,
            name: liveName,
            slug: liveSlug,
            status: initialStatus,
            hasContent: Boolean(liveLanding.bodyHtml || liveLanding.bodyText),
          }}
          frameSrc={frameSrc}
          baseUrl={baseUrl}
          liveLanding={liveLanding}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  );
}

function ShareIcon() {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 shrink-0 text-muted-foreground/60"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
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

function MaximizeIcon() {
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
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}
