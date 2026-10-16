/**
 * Gate font chữ: `npm run check:fonts`.
 *
 * Mọi luật ở đây đến từ một lỗi ĐÃ GẶP THẬT khi đo bằng Chromium (xem `src/app/globals.css`, khối `--font-sans`,
 * và `design-system/trafficiq/MASTER.md § Typography`). Gate không đo trình duyệt — nó chặn các cấu hình mà
 * phép đo đã chứng minh là sai, để không ai phải đo lại.
 *
 *  A. Font khai trong layout.tsx (next/font/google)
 *     - subset khai phải có thật trong dữ liệu font của Next;
 *     - font chữ Latin PHẢI có subset `vietnamese` (Fira Code từng thiếu nó → dấu thanh rơi sang font hệ thống);
 *     - weight khai phải có thật.
 *  B. @font-face tự host (font Ả Rập) trong globals.css
 *     - bắt buộc có `unicode-range` (thiếu nó thì font Ả Rập đứng đầu danh sách sẽ vẽ luôn chữ Latin/Việt);
 *     - file font và bản giấy phép phải có trên đĩa.
 *  C. Ngăn xếp `--font-sans/--font-display/--font-mono`
 *     - font có @font-face (Ả Rập) phải đứng TRƯỚC mọi font của next/font (font dự phòng Arial của next/font
 *       có glyph Ả Rập và sẽ chiếm chữ Ả Rập nếu đứng trước);
 *     - từ khoá chung (`sans-serif`, `serif`, `monospace`, `system-ui`…) chỉ được ở CUỐI (nó chấm dứt việc tìm font).
 *  D. Mọi `font-family:` trong globals.css đi qua token `--font-*`; không dùng thẳng biến của next/font.
 *  E. Mã nguồn .tsx
 *     - `font-display` (Fraunces) chỉ ở bề mặt công khai, luôn kèm `font-bold`, không `italic`/`semibold`/`medium`;
 *     - không dùng độ đậm chưa được nạp (thin/extralight/light/extrabold/black);
 *     - không hard-code `font-family`/`fontFamily`;
 *     - `font-mono` không bọc chữ tiếng Việt có dấu (mono chỉ cho số, code, URL).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
]);

/** Chỉ các tệp này được dùng `font-display` (Fraunces): bề mặt công khai. */
const DISPLAY_ALLOWED = [
  /^src[\\/]components[\\/]site\.tsx$/,
  /^src[\\/]components[\\/]content\.tsx$/,
  /^src[\\/]app[\\/]\(site\)[\\/]/,
  /^src[\\/]content[\\/]/,
];

const VIETNAMESE_DIACRITIC = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/* ---------------------------------------------------------------- hàm thuần (được test) */

/** Tách một danh sách `font-family` thành các mục ở mức ngoài cùng (tôn trọng ngoặc và nháy). */
export function splitStack(value) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const ch of value) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === "(") {
      depth++;
      cur += ch;
    } else if (ch === ")") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const isGeneric = (entry) => GENERIC.has(entry.toLowerCase());
const isVar = (entry) => /^var\(/.test(entry);
const isQuoted = (entry) => /^["']/.test(entry);

/**
 * Kiểm một ngăn xếp. `selfHosted` = tên các font có @font-face tự khai `unicode-range` (Ả Rập).
 * Trả về danh sách lỗi (rỗng = đạt).
 */
export function checkStack(name, value, selfHosted) {
  const errors = [];
  const parts = splitStack(value);

  const firstGeneric = parts.findIndex(isGeneric);
  if (firstGeneric === -1) errors.push(`${name}: thiếu từ khoá chung (sans-serif/serif/monospace) ở cuối`);
  else {
    // sau từ khoá chung đầu tiên chỉ được là từ khoá chung hoặc tên font hệ thống (Georgia…), không phải var()/@font-face.
    const bad = parts.slice(firstGeneric + 1).find((p) => isVar(p) || (isQuoted(p) && selfHosted.has(unquote(p))));
    if (bad) errors.push(`${name}: "${bad}" đứng SAU từ khoá chung "${parts[firstGeneric]}" nên không bao giờ được dùng`);
  }

  const lastSelfHosted = Math.max(-1, ...parts.map((p, i) => (isQuoted(p) && selfHosted.has(unquote(p)) ? i : -1)));
  const firstVar = parts.findIndex(isVar);
  if (lastSelfHosted !== -1 && firstVar !== -1 && lastSelfHosted > firstVar) {
    errors.push(
      `${name}: font Ả Rập "${parts[lastSelfHosted]}" đứng SAU font next/font — font dự phòng Arial của next/font sẽ chiếm chữ Ả Rập trước nó`,
    );
  }
  return errors;
}

const unquote = (s) => s.replace(/^["']|["']$/g, "");

/** Lỗi trong một đoạn mã .tsx. `file` là đường dẫn tương đối từ gốc dự án. */
export function checkSource(file, text) {
  const errors = [];
  const where = (index) => `${file}:${text.slice(0, index).split("\n").length}`;

  // E1/E2: className chứa font-display
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const classes = m[1] ?? m[2] ?? "";
    const tokens = classes.split(/\s+/);
    if (tokens.includes("font-display")) {
      if (!DISPLAY_ALLOWED.some((re) => re.test(file))) {
        errors.push(`${where(m.index)}: font-display (Fraunces) chỉ dành cho bề mặt công khai, không dùng ở đây`);
      }
      if (!tokens.includes("font-bold")) errors.push(`${where(m.index)}: font-display phải đi kèm font-bold (chỉ nạp weight 700)`);
      for (const t of ["italic", "font-semibold", "font-medium", "font-normal", "font-light"]) {
        if (tokens.includes(t)) errors.push(`${where(m.index)}: font-display không đi với ${t} (Fraunces chỉ nạp 700, không nghiêng — trình duyệt sẽ giả)`);
      }
    }
  }

  // E3: độ đậm chưa nạp
  for (const m of text.matchAll(/\bfont-(thin|extralight|light|extrabold|black)\b/g)) {
    errors.push(`${where(m.index)}: font-${m[1]} — độ đậm này không được nạp, trình duyệt sẽ giả`);
  }

  // E4: hard-code họ chữ
  for (const m of text.matchAll(/\bfontFamily\s*=|\bfont-family\s*:|fontFamily\s*:/g)) {
    errors.push(`${where(m.index)}: hard-code font-family — dùng class font-sans/font-display/font-mono`);
  }

  // E5: font-mono bọc chữ tiếng Việt có dấu (chỉ xét phần tử có nội dung chữ ngay trên cùng dòng)
  for (const m of text.matchAll(/<(\w+)\b[^>\n]*\bfont-mono\b[^>\n]*>([^<\n]*)<\/\1>/g)) {
    const inner = m[2].replace(/\{[^}]*\}/g, "");
    if (VIETNAMESE_DIACRITIC.test(inner)) {
      errors.push(`${where(m.index)}: font-mono bọc chữ tiếng Việt "${inner.trim().slice(0, 40)}" — mono chỉ cho số, code, URL`);
    }
  }
  return errors;
}

/* ---------------------------------------------------------------- phần chạy thật */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

function parseLayoutFonts(text) {
  const fonts = [];
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*([A-Z][A-Za-z0-9_]*)\(\{([\s\S]*?)\}\);/g)) {
    const body = m[3];
    const list = (key) => {
      const r = body.match(new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`));
      return r ? [...r[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]) : null;
    };
    fonts.push({ id: m[1], family: m[2].replace(/_/g, " "), subsets: list("subsets") ?? [], weights: list("weight") });
  }
  return fonts;
}

function main() {
  const errors = [];
  const ok = [];

  // ----- A
  const fontData = require("next/dist/compiled/@next/font/dist/google/font-data.json");
  const layout = readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
  const fonts = parseLayoutFonts(layout);
  if (fonts.length === 0) errors.push("layout.tsx: không đọc được font nào từ next/font/google");
  for (const f of fonts) {
    const data = fontData[f.family];
    if (!data) {
      errors.push(`layout.tsx: "${f.family}" không có trong dữ liệu font của Next`);
      continue;
    }
    for (const s of f.subsets) if (!data.subsets.includes(s)) errors.push(`layout.tsx: ${f.family} không có subset "${s}"`);
    if (f.subsets.includes("latin") && !f.subsets.includes("vietnamese")) {
      errors.push(`layout.tsx: ${f.family} khai subset latin nhưng thiếu "vietnamese" — chữ có dấu thanh sẽ rơi sang font hệ thống`);
    }
    if (f.subsets.includes("latin") && !data.subsets.includes("vietnamese")) {
      errors.push(`layout.tsx: ${f.family} KHÔNG có subset vietnamese — không dùng được cho site tiếng Việt`);
    }
    for (const w of f.weights ?? []) if (!data.weights.includes(w) && !data.weights.includes("variable")) errors.push(`layout.tsx: ${f.family} không có weight ${w}`);
  }
  ok.push(`${fonts.length} font next/font: ${fonts.map((f) => f.family).join(", ")}`);

  // ----- B
  const cssPath = path.join(ROOT, "src/app/globals.css");
  const css = readFileSync(cssPath, "utf8");
  const selfHosted = new Set();
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const family = body.match(/font-family\s*:\s*["']?([^;"']+)["']?/)?.[1]?.trim();
    if (!family) continue;
    selfHosted.add(family);
    if (!/unicode-range\s*:\s*[^;]+;/.test(body)) {
      errors.push(`globals.css: @font-face "${family}" thiếu unicode-range — font đứng đầu danh sách sẽ vẽ luôn chữ Latin/Việt`);
    }
    const src = body.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!src) errors.push(`globals.css: @font-face "${family}" thiếu url()`);
    else {
      const file = path.resolve(path.dirname(cssPath), src);
      if (!existsSync(file)) errors.push(`globals.css: file font "${src}" của "${family}" không có trên đĩa`);
    }
  }
  const fontsDir = path.join(ROOT, "src/app/fonts");
  if (selfHosted.size > 0) {
    const files = existsSync(fontsDir) ? readdirSync(fontsDir) : [];
    const licenses = files.filter((n) => /^OFL.*\.txt$/i.test(n)).length;
    if (licenses < selfHosted.size) errors.push(`src/app/fonts: ${selfHosted.size} font tự host nhưng chỉ có ${licenses} bản giấy phép OFL`);
  }
  ok.push(`${selfHosted.size} @font-face tự host: ${[...selfHosted].join(", ") || "(không có)"}`);

  // ----- C
  for (const name of ["--font-sans", "--font-display", "--font-mono"]) {
    const m = css.match(new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, "m"));
    if (!m) errors.push(`globals.css: thiếu ${name}`);
    else errors.push(...checkStack(name, m[1], selfHosted));
  }

  // ----- D
  const outsideFaces = css.replace(/@font-face\s*\{[^}]*\}/g, "");
  for (const m of outsideFaces.matchAll(/^\s*font-family\s*:\s*([^;]+);/gm)) {
    if (!/^var\(--font-(sans|display|mono)\)$/.test(m[1].trim())) {
      errors.push(`globals.css: font-family "${m[1].trim()}" — phải đi qua var(--font-sans|display|mono)`);
    }
  }
  for (const m of outsideFaces.matchAll(/var\(--font-(be-vietnam-pro|fraunces|jetbrains-mono)\)/g)) {
    const line = outsideFaces.slice(0, m.index).split("\n").pop();
    if (!/^\s*--font-(sans|display|mono)\s*:/.test(line)) errors.push(`globals.css: dùng thẳng biến next/font ${m[0]} — dùng token --font-*`);
  }

  // ----- E
  let scanned = 0;
  for (const file of walk(path.join(ROOT, "src"))) {
    const rel = path.relative(ROOT, file);
    errors.push(...checkSource(rel, readFileSync(file, "utf8")));
    scanned++;
  }
  ok.push(`${scanned} file .tsx đã quét`);

  for (const line of ok) console.log(`  ok   ${line}`);
  if (errors.length) {
    console.log(`\nFAIL — ${errors.length} lỗi:`);
    for (const e of errors) console.log(`  ✖ ${e}`);
    process.exit(1);
  }
  console.log("\nPASS — font chữ đúng quy ước.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
