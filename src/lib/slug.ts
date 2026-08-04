/**
 * Sinh slug ASCII từ tên tiếng Việt.
 *
 * Dùng ở CẢ hai phía:
 *  - client (`campaign-name-slug-fields.tsx`) để điền sẵn khi admin gõ tên;
 *  - server (`createCampaign`) để suy ra slug khi field bỏ trống — đó là đường
 *    duy nhất còn lại khi JS chưa tải, và control plane phải chạy được lúc đó.
 * Hai bản khác nhau nghĩa là bật/tắt JS cho ra hai slug khác nhau cho cùng một tên.
 *
 * Không import gì: file này phải nạp được trên cả Node và browser.
 */

/**
 * Kết quả luôn khớp `/^[a-z0-9-]*$/` — cùng luật với `campaignSchema.slug`. Nhưng
 * KHÔNG bảo đảm đủ 3 ký tự (tên chỉ gồm ký tự lạ sẽ ra chuỗi rỗng), nên chỗ gọi
 * phải tự kiểm độ dài và báo lỗi tử tế thay vì đẩy chuỗi rỗng xuống zod.
 */
export function slugify(input: string): string {
  return (
    input
      /*
       * NFD tách nguyên âm có dấu thành chữ gốc + combining mark, kể cả dấu móc
       * của ư/ơ (U+031B) — nên "Ưu đãi" ra "Uu dai" chứ không mất chữ.
       */
      .normalize("NFD")
      // Xoá toàn bộ combining mark (U+0300–U+036F): sắc, huyền, hỏi, ngã, nặng, móc, mũ.
      .replace(/[̀-ͯ]/g, "")
      /*
       * đ/Đ phải xử lý TAY: U+0111 và U+0110 là ký tự độc lập, NFD không phân rã
       * chúng. Thiếu dòng này thì "đầu tư" ra "u-tu" — mất hẳn chữ đầu.
       */
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      // Mọi thứ không phải a-z0-9 thành một dấu gạch: khoảng trắng, dấu câu, emoji.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // Trần 60 ký tự theo campaignSchema.
      .slice(0, 60)
      // `slice` có thể cắt giữa chỗ và để lại gạch ở cuối.
      .replace(/-+$/g, "")
  );
}
