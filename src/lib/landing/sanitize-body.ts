import sanitizeHtml from "sanitize-html";

/**
 * Sanitize thân bài landing do admin soạn bằng editor WYSIWYG.
 *
 * Vì sao phải có ở SERVER dù editor client đã whitelist node: whitelist ở client
 * chỉ là UX (toolbar không có nút thì admin không tạo được node đó). Field gửi
 * lên là một `<textarea>` thật — ai cũng gõ HTML tay vào đó được, và khi JS chưa
 * tải thì textarea là thứ duy nhất. Đây mới là chỗ chốt luật.
 *
 * Nội dung này render bằng `dangerouslySetInnerHTML` trên `/c/[slug]` — một trang
 * CÔNG KHAI. Stored XSS ở đây chạy trong browser của người đọc thật, không phải
 * chỉ trong admin.
 *
 * Whitelist cố định theo design-system/trafficiq/pages/campaign-landing.md
 * § "Thân bài rich-text". Muốn nới thì sửa file đó trước, đừng sửa mảng ở đây.
 */

/**
 * KHÔNG có `a`: bất biến kiến trúc 12 — landing không có nav/footer vì mọi link
 * ngoài CTA đều là chỗ rò rỉ click. Cho `<a>` vào thân bài là mở lại đúng lỗ đó.
 *
 * KHÔNG có `h1`: `h1` là headline của campaign. Một trang một `h1`.
 *
 * KHÔNG có `table`/`iframe`/`form`: không thuộc một landing 4 section.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "img",
];

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  /*
   * Chỉ `img` có attribute, và chỉ src/alt.
   *
   * KHÔNG cho `style`, `class`, `id`: nội dung phải nằm trong design token. Nếu
   * admin đặt được màu tay thì `npm run check:contrast` mất hết ý nghĩa — gate đó
   * đọc globals.css, không đọc được HTML nằm trong Mongo.
   */
  /*
   * `loading`/`decoding` PHẢI có trong danh sách này dù chúng do `transformTags`
   * chèn vào: sanitize-html lọc attribute SAU khi transform, nên thiếu ở đây là
   * hai attribute đó bị xoá ngay sau khi vừa được thêm — ảnh thân bài âm thầm
   * quay về nạp eager và tranh băng thông với hero. Đã bị đúng lỗi này một lần.
   */
  allowedAttributes: { img: ["src", "alt", "loading", "decoding"] },
  // Chỉ ảnh http(s). Chặn `data:` (nhồi vài trăm KB vào HTML) và `javascript:`.
  allowedSchemes: ["http", "https"],
  allowedSchemesAppliedToAttributes: ["src"],
  /*
   * Bỏ hẳn thẻ `img` không có `src` http(s) tuyệt đối.
   *
   * Vì sao cần: `allowedSchemes` chỉ xoá ATTRIBUTE xấu, để lại `<img />` rỗng —
   * một thẻ hỏng nằm giữa bài. Và URL tương đối (`src="x"`) không bị scheme filter
   * chặn chút nào, nhưng ảnh landing bắt buộc nằm trên CDN ngoài nên đường dẫn
   * tương đối luôn là rác hoặc dấu vết của payload bị lọc dở.
   */
  exclusiveFilter: (frame) =>
    frame.tag === "img" && !/^https?:\/\/\S+$/i.test(frame.attribs.src ?? ""),
  // Thẻ không cho phép: bỏ THẺ nhưng giữ nội dung text bên trong, để admin dán
  // từ Word/Google Docs không bị mất chữ — chỉ mất định dạng lạ.
  disallowedTagsMode: "discard",
  transformTags: {
    /*
     * Ép lazy trên mọi ảnh thân bài. Thân bài nằm dưới fold, còn hero là LCP
     * element của traffic trả tiền — ảnh thân bài không được tranh băng thông
     * với nó. Ép ở đây thay vì tin admin nhớ.
     */
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy", decoding: "async" },
    }),
    /*
     * Editor có thể sinh `h1` khi admin dán từ nguồn ngoài. Hạ xuống `h2` thay vì
     * xoá: giữ được cấu trúc mà không tạo `h1` thứ hai trên trang.
     */
    h1: "h2",
    h4: "h3",
    h5: "h3",
    h6: "h3",
    b: "strong",
    i: "em",
  },
  // `<img>` là void element — không tự đóng thành `<img/>` cho khớp HTML5.
  selfClosing: ["br", "hr", "img"],
};

/**
 * Trả về HTML đã lọc, hoặc `undefined` nếu sau khi lọc không còn nội dung thật.
 *
 * Editor rỗng vẫn sinh `<p></p>`, và lưu chuỗi đó xuống Mongo sẽ làm landing
 * render một đoạn trống — `bodyHtml` phải là undefined để renderer bỏ qua hẳn.
 */
export function sanitizeLandingBody(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const clean = sanitizeHtml(input, SANITIZE_OPTIONS).trim();

  // Còn chữ, hoặc còn ảnh/ngắt dòng (nội dung không phải text vẫn là nội dung).
  const hasText = clean.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
  const hasMedia = /<(img|hr)\b/.test(clean);
  if (!hasText && !hasMedia) return undefined;

  return clean;
}
