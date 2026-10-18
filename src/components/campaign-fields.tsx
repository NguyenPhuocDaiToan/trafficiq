import { CampaignNameSlugFields } from "@/components/campaign-name-slug-fields";
import { ImageUrlField } from "@/components/image-url-field";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Field, FormSection, inputClass } from "@/components/ui";
import {
  DEFAULT_AUTO_REDIRECT_SECONDS,
  MAX_DESTINATIONS_PER_CAMPAIGN,
} from "@/lib/control-plane/campaign-defaults";
import type { CampaignEditView } from "@/lib/control-plane/queries";
import { legacyBodyToHtml } from "@/lib/landing/legacy-body";

/**
 * Field của campaign, dùng cho /admin/campaigns/new (TẠO) và /admin/campaigns/[id]/edit (SỬA).
 *
 * Component này KHÔNG tự render <form> hay nút submit: nó nằm bên trong một <ActionForm> duy nhất. Chia thành
 * nhiều ActionForm sẽ thành nhiều form HTML, mỗi cái submit thiếu field của cái kia.
 *
 * HAI CHẾ ĐỘ, CỐ Ý KHÔNG CÙNG BỘ FIELD.
 *  - TẠO là đường "ảnh → link nhanh nhất": chỉ ảnh, URL đích và một tiêu đề tuỳ chọn (cộng ô tên miền nếu có
 *    tên miền phụ). Mọi thứ khác server tự điền (`campaign-defaults.ts`) và sửa sau ở form SỬA. Đừng thêm ô vào
 *    form tạo "cho đủ" — mỗi ô thêm là một lần dừng trên con đường mà mục tiêu là không phải dừng.
 *  - SỬA là đầy đủ bốn nhóm, các field bắt buộc.
 * Form tạo là tập con nên nó chỉ ghi chiến dịch MỚI (không bao giờ `$set` đè lên dữ liệu có sẵn); form sửa thì
 * PHẢI chứa mọi field, vì `updateCampaign` ghi cả object `landing`/`og` — thiếu một field là mỗi lần bấm Lưu
 * xoá trắng nó. Thêm field vào một chiến dịch ĐÃ TỒN TẠI thì thêm ở các khối của chế độ sửa bên dưới.
 */
export function CampaignFields({
  advertisers,
  campaign,
  domains,
}: {
  advertisers: { id: string; name: string }[];
  /** Có = đang sửa (nạp giá trị cũ). Không có = đang tạo mới. */
  campaign?: CampaignEditView;
  /** Tên miền đang `verified` (xem `verifiedHostSet`). Rỗng = form không hiện ô chọn. */
  domains: string[];
}) {
  const domainSelect =
    domains.length > 0 || campaign?.shareDomain ? (
      <Field
        label="Tên miền của link chia sẻ"
        help="Chỉ đổi địa chỉ hiển thị của link, không đổi cách link chạy."
      >
        <select name="shareDomain" defaultValue={campaign?.shareDomain ?? ""} className={inputClass}>
          <option value="">Tên miền chính</option>
          {campaign?.shareDomain && !domains.includes(campaign.shareDomain) ? (
            <option value={campaign.shareDomain}>
              {campaign.shareDomain} (đã tắt — link đang dùng tên miền chính)
            </option>
          ) : null}
          {domains.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </select>
      </Field>
    ) : (
      // Luôn gửi field `shareDomain` (kể cả khi không có tên miền phụ nào): `updateCampaign` hiểu "không gửi" là
      // "gỡ tên miền".
      <input type="hidden" name="shareDomain" value="" />
    );

  // ------------------------------------------------------------------------------------------------ TẠO
  if (!campaign) {
    return (
      <div className="space-y-5">
        <ImageUrlField
          name="heroImageUrl"
          kind="hero"
          tour="cf-hero"
          label="Ảnh"
          required
          dropzone
          defaultValue={undefined}
        />

        <Field
          label="URL đích"
          tour="cf-urls"
          help={`Nơi người bấm link được chuyển tới. Nhiều URL (mỗi dòng một, tối đa ${MAX_DESTINATIONS_PER_CAMPAIGN}) thì traffic chia đều.`}
        >
          <textarea
            name="destinationUrls"
            required
            rows={2}
            spellCheck={false}
            autoComplete="off"
            className={inputClass}
            placeholder="https://offer.example.com/landing"
          />
        </Field>

        <Field
          label="Tiêu đề"
          hint="(không bắt buộc)"
          tour="cf-headline"
          help="Hiện trên thẻ khi dán link lên X, Facebook, Zalo. Để trống: dùng tên miền của URL đích."
        >
          <input name="headline" maxLength={140} className={inputClass} placeholder="Ví dụ: Ưu đãi tháng 10" />
        </Field>

        {domainSelect}
      </div>
    );
  }

  // ------------------------------------------------------------------------------------------------ SỬA
  const landing = campaign.landing;

  return (
    <>
      <FormSection title="Cơ bản" description="Tên và địa chỉ của chiến dịch, và đối tác trả tiền cho traffic.">
        {/*
         * Tên + đường dẫn nằm trong một client component vì đường dẫn tự sinh theo tên khi đang gõ (ở chế độ sửa
         * nó KHÔNG tự đổi — xem ghi chú trong campaign-name-slug-fields.tsx).
         */}
        <CampaignNameSlugFields defaultName={campaign.name} defaultSlug={campaign.slug} mode="edit" />
        <Field label="Đối tác">
          <select name="advertiserId" required defaultValue={campaign.advertiserId} className={inputClass}>
            {advertisers.map((advertiser) => (
              <option key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
              </option>
            ))}
          </select>
        </Field>
        {domainSelect}
      </FormSection>

      <FormSection title="Trang giới thiệu" description="Trang công khai người đọc thấy khi bấm vào link của chiến dịch.">
        <Field label="Tiêu đề chính">
          <input
            name="headline"
            required
            defaultValue={landing.headline}
            className={inputClass}
            placeholder="Mở thẻ trong 5 phút"
          />
        </Field>
        <Field label="Tiêu đề phụ" hint="(không bắt buộc)">
          <input name="subheadline" defaultValue={landing.subheadline} className={inputClass} />
        </Field>

        {/*
         * Thân bài. Đường di trú của dữ liệu cũ: campaign tạo trước khi có editor chỉ có `bodyText` phẳng, nạp
         * nó vào editor để lần lưu này biến nó thành `bodyHtml`. Nếu chỉ đọc `bodyHtml` thì lần mở đầu tiên
         * editor trống và bấm Lưu là mất nội dung cũ.
         *
         * `legacyBodyToHtml` chứ KHÔNG phải `?? landing.bodyText` thẳng: Tiptap parse content như HTML nên hai
         * dấu xuống dòng chỉ là khoảng trắng — hai đoạn văn cũ sẽ dính thành một. Và vì textarea giữ nguyên giá
         * trị này khi admin không chạm vào editor, đưa text phẳng vào đây là chỉ cần sửa một field khác rồi bấm
         * Lưu là mất ranh giới đoạn của bài cũ.
         */}
        <RichTextEditor
          name="bodyHtml"
          defaultValue={landing.bodyHtml ?? (landing.bodyText ? legacyBodyToHtml(landing.bodyText) : undefined)}
          label="Thân bài"
          hint="(không bắt buộc)"
        />

        <div className="sm:col-span-2">
          <ImageUrlField
            name="heroImageUrl"
            kind="hero"
            label="Ảnh lớn đầu trang"
            hint="(không bắt buộc)"
            help="Dán link ảnh hoặc tải ảnh lên. Ảnh tải lên được nén tự động."
            defaultValue={landing.heroImageUrl}
          />
        </div>

        <Field label="Chữ trên nút bấm">
          <input
            name="ctaLabel"
            required
            defaultValue={landing.ctaLabel}
            className={inputClass}
            placeholder="Nhận ưu đãi"
          />
        </Field>
      </FormSection>

      <FormSection
        title="Hiển thị khi chia sẻ link"
        description="Thẻ xem trước trên X, Facebook, Zalo, Telegram. Đổi tiêu đề, mô tả hoặc ảnh thì link chia sẻ có mã ?v= mới."
      >
        <Field label="Tiêu đề khi chia sẻ" className="sm:col-span-2">
          <input name="ogTitle" required defaultValue={campaign.og.title} className={inputClass} />
        </Field>
        <Field label="Mô tả khi chia sẻ" className="sm:col-span-2">
          <input name="ogDescription" required defaultValue={campaign.og.description} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <ImageUrlField
            name="ogImageUrl"
            kind="og"
            label="Ảnh khi chia sẻ"
            hint="(không bắt buộc)"
            help="Tỉ lệ 1200×630. Ảnh tải lên được nén tự động."
            defaultValue={campaign.og.imageUrl}
          />
        </div>
      </FormSection>

      {/*
       * Tuỳ chọn hiếm dùng, thu gọn (progressive disclosure). `<details>` chứ không phải state React: form phải
       * dùng được khi JS chưa tải, và input trong `<details>` đóng vẫn được gửi cùng form.
       */}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-muted">
          Tuỳ chọn nâng cao
          <span className="ml-2 text-xs font-normal text-muted-foreground">tự động chuyển hướng</span>
        </summary>
        <div className="grid gap-x-4 gap-y-5 border-t border-border px-4 py-4 sm:grid-cols-2">
          <Field
            label="Tự động chuyển hướng (giây)"
            help={`0 là tắt: người đọc tự bấm nút. Chiến dịch mới mặc định ${DEFAULT_AUTO_REDIRECT_SECONDS} giây.`}
          >
            <input
              type="number"
              name="autoRedirectSeconds"
              min="0"
              max="10"
              // Giữ đúng giá trị đã lưu (chưa đặt = 0). Đừng gộp với mặc định 2 giây của chiến dịch mới: mở form
              // sửa của chiến dịch cũ rồi bấm Lưu sẽ ngầm bật tự chuyển hướng.
              defaultValue={landing.autoRedirectSeconds ?? 0}
              className={inputClass}
            />
          </Field>
        </div>
      </details>
    </>
  );
}
