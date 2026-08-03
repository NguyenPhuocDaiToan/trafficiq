import { createHash, timingSafeEqual } from "node:crypto";

/**
 * So sánh secret không rò thời gian.
 * Hash trước để timingSafeEqual luôn nhận 2 buffer cùng độ dài (nó throw nếu khác).
 */
export function secretMatches(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
