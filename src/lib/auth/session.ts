/**
 * Auth admin tối giản cho MVP: 1 shared password → 1 cookie.
 *
 * Dùng Web Crypto (không phải node:crypto) để file này chạy được cả trong
 * proxy.ts (Edge runtime) và server action (Node runtime).
 *
 * Cookie KHÔNG chứa password thô — chứa sha256(password + version). Đủ để một
 * người vận hành. Khi có nhiều user thì thay bằng auth thật (Auth.js), interface
 * `verifySessionCookie` giữ nguyên.
 */

export const SESSION_COOKIE = "tiq_admin";

const VERSION = "tiq-admin-v1";

export async function sessionValueFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${VERSION}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** So sánh constant-time trên 2 chuỗi hex cùng độ dài. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySessionCookie(
  cookieValue: string | undefined,
  password: string,
): Promise<boolean> {
  if (!cookieValue) return false;
  return constantTimeEqual(cookieValue, await sessionValueFor(password));
}
