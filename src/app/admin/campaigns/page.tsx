import Link from "next/link";
import { ActionForm, StatusButton } from "@/components/action-form";
import { TrackingLink } from "@/components/tracking-link";
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
import {
  countByStatus,
  filterCampaigns,
  filterHref,
  parseCampaignFilter,
  type CampaignFilter,
} from "@/lib/control-plane/campaign-filter";
import { listActiveOptions, listCampaigns } from "@/lib/control-plane/queries";
import { resolveShareBase } from "@/lib/domains/links";
import { verifiedHostSet } from "@/lib/domains/registry";
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
  searchParams: Promise<{ new?: string; reactivated?: string; status?: string }>;
}) {
  const [{ new: createdSlug, reactivated, status }, allCampaigns, options, verified] = await Promise.all([
    searchParams,
    listCampaigns(),
    listActiveOptions(),
    verifiedHostSet(),
  ]);
  const baseUrl = publicBaseUrl();

  // Mặc định chỉ hiện chiến dịch ĐANG CHẠY (xem `campaign-filter.ts`). Đếm trên toàn bộ trước khi lọc để các tab
  // luôn nói đúng "còn bao nhiêu chiến dịch tạm dừng", kể cả khi chúng đang bị ẩn.
  const filter = parseCampaignFilter(status);
  const counts = countByStatus(allCampaigns);
  const campaigns = filterCampaigns(allCampaigns, filter);
  const tabs: { filter: CampaignFilter; label: string }[] = [
    { filter: "active", label: "Đang chạy" },
    { filter: "paused", label: "Tạm dừng" },
    // "Chờ duyệt" chỉ còn ở dữ liệu cũ (thứ mới tạo chạy ngay): chỉ hiện khi thật sự có.
    ...(counts.pending > 0 ? [{ filter: "pending" as const, label: "Chờ duyệt" }] : []),
    { filter: "all", label: "Tất cả" },
  ];

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
          Đã tạo chiến dịch và đang chạy. Bấm &ldquo;Sao chép&rdquo; ở link theo dõi bên dưới để đem đi dùng.
          {Number(reactivated) > 0
            ? ` Đã bật lại ${Number(reactivated)} URL đích đang tạm dừng vì chiến dịch này dùng chúng.`
            : ""}
        </p>
      ) : null}

      {allCampaigns.length > 0 ? (
        <nav aria-label="Lọc chiến dịch theo trạng thái" className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((tab) => {
            const current = tab.filter === filter;
            return (
              <Link
                key={tab.filter}
                href={filterHref(tab.filter)}
                aria-current={current ? "page" : undefined}
                className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  current
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}{" "}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{counts[tab.filter]}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {allCampaigns.length === 0 ? (
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
      ) : campaigns.length === 0 ? (
        <Card title={`Không có chiến dịch nào ở mục “${tabs.find((t) => t.filter === filter)?.label ?? "này"}”`}>
          <p className="text-sm text-muted-foreground">
            {filter === "active" ? "Hiện không có chiến dịch nào đang chạy." : "Mục này đang trống."}{" "}
            <Link href={filterHref("all")} className="cursor-pointer text-primary underline">
              Xem tất cả ({counts.all})
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => {
            const activeOffers = campaign.offers.filter(
              (offer) => offer.status === "active" && offer.destinationStatus === "active",
            ).length;
            const share = resolveShareBase(campaign.shareDomain, verified, baseUrl);

            return (
              <Collapsible
                key={campaign.id}
                tour="campaign-row"
                // Chiến dịch vừa tạo mở sẵn: việc tiếp theo luôn là thêm đích.
                defaultOpen={campaign.slug === createdSlug}
                summary={
                  <div className="space-y-2">
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
                  {/*
                   * Link theo dõi nằm ngay trên dòng, không giấu trong phần bung: đây là thứ người dùng hệ thống
                   * cần nhất ("chỉ đi gửi link"), mà trước đây phải bấm bung từng chiến dịch mới thấy. Nằm trong
                   * <summary> vẫn bấm/sao chép được mà không làm bung dòng (xem `TrackingLink`).
                   */}
                  <div data-tour="tracking-link" className="text-xs">
                    <TrackingLink url={`${share.baseUrl}/go/${campaign.token}?v=${campaign.shareVersion}`} />
                    {share.fellBack ? (
                      <p className="mt-1 text-warning">
                        Tên miền {campaign.shareDomain} đã tắt hoặc chưa kiểm tra — đang hiện link theo tên miền chính.
                      </p>
                    ) : null}
                  </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm" data-tour="campaign-actions">
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

                  {campaign.createdByName || campaign.updatedByName ? (
                    <p className="text-xs text-muted-foreground">
                      {campaign.createdByName ? <>Tạo bởi {campaign.createdByName}</> : null}
                      {campaign.createdByName && campaign.updatedByName ? " · " : null}
                      {campaign.updatedByName ? <>Sửa gần nhất bởi {campaign.updatedByName}</> : null}
                    </p>
                  ) : null}

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
                        Về link theo dõi
                      </dt>
                      <dd className="text-xs text-muted-foreground">
                        Link ở đầu dòng chiến dịch là link đem đi chạy traffic. Đuôi{" "}
                        <code className="font-mono">?v=</code> tự đổi khi tiêu đề, mô tả hoặc ảnh chia sẻ đổi, để
                        X/Facebook lấy thẻ mới; link không có đuôi vẫn chạy. Mở link cũng được tính là một click
                        thật — muốn xem trang mà không tạo click thì dùng nút Xem trước.
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

                  <div data-tour="offer-form">
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
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
