"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore } from "react";
import { buttonSecondaryClass, inputClass } from "@/components/ui";
import { needsShrink, shrinkImage } from "@/lib/media/client-shrink";
import { CLIENT_SHRINK_ABOVE_BYTES, formatBytes, MAX_UPLOAD_BYTES } from "@/lib/media/limits";

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
  | { kind: "uploading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string; warning?: string };

/** Tỉ lệ ảnh chia sẻ chuẩn của Facebook/X/Zalo: 1200×630. */
const OG_RATIO = 1200 / 630;

/** Khớp `ACCEPTED_FORMATS` của server; GIF/SVG/HEIC bị từ chối ngay, khỏi tải rồi mới báo. */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const subscribeNoop = () => () => {};
/** `true` sau hydrate, `false` khi SSR — không cần effect để biết JS đã chạy. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function ImageUrlField({
  name,
  label,
  hint,
  help,
  kind,
  defaultValue,
  tour,
  required = false,
  dropzone = false,
}: {
  name: string;
  label: string;
  hint?: string;
  /** Ô link bắt buộc có giá trị (tải lên cũng là điền giá trị vào đúng ô này). */
  required?: boolean;
  /**
   * Chế độ "tải ảnh nhanh": một vùng lớn để kéo-thả / bấm chọn / dán ảnh bằng Ctrl+V, ô dán link thu xuống thành
   * lựa chọn phụ. Dùng ở form tạo chiến dịch, nơi tải ảnh lên là thao tác CHÍNH chứ không phải một tuỳ chọn.
   */
  dropzone?: boolean;
  /** Chú thích dưới ô nhập (xem `Field`). */
  help?: string;
  /** Điểm chỉ của coach mark (`data-tour`) — xem `lib/guide/lessons.ts`. */
  tour?: string;
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

  // Dán ảnh từ clipboard (Ctrl+V sau khi chụp màn hình hoặc sao chép ảnh) — nhanh hơn lưu file rồi chọn. Chỉ ở chế
  // độ `dropzone` và chỉ khi nội dung dán LÀ ảnh: dán chữ vào ô link hay ô khác vẫn chạy như bình thường.
  // `useEffectEvent`: handler luôn thấy `upload` mới nhất mà không buộc effect đăng ký lại listener mỗi lần render.
  const uploadPasted = useEffectEvent((file: File) => {
    void upload(file);
  });
  useEffect(() => {
    if (!dropzone) return;
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      uploadPasted(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [dropzone]);

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

  async function upload(original: File) {
    if (!ACCEPTED_TYPES.includes(original.type)) {
      setStatus({
        kind: "error",
        message: `Chỉ nhận ảnh JPG, PNG hoặc WebP (file này là ${original.type || "không rõ định dạng"}).`,
      });
      return;
    }

    // Ảnh chụp điện thoại thường 3–12MB, vượt trần của máy chủ. Thu nhỏ ngay trong trình duyệt
    // thay vì bắt admin đi nén tay; server vẫn xử lý lại bản này nên độ nét cuối không đổi.
    let file = original;
    if (needsShrink(original.size)) {
      setStatus({ kind: "uploading", message: `Đang thu nhỏ ảnh ${formatBytes(original.size)}…` });
      const shrunk = await shrinkImage(original);
      // Giữ bản gốc nếu thu nhỏ không giúp ích và bản gốc đã vừa trần.
      if (shrunk && (shrunk.size < original.size || original.size > MAX_UPLOAD_BYTES)) file = shrunk;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({
        kind: "error",
        message:
          file === original
            ? `Ảnh ${formatBytes(original.size)} vượt giới hạn ${formatBytes(MAX_UPLOAD_BYTES)} và trình duyệt này không tự thu nhỏ được. Hãy thu nhỏ ảnh bằng phần mềm chỉnh ảnh rồi tải lại.`
            : `Ảnh ${formatBytes(original.size)} vẫn còn ${formatBytes(file.size)} sau khi tự thu nhỏ, vượt giới hạn ${formatBytes(MAX_UPLOAD_BYTES)}. Hãy chọn ảnh khác.`,
      });
      return;
    }
    const shrunkNote =
      file === original ? undefined : `ảnh gốc ${formatBytes(original.size)} đã được thu nhỏ còn ${formatBytes(file.size)} trước khi gửi`;

    setStatus({ kind: "uploading", message: `Đang tải lên ${formatBytes(file.size)}…` });

    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);

    try {
      const res = await fetch("/admin/upload-image", { method: "POST", body });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      if (!isJson) {
        // Không phải JSON của route này nên là một lớp đứng trước nó trả lời. 413 = nền tảng/proxy
        // cắt body trước khi tới app; redirect = proxy đẩy về trang đăng nhập (phiên hết hạn).
        setStatus({
          kind: "error",
          message:
            res.status === 413
              ? `Yêu cầu ${formatBytes(file.size)} bị máy chủ phía trước từ chối vì quá lớn. Giới hạn của ứng dụng là ${formatBytes(MAX_UPLOAD_BYTES)}, nhưng Vercel cắt ở 4,5MB và nginx mặc định ở 1MB (cần client_max_body_size).`
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
      const done = `Đã tải lên · ${result.width}×${result.height} · ${kb}KB${shrunkNote ? ` (${shrunkNote})` : ""}`;
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
      data-tour={tour}
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

      {dropzone && hydrated ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className={`mt-2 flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 hover:bg-muted disabled:cursor-wait ${
            dragging ? "border-ring bg-muted" : "border-input"
          }`}
        >
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh admin vừa tải lên, không qua Image Optimization
            <img src={value} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
          ) : null}
          <span className="text-sm font-semibold">
            {uploading ? "Đang tải ảnh lên…" : showPreview ? "Bấm hoặc kéo ảnh khác vào để đổi" : "Kéo ảnh vào đây hoặc bấm để chọn ảnh"}
          </span>
          {showPreview || uploading ? null : (
            <span className="text-xs text-muted-foreground">Cũng dán được ảnh bằng Ctrl+V · JPG, PNG, WebP</span>
          )}
        </button>
      ) : null}

      <div className={`mt-1 flex gap-2 ${dropzone && hydrated ? "mt-2" : ""}`}>
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          placeholder={
            dropzone && hydrated ? "hoặc dán link ảnh vào đây" : hydrated ? "Dán link ảnh, hoặc tải ảnh lên" : "https://…"
          }
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        {hydrated ? (
          <>
            {dropzone ? null : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className={`${buttonSecondaryClass} shrink-0 whitespace-nowrap`}
              >
                {uploading ? "Đang xử lý…" : "Tải ảnh lên"}
              </button>
            )}
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

      {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}

      <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs">
        {status.kind === "idle" && hydrated && brokenValue !== value ? (
          // Giới hạn thật, nói trước — không đợi tới khi bị từ chối mới cho biết.
          <span className="text-muted-foreground">
            JPG, PNG hoặc WebP · tối đa {formatBytes(MAX_UPLOAD_BYTES)} · ảnh trên{" "}
            {formatBytes(CLIENT_SHRINK_ABOVE_BYTES)} được tự thu nhỏ trước khi gửi
          </span>
        ) : null}
        {status.kind === "uploading" ? (
          <span className="text-muted-foreground">{status.message}</span>
        ) : null}
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

      {/* Ở chế độ vùng kéo-thả, bản xem trước nằm ngay trong vùng đó — không hiện hai lần. */}
      {showPreview && !(dropzone && hydrated) ? (
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
