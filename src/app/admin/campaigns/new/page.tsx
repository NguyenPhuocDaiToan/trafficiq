import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CampaignFields } from "@/components/campaign-fields";
import { CreatedLinkPanel } from "@/components/created-link-panel";
import { Card } from "@/components/ui";
import { createCampaign } from "@/lib/control-plane/actions";
import { getCreatedCampaign, listActiveOptions, listDestinations } from "@/lib/control-plane/queries";
import { resolveShareBase } from "@/lib/domains/links";
import { verifiedHostSet } from "@/lib/domains/registry";
import { publicBaseUrl } from "@/lib/env";
import { ogVersion } from "@/lib/landing/share-link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tạo chiến dịch" };

/**
 * ĐƯỜNG NHANH NHẤT TỪ ẢNH TỚI LINK. Mục tiêu của trang này là người dùng tải ảnh, dán URL đích và có link `/go` để
 * sao chép trong vài giây — nên không có gì khác trên màn hình: không khung xem trước, không nhóm tuỳ chỉnh, không
 * nút "xem trước". Mọi thứ còn lại hệ thống tự điền (`campaign-defaults.ts`) và sửa sau ở trang sửa chiến dịch.
 *
 * Tạo xong, `createCampaign` redirect VỀ LẠI trang này với `?created=<slug>`: link vừa tạo hiện ở đầu trang (đã thử
 * sao chép sẵn) và form trống ngay bên dưới cho chiến dịch kế tiếp. Chiến dịch chạy ngay khi tạo; trang này không
 * chặn khi chưa có đối tác hay URL đích nào vì `createCampaign` tự tạo hoặc tái dùng chúng từ URL đích.
 *
 * Field nằm ở <CampaignFields> (chế độ tạo là tập con có chủ ý của chế độ sửa — xem ghi chú ở đó).
 */
export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; reactivated?: string }>;
}) {
  const { created: createdSlug, reactivated } = await searchParams;
  const [options, domains, destinations, created] = await Promise.all([
    listActiveOptions(),
    verifiedHostSet(),
    listDestinations(),
    createdSlug ? getCreatedCampaign(createdSlug) : Promise.resolve(null),
  ]);

  const createdUrl = created
    ? `${resolveShareBase(created.shareDomain, domains, publicBaseUrl()).baseUrl}/go/${created.token}?v=${ogVersion(created.og)}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tạo link</h1>
        <Link
          href="/admin/campaigns"
          className="cursor-pointer text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Xem danh sách chiến dịch →
        </Link>
      </div>

      {created && createdUrl ? (
        <CreatedLinkPanel
          // `key` để tạo liên tiếp nhiều chiến dịch thì panel chạy lại việc tự sao chép cho link mới.
          key={created.id}
          url={createdUrl}
          name={created.name}
          editHref={`/admin/campaigns/${created.id}/edit`}
          reactivated={Number(reactivated) || 0}
        />
      ) : null}

      <Card title={created ? "Tạo link tiếp theo" : "Chọn ảnh, dán URL đích"}>
        <ActionForm
          // `key` đổi theo chiến dịch vừa tạo để form luôn trống sau mỗi lần tạo.
          key={created?.id ?? "new"}
          action={createCampaign}
          submitLabel="Tạo link"
          className="grid gap-5"
        >
          <CampaignFields
            advertisers={options.advertisers}
            domains={[...domains]}
            // Gợi ý chọn từ danh sách đích đã lưu (đang chạy). Dán URL mới vẫn được và tự được lưu thêm.
            destinationChoices={destinations
              .filter((d) => d.status === "active")
              .map((d) => ({ url: d.url, label: `${d.advertiserName} · ${d.category}` }))}
          />
        </ActionForm>
      </Card>
    </div>
  );
}
