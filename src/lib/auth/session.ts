/**
 * Phiên đăng nhập admin: cookie KÝ chữ ký (HMAC-SHA256), không chứa bí mật.
 *
 * Dạng: `v2.<userId>.<tokenVersion>.<hết hạn (giây)>.<chữ ký base64url>`.
 *
 * Dùng Web Crypto (không phải node:crypto) để file này chạy được cả trong `proxy.ts` (Edge runtime) lẫn
 * server action/route (Node). Edge không có DB nên proxy CHỈ kiểm chữ ký + hạn: nó biết cookie do ta cấp,
 * không biết tài khoản còn hoạt động hay không. Phần đó do `current-user.ts` làm bằng cách đối chiếu
 * `tokenVersion` với DB (layout admin, upload, mọi server action).
 *
 * Trước bản này cookie là sha256(mật khẩu chung) — tĩnh, không hết hạn, và ai có nó là có phiên mãi mãi.
 * Cookie cũ (hex 64 ký tự) không khớp định dạng `v2.` nên tự bị từ chối: lần tải kế tiếp phải đăng nhập lại.
 */

export const SESSION_COOKIE = "tiq_admin";
/** 7 ngày. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionClaims {
  /** ObjectId hex của AdminUser. */
  uid: string;
  /** Khớp `AdminUser.tokenVersion`; lệch là phiên đã bị thu hồi. */
  ver: number;
  /** Hết hạn, giây Unix. */
  exp: number;
}

/**
 * Khoá ký. Ưu tiên `SESSION_SECRET`. Nếu chưa đặt thì dẫn xuất từ `IP_HASH_SALT` + `ADMIN_PASSWORD`: cả hai
 * đã bắt buộc có sẵn nên bản đang chạy không phải thêm biến môi trường nào để tiếp tục hoạt động.
 *
 * KHÔNG dùng `ADMIN_PASSWORD` một mình: nó là mật khẩu con người đặt (có thể ngắn), và chữ ký cookie kiểm
 * tra được offline — thành viên nào cũng có một cookie hợp lệ trong tay, nên khoá yếu là họ dò ra được rồi
 * tự ký cookie của owner. `IP_HASH_SALT` được sinh ngẫu nhiên và thành viên không biết nó.
 *
 * Trả `null` khi chưa đủ vật liệu: proxy khoá admin (503) thay vì chạy với khoá rỗng.
 */
export function sessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.SESSION_SECRET;
  if (explicit) return explicit.length >= 32 ? `s|${explicit}` : null;
  const salt = env.IP_HASH_SALT;
  const password = env.ADMIN_PASSWORD;
  if (salt && salt.length >= 16 && password) return `d|${salt}|${password}`;
  return null;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`tiq-session-v2|${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

/** So sánh không rò thời gian trên hai chuỗi. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  const body = `v2.${claims.uid}.${claims.ver}.${claims.exp}`;
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifySession(
  cookieValue: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
): Promise<SessionClaims | null> {
  if (!cookieValue || cookieValue.length > 200) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, uid, verRaw, expRaw, sig] = parts;
  if (!/^[a-f0-9]{24}$/i.test(uid) || !/^\d{1,9}$/.test(verRaw) || !/^\d{1,12}$/.test(expRaw)) return null;

  const body = `v2.${uid}.${verRaw}.${expRaw}`;
  if (!constantTimeEqual(sig, await hmac(secret, body))) return null;

  const exp = Number(expRaw);
  if (exp * 1000 <= nowMs) return null;
  return { uid, ver: Number(verRaw), exp };
}

export function newSessionClaims(uid: string, ver: number, nowMs: number = Date.now()): SessionClaims {
  return { uid, ver, exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS };
}
