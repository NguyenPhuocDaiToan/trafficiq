/** Mọi thứ cần từ `Headers` — để test không phải dựng `Request` thật. */
export interface HeaderBag {
  get(name: string): string | null;
}

export type SignalId =
  // Lớp 1 — danh tính crawler
  | "spoofed-crawler"
  | "unverified-crawler"
  // Lớp 2 — UA + header
  | "headless-ua"
  | "http-library-ua"
  | "unknown-declared-bot"
  | "empty-ua"
  | "non-browser-ua"
  | "headless-client-hint"
  | "platform-mismatch"
  | "programmatic-fetch"
  | "no-sec-fetch"
  | "no-accept-language"
  | "no-accept"
  | "wildcard-accept"
  | "non-document-accept"
  | "datacenter-asn"
  // Lớp 3 — telemetry phía client
  | "webdriver-flag"
  | "untrusted-events"
  | "ua-mismatch"
  | "empty-languages"
  | "zero-window"
  | "default-screen"
  | "no-interaction"
  | "no-chrome-object"
  | "no-plugins"
  | "no-hardware-concurrency";

/**
 * `weight` là 0–100: "nếu chỉ có tín hiệu này thì khả năng đây là automation
 * cỡ nào". Điểm tổng KHÔNG phải tổng các weight — xem `combineWeights()`.
 */
export interface Signal {
  id: SignalId;
  weight: number;
  detail?: string;
}

export type CrawlerVerification = "verified" | "spoofed" | "unverified";

export interface CrawlerClaim {
  id: string;
  verification: CrawlerVerification;
  /** Bằng chứng nào đã xác minh: rDNS hai chiều hay ASN. */
  via?: "fcrdns" | "asn";
  hostname?: string;
}

export type Classification =
  | "human-likely"
  | "suspicious"
  | "automated"
  | "verified-crawler"
  | "spoofed-crawler";

export interface Assessment {
  /** 0 = người dùng thông thường … 100 = gần như chắc chắn automation. */
  score: number;
  classification: Classification;
  signals: Signal[];
  crawler?: CrawlerClaim;
}

/**
 * - `allow`        — đi tiếp.
 * - `flag`         — đi tiếp nhưng ghi log để phân tích.
 * - `rate-limited` — vượt hạn mức của bậc điểm; trả 429.
 * - `challenge`    — yêu cầu giải PoW trước khi đi tiếp.
 */
export type Action = "allow" | "flag" | "rate-limited" | "challenge";

export interface Decision {
  action: Action;
  retryAfterSec?: number;
}
