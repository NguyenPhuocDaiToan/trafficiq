/**
 * In một graph JSON-LD vào HTML do server render.
 *
 * Phải là thẻ trong HTML đầu tiên, không phải thứ chèn bằng JS: blog.md ràng
 * "không có nội dung nào chỉ hiện khi có JS", và structured data mà crawler phải
 * chạy JS mới thấy thì phần lớn crawler không thấy.
 *
 * Dữ liệu đến từ hằng số trong repo (`lib/seo.ts` đọc `src/content` và
 * `lib/site.ts`), không phải input của người dùng — nên `dangerouslySetInnerHTML`
 * ở đây an toàn. Vẫn đổi mọi dấu nhỏ-hơn sang dạng escape unicode của JSON (vẫn là
 * JSON hợp lệ, parser đọc lại đúng ký tự): nếu về sau có bài nào chứa dấu đó trong
 * tiêu đề hoặc mô tả, một chuỗi đóng thẻ script nằm giữa JSON sẽ kết thúc thẻ sớm
 * và làm phần còn lại đổ ra thành nội dung trang.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
