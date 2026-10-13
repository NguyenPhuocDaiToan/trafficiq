import type { RateLimitRule, RateLimitStore } from "./rate-limit";
import type { Assessment, Decision } from "./types";

/**
 * Điểm → hành động.
 *
 *    0–29   allow         bình thường; chỉ áp hạn mức nền chống xả
 *   30–59   flag          đi tiếp, ghi log để phân tích (shadow)
 *   60–79   rate-limit    hạn mức chặt; vượt thì 429
 *   80–100  challenge     phải giải PoW trước
 *
 * Ngưỡng là chính sách, không phải sự thật vật lý: đổi bằng dữ liệu thật (xem
 * nhóm nào convert) chứ không phải bằng cảm giác.
 */
export interface Thresholds {
  flag: number;
  rateLimit: number;
  challenge: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { flag: 30, rateLimit: 60, challenge: 80 };

/**
 * HAI bucket cho mỗi khoá, và ranh giới giữa chúng là cố ý:
 *
 *   `h:` (sạch)     — chỉ request điểm thấp. 120 burst, 2/s: người thật bấm vài link
 *                     mỗi phút nên rất rộng.
 *   `s:` (nghi ngờ) — request bậc flag và bậc đáng ngờ dùng CHUNG (30 burst, 0.5/s;
 *                     mỗi request đáng ngờ tốn 5 token ≈ 6 burst).
 *
 * Vì sao không một bucket duy nhất: nhiều người dùng chung một IP (CGNAT di động, văn
 * phòng), nên một bot bậc cao trút request vào bucket chung sẽ rút cạn hạn mức của
 * mọi NGƯỜI SẠCH cùng IP đó. Vì sao không bucket riêng cho từng bậc: luân phiên giữa
 * các bậc cộng dồn được 120 + 30 + 6. Hai bucket giữ được cả hai: bot không chạm tới
 * bucket sạch, và tổng tối đa bị chặn (~150) bởi hai trần cố định.
 */
export const HUMAN_RULE: RateLimitRule = { capacity: 120, refillPerSec: 2 };
export const SUSPECT_RULE: RateLimitRule = { capacity: 30, refillPerSec: 0.5 };
export const RATE_COSTS = { allow: 1, flag: 1, suspicious: 5 } as const;

export interface PolicyOptions {
  limiter: RateLimitStore;
  /** Khoá hạn mức — thường là ipHash. */
  key: string;
  thresholds?: Thresholds;
}

export function decide(assessment: Assessment, options: PolicyOptions): Decision {
  const { limiter, key, thresholds = DEFAULT_THRESHOLDS } = options;
  const { classification } = assessment;
  // Điểm không hữu hạn (lỗi ở phía gọi) rơi vào bậc flag — không allow trơn, cũng
  // không challenge người thật vì một lỗi tính toán.
  const score = Number.isFinite(assessment.score) ? assessment.score : thresholds.flag;

  // Crawler đã xác minh: không rate-limit/challenge — chặn Googlebot thật là
  // tự bắn vào chân. Chỉ hạn mức nền chống lỗi vòng lặp.
  if (classification === "verified-crawler") {
    return limiter.take(`v:${key}`, HUMAN_RULE, RATE_COSTS.allow).allowed
      ? { action: "allow" }
      : { action: "rate-limited", retryAfterSec: 1 };
  }

  if (score >= thresholds.challenge) return { action: "challenge" };

  if (score >= thresholds.rateLimit) {
    const r = limiter.take(`s:${key}`, SUSPECT_RULE, RATE_COSTS.suspicious);
    return r.allowed
      ? { action: "flag" }
      : { action: "rate-limited", retryAfterSec: r.retryAfterSec };
  }

  if (score >= thresholds.flag) {
    const r = limiter.take(`s:${key}`, SUSPECT_RULE, RATE_COSTS.flag);
    return r.allowed
      ? { action: "flag" }
      : { action: "rate-limited", retryAfterSec: r.retryAfterSec };
  }

  const r = limiter.take(`h:${key}`, HUMAN_RULE, RATE_COSTS.allow);
  return r.allowed
    ? { action: "allow" }
    : { action: "rate-limited", retryAfterSec: r.retryAfterSec };
}
