"use client";

import TiptapImage from "@tiptap/extension-image";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useId, useRef, useState } from "react";

/**
 * Editor WYSIWYG cho thân bài landing.
 *
 * ── Vì sao Tiptap, không phải CKEditor ───────────────────────────────────────
 * Tiptap headless nên WHITELIST được node: admin không tạo ra được thứ phá design
 * system. CKEditor mang theme màu riêng của nó, sẽ đẻ hex ngoài globals.css và
 * phá luật token trong AGENTS.md.
 *
 * ── Vì sao bọc quanh <textarea> thật ─────────────────────────────────────────
 * `<textarea>` là form control THẬT và luôn có trong DOM; Tiptap mount lên trên
 * rồi ghi ngược HTML vào nó ở mỗi lần sửa. Khi JS chưa tải (hoặc bị chặn), admin
 * vẫn còn textarea để sửa nội dung — cùng nguyên tắc với action-form.tsx và
 * <details> trong ui.tsx: control plane không được đòi JS mới dùng được.
 *
 * Hệ quả: field submit là giá trị trong textarea, KHÔNG phải state React. Đó là
 * lý do dùng ref + ghi `.value` trực tiếp thay vì controlled input — form action
 * đọc FormData từ DOM.
 *
 * ── Whitelist ở đây chỉ là UX ────────────────────────────────────────────────
 * Luật thật nằm ở `sanitizeLandingBody` phía server. Ai cũng gõ HTML tay vào
 * textarea được. Sửa danh sách extension ở đây mà không sửa sanitizer thì nội
 * dung mới sẽ bị lọc sạch lúc lưu — và ngược lại là lỗ bảo mật.
 * Xem design-system/trafficiq/pages/campaign-landing.md § Thân bài rich-text.
 */
export function RichTextEditor({
  name,
  defaultValue,
  label,
  hint,
}: {
  name: string;
  defaultValue?: string;
  label: string;
  hint?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();

  const editor = useEditor({
    /*
     * BẮT BUỘC với App Router: mặc định Tiptap render ngay trong lần render đầu,
     * nhưng ProseMirror cần DOM thật nên sẽ lệch hydration. `false` khiến
     * `useEditor` trả null ở lần render đầu (khớp SSR) rồi mới dựng sau khi mount.
     */
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Chỉ h2/h3. Không h1: h1 là headline của campaign, một trang một h1.
        heading: { levels: [2, 3] },
        /*
         * Tắt hẳn những thứ sanitizer sẽ lọc bỏ. Để bật ở đây là hứa với admin
         * một định dạng rồi ăn mất nó lúc lưu — tệ hơn là không có nút.
         *
         * `link` tắt vì bất biến kiến trúc 12: mọi link ngoài CTA là chỗ rò rỉ
         * click, và landing không có nav/footer chính vì lý do đó.
         */
        link: false,
        underline: false,
        strike: false,
        code: false,
        codeBlock: false,
      }),
      /*
       * `allowBase64: false` (mặc định): ảnh base64 nhồi vài trăm KB vào chính
       * HTML trong Mongo và đi kèm mọi lượt render landing. Ảnh phải nằm trên CDN.
       */
      TiptapImage.configure({
        HTMLAttributes: { loading: "lazy", decoding: "async" },
      }),
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: {
        /*
         * `.prose prose-landing` — CHÍNH style của thân bài landing. Đây là chỗ
         * "WYSIWYG" thành thật: khung soạn thảo không phải bản gần giống trang
         * thật, nó dùng đúng cùng một bộ CSS.
         */
        class: "prose prose-landing min-h-40 px-3 py-2 focus:outline-none",
      },
    },
    /*
     * Đồng bộ NGAY khi editor dựng xong, không chỉ khi admin sửa.
     *
     * Vì sao: `onUpdate` chỉ chạy nếu có thay đổi. Sửa một field khác rồi bấm Lưu
     * mà không chạm vào thân bài thì textarea vẫn giữ `defaultValue` nguyên bản —
     * và giá trị đó có thể chưa phải HTML mà editor coi là hợp lệ. Ghi lại bản đã
     * chuẩn hoá ở đây khiến "không sửa gì" thành một no-op thật.
     */
    onCreate: ({ editor }) => syncToTextarea(editor),
    onUpdate: ({ editor }) => syncToTextarea(editor),
  });

  function syncToTextarea(instance: Editor) {
    if (!textareaRef.current) return;
    // Editor rỗng vẫn sinh "<p></p>" — ghi "" để sanitizer trả undefined thay vì
    // lưu một đoạn trống rồi render khoảng trắng lỗi trên landing.
    textareaRef.current.value = instance.isEmpty ? "" : instance.getHTML();
    textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="col-span-full text-sm">
      <label htmlFor={textareaId} className="block">
        <span className="font-medium">{label}</span>
        {hint ? <span className="ml-1 text-xs text-muted-foreground">{hint}</span> : null}
      </label>

      <div className="mt-1 overflow-hidden rounded-lg border border-input bg-card text-card-foreground">
        {editor ? <Toolbar editor={editor} /> : null}

        {/*
         * Textarea là form control thật. Khi editor đã mount thì ẩn đi bằng
         * `hidden` chứ KHÔNG unmount: unmount là field biến mất khỏi FormData và
         * lần lưu sẽ xoá trắng thân bài.
         *
         * `hidden` (không phải display:none qua class Tailwind `hidden`… thực ra
         * cùng hiệu ứng) vẫn để field được submit — chỉ `disabled` mới loại field
         * khỏi FormData, nên đừng thêm `disabled` vào đây.
         */}
        <textarea
          ref={textareaRef}
          id={textareaId}
          name={name}
          defaultValue={defaultValue}
          rows={10}
          className={editor ? "hidden" : "w-full bg-card px-3 py-2 font-mono text-xs focus:outline-none"}
          // Chỉ hiện khi JS chưa tải, nên nhắc luôn định dạng nhận được.
          placeholder="Thẻ HTML được phép: p, h2, h3, strong, em, ul, ol, li, blockquote, hr, img"
        />

        {editor ? <EditorContent editor={editor} /> : null}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Thân bài nằm DƯỚI tiêu đề lớn và TRÊN nút bấm. Đây là chỗ cho 3–5 luận
        điểm có cấu trúc, không phải chỗ viết dài — landing càng gọn thì tỷ lệ bấm
        nút càng cao. Link trong thân bài bị bỏ khi lưu: mọi cú bấm phải đi vào nút.
      </p>
    </div>
  );
}

/**
 * Toolbar.
 *
 * MỌI nút phải là `type="button"`. Mặc định của <button> trong <form> là
 * `type="submit"` — thiếu một chỗ là bấm "in đậm" submit luôn cả form.
 */
function Toolbar({ editor }: { editor: Editor }) {
  const [imageOpen, setImageOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted px-2 py-1.5">
      <ToolbarButton
        label="B"
        title="In đậm (Ctrl+B)"
        bold
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="In nghiêng (Ctrl+I)"
        italic
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />

      <Separator />

      <ToolbarButton
        label="Tiêu đề"
        title="Tiêu đề mục"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Tiêu đề nhỏ"
        title="Tiêu đề phụ trong mục"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Separator />

      <ToolbarButton
        label="Gạch đầu dòng"
        title="Danh sách gạch đầu dòng"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Danh sách số"
        title="Danh sách có số thứ tự"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Trích dẫn"
        title="Khối trích dẫn"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Ngắt mạch"
        title="Đường kẻ ngắt giữa hai luận điểm"
        active={false}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarButton
        label="Ảnh"
        title="Chèn ảnh theo địa chỉ"
        active={imageOpen}
        onClick={() => setImageOpen((open) => !open)}
      />

      <Separator />

      <ToolbarButton
        label="Xoá định dạng"
        title="Trả đoạn đang chọn về văn bản thường"
        active={false}
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      />

      {imageOpen ? (
        <ImageUrlInput
          onInsert={(src) => {
            editor.chain().focus().setImage({ src }).run();
            setImageOpen(false);
          }}
          onCancel={() => setImageOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Ô nhập địa chỉ ảnh.
 *
 * KHÔNG có `name`: nó nằm bên trong <form> của ActionForm, có `name` là nó bị
 * gửi kèm lên server như một field lạ.
 *
 * Enter phải `preventDefault`: Enter trong một input nằm trong form sẽ submit
 * form, tức là lưu campaign giữa lúc đang chèn ảnh.
 */
function ImageUrlInput({
  onInsert,
  onCancel,
}: {
  onInsert: (src: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  // Chỉ http(s) — cùng luật với sanitizer server. Chặn `data:` (ảnh base64 nhồi
  // vào HTML) ngay ở đây để admin biết lý do, thay vì để server lọc âm thầm.
  const valid = /^https?:\/\/\S+$/i.test(value.trim());

  return (
    <div className="flex w-full flex-wrap items-center gap-2 pt-1.5">
      <input
        type="url"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (valid) onInsert(value.trim());
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder="https://… (ảnh nằm trên CDN, không phải upload ở đây)"
        aria-label="Địa chỉ ảnh"
        className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
      <button
        type="button"
        disabled={!valid}
        onClick={() => onInsert(value.trim())}
        className="min-h-9 cursor-pointer rounded-md border border-primary px-2.5 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Chèn
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="min-h-9 cursor-pointer rounded-md px-2.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        Bỏ
      </button>
    </div>
  );
}

function Separator() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />;
}

/**
 * Nút định dạng.
 *
 * `aria-pressed` chứ không chỉ đổi màu: trạng thái bật/tắt phải đọc được bằng
 * screen reader, và đó cũng là luật "không dùng riêng màu để truyền thông tin".
 *
 * `min-h-9` = 36px, khớp `--table-row-height` của Data-Dense Dashboard. Vẫn dưới
 * 44px của chuẩn cảm ứng — chấp nhận được vì đây là surface admin trên desktop,
 * nhưng đừng bê nguyên toolbar này ra surface công khai dùng trên điện thoại.
 */
function ToolbarButton({
  label,
  title,
  active,
  onClick,
  bold,
  italic,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`min-h-9 cursor-pointer rounded-md px-2.5 text-xs transition-colors duration-150 ${
        bold ? "font-bold" : "font-medium"
      } ${italic ? "italic" : ""} ${
        active
          ? "bg-primary text-on-primary"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
