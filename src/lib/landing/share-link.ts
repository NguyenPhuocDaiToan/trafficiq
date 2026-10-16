import type { CampaignOg } from "@/lib/types";

/**
 * Link CHIA SẺ của một campaign: `/go/<token>?v=<mã thẻ>`.
 *
 * Vấn đề nó giải: X, Facebook, Zalo… lưu thẻ chia sẻ (tiêu đề, mô tả, ảnh) THEO URL, thường vài
 * ngày, và không có cách xoá từ phía mình. Admin đổi ảnh xong thì link đã đăng/đã gửi vẫn hiện ảnh
 * cũ, trong khi người dùng hệ thống "chỉ đi gửi link" nên không ai biết để làm mới.
 *
 * Giải pháp: gắn vào link một mã tính TỪ CHÍNH nội dung thẻ. Đổi tiêu đề/mô tả/ảnh → mã đổi → URL
 * mới → nền tảng coi là link chưa từng thấy và lấy thẻ mới. Admin luôn hiện link có mã hiện tại, nên
 * người dùng chỉ việc copy từ admin; không có bộ đếm phiên bản nào để quên tăng.
 *
 * KHÔNG đổi `token`: nó là link đã đem đi chạy traffic và mọi `clickEvent` lịch sử neo vào campaign
 * qua nó (xem `updateCampaign`). `?v=` là tham số tuỳ chọn mà `/go` bỏ qua khi redirect (và
 * `buildTargetUrl` không chuyển tiếp nó cho advertiser), nên link cũ không có mã vẫn chạy bình
 * thường — chỉ là thẻ của nó có thể còn bản cũ ở phía nền tảng.
 *
 * Mã chỉ phụ thuộc nội dung thẻ chứ không phụ thuộc `updatedAt`: bật/tắt trạng thái, đổi đích hay
 * sửa nội dung landing không làm link chia sẻ đổi một cách vô ích (mỗi lần đổi là một lần mất bộ
 * đếm lượt chia sẻ của nền tảng).
 */

type CardContent = Pick<CampaignOg, "title" | "description" | "imageUrl">;

/**
 * FNV-1a 32 bit → base36. Không cần mật mã: đây không phải bí mật, chỉ là dấu vết "nội dung đã đổi",
 * và va chạm (hai nội dung ra cùng mã) chỉ làm một lần đổi không tạo URL mới — cực hiếm và vô hại.
 * Không dùng `node:crypto` để file này chạy được ở mọi nơi (server component, client, test).
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function ogVersion(og: CardContent): string {
  // `\u0000` làm dấu phân cách: không xuất hiện trong văn bản người nhập, nên ("ab", "c") và
  // ("a", "bc") không ra cùng chuỗi băm.
  const content = [og.title, og.description, og.imageUrl ?? ""].join("\u0000");
  return fnv1a(content).toString(36).padStart(7, "0");
}

export function shareUrl(baseUrl: string, token: string, og: CardContent): string {
  return `${baseUrl}/go/${token}?v=${ogVersion(og)}`;
}

/**
 * Đọc `?v=` từ request. Giá trị đi vào HTML của thẻ (`og:url`) nên chỉ nhận đúng dạng mã mà
 * `ogVersion` sinh ra; thứ gì khác (kể cả cố ý chèn thẻ/dấu nháy) bị bỏ như thể không có.
 */
export function parseShareVersion(raw: string | null | undefined): string | undefined {
  return raw && /^[a-z0-9]{1,12}$/i.test(raw) ? raw : undefined;
}
