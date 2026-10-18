import { ActionForm, FieldsButton } from "@/components/action-form";
import { Card, EmptyRow, Field, Notice, Table, TableWrap, Th, Tr, inputClass } from "@/components/ui";
import { requireOwner } from "@/lib/auth/current-user";
import { addDomain, deleteDomain, disableDomain, verifyDomain } from "@/lib/domains/actions";
import { listDomains, type DomainView } from "@/lib/domains/registry";
import { publicBaseUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tên miền" };

const STATUS: Record<DomainView["status"], { label: string; className: string }> = {
  verified: { label: "Dùng được", className: "text-success" },
  pending: { label: "Chờ kiểm tra", className: "text-warning" },
  disabled: { label: "Đã tắt", className: "text-muted-foreground" },
};

/** Chỉ owner — xem `requireOwner()`; mỗi action tự kiểm lại bằng DB. */
export default async function DomainsPage() {
  await requireOwner();
  const domains = await listDomains();
  const primary = publicBaseUrl();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tên miền</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Link theo dõi mặc định dùng tên miền chính{" "}
          <code className="font-mono text-xs">{primary}</code>. Ở đây bạn thêm tên miền riêng (vd.{" "}
          <code className="font-mono text-xs">go.thuonghieu.com</code>) để mỗi chiến dịch hiện link theo tên
          miền bạn chọn.
        </p>
      </div>

      <Notice>
        Tên miền chỉ đổi <strong>địa chỉ hiển thị của link</strong>. Mọi tên miền cùng phục vụ một ứng dụng:
        cùng danh sách đích được phép, cùng trang giới thiệu, cùng thẻ chia sẻ — không có cách ứng xử khác nhau
        theo tên miền.
      </Notice>

      <Card
        title="Thêm tên miền"
        description="Khai báo xong, bạn phải tự trỏ DNS và thêm tên miền vào nơi deploy; sau đó bấm “Kiểm tra”."
      >
        <ActionForm action={addDomain} submitLabel="Thêm tên miền" className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên miền" hint="chỉ hostname, không https:// và không cổng">
            <input name="host" required placeholder="go.thuonghieu.com" autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Ghi chú" hint="(không bắt buộc)">
            <input name="label" maxLength={80} placeholder="Chiến dịch mùa hè" className={inputClass} />
          </Field>
        </ActionForm>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Trên <strong>Vercel</strong>: Project → Settings → Domains → thêm tên miền, rồi tạo bản ghi DNS đúng
            như Vercel hiển thị ở đó (giá trị phụ thuộc dự án — hãy lấy từ trang đó, không đoán).
          </li>
          <li>
            Trên <strong>máy chủ riêng</strong>: trỏ DNS về máy chủ và thêm tên miền vào cấu hình nginx/chứng chỉ
            của ứng dụng.
          </li>
          <li>
            Quay lại đây bấm <strong>Kiểm tra</strong>. Hệ thống mở thử đường dẫn{" "}
            <code className="font-mono text-xs">/api/health</code> trên tên miền đó và chỉ cho dùng khi nhận
            đúng ứng dụng này.
          </li>
        </ol>
      </Card>

      <Card title={`Tên miền đã khai báo (${domains.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tên miền</Th>
                <Th>Trạng thái</Th>
                <Th>Kiểm tra lần cuối thành công</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <EmptyRow colSpan={4}>Chưa có tên miền riêng — mọi link đang dùng tên miền chính.</EmptyRow>
              ) : (
                domains.map((d) => (
                  <Tr key={d.id}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-mono text-xs">{d.host}</div>
                      {d.label ? <div className="text-xs text-muted-foreground">{d.label}</div> : null}
                    </td>
                    <td className={`px-3 py-2 align-top ${STATUS[d.status].className}`}>{STATUS[d.status].label}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{formatDateTime(d.verifiedAt)}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        {/*
                          Hai nút đầu luôn là FieldsButton ở cùng vị trí, chỉ đổi nhãn/action theo trạng thái. Việc
                          đó có chủ đích: kết quả action hiện NGAY DƯỚI chính nút bấm (state nằm trong nút), và React
                          chỉ giữ state khi nút còn ở nguyên vị trí cùng kiểu. Ẩn nút "Tắt" sau khi tắt xong thì
                          thông báo "đang có N chiến dịch dùng tên miền này" biến mất đúng lúc cần đọc nhất.
                        */}
                        <FieldsButton
                          action={verifyDomain}
                          fields={{ id: d.id }}
                          label={d.status === "disabled" ? "Bật lại (kiểm tra)" : "Kiểm tra"}
                        />
                        <FieldsButton
                          action={disableDomain}
                          fields={{ id: d.id }}
                          label={d.status === "disabled" ? "Đã tắt" : "Tắt"}
                        />
                        <FieldsButton action={deleteDomain} fields={{ id: d.id }} label="Xoá" />
                      </div>
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
        <p className="mt-3 text-xs text-muted-foreground">
          Kết quả của nút “Kiểm tra” hiện ngay dưới nút bấm không — nếu thất bại, lý do nằm trong thông báo.
          Tên miền đang “Dùng được” mà kiểm lại hỏng thì tự hạ về “Chờ kiểm tra”.
        </p>
      </Card>
    </div>
  );
}
