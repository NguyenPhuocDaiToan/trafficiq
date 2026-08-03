import { ActionForm, StatusButton } from "@/components/action-form";
import {
  Card,
  EmptyRow,
  Field,
  StatusBadge,
  Table,
  TableWrap,
  Th,
  Tr,
  inputClass,
} from "@/components/ui";
import { createAdvertiser, setAdvertiserStatus } from "@/lib/control-plane/actions";
import { listAdvertisers } from "@/lib/control-plane/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Đối tác quảng cáo" };

export default async function AdvertisersPage() {
  const rows = await listAdvertisers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Đối tác quảng cáo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bên trả tiền cho traffic. Mỗi URL đích trong whitelist phải thuộc về một
          đối tác ở đây.
        </p>
      </div>

      <Card
        title="Thêm đối tác"
        description="Đối tác mới luôn ở trạng thái chờ duyệt — phải xem lại rồi mới kích hoạt."
      >
        <ActionForm
          action={createAdvertiser}
          submitLabel="Thêm đối tác"
          className="grid gap-3 sm:grid-cols-3"
        >
          <Field label="Tên đối tác">
            <input name="name" required className={inputClass} placeholder="Acme Affiliate" />
          </Field>
          <Field label="Email liên hệ" hint="(không bắt buộc)">
            <input
              name="contactEmail"
              type="email"
              className={inputClass}
              placeholder="ops@acme.com"
            />
          </Field>
          <Field label="Ghi chú" hint="(không bắt buộc)">
            <input
              name="notes"
              className={inputClass}
              placeholder="Nguồn, điều khoản chia doanh thu…"
            />
          </Field>
        </ActionForm>
      </Card>

      <Card title={`Danh sách đối tác (${rows.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tên đối tác</Th>
                <Th>Email liên hệ</Th>
                <Th>Trạng thái</Th>
                <Th>Cập nhật lúc</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>Chưa có đối tác nào.</EmptyRow>
              ) : (
                rows.map((row) => (
                  <Tr key={row.id}>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.contactEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <StatusButton
                          action={setAdvertiserStatus}
                          id={row.id}
                          status="active"
                          label="Kích hoạt"
                        />
                        <StatusButton
                          action={setAdvertiserStatus}
                          id={row.id}
                          status="paused"
                          label="Tạm dừng"
                        />
                      </div>
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
