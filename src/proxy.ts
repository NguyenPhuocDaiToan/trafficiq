import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/auth/session";

/**
 * Next 16: file convention là `proxy.ts` (`middleware.ts` đã deprecated).
 * Chạy trên Edge runtime — KHÔNG import driver Mongo hay node:crypto ở đây.
 *
 * Nhiệm vụ duy nhất: chặn /admin nếu chưa đăng nhập.
 * Hot path /go/[token] KHÔNG đi qua đây (xem matcher) để không thêm latency.
 */
export default async function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;

  // Chưa cấu hình password thì khóa hẳn admin, không mở toang.
  if (!password) {
    return new NextResponse(
      "ADMIN_PASSWORD chưa được cấu hình. Đặt biến môi trường rồi deploy lại.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionCookie(cookie, password)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Chỉ /admin/**, trừ trang login. Redirect, landing, postback không bị chặn.
  matcher: ["/admin", "/admin/((?!login).*)"],
};
