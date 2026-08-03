/**
 * Nhãn tiếng Việt cho các giá trị được lưu dạng mã trong DB.
 *
 * QUAN TRỌNG: đây là tầng HIỂN THỊ. Giá trị lưu xuống Mongo luôn là mã tiếng Anh
 * ("active", "mobile", "direct"…). Không bao giờ dịch giá trị lưu trữ — mọi filter
 * trong `src/lib/analytics/queries.ts` và `src/lib/redirect/resolve.ts` khớp theo
 * mã đó, dịch xuống DB sẽ làm dashboard về 0 và redirect ngừng resolve.
 */

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  desktop: "Máy tính",
  bot: "Bot",
  unknown: "Không rõ",
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "Truy cập trực tiếp",
  unknown: "Không rõ",
};

/** Dùng cho cột "Thiết bị" trên dashboard. */
export function deviceLabel(value: string): string {
  return DEVICE_LABELS[value] ?? value;
}

/** Dùng cho cột "Nguồn traffic". Giá trị khác là sub-id do người chạy tự đặt. */
export function sourceLabel(value: string): string {
  return SOURCE_LABELS[value] ?? value;
}

/** Mã quốc gia ISO giữ nguyên; chỉ "unknown" cần dịch. */
export function countryLabel(value: string): string {
  return value === "unknown" ? "Không rõ" : value.toUpperCase();
}

/** Ngày giờ theo định dạng Việt Nam. `undefined` -> "—". */
export function formatDateTime(value: Date | string | undefined | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

/** Ngày (không giờ) — dùng cho bài viết blog. */
export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}
