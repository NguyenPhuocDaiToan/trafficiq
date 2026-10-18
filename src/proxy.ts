import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth/session";

/**
 * Next 16: file convention là `proxy.ts` (`middleware.ts` đã deprecated).
 * Chạy trên Edge runtime — KHÔNG import driver Mongo hay node:crypto ở đây.
 *
 * Nhiệm vụ duy nhất: chặn control plane nếu chưa đăng nhập.
 * Hot path /go/[token] KHÔNG đi qua đây (xem matcher) để không thêm latency.
 *
 * Ở đây chỉ kiểm CHỮ KÝ và HẠN của cookie (Edge không có DB). Việc tài khoản còn hoạt động hay không do
 * `lib/auth/current-user.ts` kiểm ở layout admin và đầu mọi server action.
 *
 * `/admin/login` cũng đi qua đây nhưng luôn được cho qua: proxy gắn header `x-tiq-path` cho request vào
 * server để layout admin biết đang ở trang nào (layout không đọc được pathname) — layout cần nó để không
 * chuyển hướng chính trang đăng nhập. Header do client gửi bị ghi đè ở đây nên không giả được.
 */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const forwarded = new Headers(request.headers);
  forwarded.set("x-tiq-path", pathname);
  const pass = () => NextResponse.next({ request: { headers: forwarded } });

  if (pathname === "/admin/login") return pass();

  const secret = sessionSecret();

  // Chưa đủ vật liệu ký thì khóa hẳn admin, không mở toang.
  if (!secret) {
    return new NextResponse(
      "Chưa cấu hình khoá phiên. Đặt SESSION_SECRET (hoặc IP_HASH_SALT và ADMIN_PASSWORD) rồi deploy lại.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(cookie, secret)) return pass();

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /*
   * /admin/** (trừ trang login). Redirect, landing, postback không bị chặn.
   *
   * `/campaign-preview/**` là NỘI DUNG IFRAME của trang xem trước trong admin.
   * Nó phải nằm ngoài /admin vì layout admin bọc mọi route con bằng header + nav,
   * và layout cha thì không bỏ được từ route con — có nav admin trong iframe là
   * preview không còn giống trang thật.
   *
   * Hệ quả: nó KHÔNG được matcher /admin bảo vệ, nên phải khai riêng ở đây. Route
   * đó đọc campaign theo `_id` và KHÔNG lọc status (để xem được cả bản đã tạm
   * dừng) — bỏ dòng dưới là bản nháp và bản đã dừng của mọi campaign thành công
   * khai cho bất kỳ ai đoán được ObjectId.
   */
  matcher: ["/admin", "/admin/:path*", "/campaign-preview/:path*"],
};
