"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { slugify } from "@/lib/slug";

/**
 * Cặp field "Tên chiến dịch" + "Đường dẫn tĩnh".
 *
 * Client component vì đường dẫn phải tự sinh theo tên khi admin đang gõ. Khi JS
 * chưa tải thì cả hai vẫn là input thường, và `createCampaign` tự suy ra đường dẫn
 * từ tên ở server bằng ĐÚNG hàm `slugify` này — không có JS thì mất phần điền sẵn,
 * không mất khả năng tạo chiến dịch.
 *
 * ── Vì sao hành vi khác nhau giữa tạo và sửa ─────────────────────────────────
 * `mode="create"`: chưa có gì phát hành ra ngoài nên tự điền là tiện thuần túy.
 *
 * `mode="edit"`: đường dẫn đang SỐNG. Tự sinh lại theo tên ở đây nghĩa là admin
 * sửa một chữ trong tên rồi bấm Lưu là mọi link /c/… đã chia sẻ thành 404 mà
 * không ai chọn điều đó. Nên ở chế độ sửa nó chỉ đổi khi admin bấm nút "Sinh lại
 * từ tên" — vẫn làm được, nhưng phải cố ý.
 */
export function CampaignNameSlugFields({
  defaultName,
  defaultSlug,
  mode,
}: {
  defaultName?: string;
  defaultSlug?: string;
  mode: "create" | "edit";
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [slug, setSlug] = useState(defaultSlug ?? "");
  /*
   * Đã tự tay sửa đường dẫn chưa. Ở chế độ sửa thì coi như đã sửa ngay từ đầu —
   * giá trị đang có là đường dẫn thật đang chạy, không phải bản nháp để ghi đè.
   */
  const [slugTouched, setSlugTouched] = useState(
    mode === "edit" || Boolean(defaultSlug),
  );

  return (
    <>
      <Field label="Tên chiến dịch">
        <input
          name="name"
          /*
           * Chỉ bắt buộc khi SỬA. Lúc tạo, để trống là hợp lệ: server đặt tên theo tên miền của URL đích
           * (`applyCreateDefaults`), nên đây là ô "tuỳ chọn" chứ không phải thứ phải nghĩ ra.
           */
          required={mode === "edit"}
          value={name}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            // Chỉ đuổi theo tên khi admin chưa tự đặt đường dẫn.
            if (mode === "create" && !slugTouched) setSlug(slugify(next));
          }}
          className={inputClass}
          placeholder={mode === "create" ? "Để trống: tự đặt theo URL đích" : "Tài chính Q3 VN"}
        />
      </Field>

      <Field
        label="Đường dẫn tĩnh"
        help={
          mode === "edit"
            ? "Đổi đường dẫn thì link /c/… đã chia sẻ sẽ không còn hoạt động (404)."
            : "Tự sinh từ tên chiến dịch, sửa được."
        }
        helpTone={mode === "edit" ? "warning" : "muted"}
      >
        <div className="flex flex-wrap gap-2">
        {/* Tiền tố cố định: cho thấy đây là phần đuôi của /c/…, không phải một URL đầy đủ. */}
        <span
          aria-hidden="true"
          className="inline-flex items-center rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground"
        >
          /c/
        </span>
        <div className="min-w-40 flex-1">
        <input
          name="slug"
          /*
           * Chỉ bắt buộc khi SỬA. Lúc tạo, để trống là hợp lệ: server suy ra từ
           * tên. Đặt `required` ở đây sẽ chặn đúng luồng no-JS mà nó cần hỗ trợ.
           */
          required={mode === "edit"}
          value={slug}
          onChange={(event) => {
            const next = event.target.value;
            setSlug(next);
            /*
             * Xoá trắng thì quay lại chế độ tự sinh — nếu không, admin xoá để gõ
             * lại rồi đổi ý sẽ mắc kẹt với một field trống mãi.
             */
            setSlugTouched(next.length > 0);
          }}
          className={inputClass}
          placeholder={mode === "create" ? "tự sinh từ tên" : "tai-chinh-q3-vn"}
        />
        </div>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={() => setSlug(slugify(name))}
            disabled={slugify(name) === slug || slugify(name).length === 0}
            className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-primary px-3 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sinh lại từ tên
          </button>
        ) : null}
        </div>
      </Field>
    </>
  );
}
