import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Băm mật khẩu người dùng bằng scrypt (có trong Node, không thêm phụ thuộc).
 *
 * Định dạng lưu: `scrypt$N$r$p$<salt b64>$<hash b64>` — tham số nằm trong chính chuỗi nên nâng độ khó sau
 * này không làm hỏng hash cũ: `verifyPassword` đọc tham số từ chuỗi, `needsRehash` cho biết khi nào nên băm lại.
 *
 * Chỉ chạy ở Node. File này KHÔNG được import từ `proxy.ts` (Edge) — proxy chỉ cần kiểm chữ ký phiên.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
/** scrypt cần ~128·N·r byte (32MB ở N=2^15); mặc định của Node là 32MB nên phải nâng trần. */
const MAXMEM = 128 * N * R * 2;

/**
 * Trần độ dài đầu vào. scrypt tốn CPU như nhau với mọi độ dài, nhưng một chuỗi MB-lớn bị server action
 * nhận vào là tốn bộ nhớ trước cả khi băm.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  // Tham số lấy từ chuỗi lưu trong DB (tin được), nhưng vẫn chặn giá trị phi lý để một bản ghi hỏng
  // không biến thành yêu cầu cấp phát hàng GB.
  if (!Number.isInteger(params.N) || params.N < 2 ** 10 || params.N > 2 ** 20 || (params.N & (params.N - 1)) !== 0) return false;
  if (!Number.isInteger(params.r) || params.r < 1 || params.r > 16) return false;
  if (!Number.isInteger(params.p) || params.p < 1 || params.p > 4) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    ...params,
    maxmem: 128 * params.N * params.r * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash cũ dùng tham số yếu hơn hiện tại → băm lại ở lần đăng nhập thành công kế tiếp. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  return parts[0] !== "scrypt" || Number(parts[1]) !== N || Number(parts[2]) !== R || Number(parts[3]) !== P;
}

/** Lỗi đầu tiên của mật khẩu mới, hoặc `null` nếu dùng được. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự.`;
  if (password.length > PASSWORD_MAX) return `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`;
  if (email && password.toLowerCase() === email.toLowerCase()) return "Mật khẩu không được trùng email.";
  if (/^(.)\1+$/.test(password)) return "Mật khẩu quá dễ đoán (một ký tự lặp lại).";
  return null;
}
