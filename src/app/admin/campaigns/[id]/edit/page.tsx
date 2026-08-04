import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { CampaignEditLivePreview } from "@/components/campaign-edit-live-preview";
import { CampaignFields } from "@/components/campaign-fields";
import { Card, Notice, StatusBadge } from "@/components/ui";
import { updateCampaign } from "@/lib/control-plane/actions";
import {
  getCampaignById,
  listAdvertiserOptionsForEdit,
} from "@/lib/control-plane/queries";
import { publicBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sửa chiến dịch" };

/**
 * Sửa chiến dịch.
 *
 * Tích hợp Live Preview điện thoại thời gian thực trong lúc gõ phím.
 */
export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const advertisers = await listAdvertiserOptionsForEdit(campaign.advertiserId);
  const baseUrl = publicBaseUrl();

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
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Trạng thái và đích chuyển hướng đổi ở{" "}
          <Link
            href="/admin/campaigns"
            className="cursor-pointer text-primary underline"
          >
            danh sách chiến dịch
          </Link>
          , không đổi ở đây. Link theo dõi{" "}
          <code className="font-mono text-xs">
            {baseUrl}/go/{campaign.token}
          </code>{" "}
          không bao giờ thay đổi khi sửa — link đã đem đi chạy traffic vẫn sống.
        </p>
      </div>

      <CampaignEditLivePreview campaign={campaign} baseUrl={baseUrl}>
        <Card title="Thông tin chiến dịch">
          <ActionForm
            action={updateCampaign}
            submitLabel="Lưu thay đổi"
            className="grid gap-3 sm:grid-cols-2"
            resetOnSuccess={false}
          >
            <input type="hidden" name="id" value={campaign.id} />
            <CampaignFields advertisers={advertisers} campaign={campaign} />
          </ActionForm>
        </Card>
      </CampaignEditLivePreview>

      {campaign.status === "active" ? (
        <Notice>
          Chiến dịch đang chạy — thay đổi có hiệu lực ngay với người bấm link sau
          khi lưu. Muốn sửa yên tĩnh thì tạm dừng trước.
        </Notice>
      ) : null}
    </div>
  );
}
