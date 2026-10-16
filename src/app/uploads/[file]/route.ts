import { UPLOAD_FILE_RE } from "@/lib/media/path";
import { CONTENT_TYPE_BY_EXT, readUpload } from "@/lib/media/store";

/**
 * Phục vụ ảnh admin đã tải lên (xem `lib/media/store.ts`).
 *
 * Route CÔNG KHAI: ảnh nằm trong landing và thẻ OG, crawler không có cookie. Nó nằm
 * ngoài `/admin` nên proxy không chặn — và không được chặn.
 *
 * Chạy được không cần nginx (`next start` không phục vụ file ghi sau lúc build, nên
 * phải có route này). Để nhanh hơn trên VM, cho nginx đọc thẳng thư mục — file có thì
 * nginx trả luôn, không có thì rơi về app:
 *
 *   location /uploads/ {
 *     alias /var/lib/trafficiq/uploads/;      # = UPLOAD_DIR
 *     expires 1y;
 *     add_header Cache-Control "public, immutable";
 *     add_header X-Content-Type-Options nosniff;
 *     add_header Content-Security-Policy "default-src 'none'; sandbox";
 *     autoindex off;
 *     try_files $uri @app;
 *   }
 *   location @app { proxy_pass http://127.0.0.1:3000; }
 *
 * và cho route upload (nginx mặc định cắt body ở 1MB → 413 trước khi tới app):
 *
 *   location = /admin/upload-image {
 *     client_max_body_size 5m;
 *     proxy_pass http://127.0.0.1:3000;
 *   }
 *
 * Cache: tên file là sha256 của nội dung nên URL không bao giờ đổi nội dung → `immutable`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMMUTABLE = "public, max-age=31536000, immutable";

const COMMON = {
  // Ảnh phục vụ từ origin của site: cấm trình duyệt đoán lại kiểu nội dung.
  "x-content-type-options": "nosniff",
  // Lớp dự phòng nếu một file không phải ảnh nào đó lọt vào thư mục: mở trực tiếp URL này thì
  // không chạy được script, không nạp được tài nguyên nào, và bị cô lập (sandbox) khỏi origin
  // của site. Thẻ <img> không bị ảnh hưởng — CSP chỉ áp cho chính tài liệu này.
  "content-security-policy": "default-src 'none'; sandbox",
} as const;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;

  // Regex chặt là phòng thủ path traversal: chỉ `<64 hex>.webp|jpg` đi tiếp tới đĩa.
  if (!UPLOAD_FILE_RE.test(file)) {
    return new Response("Not found", { status: 404, headers: COMMON });
  }

  // Nội dung gắn chặt với tên nên ETag = tên. Client đã có bản này thì khỏi đọc đĩa.
  const etag = `"${file}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ...COMMON, etag, "cache-control": IMMUTABLE },
    });
  }

  const data = await readUpload(file);
  if (!data) {
    return new Response("Not found", {
      status: 404,
      // Ngắn: ảnh có thể vừa được tải lên.
      headers: { ...COMMON, "cache-control": "public, max-age=30" },
    });
  }

  const ext = file.endsWith(".webp") ? "webp" : "jpg";
  return new Response(new Uint8Array(data), {
    headers: {
      ...COMMON,
      "content-type": CONTENT_TYPE_BY_EXT[ext],
      "content-length": String(data.length),
      "cache-control": IMMUTABLE,
      etag,
    },
  });
}
