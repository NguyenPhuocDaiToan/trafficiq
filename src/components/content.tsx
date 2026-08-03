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
    <aside className="rounded-xl border border-border bg-muted px-4 py-3 text-sm">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </aside>
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
    <aside className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        Liên kết tài trợ
      </p>
      <p className="mt-2 text-sm">{note}</p>
      <Link
        href={href}
        rel="nofollow sponsored"
        className="mt-3 inline-block cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
      >
        {label}
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">
        Nếu bạn dùng liên kết này, chúng tôi có thể nhận hoa hồng.{" "}
        <Link href="/tiet-lo-lien-ket" className="cursor-pointer underline">
          Cách chúng tôi kiếm tiền
        </Link>
        .
      </p>
    </aside>
  );
}
