/**
 * Sinh favicon/app icon từ MỘT định nghĩa hình học duy nhất.
 *
 * VÌ SAO CÓ SCRIPT NÀY thay vì ba file ảnh rời:
 * Next cần ba định dạng cho ba chỗ khác nhau (`icon.svg` cho tab trình duyệt,
 * `favicon.ico` cho bookmark/RSS reader/trình duyệt cũ, `apple-icon.png` cho màn
 * hình chính iOS). Ba file vẽ tay là ba bản dễ lệch nhau sau lần sửa thứ hai.
 * Ở đây `SHAPES` là nguồn duy nhất; SVG và PNG đều xuất từ nó.
 *
 * Không có dependency: PNG mã hoá bằng `node:zlib`, ICO là container bọc PNG
 * (mọi trình duyệt hiện đại đều đọc được). Vì vậy không cần sharp/canvas —
 * đúng ràng buộc "không thêm dependency chỉ để build một file 4KB".
 *
 * Chạy: npm run gen:icons
 *
 * ⚠️ Màu ở đây là bản SAO của token trong `src/app/globals.css` (bộ
 * `.theme-editorial`). Đây là ngoại lệ có chủ đích của luật "hex chỉ nằm trong
 * globals.css": file ảnh nhị phân không đọc được CSS variable. Đổi
 * `--foreground`/`--accent` của bộ editorial thì sửa `PALETTE` bên dưới rồi chạy
 * lại script.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "src", "app");

/** Sao của `.theme-editorial` trong globals.css. Xem cảnh báo ở đầu file. */
const PALETTE = {
  ink: "#0a0a0a", // --foreground / --primary (near-black broadsheet)
  paper: "#fafafa", // --on-primary
  accent: "#c2410c", // --accent (cam đất — màu mực thứ hai của báo in)
};

/**
 * Hình học trên lưới 32×32 — cỡ favicon chuẩn, và chia hết cho 16 nên bản 16px
 * không có pixel lẻ.
 *
 * Chữ "I" của InsightDaily dựng bằng BA HÌNH CHỮ NHẬT (chân trên, thân, chân
 * dưới) chứ không phải glyph Fraunces thật. Hai lý do:
 *   1. Font không tồn tại trong file .ico/.png — phải vector hoá tay dù sao.
 *   2. Ngôn ngữ hình của surface công khai là GẠCH KẺ (`--rule`, `border-t-[3px]`,
 *      xem pages/blog.md § "Thứ bậc dựng bằng gạch kẻ"). Một chữ I ghép từ ba
 *      gạch nói đúng thứ ngôn ngữ đó, và ở 16px thì serif có bo cong của Fraunces
 *      biến mất hết — vẽ cong chỉ tốn byte để ra cùng một khối pixel.
 *
 * Gạch cam dưới chân là masthead rule của trang nhất, thu nhỏ. Ở 16px nó còn
 * đúng 1px — vừa đủ để tab này khác mọi tab đen-trắng khác trong dải tab.
 */
const SHAPES = [
  { x: 0, y: 0, w: 32, h: 32, fill: PALETTE.ink }, // nền
  { x: 8, y: 4, w: 16, h: 4, fill: PALETTE.paper }, // chân trên chữ I
  { x: 14, y: 8, w: 4, h: 12, fill: PALETTE.paper }, // thân chữ I
  { x: 8, y: 20, w: 16, h: 4, fill: PALETTE.paper }, // chân dưới chữ I
  { x: 6, y: 26, w: 20, h: 2, fill: PALETTE.accent }, // gạch masthead
];

const GRID = 32;

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

function buildSvg() {
  const rects = SHAPES.map(
    (s) => `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}" />`,
  ).join("\n");

  // `shape-rendering="crispEdges"` để Chrome không làm mờ cạnh khi hạ xuống 16px.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">
${rects}
</svg>
`;
}

// ---------------------------------------------------------------------------
// Raster: phủ pixel theo diện tích giao nhau
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Vẽ SHAPES ra buffer RGBA ở cỡ `size`.
 *
 * Mọi hình đều là chữ nhật thẳng trục nên độ phủ của một pixel tính được CHÍNH
 * XÁC bằng diện tích giao — không cần supersample. Ở cỡ chia hết cho 32 (16/32/
 * 48) độ phủ luôn là 0 hoặc 1, tức cạnh sắc tuyệt đối; ở 180 (=5.625×) thì cạnh
 * được khử răng cưa đúng theo diện tích.
 *
 * Kênh alpha luôn 255 (hình nền phủ kín khung) nhưng KHÔNG bỏ được: decoder ICO
 * của Turbopack chỉ nhận PNG ở RGBA, PNG truecolor không alpha làm `next build`
 * chết với "The PNG is not in RGBA format!".
 */
function rasterize(size) {
  const scale = size / GRID;
  const px = new Uint8Array(size * size * 4);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;

  for (const shape of SHAPES) {
    const [r, g, b] = hexToRgb(shape.fill);
    const x0 = shape.x * scale;
    const y0 = shape.y * scale;
    const x1 = (shape.x + shape.w) * scale;
    const y1 = (shape.y + shape.h) * scale;

    for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
      const covY = Math.min(py + 1, y1) - Math.max(py, y0);
      if (covY <= 0) continue;
      for (let pxX = Math.floor(x0); pxX < Math.ceil(x1); pxX++) {
        const covX = Math.min(pxX + 1, x1) - Math.max(pxX, x0);
        if (covX <= 0) continue;
        const a = covX * covY;
        const i = (py * size + pxX) * 4;
        px[i] = Math.round(px[i] * (1 - a) + r * a);
        px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
        px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
      }
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// PNG encoder (color type 6 = truecolor + alpha, 8-bit)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  // Mỗi hàng scanline có 1 byte filter đứng trước; dùng filter 0 (None) cho đơn
  // giản — ảnh 180px toàn mảng phẳng nên deflate vẫn nén xuống vài trăm byte.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  // 10,11,12 = compression/filter/interlace, đều 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// ICO: container bọc thẳng payload PNG (định dạng Vista+, mọi browser đọc được)
// ---------------------------------------------------------------------------

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;

  entries.forEach((entry, i) => {
    const at = i * 16;
    dir[at] = entry.size === 256 ? 0 : entry.size; // 0 nghĩa là 256
    dir[at + 1] = entry.size === 256 ? 0 : entry.size;
    dir[at + 2] = 0; // số màu bảng palette (0 = truecolor)
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // color planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(entry.png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

// ---------------------------------------------------------------------------

const outputs = [];

const svg = buildSvg();
writeFileSync(join(APP, "icon.svg"), svg);
outputs.push(["src/app/icon.svg", Buffer.byteLength(svg)]);

/*
 * .ico giữ ba cỡ: 16 (tab), 32 (bookmark bar / taskbar), 48 (Windows shortcut).
 * Không thêm 64/128/256 — SVG đã lo mọi cỡ lớn, mỗi cỡ thừa chỉ làm nặng file
 * mà không có chỗ nào dùng tới.
 */
const ico = encodeIco(
  [16, 32, 48].map((size) => ({ size, png: encodePng(size, rasterize(size)) })),
);
writeFileSync(join(APP, "favicon.ico"), ico);
outputs.push(["src/app/favicon.ico", ico.length]);

// 180×180 là cỡ apple-touch-icon Apple khuyến nghị (iPhone Retina @3x).
const apple = encodePng(180, rasterize(180));
writeFileSync(join(APP, "apple-icon.png"), apple);
outputs.push(["src/app/apple-icon.png", apple.length]);

for (const [file, bytes] of outputs) {
  console.log(`${file.padEnd(24)} ${String(bytes).padStart(6)} bytes`);
}
