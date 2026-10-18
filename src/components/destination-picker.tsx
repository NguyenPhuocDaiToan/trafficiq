"use client";

import { useId, useState } from "react";
import { inputClass } from "@/components/ui";
import { MAX_DESTINATIONS_PER_CAMPAIGN } from "@/lib/control-plane/campaign-defaults";

/**
 * Ô "URL đích" của form tạo chiến dịch: CHỌN từ danh sách đã lưu (Cài đặt → URL đích) HOẶC dán URL mới.
 *
 * Dùng `<input list>` + `<datalist>` chứ không phải `<select>`: một ô duy nhất nhận cả hai cách, nên đường nhanh
 * nhất (dán một URL) không phải đi qua một lựa chọn "chọn có sẵn hay nhập mới". URL mới được `createCampaign` tự
 * thêm vào danh sách đích, URL đã có thì dùng lại — nên chọn hay dán ra cùng một kết quả.
 *
 * Mỗi hàng là một `<input name="destinationUrls">` cùng tên; server gom bằng `formData.getAll` (xem
 * `createCampaign`). Nhiều hàng = nhiều đích, traffic chia đều. Hàng đầu tiên là `<input>` thường nên form vẫn
 * dùng được khi JS chưa tải; chỉ nút "Thêm URL đích" cần JS.
 */
export interface DestinationChoice {
  url: string;
  /** Nhãn phụ hiện cạnh URL trong danh sách gợi ý: đối tác · phân loại. */
  label: string;
}

export function DestinationPicker({ choices }: { choices: DestinationChoice[] }) {
  const listId = useId();
  const [rows, setRows] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  return (
    <div className="space-y-2" data-tour="cf-urls">
      <label className="block text-sm font-medium" htmlFor={`${listId}-0`}>
        URL đích
      </label>

      <datalist id={listId}>
        {choices.map((choice) => (
          <option key={choice.url} value={choice.url} label={choice.label} />
        ))}
      </datalist>

      {rows.map((id, index) => (
        <div key={id} className="flex gap-2">
          <input
            id={`${listId}-${id}`}
            name="destinationUrls"
            list={listId}
            required={index === 0}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
            placeholder={
              choices.length > 0
                ? "Bấm để chọn URL đã lưu, hoặc dán URL mới"
                : "https://offer.example.com/landing"
            }
          />
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((row) => row !== id))}
              className="shrink-0 cursor-pointer rounded-lg border border-input px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              aria-label="Bỏ URL đích này"
            >
              Bỏ
            </button>
          ) : null}
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        {choices.length > 0
          ? `Có ${choices.length} URL đã lưu ở Cài đặt → URL đích: bấm vào ô để chọn. `
          : "Chưa có URL nào được lưu. "}
        Dán URL mới cũng được — nó tự được lưu vào danh sách và dùng được ngay.
      </p>

      {rows.length < MAX_DESTINATIONS_PER_CAMPAIGN ? (
        <button
          type="button"
          onClick={() => {
            setRows((current) => [...current, nextId]);
            setNextId((n) => n + 1);
          }}
          className="cursor-pointer text-xs font-medium text-primary underline underline-offset-2"
        >
          + Thêm URL đích khác (traffic chia đều)
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Tối đa {MAX_DESTINATIONS_PER_CAMPAIGN} URL đích.</p>
      )}
    </div>
  );
}
