/**
 * Tiến độ học: bài nào đã xem xong, lưu ở `localStorage` của TRÌNH DUYỆT này.
 *
 * Chỉ là tiện ích hiển thị ("Đã xem" trên thẻ bài học), nên mọi thao tác đều bọc try/catch và thất bại
 * thầm lặng: cửa sổ ẩn danh, bị chặn dữ liệu site, hay hết dung lượng không được làm hỏng trang. Không lưu
 * lên server — hệ thống chỉ có MỘT mật khẩu admin dùng chung nên không có "người dùng" nào để gắn tiến độ.
 */

const KEY = "tiq-guide-done";
const EVENT = "tiq-guide-progress";

/** Chuỗi thô đang lưu (hoặc ""), dùng làm snapshot ổn định cho `useSyncExternalStore`. */
export function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseDone(raw: string): string[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function markDone(id: string): void {
  try {
    const done = new Set(parseDone(readRaw()));
    if (done.has(id)) return;
    done.add(id);
    window.localStorage.setItem(KEY, JSON.stringify([...done]));
    // `storage` chỉ bắn ở TAB KHÁC; cùng tab phải tự báo.
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // không lưu được thì thôi
  }
}

export function resetDone(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // không lưu được thì thôi
  }
}

export function subscribeProgress(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
