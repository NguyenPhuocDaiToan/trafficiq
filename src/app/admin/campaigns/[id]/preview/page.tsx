import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignPreviewDrawer } from "@/components/campaign-preview-drawer";
import { Notice, StatusBadge } from "@/components/ui";
import { getCampaignById } from "@/lib/control-plane/queries";
import { publicBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Xem trước chiến dịch" };

/**
 * Xem trước trang giới thiệu, mở dưới dạng slider sidebar từ bên phải sang.
 *
 * Cho phép chuyển đổi giữa chế độ Điện thoại (375px) và Máy tính / Laptop (1440px),
 * mặc định ở chế độ Điện thoại.
 */
export default async function CampaignPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const frameSrc = `/campaign-preview/${campaign.id}`;
  const baseUrl = publicBaseUrl();
  const hasContent = Boolean(campaign.landing.bodyHtml || campaign.landing.bodyText);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/campaigns"
          className="cursor-pointer text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          ← Quay lại danh sách chiến dịch
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Xem trước: {campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Đây là bản ĐÃ LƯU, render bằng đúng component của trang thật. Nút bấm hiện
          đúng chỗ nhưng không điều hướng — bấm thử trong khung này không được tính
          thành một cú click trong báo cáo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/campaigns/${campaign.id}/edit`}
          className="cursor-pointer rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary"
        >
          Sửa nội dung
        </Link>
        {campaign.status === "paused" ? (
          <span className="text-xs text-muted-foreground">
            Chiến dịch đang tạm dừng nên{" "}
            <code className="font-mono text-xs">/c/{campaign.slug}</code> trả về 404
            với người ngoài.
          </span>
        ) : (
          <Link
            href={`/c/${campaign.slug}`}
            target="_blank"
            className="cursor-pointer text-sm text-primary underline"
          >
            Mở trang thật {baseUrl}/c/{campaign.slug} ↗
          </Link>
        )}
      </div>

      {campaign.status === "pending" ? (
        <Notice>
          Chiến dịch đang chờ duyệt nên link theo dõi chưa chạy. Việc tiếp theo: thêm
          đích chuyển hướng rồi kích hoạt ở{" "}
          <Link href="/admin/campaigns" className="cursor-pointer underline">
            danh sách chiến dịch
          </Link>
          .
        </Notice>
      ) : null}

      {!hasContent ? (
        <Notice>
          Chiến dịch này chưa có thân bài — trang chỉ có tiêu đề và nút bấm. Thêm 3–5
          luận điểm ở{" "}
          <Link
            href={`/admin/campaigns/${campaign.id}/edit`}
            className="cursor-pointer underline"
          >
            trang sửa nội dung
          </Link>
          .
        </Notice>
      ) : null}

      {/* Slider Sidebar xem trước (Slide-over panel từ bên phải sang) */}
      <CampaignPreviewDrawer
        campaign={{
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status,
          hasContent,
        }}
        frameSrc={frameSrc}
        baseUrl={baseUrl}
      />
    </div>
  );
}
