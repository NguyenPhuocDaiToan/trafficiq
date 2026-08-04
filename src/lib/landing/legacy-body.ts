/**
 * Chuyển thân bài PHẲNG đời đầu (`landing.bodyText`, @deprecated) sang HTML.
 *
 * Vì sao cần một module riêng chứ không xử lý tại chỗ: luật tách đoạn phải GIỐNG
 * NHAU ở hai nơi —
 *   1. `LandingView` khi render campaign cũ chưa di trú.
 *   2. `CampaignFields` khi nạp nội dung cũ vào editor.
 * Hai luật tách khác nhau nghĩa là mở trang sửa rồi bấm Lưu mà không sửa gì cũng
 * làm bố cục bài đổi.
 */

/**
 * Tách theo DÒNG TRỐNG, không phải mọi "\n".
 *
 * `split("\n")` trên "đoạn 1\n\nđoạn 2" sinh một phần tử rỗng ở giữa và render ra
 * `<p></p>` — một khoảng trắng lỗi giữa trang đang chạy traffic trả tiền. Đó là
 * hành vi của bản đầu, đã sửa.
 */
export function splitLegacyParagraphs(bodyText: string): string[] {
  return bodyText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Escape để text phẳng không bị hiểu thành thẻ khi editor parse nó như HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bọc từng đoạn của text phẳng vào `<p>`.
 *
 * Dùng để nạp `bodyText` cũ vào editor. KHÔNG đưa text phẳng thẳng vào Tiptap:
 * Tiptap parse content như HTML, nên "\n\n" chỉ là khoảng trắng và hai đoạn văn
 * dính thành một. Cũng chính là lý do phải gọi hàm này thay vì tin rằng admin sẽ
 * chạm vào editor trước khi bấm Lưu — không chạm thì textarea giữ nguyên text
 * phẳng và lần lưu đó làm mất ranh giới đoạn.
 */
export function legacyBodyToHtml(bodyText: string): string {
  return splitLegacyParagraphs(bodyText)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}
