/**
 * Giới hạn tần suất + số lượt xử lý đồng thời cho `/admin/upload-image`.
 *
 * Vì sao cần dù endpoint chỉ dành cho admin: giải mã ảnh là việc nặng nhất site làm (ảnh
 * 40 megapixel mở ra hàng trăm MB), và mỗi lần thành công ghi thêm một file lên đĩa. Một phiên
 * bị lộ — hoặc một lỗi vòng lặp ở client — không nên đủ sức làm treo máy hay đầy đĩa.
 *
 * Trạng thái nằm trong bộ nhớ TIẾN TRÌNH, cùng giới hạn đã ghi ở các rate limit khác của dự
 * án: chạy nhiều instance thì mỗi instance đếm riêng. Chấp nhận được ở đây vì mục tiêu là
 * chặn lạm dụng thô, không phải hạn mức chính xác; một VM duy nhất thì đúng tuyệt đối.
 */

/** 20 lượt/phút: dư cho người thật (mỗi campaign tối đa 2 ảnh), chặn kịch bản bị lạm dụng. */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 60_000;
/** Hai ảnh (hero + OG) tải song song là bình thường; ba trở lên thì không. */
const MAX_CONCURRENT = 3;

const state = {
  /** Thời điểm các lượt gần đây, để đếm trong cửa sổ trượt. */
  recent: [] as number[],
  inFlight: 0,
};

export type UploadSlot =
  | { ok: true; release: () => void }
  | { ok: false; error: string; retryAfterSeconds: number };

export function acquireUploadSlot(now: number = Date.now()): UploadSlot {
  state.recent = state.recent.filter((t) => now - t < WINDOW_MS);

  if (state.recent.length >= MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.recent[0] + WINDOW_MS - now) / 1000));
    return { ok: false, error: "Tải ảnh quá nhanh. Thử lại sau ít phút.", retryAfterSeconds };
  }
  if (state.inFlight >= MAX_CONCURRENT) {
    return { ok: false, error: "Đang xử lý các ảnh khác. Thử lại sau vài giây.", retryAfterSeconds: 3 };
  }

  state.recent.push(now);
  state.inFlight += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      // Idempotent: gọi hai lần không được làm bộ đếm âm và mở toang giới hạn.
      if (released) return;
      released = true;
      state.inFlight -= 1;
    },
  };
}

/** Chỉ cho test: đưa bộ đếm về trạng thái đầu. */
export function resetUploadGuard(): void {
  state.recent = [];
  state.inFlight = 0;
}
