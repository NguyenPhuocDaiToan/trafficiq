import Link from "next/link";

/*
 * Component dùng BÊN TRONG thân bài viết (`body()` của mỗi post).
 *
 * Luật token vẫn áp dụng: không hex, không `neutral-*`. Chỉ semantic token.
 */

/** Khung ghi chú giữa bài. Không phải cảnh báo lỗi — dùng cho lưu ý bên lề. */
export function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    /* Không `rounded-*`: bo góc = 0 trên toàn surface công khai. Ghi chú giữa bài
       tách khỏi thân bài bằng nền `--muted` + thanh dọc, không bằng góc mềm. */
    <aside className="border-l-[3px] border-rule bg-muted px-4 py-3 text-sm">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </aside>
  );
}

/**
 * Ghi chú cơ sở của bài — BẮT BUỘC ở mọi bài `kind: "review"`.
 *
 * Vì sao bắt buộc: bài giúp chọn mua là dạng bài dễ mất uy tín nhất, và cách mất
 * nhanh nhất là để người đọc tưởng người viết đã dùng thử trong khi không có.
 * Khối này nói thẳng bài dựa trên cái gì, nên người đọc tự biết nên tin tới đâu —
 * và nó chặn luôn việc bài sau vô tình trôi sang giọng "tôi đã test".
 *
 * Viết `basis` cụ thể, không viết "dựa trên nghiên cứu kỹ lưỡng". Ví dụ đúng:
 * "thông số nhà sản xuất công bố + giá niêm yết tại thời điểm viết + cách tự kiểm
 * bạn làm được tại nhà. Tôi không dùng thử từng model trong bài."
 */
export function MethodNote({ children }: { children: React.ReactNode }) {
  return (
    <aside className="border-y border-border py-3 text-sm text-muted-foreground">
      <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-foreground uppercase">
        Bài này dựa trên đâu
      </p>
      <div className="mt-1.5">{children}</div>
    </aside>
  );
}

/**
 * Bảng tiêu chí / so sánh nhóm.
 *
 * Nhận `head` + `rows` thay vì để người viết tự dựng `<table>`: bảng trong
 * `.prose` đã có style riêng (scroll ngang ở mobile), và tự viết tay thì rất dễ
 * quên `<thead>` khiến hàng đầu không thành tiêu đề cột — screen reader đọc bảng
 * đó thành một mớ ô rời.
 *
 * So sánh theo NHÓM (kiểu máy, tầm giá), không theo model cụ thể: xem ràng buộc ở
 * `Post.kind` trong `content/types.ts`. Số liệu của model cụ thể sẽ cũ đi trong vài
 * tháng và không ai đi cập nhật, còn tiêu chí thì đúng lâu.
 */
export function CriteriaTable({
  head,
  rows,
  caption,
}: {
  head: string[];
  rows: string[][];
  /** Dòng chú thích dưới bảng — nói rõ số liệu lấy ở đâu, nếu có số. */
  caption?: string;
}) {
  return (
    <figure>
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={`${row[0]}-${index}`}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Khối liên kết affiliate.
 *
 * BẮT BUỘC dùng component này cho MỌI link có tính chất affiliate trong bài —
 * đừng viết `<a href>` tay. Nó gánh ba thứ không được phép quên:
 *   1. `rel="nofollow sponsored"` — yêu cầu của Google cho link được trả tiền.
 *   2. Nhãn tiết lộ hiện ngay tại chỗ, không phải chỉ nằm ở footer.
 *   3. `--accent` — màu duy nhất được dùng cho CTA (luật MASTER.md).
 *
 * Cách dùng, trỏ vào trang giới thiệu chiến dịch có sẵn trong admin:
 *
 *   <PromoBox
 *     href="/c/duong-dan-chien-dich"
 *     label="Xem chi tiết ưu đãi"
 *     note="Ưu đãi từ đối tác X, áp dụng tới 31/12."
 *   />
 *
 * KHÔNG hard-code link `/go/<token>` vào bài: token sinh tự động trong DB, chép
 * tay vào nội dung tĩnh là chắc chắn có ngày lệch. Trỏ vào `/c/<slug>` — trang đó
 * tự dựng link `/go` đúng và tự chuyển tiếp tham số tracking.
 */
export function PromoBox({
  href,
  label,
  note,
}: {
  href: string;
  label: string;
  note: string;
}) {
  return (
    /* Gạch đậm trên + dưới thay vì hộp bo góc: khối này phải nổi rõ giữa thân bài
       (nó là chỗ duy nhất trong bài có CTA accent) mà không thành hình chữ nhật
       mềm duy nhất trên cả surface. */
    <aside className="border-y-[3px] border-rule py-4">
      <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Liên kết tài trợ
      </p>
      <p className="mt-2 text-sm">{note}</p>
      <Link
        href={href}
        rel="nofollow sponsored"
        className="mt-3 inline-block cursor-pointer bg-accent px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-on-accent uppercase transition-opacity hover:opacity-90"
      >
        {label}
      </Link>
      <p className="mt-3 text-xs text-muted-foreground">
        Nếu bạn dùng liên kết này, tôi có thể nhận hoa hồng.{" "}
        <Link href="/tiet-lo-lien-ket" className="cursor-pointer underline">
          Cách tôi kiếm tiền
        </Link>
        .
      </p>
    </aside>
  );
}
