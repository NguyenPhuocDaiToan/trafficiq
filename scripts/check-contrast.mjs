/**
 * Gate WCAG contrast cho design token.
 *
 * Vì sao tự viết: checklist trong design-system/trafficiq/MASTER.md yêu cầu
 * "text contrast 4.5:1 minimum" và "focus states visible", nhưng skill
 * ui-ux-pro-max không ship validator nào để kiểm. Không có gate thì checklist chỉ
 * là lời hứa — nhất là với bộ dark palette do ta tự suy ra, không có trong MASTER.
 *
 * Chạy: npm run check:contrast
 *
 * Đọc trực tiếp src/app/globals.css để không bao giờ lệch khỏi giá trị thật.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

/** WCAG 2.1: 4.5:1 cho body text, 3:1 cho text lớn và UI component/border. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

/**
 * Đọc một khối khai token.
 *
 * `globals.css` có BỐN khối màu, không phải hai — surface công khai dùng tầng token
 * riêng `.theme-editorial` (xem comment đầu globals.css):
 *
 *   :root                        light  → /admin, /c/[slug], /link-unavailable
 *   .theme-editorial             light  → (site): trang chủ, blog, chuyên mục…
 *   :root trong @media dark      dark
 *   .theme-editorial trong @media dark  dark
 *
 * Chỉ lấy đúng phần trong cặp ngoặc của selector đó — không quét tới hết file như
 * bản trước. Bản cũ dựa vào "match đầu tiên thắng" nên khi thêm block thứ hai vào
 * cùng region, token của block sau bị block trước che và gate im lặng đo sai bộ.
 */
function parseBlock(source, selector, mode) {
  const darkIndex = source.indexOf("prefers-color-scheme: dark");
  const region =
    mode === "dark"
      ? source.slice(darkIndex)
      : source.slice(0, darkIndex === -1 ? source.length : darkIndex);

  /*
   * Phải khớp selector ở ĐẦU DÒNG rồi tới `{`, không dùng `indexOf(selector)`:
   * chính comment đầu globals.css có nhắc tên cả hai selector, nên `indexOf` bắt
   * vào comment rồi lấy `{` kế tiếp — tức đọc khối `:root` mà vẫn in nhãn "CÔNG
   * KHAI" và báo PASS. Đó là một gate nói dối, tệ hơn không có gate.
   */
  const declaration = new RegExp(
    `^[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*\\{`,
    "m",
  );
  const found = declaration.exec(region);
  if (!found) {
    throw new Error(`Không tìm thấy khối ${selector} cho bộ ${mode}`);
  }

  const open = found.index + found[0].length - 1;
  const close = region.indexOf("}", open);
  if (close === -1) {
    throw new Error(`Khối ${selector} (${mode}) không có dấu } đóng`);
  }

  const tokens = {};
  for (const match of region
    .slice(open, close)
    .matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

function toRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function relativeLuminance(hex) {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Alpha-blend fg lên bg — StatusBadge dùng bg-success/15 nên phải tính nền pha. */
function blend(fg, bg, alpha) {
  const f = toRgb(fg);
  const b = toRgb(bg);
  const mixed = f.map((channel, i) => Math.round(channel * alpha + b[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Các cặp màu thực sự xuất hiện trong UI. Thêm cặp mới khi thêm component. */
function pairsFor(t) {
  return [
    ["body text", t.foreground, t.background, AA_TEXT],
    ["text trong card", t["card-foreground"], t.card, AA_TEXT],
    ["muted text / background", t["muted-foreground"], t.background, AA_TEXT],
    ["muted text / card", t["muted-foreground"], t.card, AA_TEXT],
    ["link primary / background", t.primary, t.background, AA_TEXT],
    ["link primary / card", t.primary, t.card, AA_TEXT],
    ["CTA: on-accent / accent", t["on-accent"], t.accent, AA_TEXT],
    ["nút primary: on-primary / primary", t["on-primary"], t.primary, AA_TEXT],
    ["text destructive / card", t.destructive, t.card, AA_TEXT],
    ["text destructive / background", t.destructive, t.background, AA_TEXT],
    // StatusBadge: chữ trên nền tint 15%.
    ["badge active: success / success@15%", t.success, blend(t.success, t.card, 0.15), AA_TEXT],
    ["badge pending: warning / warning@15%", t.warning, blend(t.warning, t.card, 0.15), AA_TEXT],
    ["badge paused: muted-fg / muted", t["muted-foreground"], t.muted, AA_TEXT],
    // Notice component dùng tint 10% trên background trang.
    ["notice: warning / warning@10%", t.warning, blend(t.warning, t.background, 0.1), AA_TEXT],
    // Banner "đã tạo chiến dịch" ở /admin/campaigns: cùng kiểu tint 10%.
    ["notice ok: success / success@10%", t.success, blend(t.success, t.background, 0.1), AA_TEXT],
    /*
     * Hàng chiến dịch bung được (Collapsible) đổi nền sang --muted khi hover,
     * nên MỌI màu chữ xuất hiện trong hàng đó phải đạt ngưỡng trên nền --muted,
     * không chỉ trên --card. Cảnh báo "đang chạy nhưng không có đích nào" dùng
     * --warning: --destructive chỉ đạt 4.09:1 trên --muted ở light mode, nên
     * đừng đổi sang màu đỏ cho "nổi hơn" — gate này sẽ chặn.
     */
    ["cảnh báo trong hàng hover: warning / muted", t.warning, t.muted, AA_TEXT],
    /*
     * Surface blog dùng --accent làm MÀU CHỮ (nhãn chuyên mục, dòng tagline ở
     * hero), không chỉ làm nền nút. Khi là chữ thì phải đạt 4.5:1 — nền nút và
     * chữ trên nền là hai ngưỡng khác nhau.
     */
    ["nhãn accent làm chữ / background", t.accent, t.background, AA_TEXT],
    ["nhãn accent làm chữ / card", t.accent, t.card, AA_TEXT],
    /*
     * PostCard/FeaturedCard có "cover kiểu chữ": nửa trên nằm trên nền --muted và
     * chứa nhãn chuyên mục màu accent. Nền tint là nền thứ BA cho cùng màu chữ đó
     * (background, card, muted) nên phải gác riêng.
     */
    ["nhãn accent làm chữ / muted", t.accent, t.muted, AA_TEXT],
    /*
     * Palette editorial black: --accent còn là màu HOVER của link, tiêu đề bài và
     * wordmark (vì --primary gần trùng --foreground nên hover bằng primary sẽ vô
     * hình). Ba cặp accent-làm-chữ ở trên đã phủ đúng ba nền mà hover xảy ra.
     *
     * Và vì --primary được dùng làm màu chữ link, nó cũng phải đạt ngưỡng TEXT
     * chứ không chỉ ngưỡng UI — hai cặp "link primary" ở trên đã gác việc đó.
     */
    // `.prose code` và thẻ tag: chữ thường trên nền --muted.
    ["code trong bài: foreground / muted", t.foreground, t.muted, AA_TEXT],
    // Thông báo thành công của form (ActionForm trong card, ContactForm trên trang).
    ["thông báo ok: success / background", t.success, t.background, AA_TEXT],
    ["thông báo ok: success / card", t.success, t.card, AA_TEXT],
    // UI/non-text: 3:1 là đủ theo WCAG 1.4.11.
    ["focus ring / background", t.ring, t.background, AA_LARGE],
    ["focus ring / card", t.ring, t.card, AA_LARGE],
    ["viền input / card", t.input, t.card, AA_LARGE],
    ["chart bar: secondary / card", t.secondary, t.card, AA_LARGE],
    // KHÔNG kiểm `--border`: nó chỉ dùng cho divider/viền card, không mang
    // thông tin trạng thái nên WCAG 1.4.11 không áp dụng. Ép 3:1 sẽ làm bảng
    // data-dense nặng mắt. Viền control kiểm riêng qua `--input` ở trên.
  ];
}

let failures = 0;

/*
 * Bốn bộ phải gác, không phải hai. Bộ `.theme-editorial` là surface người đọc thấy
 * — bỏ nó ra khỏi gate thì gate chỉ còn kiểm màu của trang admin nội bộ.
 *
 * Cả bốn bộ dùng CÙNG một danh sách cặp màu, kể cả những cặp chỉ xảy ra ở /admin
 * (StatusBadge, notice tint). Cố ý: một cặp không dùng ở surface này thì đo thêm
 * không tốn gì, còn nếu sau này component admin được dùng lại ở public thì gate đã
 * phủ sẵn — rẻ hơn nhiều so với việc phát hiện khi đã lên production.
 */
const SCOPES = [
  { selector: ":root", mode: "light", label: "NỀN (/admin) — LIGHT" },
  { selector: ":root", mode: "dark", label: "NỀN (/admin) — DARK" },
  { selector: ".theme-editorial", mode: "light", label: "CÔNG KHAI (site) — LIGHT" },
  { selector: ".theme-editorial", mode: "dark", label: "CÔNG KHAI (site) — DARK" },
];

for (const scope of SCOPES) {
  const tokens = parseBlock(css, scope.selector, scope.mode);
  console.log(`\n${scope.label}`);

  for (const [label, fg, bg, min] of pairsFor(tokens)) {
    if (!fg || !bg) {
      console.log(`  ?  ${label} — thiếu token, bỏ qua`);
      continue;
    }
    const ratio = contrast(fg, bg);
    const pass = ratio >= min;
    if (!pass) failures += 1;
    console.log(
      `  ${pass ? "PASS" : "FAIL"} ${ratio.toFixed(2)}:1 (cần ${min}:1)  ${label}  ${fg} on ${bg}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} cặp màu không đạt WCAG. Sửa token trong globals.css.`);
  process.exit(1);
}
console.log("\nTất cả cặp màu đạt WCAG.");
