/**
 * Token bucket in-memory, giới hạn kích thước.
 *
 * PER-INSTANCE: mỗi instance serverless có bucket riêng nên hạn mức thực tế là
 * N × limit khi N instance đang warm — cùng giới hạn đã ghi cho route cache ở
 * lib/redirect/resolve.ts. Đủ để chặn một client xả liên tục vào một instance;
 * KHÔNG đủ để đảm bảo "tối đa X request/phút toàn hệ thống". Cần cái sau thì
 * implement `RateLimitStore` bằng store dùng chung (Redis/Upstash) — interface
 * giữ nguyên.
 */
export interface RateLimitRule {
  /** Số request tối đa dồn được (burst). */
  capacity: number;
  /** Token hồi mỗi giây. */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Chỉ có khi bị từ chối — số giây tới khi có token. */
  retryAfterSec?: number;
}

export interface RateLimitStore {
  take(key: string, rule: RateLimitRule, cost?: number): RateLimitResult;
}

const MAX_RETRY_AFTER_SEC = 86_400;

interface Bucket {
  tokens: number;
  updatedAt: number;
  capacity: number;
}

/** Số bucket cũ nhất được xét khi cần đá bớt một cái. */
const EVICTION_SCAN = 512;

export class MemoryRateLimiter implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: { maxKeys?: number; now?: () => number } = {}) {
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  take(key: string, rule: RateLimitRule, cost = 1): RateLimitResult {
    if (!Number.isFinite(cost) || cost <= 0) throw new RangeError("cost phải là số dương hữu hạn");
    const prev = this.buckets.get(key);
    // Đồng hồ nhảy lùi rồi tiến lại sẽ "hồi" token ma nếu updatedAt bị kéo lùi theo:
    // giữ mốc không giảm, và coi khoảng lùi là 0 giây trôi qua.
    const now = prev ? Math.max(this.now(), prev.updatedAt) : this.now();

    let tokens = rule.capacity;
    if (prev) {
      const elapsedSec = (now - prev.updatedAt) / 1000;
      tokens = Math.min(rule.capacity, prev.tokens + elapsedSec * rule.refillPerSec);
    }

    // Xoá rồi chèn lại để Map giữ thứ tự "ít dùng nhất ở đầu" → evict kiểu LRU.
    this.buckets.delete(key);
    if (this.buckets.size >= this.maxKeys) this.evictOne();

    if (tokens >= cost) {
      this.buckets.set(key, { tokens: tokens - cost, updatedAt: now, capacity: rule.capacity });
      return { allowed: true, remaining: Math.floor(tokens - cost) };
    }

    this.buckets.set(key, { tokens, updatedAt: now, capacity: rule.capacity });
    // Không bao giờ có token (không hồi, hoặc cost > capacity): KHÔNG có thời điểm thử lại
    // đúng. Infinity không dùng được trong Retry-After và một con số hữu hạn là nói dối,
    // nên bỏ trống — 429 không kèm Retry-After là câu trả lời trung thực.
    const unreachable = rule.refillPerSec <= 0 || cost > rule.capacity;
    if (unreachable) return { allowed: false, remaining: 0 };
    const retryAfterSec = Math.min(MAX_RETRY_AFTER_SEC, Math.ceil((cost - tokens) / rule.refillPerSec));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  /**
   * Khi đầy, đá một bucket còn ≥ 50% token (client rảnh, mất nó là vô hại)
   * thay vì đá bucket CŨ NHẤT một cách mù quáng. LRU thuần cho phép kẻ tấn công phun
   * `maxKeys` khoá lạ để đẩy bucket đã cạn của chính mình ra và nhận lại đủ burst.
   * Chỉ xét EVICTION_SCAN bucket cũ nhất để chi phí không phụ thuộc kích thước map. Kẻ tấn công cần
   * hơn ngần ấy khoá ĐÃ CẠN (mỗi khoá tốn cả burst) mới ép được đường lùi về "đá cũ nhất"; với
   * IPv6 xoay vòng thì giới hạn này vẫn bị vượt — đó là giới hạn của bộ nhớ có trần, không phải bug.
   */
  private evictOne(): void {
    let scanned = 0;
    let fallback: string | undefined;
    for (const [k, b] of this.buckets) {
      fallback ??= k;
      if (b.tokens >= b.capacity * 0.5) {
        this.buckets.delete(k);
        return;
      }
      if (++scanned >= EVICTION_SCAN) break;
    }
    if (fallback !== undefined) this.buckets.delete(fallback);
  }

  get size(): number {
    return this.buckets.size;
  }
}
