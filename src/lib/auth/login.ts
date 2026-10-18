import type { ObjectId } from "mongodb";
import { secretMatches } from "@/lib/auth/secret";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import type { AdminUser } from "@/lib/types";

/**
 * Chính sách đăng nhập, tách khỏi Mongo để test được (xem `UserStore`).
 *
 * Chống dò mật khẩu: sau `MAX_FAILURES` lần sai liên tiếp thì khoá `LOCK_MS`. Khoá theo TÀI KHOẢN chứ không
 * theo IP vì serverless không có chỗ chung để đếm theo IP; đổi lại, ai biết email có thể khoá người đó vài
 * phút — chấp nhận được với 5 phút, và scrypt (~100ms mỗi lượt) đã là một lớp làm chậm riêng.
 */
export const MAX_FAILURES = 5;
export const LOCK_MS = 5 * 60 * 1000;

export interface UserStore {
  findByEmail(email: string): Promise<AdminUser | null>;
  countUsers(): Promise<number>;
  /** Trả `null` nếu email đã tồn tại (khoá unique) — hai người cùng đăng nhập lần đầu một lúc. */
  insertOwner(user: Omit<AdminUser, "_id">): Promise<AdminUser | null>;
  /** Tăng bộ đếm sai nguyên tử, trả giá trị mới. */
  incrementFailures(id: ObjectId): Promise<number>;
  lock(id: ObjectId, until: Date): Promise<void>;
  markLogin(id: ObjectId, now: Date, newHash?: string): Promise<void>;
}

export type LoginResult = { ok: true; user: AdminUser } | { ok: false };

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

let dummyHash: Promise<string> | undefined;
/** Hash giả để email không tồn tại tốn thời gian như email có thật — không cho dò danh sách tài khoản qua độ trễ. */
function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword("tiq-không-có-tài-khoản-này"));
}

/**
 * Kết quả chỉ có hai trạng thái ("được" / "không") và UI chỉ có MỘT câu lỗi: không tách "sai mật khẩu",
 * "không có tài khoản", "bị khoá", "đã tắt" — mỗi cách tách là một cách để người ngoài dò xem email nào có thật.
 *
 * Tài khoản đầu tiên: khi CHƯA có tài khoản nào, `ADMIN_PASSWORD` (biến môi trường cũ) đăng nhập được với email
 * bất kỳ và tạo ra owner. Từ lúc có tài khoản đầu tiên, biến đó thôi mở cửa — quyền vào chỉ còn qua tài khoản
 * (mất owner thì dùng `npm run admin:user`, cần quyền truy cập DB).
 */
export async function authenticate(
  input: { email: string; password: string },
  store: UserStore,
  options: { bootstrapPassword?: string; now?: Date } = {},
): Promise<LoginResult> {
  const now = options.now ?? new Date();
  const email = normalizeEmail(input.email);
  const { password } = input;
  if (!isPlausibleEmail(email) || password.length === 0 || password.length > 200) {
    await verifyPassword(password.slice(0, 200), await getDummyHash());
    return { ok: false };
  }

  const user = await store.findByEmail(email);

  if (!user) {
    if (options.bootstrapPassword && (await store.countUsers()) === 0 && secretMatches(password, options.bootstrapPassword)) {
      const created = await store.insertOwner({
        email,
        name: email.split("@")[0] ?? email,
        role: "owner",
        passwordHash: await hashPassword(password),
        active: true,
        tokenVersion: 1,
        failedLogins: 0,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return created ? { ok: true, user: created } : { ok: false };
    }
    await verifyPassword(password, await getDummyHash());
    return { ok: false };
  }

  if (!user.active || (user.lockedUntil && user.lockedUntil.getTime() > now.getTime())) {
    // Vẫn tốn một lượt băm: thời gian không tiết lộ tài khoản đang bị khoá/tắt.
    await verifyPassword(password, await getDummyHash());
    return { ok: false };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = await store.incrementFailures(user._id as ObjectId);
    if (failures >= MAX_FAILURES) await store.lock(user._id as ObjectId, new Date(now.getTime() + LOCK_MS));
    return { ok: false };
  }

  await store.markLogin(user._id as ObjectId, now, needsRehash(user.passwordHash) ? await hashPassword(password) : undefined);
  return { ok: true, user };
}
