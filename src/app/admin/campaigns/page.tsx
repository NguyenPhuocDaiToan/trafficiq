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

export default async function CampaignsPage() {
  const [campaigns, options] = await Promise.all([listCampaigns(), listActiveOptions()]);
  const baseUrl = publicBaseUrl();

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-2xl font-semibold">Campaigns</h1>

      <Card
        title="Tạo campaign"
        description="Slug là URL landing (/c/slug). Token của link /go được sinh tự động, không đoán được."
      >
        {options.advertisers.length === 0 ? (
          <Notice>Cần ít nhất một advertiser active trước khi tạo campaign.</Notice>
        ) : (
          <ActionForm
            action={createCampaign}
            submitLabel="Tạo campaign"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Tên campaign">
              <input name="name" required className={inputClass} placeholder="Q3 Fintech VN" />
            </Field>
            <Field label="Advertiser">
              <select name="advertiserId" required className={inputClass}>
                {options.advertisers.map((advertiser) => (
                  <option key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Slug" hint="a-z, 0-9, gạch ngang">
              <input name="slug" required className={inputClass} placeholder="q3-fintech-vn" />
            </Field>
            <Field label="CTA label">
              <input name="ctaLabel" required className={inputClass} placeholder="Nhận ưu đãi" />
            </Field>
            <Field label="Headline">
              <input
                name="headline"
                required
                className={inputClass}
                placeholder="Mở thẻ trong 5 phút"
              />
            </Field>
            <Field label="Subheadline" hint="(tùy chọn)">
              <input name="subheadline" className={inputClass} />
            </Field>
            <Field label="Body text" hint="(tùy chọn)">
              <textarea name="bodyText" rows={3} className={inputClass} />
            </Field>
            <Field label="Hero image URL" hint="(tùy chọn, ≤ 200KB)">
              <input name="heroImageUrl" className={inputClass} placeholder="https://…" />
            </Field>
            <Field label="OG title">
              <input name="ogTitle" required className={inputClass} />
            </Field>
            <Field label="OG description">
              <input name="ogDescription" required className={inputClass} />
            </Field>
            <Field label="OG image URL" hint="1200×630, nén nhẹ để tiết kiệm bandwidth">
              <input name="ogImageUrl" className={inputClass} placeholder="https://…" />
            </Field>
          </ActionForm>
        )}
      </Card>

      {campaigns.length === 0 ? (
        <Card title="Chưa có campaign nào">
          <p className="text-sm text-muted-foreground">
            Tạo campaign đầu tiên ở form phía trên.
          </p>
        </Card>
      ) : (
        campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            title={campaign.name}
            description={`Advertiser: ${campaign.advertiserName}`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={campaign.status} />
                <StatusButton
                  action={setCampaignStatus}
                  id={campaign.id}
                  status="active"
                  label="Activate"
                />
                <StatusButton
                  action={setCampaignStatus}
                  id={campaign.id}
                  status="paused"
                  label="Pause"
                />
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    Landing
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
                    Redirect (link đi chạy traffic)
                  </dt>
                  <dd>
                    <code className="font-mono text-xs">
                      {baseUrl}/go/{campaign.token}
                    </code>
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="font-mono text-sm font-medium">
                  Offers ({campaign.offers.length})
                </h3>
                {campaign.offers.length === 0 ? (
                  <div className="mt-2">
                    <Notice>
                      Chưa có offer — link /go sẽ trả về trang link-unavailable.
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
                        <span className="font-mono text-xs text-muted-foreground">
                          weight {offer.weight}
                        </span>
                        <StatusBadge status={offer.status} />
                        <code className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                          {offer.destinationUrl}
                        </code>
                        {offer.destinationStatus !== "active" ? (
                          <span className="text-xs text-destructive">
                            destination {offer.destinationStatus} → offer này bị bỏ qua
                          </span>
                        ) : null}
                        <StatusButton
                          action={setOfferStatus}
                          id={offer.id}
                          status="paused"
                          label="Pause"
                        />
                        <StatusButton
                          action={setOfferStatus}
                          id={offer.id}
                          status="active"
                          label="Activate"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {options.destinations.length === 0 ? (
                <Notice>Cần destination active trong whitelist trước khi thêm offer.</Notice>
              ) : (
                <ActionForm
                  action={createOffer}
                  submitLabel="Thêm offer"
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Field label="Tên offer">
                    <input name="name" required className={inputClass} placeholder="Variant A" />
                  </Field>
                  <Field label="Destination">
                    <select name="destinationId" required className={inputClass}>
                      {options.destinations.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Weight" hint="cho A/B split">
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
