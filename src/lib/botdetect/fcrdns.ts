import { isIP } from "node:net";
import { promises as dns } from "node:dns";

/**
 * Forward-Confirmed reverse DNS (FCrDNS).
 *
 * User-Agent là chuỗi ai cũng đặt được; IP nguồn thì không giả được ở tầng TCP.
 * Nhà vận hành crawler kiểm soát bản ghi PTR của dải IP họ sở hữu, nên:
 *   1. PTR(ip)  → hostname, hostname PHẢI thuộc domain của nhà vận hành;
 *   2. A/AAAA(hostname) PHẢI chứa lại đúng `ip`.
 * Thiếu bước 2 thì kẻ có dải IP riêng tự đặt PTR = "crawl-1.googlebot.com" là qua
 * — vì PTR do chủ IP tự khai, còn A record của googlebot.com thì không.
 */

export interface DnsResolver {
  reverse(ip: string): Promise<string[]>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
}

export const systemResolver: DnsResolver = {
  reverse: (ip) => dns.reverse(ip),
  resolve4: (host) => dns.resolve4(host),
  resolve6: (host) => dns.resolve6(host),
};

/**
 * - `verified` — rDNS thuộc domain đúng VÀ forward khớp.
 * - `failed`   — bằng chứng chống lại: không PTR, sai domain, hoặc forward lệch.
 *                Crawler thật luôn có PTR hợp lệ nên đây là dấu hiệu giả mạo.
 * - `error`    — không kết luận được (timeout, SERVFAIL…). KHÔNG được coi là giả:
 *                DNS chập chờn mà chặn nhầm thì mất cả Googlebot thật.
 */
export type FcrdnsResult =
  | { status: "verified"; hostname: string }
  | { status: "failed"; reason: "no-ptr" | "wrong-domain" | "forward-mismatch" }
  | { status: "error"; reason: string };

const DEFINITIVE_NEGATIVE = new Set(["ENOTFOUND", "ENODATA"]);
const MAX_CANDIDATES = 3;

/** Dạng chuẩn để so sánh hai địa chỉ: IPv4 chấm thập phân, IPv6 đủ 8 nhóm hex. */
export function normalizeIp(raw: string): string | null {
  let ip = raw.trim();
  // Cổng đi kèm ("1.2.3.4:443", "[::1]:443") — phổ biến ở header proxy. Bỏ cổng thay
  // vì coi cả chuỗi là "IP sai": IP sai bị tính là giả mạo, mà đây chỉ là định dạng.
  const v4port = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
  if (v4port) ip = v4port[1];
  const v6port = ip.match(/^\[([^\]]+)\]:\d{1,5}$/);
  if (v6port) ip = v6port[1];
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);

  const zone = ip.indexOf("%");
  if (zone !== -1) {
    // Zone id chỉ có nghĩa với IPv6 link-local; IPv4 kèm "%x" là rác.
    // zone rỗng hoặc chứa ký tự lạ đều sai (RFC 4007: tên interface/số)
    if (isIP(ip.slice(0, zone)) !== 6 || !/^[A-Za-z0-9._~-]+$/.test(ip.slice(zone + 1))) return null;
    ip = ip.slice(0, zone);
  }

  const family = isIP(ip);
  if (family === 4) return ip;
  if (family !== 6) return null;

  const groups = expandIpv6(ip);
  if (!groups) return null;

  // ::ffff:a.b.c.d là IPv4 đi qua socket dual-stack — so như IPv4.
  const mapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join(".");
  }
  return groups.map((g) => g.toString(16)).join(":");
}

function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const tail4 = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (tail4) {
    const o = tail4.slice(2, 6).map(Number);
    if (o.some((n) => n > 255)) return null;
    s = `${tail4[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }

  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = 8 - head.length - rest.length;
  if (parts.length === 2 ? fill < 1 : fill !== 0) return null;

  const out: number[] = [];
  for (const g of [...head, ...Array<string>(parts.length === 2 ? fill : 0).fill("0"), ...rest]) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

/**
 * Khớp theo RANH GIỚI nhãn DNS, không theo chuỗi con: "evilgooglebot.com" và
 * "googlebot.com.evil.net" đều phải trượt khi suffix là "googlebot.com".
 */
export function hostMatchesSuffix(hostname: string, suffix: string): boolean {
  if (typeof hostname !== "string") return false;
  const raw = hostname.replace(/\.$/, "");
  // Hostname phải là chuỗi nhãn DNS hợp lệ. Không kiểm thì "evil\0.googlebot.com" (resolver C cắt
  // tại NUL) hay "evil.com#.googlebot.com" qua được phép khớp đuôi. Lớp ký tự ASCII TƯỜNG MINH, trên
  // chuỗi GỐC: không dùng cờ /iu (khi đó U+212A ký hiệu Kelvin khớp "k") và không hạ chữ thường trước
  // (toLowerCase() biến Kelvin thành "k" ASCII).
  if (raw.length > 253 || !HOSTNAME_RE.test(raw)) return false;
  const host = raw.toLowerCase();
  const sfx = suffix.toLowerCase();
  return host === sfx || host.endsWith(`.${sfx}`);
}

const HOSTNAME_RE = /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?(\.[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?)*$/;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("dns timeout"), { code: "ETIMEOUT" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function errorCode(err: unknown): string {
  try {
    return typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "UNKNOWN";
  } catch {
    return "UNKNOWN"; // getter `code` ném lỗi
  }
}

/** Resolver ngoài có thể trả undefined/phần tử không phải chuỗi — chỉ giữ chuỗi. */
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function verifyFcrdns(
  ip: string,
  allowedSuffixes: readonly string[],
  resolver: DnsResolver = systemResolver,
  timeoutMs = 2000,
): Promise<FcrdnsResult> {
  const normalized = normalizeIp(ip);
  // IP không parse được là "không kết luận được", KHÔNG phải bằng chứng giả mạo:
  // "failed" sẽ thành "spoofed" rồi bị challenge, và chuỗi lạ có thể chỉ là một danh
  // sách X-Forwarded-For bị truyền nhầm. Caller phải lọc IP trước.
  if (!normalized) return { status: "error", reason: "invalid-ip" };

  let hostnames: string[];
  try {
    const answer: unknown = await withTimeout(resolver.reverse(normalized), timeoutMs);
    // Resolver hỏng trả undefined/không phải mảng: không phải bằng chứng "không có PTR".
    if (!Array.isArray(answer)) return { status: "error", reason: "bad-resolver-response" };
    hostnames = strings(answer);
  } catch (err) {
    const code = errorCode(err);
    return DEFINITIVE_NEGATIVE.has(code)
      ? { status: "failed", reason: "no-ptr" }
      : { status: "error", reason: code };
  }

  const candidates = hostnames
    .filter((h) => allowedSuffixes.some((s) => hostMatchesSuffix(h, s)))
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { status: "failed", reason: "wrong-domain" };

  const isV4 = isIP(normalized) === 4;
  let sawError: string | undefined;

  for (const hostname of candidates) {
    try {
      const answer: unknown = await withTimeout(
        isV4 ? resolver.resolve4(hostname) : resolver.resolve6(hostname),
        timeoutMs,
      );
      if (!Array.isArray(answer)) {
        sawError = "bad-resolver-response";
        continue;
      }
      const forward = strings(answer);
      if (forward.some((addr) => normalizeIp(addr) === normalized)) {
        return { status: "verified", hostname: hostname.toLowerCase().replace(/\.$/, "") };
      }
    } catch (err) {
      const code = errorCode(err);
      if (!DEFINITIVE_NEGATIVE.has(code)) sawError = code;
    }
  }

  return sawError
    ? { status: "error", reason: sawError }
    : { status: "failed", reason: "forward-mismatch" };
}

interface CacheEntry {
  result: FcrdnsResult;
  expiresAt: number;
}

export interface CachedVerifierOptions {
  resolver?: DnsResolver;
  now?: () => number;
  /** Kết quả xác định (verified/failed) — PTR hiếm khi đổi nên cache lâu. */
  ttlMs?: number;
  /** Kết quả `error` — ngắn, để DNS hồi phục là thử lại ngay. */
  errorTtlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
}

/**
 * Bọc `verifyFcrdns` bằng cache per-instance. DNS tốn 2 round-trip nên mỗi
 * lượt crawl không được trả giá đó; cache cùng kiểu với route cache ở
 * lib/redirect/resolve.ts (bound kích thước, TTL, không chia sẻ giữa instance).
 */
export function createCrawlerVerifier(options: CachedVerifierOptions = {}) {
  const {
    resolver = systemResolver,
    now = Date.now,
    ttlMs = 6 * 60 * 60 * 1000,
    errorTtlMs = 60 * 1000,
    maxEntries = 2000,
    timeoutMs = 2000,
  } = options;
  const cache = new Map<string, CacheEntry>();
  // Nhiều request cùng IP tới trước khi lookup đầu xong sẽ cùng trượt cache; gộp
  // lại để mỗi (ip, suffix) chỉ tốn một cặp truy vấn DNS tại một thời điểm.
  const inflight = new Map<string, Promise<FcrdnsResult>>();

  return async function verify(
    ip: string,
    allowedSuffixes: readonly string[],
  ): Promise<FcrdnsResult> {
    const normalized = normalizeIp(ip);
    // IP không parse được trả kết quả ngay (không DNS) và KHÔNG được cache: khoá cache theo chuỗi gốc
    // sẽ giữ lại tới 2000 chuỗi dài tuỳ ý của client (đo: 100 khoá × 500KB giữ 50MB sau GC).
    if (normalized === null) return verifyFcrdns(ip, allowedSuffixes, resolver, timeoutMs);
    const key = `${normalized}|${allowedSuffixes.join(",")}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.result;

    let pending = inflight.get(key);
    if (!pending) {
      pending = verifyFcrdns(ip, allowedSuffixes, resolver, timeoutMs).finally(() =>
        inflight.delete(key),
      );
      inflight.set(key, pending);
    }
    const result = await pending;

    if (cache.size >= maxEntries) cache.delete(cache.keys().next().value as string);
    cache.set(key, {
      result,
      expiresAt: now() + (result.status === "error" ? errorTtlMs : ttlMs),
    });
    return result;
  };
}
