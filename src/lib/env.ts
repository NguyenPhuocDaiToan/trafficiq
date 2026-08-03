/**
 * Truy cập env qua hàm (lazy), KHÔNG đọc ở module scope.
 *
 * Lý do: Next build/prerender chạy module code mà không có runtime env đầy đủ.
 * Nếu throw ở module scope thì `next build` sẽ fail dù runtime hoàn toàn ổn.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Thiếu biến môi trường ${name}. Xem .env.example và tạo .env.local`,
    );
  }
  return value;
}

export const mongodbUri = () => required("MONGODB_URI");

export const mongodbDb = () => process.env.MONGODB_DB ?? "trafficiq";

/** TTL cho clickEvents. M0 chỉ có 512MB nên retention raw là bắt buộc (Mục 4.5). */
export const clickTtlDays = () => Number(process.env.CLICK_TTL_DAYS ?? 30);

/** Salt để hash IP. IP là PII — chỉ lưu hash, không lưu raw. */
export const ipHashSalt = () => required("IP_HASH_SALT");

/** Shared secret cho /api/postback và /api/rollup. */
export const postbackSecret = () => required("POSTBACK_SECRET");

export const adminPassword = () => required("ADMIN_PASSWORD");

/** Base URL công khai, dùng để build link /go và absolute OG image. */
export function publicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
