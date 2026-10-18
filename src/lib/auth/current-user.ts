import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { adminUsers } from "@/lib/db/collections";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth/session";
import type { Actor, AdminRole, AdminUser } from "@/lib/types";

/**
 * Người đang đăng nhập, đối chiếu với DB.
 *
 * Proxy (Edge) chỉ kiểm chữ ký cookie. Hàm này làm nốt phần proxy không làm được: tài khoản còn tồn tại, còn
 * `active`, và `tokenVersion` khớp — nên tắt tài khoản / đổi mật khẩu / đổi vai trò có hiệu lực ngay ở request
 * kế tiếp thay vì chờ cookie hết hạn 7 ngày.
 *
 * Gọi ở: layout admin, route upload, trang xem trước, và ĐẦU MỌI server action. Server action là POST vào
 * đường dẫn của trang nên proxy có chặn, nhưng layout KHÔNG chạy lại khi action gọi — nếu action không tự kiểm
 * thì người vừa bị tắt vẫn thao tác được tới khi cookie hết hạn.
 *
 * Giới hạn đã biết: layout chỉ chạy lại khi tải trang đầy đủ, không chạy khi chuyển trang trong admin bằng
 * link (Next giữ layout). Người vừa bị tắt vẫn xem được trang đang mở cho tới khi tải lại — nhưng không GHI
 * được gì, vì mọi action và route upload tự kiểm. Trang chỉ dành owner tự gọi `requireOwner()` nên không dính.
 */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/** Điểm thay thế được cho test — route upload test không có Mongo. */
export const userLookup = {
  async byId(id: string): Promise<AdminUser | null> {
    if (!/^[a-f0-9]{24}$/i.test(id)) return null;
    return (await adminUsers()).findOne({ _id: new ObjectId(id) });
  },
};

export async function userFromCookie(cookieValue: string | undefined): Promise<CurrentUser | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const claims = await verifySession(cookieValue, secret);
  if (!claims) return null;
  const user = await userLookup.byId(claims.uid);
  if (!user || !user.active || user.tokenVersion !== claims.ver) return null;
  return { id: user._id!.toString(), email: user.email, name: user.name, role: user.role };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  return userFromCookie(store.get(SESSION_COOKIE)?.value);
}

/** Dùng ở đầu server action và trang cần đăng nhập. Chưa đăng nhập → về trang login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Trang/action chỉ dành cho owner. Member bị đưa về trang chiến dịch. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/admin/campaigns");
  return user;
}

export function actorOf(user: CurrentUser): Actor {
  return { id: new ObjectId(user.id), name: user.name };
}
