import { NextResponse, type NextRequest } from "next/server";
import { userFromCookie } from "@/lib/auth/current-user";
import { SESSION_COOKIE, sessionSecret } from "@/lib/auth/session";
import { formatBytes, MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD } from "@/lib/media/limits";
import { MediaError, processImage, type MediaKind } from "@/lib/media/process";
import { acquireUploadSlot } from "@/lib/media/upload-guard";
import { saveImage, StorageNotConfiguredError } from "@/lib/media/store";

/**
 * Tải ảnh lên cho form campaign. Là route handler chứ KHÔNG phải server action vì
 * server action bị giới hạn body 1MB trên TOÀN site (kể cả form liên hệ công khai);
 * nâng giới hạn đó để chứa ảnh là nâng nó cho cả những action ai cũng gọi được.
 *
 * Đây là endpoint GHI DỮ LIỆU của người dùng xuống đĩa nên nhiều lớp độc lập, mỗi lớp tự
 * đứng được nếu lớp khác hỏng:
 *   1. `proxy.ts` chặn `/admin/**` khi chưa đăng nhập (redirect về trang login).
 *   2. Chính handler này kiểm lại cookie phiên — nếu ai đó sửa matcher của proxy (như
 *      từng suýt xảy ra với `/campaign-preview`), endpoint ghi file không thành công khai.
 *   3. Chống CSRF bằng Fetch Metadata, rơi về so Origin (xem `isSameOrigin`).
 *   4. Bắt buộc `content-length` hợp lệ và ≤ trần TRƯỚC khi đọc body.
 *   5. Giới hạn tần suất và số lượt xử lý đồng thời (`upload-guard.ts`): giải mã ảnh tốn CPU
 *      và bộ nhớ, còn ghi file tốn đĩa — phiên bị lộ không được thành công cụ làm đầy đĩa.
 *   6. `processImage` quyết định bằng NỘI DUNG, không tin tên/`Content-Type` client khai, và
 *      luôn mã hoá lại (không bao giờ lưu nguyên byte đã nhận).
 *
 * Triển khai sau nginx: mặc định nginx cắt body ở 1MB (`client_max_body_size`) và trả 413
 * HTML trước khi tới đây — cần `client_max_body_size 5m;` cho location này.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "cache-control": "no-store", ...headers } },
  );
}

/**
 * Chặn CSRF: một trang khác site không được phép bắt trình duyệt của admin POST vào đây.
 *
 * Ưu tiên `Sec-Fetch-Site`: do trình duyệt đặt, script không giả được, và KHÔNG phụ thuộc
 * cấu hình proxy. Cách cũ (so `Origin` với `Host`) sai ngay sau nginx — `proxy_pass` mặc định
 * gửi Host của upstream (`127.0.0.1:3000`) nên mọi upload hợp lệ bị từ chối.
 *
 * Chỉ khi thiếu header đó (trình duyệt cũ, client không phải trình duyệt) mới so Origin với
 * Host đã được proxy chuyển tiếp. Client không phải trình duyệt chẳng có cách nào mang cookie
 * phiên của admin tới đây nên không phải mối đe doạ CSRF.
 */
function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
    ?.split(",")[0]
    ?.trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Lớp 2: tự kiểm phiên, không chỉ dựa vào matcher của proxy.
  if (!sessionSecret()) return fail("Chưa cấu hình khoá phiên.", 503);
  if (!(await userFromCookie(request.cookies.get(SESSION_COOKIE)?.value))) {
    return fail("Chưa đăng nhập.", 401);
  }

  if (!isSameOrigin(request)) return fail("Yêu cầu không hợp lệ.", 403);

  // Lớp 4: từ chối theo header TRƯỚC khi đọc body. Thiếu header thì không biết cỡ → không
  // đọc (một body chunked vô hạn sẽ bị `formData()` gom hết vào RAM). Trình duyệt luôn gửi
  // `content-length` cho FormData; HTTP framing đảm bảo body không vượt giá trị khai báo.
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return fail("Thiếu độ dài nội dung.", 411);
  if (declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) {
    return fail(
      `File quá lớn: yêu cầu ${formatBytes(declared)}, tối đa ${formatBytes(MAX_UPLOAD_BYTES)}. Hãy thu nhỏ ảnh trước khi tải lên.`,
      413,
    );
  }

  // Lớp 5.
  const slot = acquireUploadSlot();
  if (!slot.ok) return fail(slot.error, 429, { "retry-after": String(slot.retryAfterSeconds) });

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("Không đọc được dữ liệu tải lên.", 400);
    }

    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File)) return fail("Chưa chọn file.", 400);
    if (kind !== "hero" && kind !== "og") return fail("Loại ảnh không hợp lệ.", 400);

    const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind as MediaKind);
    const stored = await saveImage(processed);
    return NextResponse.json(
      { ok: true, url: stored.url, bytes: stored.bytes, width: stored.width, height: stored.height },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof MediaError) return fail(err.message, 422);
    if (err instanceof StorageNotConfiguredError) return fail(err.message, 503);
    // Lỗi hạ tầng (ghi đĩa, sharp không nạp được): log để còn tra, trả câu chung — không để
    // lộ đường dẫn đĩa hay stack trace ra trình duyệt.
    console.error("upload-image failed", err);
    return fail("Lỗi máy chủ khi lưu ảnh. Thử lại sau.", 500);
  } finally {
    slot.release();
  }
}
