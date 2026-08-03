import Link from "next/link";
import { ActionForm, StatusButton } from "@/components/action-form";
import { Card, Field, Notice, StatusBadge, inputClass } from "@/components/ui";
import {
  createCampaign,
  createOffer,
  setCampaignStatus,
  setOfferStatus,
} from "@/lib/control-plane/actions";
import { listActiveOptions, listCampaigns } from "@/lib/control-plane/queries";
import { publicBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chiến dịch" };

export default async function CampaignsPage() {
  const [campaigns, options] = await Promise.all([listCampaigns(), listActiveOptions()]);
  const baseUrl = publicBaseUrl();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Chiến dịch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mỗi chiến dịch có một trang giới thiệu công khai và một link theo dõi.
          Trạng thái chiến dịch là công tắc chính: tạm dừng là link ngừng chạy.
        </p>
      </div>

      <Card
        title="Tạo chiến dịch"
        description="Đường dẫn tĩnh là địa chỉ trang giới thiệu (/c/duong-dan). Mã link theo dõi được sinh tự động, không đoán được."
      >
        {options.advertisers.length === 0 ? (
          <Notice>
            Cần ít nhất một đối tác đang chạy trước khi tạo chiến dịch.
          </Notice>
        ) : (
          <ActionForm
            action={createCampaign}
            submitLabel="Tạo chiến dịch"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Tên chiến dịch">
              <input name="name" required className={inputClass} placeholder="Tài chính Q3 VN" />
            </Field>
            <Field label="Đối tác">
              <select name="advertiserId" required className={inputClass}>
                {options.advertisers.map((advertiser) => (
                  <option key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Đường dẫn tĩnh" hint="chỉ a-z, 0-9 và dấu gạch ngang">
              <input name="slug" required className={inputClass} placeholder="tai-chinh-q3-vn" />
            </Field>
            <Field label="Chữ trên nút bấm">
              <input name="ctaLabel" required className={inputClass} placeholder="Nhận ưu đãi" />
            </Field>
            <Field label="Tiêu đề chính">
              <input
                name="headline"
                required
                className={inputClass}
                placeholder="Mở thẻ trong 5 phút"
              />
            </Field>
            <Field label="Tiêu đề phụ" hint="(không bắt buộc)">
              <input name="subheadline" className={inputClass} />
            </Field>
            <Field label="Nội dung mô tả" hint="(không bắt buộc)">
              <textarea name="bodyText" rows={3} className={inputClass} />
            </Field>
            <Field label="Ảnh lớn đầu trang" hint="(không bắt buộc, dung lượng ≤ 200KB)">
              <input name="heroImageUrl" className={inputClass} placeholder="https://…" />
            </Field>
            <Field label="Tiêu đề khi chia sẻ" hint="hiện trên Facebook, Zalo, Telegram">
              <input name="ogTitle" required className={inputClass} />
            </Field>
            <Field label="Mô tả khi chia sẻ">
              <input name="ogDescription" required className={inputClass} />
            </Field>
            <Field label="Ảnh khi chia sẻ" hint="1200×630, nén nhẹ để tiết kiệm băng thông">
              <input name="ogImageUrl" className={inputClass} placeholder="https://…" />
            </Field>
          </ActionForm>
        )}
      </Card>

      {campaigns.length === 0 ? (
        <Card title="Chưa có chiến dịch nào">
          <p className="text-sm text-muted-foreground">
            Tạo chiến dịch đầu tiên ở khung phía trên.
          </p>
        </Card>
      ) : (
        campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            title={campaign.name}
            description={`Đối tác: ${campaign.advertiserName}`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={campaign.status} />
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
                  Cần có URL đích đang chạy trong danh sách cho phép trước khi thêm
                  đích chuyển hướng.
                </Notice>
              ) : (
                <ActionForm
                  action={createOffer}
                  submitLabel="Thêm đích chuyển hướng"
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Field label="Tên đích">
                    <input name="name" required className={inputClass} placeholder="Phương án A" />
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
          </Card>
        ))
      )}
    </div>
  );
}
