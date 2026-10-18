"use server";

import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminUsers } from "@/lib/db/collections";
import { requireOwner, requireUser } from "@/lib/auth/current-user";
import { authenticate, isPlausibleEmail, normalizeEmail } from "@/lib/auth/login";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  newSessionClaims,
  sessionSecret,
  signSession,
} from "@/lib/auth/session";
import { mongoUserStore } from "@/lib/auth/user-store";
import { isDuplicateKeyError } from "@/lib/tracking/emit";
import type { ActionResult } from "@/lib/control-plane/schemas";

/**
 * Đăng nhập / đăng xuất / quản lý thành viên.
 *
 * Mọi action quản lý (tạo, tắt, đổi vai trò, đặt lại mật khẩu) gọi `requireOwner()` ở dòng đầu: kiểm bằng DB,
 * không tin cookie. Nút ẩn trên giao diện chỉ là UX — action vẫn phải tự chặn.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function setSessionCookie(user: { _id?: ObjectId; tokenVersion: number }): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Chưa cấu hình khoá phiên");
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(newSessionClaims(user._id!.toString(), user.tokenVersion), secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function login(formData: FormData): Promise<void> {
  const target = text(formData, "next");
  // Chỉ nhận đường dẫn nội bộ — chặn open-redirect qua ?next=
  const safeTarget =
    target.startsWith("/admin") && !target.startsWith("//") && !target.startsWith("/admin/login")
      ? target
      : "/admin/campaigns";

  const result = await authenticate(
    { email: text(formData, "email"), password: text(formData, "password") },
    mongoUserStore,
    { bootstrapPassword: process.env.ADMIN_PASSWORD },
  );
  if (!result.ok) redirect(`/admin/login?error=1&next=${encodeURIComponent(safeTarget)}`);

  await setSessionCookie(result.user);
  redirect(safeTarget);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ----------------------------------------------------------------- tài khoản của mình

export async function changeOwnPassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireUser();
  const current = text(formData, "current");
  const next = text(formData, "next");
  if (next !== text(formData, "confirm")) return { ok: false, error: "Hai ô mật khẩu mới không giống nhau." };
  const problem = passwordProblem(next, me.email);
  if (problem) return { ok: false, error: problem };

  const col = await adminUsers();
  const user = await col.findOne({ _id: new ObjectId(me.id) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  }

  // Tăng tokenVersion: mọi phiên khác của người này (máy khác, cookie bị lộ) hết hiệu lực. Phiên hiện tại
  // được cấp lại ngay bên dưới nên người đổi mật khẩu không bị văng.
  const updated = await col.findOneAndUpdate(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(next), updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  );
  if (updated) await setSessionCookie(updated);
  return { ok: true, message: "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất." };
}

// -------------------------------------------------------------------- quản lý thành viên

const ROLES = new Set(["owner", "member"]);

export async function createMember(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const email = normalizeEmail(text(formData, "email"));
  const name = text(formData, "name").trim();
  const role = text(formData, "role");
  const password = text(formData, "password");

  if (!isPlausibleEmail(email)) return { ok: false, error: "Email không hợp lệ." };
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Tên hiển thị 2–80 ký tự." };
  if (!ROLES.has(role)) return { ok: false, error: "Vai trò không hợp lệ." };
  const problem = passwordProblem(password, email);
  if (problem) return { ok: false, error: problem };

  const now = new Date();
  const users = await adminUsers();
  // Kiểm trước thay vì chỉ dựa vào chỉ mục unique: nếu quên `npm run setup:indexes` thì chỉ mục chưa có và
  // hai tài khoản cùng email sẽ lọt vào, rồi đăng nhập tra ra một trong hai ngẫu nhiên.
  if (await users.findOne({ email }, { projection: { _id: 1 } })) {
    return { ok: false, error: "Email này đã có tài khoản." };
  }
  try {
    await users.insertOne({
      email,
      name,
      role: role as "owner" | "member",
      passwordHash: await hashPassword(password),
      active: true,
      tokenVersion: 1,
      failedLogins: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return { ok: false, error: "Email này đã có tài khoản." };
    throw err;
  }

  revalidatePath("/admin/thanh-vien");
  return {
    ok: true,
    message: `Đã tạo tài khoản ${email}. Gửi mật khẩu cho họ qua kênh riêng và nhờ đổi ngay lần đầu.`,
  };
}

/** Còn bao nhiêu owner đang hoạt động, không tính `exceptId`. Không để hệ thống mất owner cuối. */
async function otherActiveOwners(exceptId: ObjectId): Promise<number> {
  return (await adminUsers()).countDocuments({ role: "owner", active: true, _id: { $ne: exceptId } });
}

export async function setMemberActive(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";
  if (!/^[a-f0-9]{24}$/i.test(id)) return { ok: false, error: "Tài khoản không hợp lệ." };
  const oid = new ObjectId(id);

  const col = await adminUsers();
  const target = await col.findOne({ _id: oid });
  if (!target) return { ok: false, error: "Không tìm thấy tài khoản." };
  if (!active && target.role === "owner" && (await otherActiveOwners(oid)) === 0) {
    return { ok: false, error: "Không thể tắt owner cuối cùng — hệ thống sẽ không còn ai quản trị." };
  }

  await col.updateOne(
    { _id: oid },
    { $set: { active, updatedAt: new Date() }, $inc: { tokenVersion: 1 }, $unset: { lockedUntil: "" } },
  );
  revalidatePath("/admin/thanh-vien");
  return {
    ok: true,
    message: active ? "Đã bật lại tài khoản." : "Đã tắt tài khoản — phiên đang mở của họ hết hiệu lực.",
  };
}

export async function setMemberRole(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = text(formData, "id");
  const role = text(formData, "role");
  if (!/^[a-f0-9]{24}$/i.test(id) || !ROLES.has(role)) return { ok: false, error: "Yêu cầu không hợp lệ." };
  const oid = new ObjectId(id);

  const col = await adminUsers();
  const target = await col.findOne({ _id: oid });
  if (!target) return { ok: false, error: "Không tìm thấy tài khoản." };
  if (target.role === "owner" && role !== "owner" && (await otherActiveOwners(oid)) === 0) {
    return { ok: false, error: "Không thể hạ owner cuối cùng xuống thành viên." };
  }

  await col.updateOne(
    { _id: oid },
    { $set: { role: role as "owner" | "member", updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
  );
  revalidatePath("/admin/thanh-vien");
  return { ok: true, message: "Đã đổi vai trò." };
}

export async function resetMemberPassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = text(formData, "id");
  const password = text(formData, "password");
  if (!/^[a-f0-9]{24}$/i.test(id)) return { ok: false, error: "Tài khoản không hợp lệ." };
  const col = await adminUsers();
  const target = await col.findOne({ _id: new ObjectId(id) });
  if (!target) return { ok: false, error: "Không tìm thấy tài khoản." };
  const problem = passwordProblem(password, target.email);
  if (problem) return { ok: false, error: problem };

  await col.updateOne(
    { _id: target._id },
    {
      $set: { passwordHash: await hashPassword(password), failedLogins: 0, updatedAt: new Date() },
      $inc: { tokenVersion: 1 },
      $unset: { lockedUntil: "" },
    },
  );
  revalidatePath("/admin/thanh-vien");
  return { ok: true, message: `Đã đặt lại mật khẩu cho ${target.email}. Họ phải đăng nhập lại.` };
}
