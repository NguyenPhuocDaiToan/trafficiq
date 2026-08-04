import { CampaignNameSlugFields } from "@/components/campaign-name-slug-fields";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Field, inputClass } from "@/components/ui";
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
}: {
  advertisers: { id: string; name: string }[];
  /** Có = đang sửa (nạp giá trị cũ). Không có = đang tạo mới. */
  campaign?: CampaignEditView;
}) {
  const landing = campaign?.landing;

  return (
    <>
      {/*
       * Tên + đường dẫn nằm trong một client component vì đường dẫn tự sinh theo
       * tên khi đang gõ. Hành vi khác nhau giữa tạo và sửa — xem ghi chú trong
       * campaign-name-slug-fields.tsx.
       */}
      <CampaignNameSlugFields
        defaultName={campaign?.name}
        defaultSlug={campaign?.slug}
        mode={campaign ? "edit" : "create"}
      />
      <Field label="Đối tác">
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
      <Field label="Chữ trên nút bấm">
        <input
          name="ctaLabel"
          required
          defaultValue={landing?.ctaLabel}
          className={inputClass}
          placeholder="Nhận ưu đãi"
        />
      </Field>
      <Field label="Tự động chuyển hướng (giây)" hint="0 = tắt (người đọc tự bấm). 1 = tự nhảy sau 1s">
        <input
          type="number"
          name="autoRedirectSeconds"
          min="0"
          max="10"
          defaultValue={landing?.autoRedirectSeconds ?? 0}
          className={inputClass}
        />
      </Field>

      <SectionLabel>Nội dung trang giới thiệu</SectionLabel>
      <Field label="Tiêu đề chính">
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
       * Thân bài. Đường di trú của dữ liệu cũ: campaign tạo trước khi có editor
       * chỉ có `bodyText` phẳng, nạp nó vào editor để lần lưu này biến nó thành
       * `bodyHtml`. Nếu chỉ đọc `bodyHtml` thì lần mở đầu tiên editor trống và bấm
       * Lưu là mất nội dung cũ.
       *
       * `legacyBodyToHtml` chứ KHÔNG phải `?? landing.bodyText` thẳng: Tiptap parse
       * content như HTML nên "\n\n" chỉ là khoảng trắng — hai đoạn văn cũ sẽ dính
       * thành một. Và vì textarea giữ nguyên giá trị này khi admin không chạm vào
       * editor, đưa text phẳng vào đây là chỉ cần sửa một field khác rồi bấm Lưu là
       * mất ranh giới đoạn của bài cũ.
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

      <Field label="Ảnh lớn đầu trang" hint="(không bắt buộc)">
        <input
          name="heroImageUrl"
          defaultValue={landing?.heroImageUrl}
          className={inputClass}
          placeholder="https://…"
        />
      </Field>

      <SectionLabel>Hiển thị khi chia sẻ link</SectionLabel>
      <Field label="Tiêu đề khi chia sẻ" hint="hiện trên Facebook, Zalo, Telegram">
        <input
          name="ogTitle"
          required
          defaultValue={campaign?.og.title}
          className={inputClass}
        />
      </Field>
      <Field label="Mô tả khi chia sẻ">
        <input
          name="ogDescription"
          required
          defaultValue={campaign?.og.description}
          className={inputClass}
        />
      </Field>
      <Field label="Ảnh khi chia sẻ" hint="1200×630, nén nhẹ để tiết kiệm băng thông">
        <input
          name="ogImageUrl"
          defaultValue={campaign?.og.imageUrl}
          className={inputClass}
          placeholder="https://…"
        />
      </Field>
    </>
  );
}

/** Tiêu đề phân đoạn bên trong grid của form — chiếm trọn hàng. */
function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="col-span-full mt-2 border-t border-border pt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}
