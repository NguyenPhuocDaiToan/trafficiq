"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { buttonSecondaryClass, inputClass } from "@/components/ui";

/**
 * Field ảnh: MỘT ô nhập duy nhất, nhận cả link dán vào lẫn ảnh tải lên.
 *
 * Tải lên không tạo field thứ hai — nó chỉ điền đường dẫn `/uploads/<tên>` vào chính ô
 * nhập. Nhờ vậy form submit đúng một giá trị (`name`), server không phải đoán "link
 * hay file", và sửa lại bằng tay (xoá, dán link khác) hoạt động y như trước.
 *
 * Tải lên đi qua `/admin/upload-image` (route handler) chứ không nằm trong submit của
 * form: server action bị giới hạn body 1MB trên toàn site. Hệ quả: khi JS chưa tải,
 * nút tải lên không dùng được, còn dán link thì vẫn chạy — control plane vẫn lưu được
 * campaign (cùng nguyên tắc với `action-form.tsx`). Vì vậy nút tải chỉ hiện sau
 * hydrate, không để một nút chết nằm trên trang.
 */

type UploadResponse =
  | { ok: true; url: string; bytes: number; width: number; height: number }
  | { ok: false; error: string };

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string; warning?: string };

/** Tỉ lệ ảnh chia sẻ chuẩn của Facebook/X/Zalo: 1200×630. */
const OG_RATIO = 1200 / 630;

const subscribeNoop = () => () => {};
/** `true` sau hydrate, `false` khi SSR — không cần effect để biết JS đã chạy. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function ImageUrlField({
  name,
  label,
  hint,
  kind,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  /** Quyết định cỡ và định dạng server nén ra — xem `lib/media/process.ts`. */
  kind: "hero" | "og";
  defaultValue?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();

  const [value, setValue] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  // Link đã thử nạp mà hỏng. Lưu theo giá trị thay vì boolean để tự hết hiệu lực khi
  // admin đổi link, không cần effect reset.
  const [brokenValue, setBrokenValue] = useState<string | null>(null);

  const uploading = status.kind === "uploading";

  /**
   * Gán giá trị vào ô nhập rồi phát một sự kiện `input` thật. Form cha
   * (`CampaignEditLivePreview`) nghe `onInput` bubbling để cập nhật bản xem trước —
   * đổi `value` bằng code không phát sự kiện nào, nên không phát thì ảnh vừa tải lên
   * không hiện ở preview cho tới lần gõ phím kế tiếp.
   */
  function commit(next: string) {
    const el = inputRef.current;
    if (!el) return;
    // Setter gốc của HTMLInputElement: gán `el.value` trực tiếp bị React theo dõi và
    // có thể nuốt sự kiện input kế tiếp.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus({ kind: "error", message: "Chỉ nhận file ảnh (JPG, PNG, WebP)." });
      return;
    }
    setStatus({ kind: "uploading" });

    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);

    try {
      const res = await fetch("/admin/upload-image", { method: "POST", body });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (!isJson) {
        // Không phải JSON của route này nên là một lớp đứng trước nó trả lời. 413 = nginx cắt
        // body (cần `client_max_body_size`); redirect = proxy đẩy về trang đăng nhập (phiên hết hạn).
        setStatus({
          kind: "error",
          message:
            res.status === 413
              ? "File quá lớn so với giới hạn của máy chủ. Hãy thu nhỏ ảnh trước khi tải lên."
              : "Phiên đăng nhập đã hết hạn. Tải lại trang rồi đăng nhập lại.",
        });
        return;
      }
      const result = (await res.json()) as UploadResponse;
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      commit(result.url);

      const kb = Math.max(1, Math.round(result.bytes / 1024));
      const done = `Đã tải lên · ${result.width}×${result.height} · ${kb}KB`;
      // Ảnh chia sẻ lệch tỉ lệ sẽ bị mạng xã hội cắt. Chỉ cảnh báo, không chặn:
      // admin có thể cố ý dùng ảnh vuông.
      const warning =
        kind === "og" && Math.abs(result.width / result.height - OG_RATIO) / OG_RATIO > 0.15
          ? "Tỉ lệ ảnh khác 1,91:1 nên Facebook/Zalo có thể cắt hai mép khi chia sẻ."
          : undefined;
      setStatus({ kind: "done", message: done, warning });
    } catch {
      setStatus({ kind: "error", message: "Không kết nối được máy chủ. Thử lại." });
    }
  }

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
    // Xoá lựa chọn để chọn lại ĐÚNG file vừa chọn vẫn kích hoạt onChange.
    if (fileRef.current) fileRef.current.value = "";
  }

  const showPreview = value.length > 0 && brokenValue !== value;

  return (
    <div
      className={`text-sm ${dragging ? "rounded-lg outline-2 outline-dashed outline-ring outline-offset-4" : ""}`}
      onDragOver={(e) => {
        if (!hydrated || uploading) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!hydrated || uploading) return;
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      {hint ? <span className="ml-1 text-xs text-muted-foreground">{hint}</span> : null}

      <div className="mt-1 flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          placeholder={hydrated ? "Dán link ảnh, hoặc tải ảnh lên" : "https://…"}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        {hydrated ? (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className={`${buttonSecondaryClass} shrink-0 whitespace-nowrap`}
            >
              {uploading ? "Đang tải…" : "Tải ảnh lên"}
            </button>
            {/* Không `name`: file KHÔNG đi theo submit của form, chỉ đi qua fetch ở trên. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label={`Chọn file cho ${label}`}
              onChange={(e) => pick(e.target.files)}
            />
          </>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs">
        {status.kind === "error" ? (
          <span className="text-destructive">{status.message}</span>
        ) : null}
        {status.kind === "done" ? (
          <>
            <span className="text-success">{status.message}</span>
            {status.warning ? (
              <span className="ml-2 text-warning">{status.warning}</span>
            ) : null}
          </>
        ) : null}
        {brokenValue === value && value.length > 0 ? (
          <span className="text-destructive">
            Không tải được ảnh từ link này. Kiểm tra lại đường dẫn.
          </span>
        ) : null}
      </p>

      {showPreview ? (
        <div className="mt-2 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh admin dán/tải lên, không qua Image Optimization (hạn mức free tier) */}
          <img
            src={value}
            alt=""
            onError={() => setBrokenValue(value)}
            className="max-h-28 max-w-56 rounded-lg border border-border object-contain"
          />
          {hydrated ? (
            <button
              type="button"
              onClick={() => {
                commit("");
                setStatus({ kind: "idle" });
              }}
              className={buttonSecondaryClass}
            >
              Xoá ảnh
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
