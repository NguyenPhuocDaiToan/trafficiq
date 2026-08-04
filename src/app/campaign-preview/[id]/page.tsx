import { notFound } from "next/navigation";
import { LandingView } from "@/components/landing-view";
import { getCampaignById } from "@/lib/control-plane/queries";

export const dynamic = "force-dynamic";

/**
 * NỘI DUNG BÊN TRONG KHUNG xem trước. Không phải trang admin mở trực tiếp — nó là
 * `src` của các <iframe> ở /admin/campaigns/[id]/preview.
 *
 * ── Vì sao nằm NGOÀI /admin ──────────────────────────────────────────────────
 * `src/app/admin/layout.tsx` bọc MỌI route con bằng header + nav admin, và layout
 * cha trong App Router thì không thể bỏ từ route con. Đặt khung ở dưới /admin là
 * có nav admin nằm bên trong iframe — tức preview không còn giống trang thật.
 *
 * Bù lại, đường dẫn này KHÔNG tự động được bảo vệ như /admin, nên `src/proxy.ts`
 * có một entry matcher riêng cho nó. Đổi tên đường dẫn này thì phải sửa cả
 * matcher đó — nếu không, bản nháp của mọi campaign thành công khai.
 *
 * ── Vì sao không dùng thẳng /c/[slug] làm khung ──────────────────────────────
 * `/c/[slug]` chỉ nhận status active|pending nên campaign `paused` sẽ 404 — mà tạm
 * dừng chính là lúc cần xem lại nội dung để sửa. Route này đọc theo `_id` và không
 * lọc status.
 */
export const metadata = {
  title: "Xem trước trang giới thiệu",
  robots: { index: false, follow: false },
};

export default async function CampaignPreviewFrame({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  /*
   * Không truyền `ctaHref`: CTA render đúng hình dáng và vị trí nhưng không điều
   * hướng. Bấm thử trong preview mà đi qua /go/[token] là tạo click giả trong
   * clickEvents — làm sai chính báo cáo mà dashboard đang đọc.
   */
  return <LandingView landing={campaign.landing} />;
}
