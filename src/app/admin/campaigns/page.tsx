import Link from "next/link";
import { ActionForm, StatusButton } from "@/components/action-form";
import {
  Card,
  Collapsible,
  Field,
  Notice,
  StatusBadge,
  buttonSecondaryClass,
  inputClass,
  linkPrimaryClass,
} from "@/components/ui";
import { createOffer, setCampaignStatus, setOfferStatus } from "@/lib/control-plane/actions";
import { listActiveOptions, listCampaigns } from "@/lib/control-plane/queries";
import { publicBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chiến dịch" };

/**
 * Chỉ DANH SÁCH. Form tạo nằm ở /admin/campaigns/new.
 *
 * Mỗi chiến dịch là một hàng thu gọn, bấm vào mới xổ chi tiết (link, đích
 * chuyển hướng, form thêm đích). Trước đây mọi chi tiết đều mở sẵn nên 10 chiến
 * dịch là 10 màn hình cuộn — không nhìn ra cái nào đang chạy.
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ new: createdSlug }, campaigns, options] = await Promise.all([
    searchParams,
    listCampaigns(),
    listActiveOptions(),
  ]);
  const baseUrl = publicBaseUrl();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Chiến dịch</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mỗi chiến dịch có một trang giới thiệu công khai và một link theo dõi.
            Trạng thái chiến dịch là công tắc chính: tạm dừng là link ngừng chạy.
          </p>
        </div>
        <Link href="/admin/campaigns/new" className={linkPrimaryClass}>
          Tạo chiến dịch
        </Link>
      </div>

      {createdSlug ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Đã tạo chiến dịch. Thêm đích chuyển hướng ở khung bên dưới rồi kích hoạt
          thì link theo dõi mới chạy.
        </p>
      ) : null}

      {campaigns.length === 0 ? (
        <Card title="Chưa có chiến dịch nào">
          <p className="text-sm text-muted-foreground">
            Bấm{" "}
            <Link
              href="/admin/campaigns/new"
              className="cursor-pointer text-primary underline"
            >
              Tạo chiến dịch
            </Link>{" "}
            để bắt đầu.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => {
            const activeOffers = campaign.offers.filter(
              (offer) => offer.status === "active" && offer.destinationStatus === "active",
            ).length;

            return (
              <Collapsible
                key={campaign.id}
                // Chiến dịch vừa tạo mở sẵn: việc tiếp theo luôn là thêm đích.
                defaultOpen={campaign.slug === createdSlug}
                summary={
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{campaign.name}</span>
                    <StatusBadge status={campaign.status} />
                    <span className="text-xs text-muted-foreground">
                      {campaign.advertiserName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{activeOffers}</span>/
                      <span className="font-mono tabular-nums">
                        {campaign.offers.length}
                      </span>{" "}
                      đích đang chạy
                    </span>
                    {campaign.status === "active" && activeOffers === 0 ? (
                      <span className="text-xs font-medium text-warning">
                        đang chạy nhưng không có đích nào
                      </span>
                    ) : null}
                    <code className="ml-auto hidden font-mono text-xs text-muted-foreground sm:inline">
                      /c/{campaign.slug}
                    </code>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {/*
                     * Sửa / Xem trước dùng cùng hình dáng với StatusButton (outline
                     * --primary) để hàng action không có hai kiểu nút khác nhau.
                     * Không dùng accent: CTA accent của view này là "Tạo chiến dịch"
                     * ở đầu trang.
                     */}
                    <Link
                      href={`/admin/campaigns/${campaign.id}/edit`}
                      className={buttonSecondaryClass}
                    >
                      Sửa nội dung
                    </Link>
                    <Link
                      href={`/admin/campaigns/${campaign.id}/preview`}
                      className={buttonSecondaryClass}
                    >
                      Xem trước
                    </Link>
                    <StatusButton
                      action={setCampaignStatus}
                      id={campaign.id}
                      status="active"
                      label="Kích hoạt"
                    />
                    <StatusButton
                      action={setCampaignStatus}
                      id={campaign.id}
                      status="paused"
                      label="Tạm dừng"
                    />
                    {/*
                     * Route cache của redirect là per-instance (bất biến số 8):
                     * instance warm khác còn giữ route cũ tới 60s.
                     */}
                    <span className="text-xs text-muted-foreground">
                      Sau khi tạm dừng, link có thể còn sống thêm khoảng 1 phút.
                    </span>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                        Trang giới thiệu
                      </dt>
                      <dd>
                        <Link
                          href={`/c/${campaign.slug}`}
                          className="cursor-pointer text-primary underline"
                          target="_blank"
                        >
                          {baseUrl}/c/{campaign.slug}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                        Link theo dõi (link đem đi chạy traffic)
                      </dt>
                      <dd>
                        <code className="font-mono text-xs">
                          {baseUrl}/go/{campaign.token}
                        </code>
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-sm font-semibold">
                      Đích chuyển hướng ({campaign.offers.length})
                    </h3>
                    {campaign.offers.length === 0 ? (
                      <div className="mt-2">
                        <Notice>
                          Chưa có đích nào — link theo dõi sẽ đưa người dùng tới trang
                          &ldquo;link không còn hoạt động&rdquo;.
                        </Notice>
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {campaign.offers.map((offer) => (
                          <li
                            key={offer.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                          >
                            <span className="font-medium">{offer.name}</span>
                            <span className="text-xs text-muted-foreground">
                              tỷ lệ chia{" "}
                              <span className="font-mono tabular-nums">{offer.weight}</span>
                            </span>
                            <StatusBadge status={offer.status} />
                            <code className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                              {offer.destinationUrl}
                            </code>
                            {offer.destinationStatus !== "active" ? (
                              <span className="text-xs text-destructive">
                                URL đích chưa được kích hoạt → đích này bị bỏ qua
                              </span>
                            ) : null}
                            <StatusButton
                              action={setOfferStatus}
                              id={offer.id}
                              status="paused"
                              label="Tạm dừng"
                            />
                            <StatusButton
                              action={setOfferStatus}
                              id={offer.id}
                              status="active"
                              label="Kích hoạt"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {options.destinations.length === 0 ? (
                    <Notice>
                      Cần có URL đích đang chạy trong danh sách cho phép trước khi
                      thêm đích chuyển hướng.
                    </Notice>
                  ) : (
                    <ActionForm
                      action={createOffer}
                      submitLabel="Thêm đích chuyển hướng"
                      className="grid gap-3 sm:grid-cols-3"
                      // CTA accent của view này là nút "Tạo chiến dịch" ở đầu trang.
                      submitVariant="secondary"
                    >
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <Field label="Tên đích">
                        <input
                          name="name"
                          required
                          className={inputClass}
                          placeholder="Phương án A"
                        />
                      </Field>
                      <Field label="URL đích">
                        <select name="destinationId" required className={inputClass}>
                          {options.destinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tỷ lệ chia" hint="để chia traffic thử A/B">
                        <input
                          name="weight"
                          type="number"
                          min={1}
                          defaultValue={1}
                          className={inputClass}
                        />
                      </Field>
                    </ActionForm>
                  )}
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
