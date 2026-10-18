import { CampaignNameSlugFields } from "@/components/campaign-name-slug-fields";
import { ImageUrlField } from "@/components/image-url-field";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Field, FormSection, inputClass } from "@/components/ui";
import type { CampaignEditView } from "@/lib/control-plane/queries";
import { legacyBodyToHtml } from "@/lib/landing/legacy-body";

/**
 * Nhóm field của campaign, DÙNG CHUNG giữa /admin/campaigns/new và
 * /admin/campaigns/[id]/edit.
 *
 * Vì sao dùng chung thay vì hai form riêng: hai form rời sẽ lệch nhau ngay lần
 * thêm field kế tiếp, và lệch theo hướng tệ nhất — form sửa thiếu một field mà
 * form tạo có, nên mỗi lần lưu là âm thầm xoá trắng field đó.
 *
 * Component này KHÔNG tự render <form> hay nút submit: nó nằm bên trong một
 * <ActionForm> duy nhất. Chia thành nhiều ActionForm sẽ thành nhiều form HTML,
 * mỗi cái submit thiếu field của cái kia.
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
  const landing = campaign?.landing;

  /*
   * Bốn nhóm, theo thứ tự người ta nghĩ khi tạo chiến dịch: nó là gì → trang giới thiệu nói gì → link chia sẻ
   * hiện thế nào → tuỳ chọn hiếm dùng. Mỗi nhóm là một lưới riêng nên cặp field đứng cạnh nhau luôn có liên
   * quan; cái nào dài (thân bài, ảnh, tiêu đề chia sẻ) chiếm cả hàng.
   *
   * Tên field (`name=`) và các `data-tour` giữ nguyên: form sửa, xem trước trực tiếp và coach mark đều bám vào
   * chúng.
   */
  return (
    <>
      <FormSection
        title="Cơ bản"
        description="Tên và địa chỉ của chiến dịch, và đối tác trả tiền cho traffic."
      >
        {/*
         * Tên + đường dẫn nằm trong một client component vì đường dẫn tự sinh theo tên khi đang gõ. Hành vi
         * khác nhau giữa tạo và sửa — xem ghi chú trong campaign-name-slug-fields.tsx.
         */}
        <CampaignNameSlugFields
          defaultName={campaign?.name}
          defaultSlug={campaign?.slug}
          mode={campaign ? "edit" : "create"}
        />
        <Field label="Đối tác" tour="cf-advertiser">
          <select
            name="advertiserId"
            required
            defaultValue={campaign?.advertiserId}
            className={inputClass}
          >
            {advertisers.map((advertiser) => (
              <option key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
              </option>
            ))}
          </select>
        </Field>
        {/*
          Luôn gửi field `shareDomain` (kể cả khi không có tên miền phụ nào) để form sửa không bao giờ ngầm bỏ
          nó — `updateCampaign` hiểu "không gửi" là "gỡ tên miền". Không có tên miền phụ thì gửi rỗng.
        */}
        {domains.length > 0 || campaign?.shareDomain ? (
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
          <input type="hidden" name="shareDomain" value="" />
        )}
      </FormSection>

      <FormSection
        title="Trang giới thiệu"
        description="Trang công khai người đọc thấy khi bấm vào link của chiến dịch."
      >
        <Field label="Tiêu đề chính" tour="cf-headline">
          <input
            name="headline"
            required
            defaultValue={landing?.headline}
            className={inputClass}
            placeholder="Mở thẻ trong 5 phút"
          />
        </Field>
        <Field label="Tiêu đề phụ" hint="(không bắt buộc)">
          <input name="subheadline" defaultValue={landing?.subheadline} className={inputClass} />
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
          defaultValue={
            landing?.bodyHtml ??
            (landing?.bodyText ? legacyBodyToHtml(landing.bodyText) : undefined)
          }
          label="Thân bài"
          hint="(không bắt buộc)"
        />

        <div className="sm:col-span-2">
          <ImageUrlField
            name="heroImageUrl"
            kind="hero"
            tour="cf-hero"
            label="Ảnh lớn đầu trang"
            hint="(không bắt buộc)"
            help="Dán link ảnh hoặc tải ảnh lên. Ảnh tải lên được nén tự động."
            defaultValue={landing?.heroImageUrl}
          />
        </div>

        <Field label="Chữ trên nút bấm" tour="cf-cta">
          <input
            name="ctaLabel"
            required
            defaultValue={landing?.ctaLabel}
            className={inputClass}
            placeholder="Nhận ưu đãi"
          />
        </Field>
      </FormSection>

      <FormSection
        title="Hiển thị khi chia sẻ link"
        description="Thẻ xem trước trên X, Facebook, Zalo, Telegram. Đổi tiêu đề, mô tả hoặc ảnh thì link chia sẻ có mã ?v= mới."
      >
        <Field label="Tiêu đề khi chia sẻ" tour="cf-share" className="sm:col-span-2">
          <input name="ogTitle" required defaultValue={campaign?.og.title} className={inputClass} />
        </Field>
        <Field label="Mô tả khi chia sẻ" className="sm:col-span-2">
          <input
            name="ogDescription"
            required
            defaultValue={campaign?.og.description}
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <ImageUrlField
            name="ogImageUrl"
            kind="og"
            label="Ảnh khi chia sẻ"
            hint="(không bắt buộc)"
            help="Tỉ lệ 1200×630. Ảnh tải lên được nén tự động."
            defaultValue={campaign?.og.imageUrl}
          />
        </div>
      </FormSection>

      {/*
       * Tuỳ chọn hiếm dùng, thu gọn (progressive disclosure). `<details>` chứ không phải state React: form phải
       * dùng được khi JS chưa tải, và input trong `<details>` đóng vẫn được gửi cùng form. Coach mark tự mở
       * `<details>` bao quanh mục tiêu nên đặt gì vào đây cũng không làm bước hướng dẫn mất chỗ chỉ.
       */}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-muted">
          Tuỳ chọn nâng cao
          <span className="ml-2 text-xs font-normal text-muted-foreground">tự động chuyển hướng</span>
        </summary>
        <div className="grid gap-x-4 gap-y-5 border-t border-border px-4 py-4 sm:grid-cols-2">
          <Field
            label="Tự động chuyển hướng (giây)"
            help="0 là tắt: người đọc tự bấm nút. 1 là tự chuyển sau 1 giây."
          >
            <input
              type="number"
              name="autoRedirectSeconds"
              min="0"
              max="10"
              defaultValue={landing?.autoRedirectSeconds ?? 0}
              className={inputClass}
            />
          </Field>
        </div>
      </details>
    </>
  );
}
