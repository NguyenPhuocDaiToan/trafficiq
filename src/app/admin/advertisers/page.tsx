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
import { createAdvertiser, setAdvertiserStatus, updateAdvertiser } from "@/lib/control-plane/actions";
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

      <div data-tour="advertiser-form">
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
      </div>

      <div data-tour="advertiser-list">
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
                    <td className="px-3 py-2 align-top">
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
                      {/*
                        details chứ không phải state React: sửa được cả khi JS chưa tải (xem action-form.tsx).
                        Không đổi trạng thái ở đây — công tắc Kích hoạt/Tạm dừng ở trên là đường duy nhất.
                      */}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-primary">Sửa thông tin</summary>
                        <ActionForm
                          action={updateAdvertiser}
                          submitLabel="Lưu"
                          submitVariant="secondary"
                          resetOnSuccess={false}
                          className="mt-2 flex w-72 max-w-full flex-col gap-3"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <Field label="Tên đối tác">
                            <input name="name" required defaultValue={row.name} className={inputClass} />
                          </Field>
                          <Field label="Email liên hệ" hint="(để trống là xoá)">
                            <input name="contactEmail" type="email" defaultValue={row.contactEmail} className={inputClass} />
                          </Field>
                          <Field label="Ghi chú" hint="(để trống là xoá)">
                            <input name="notes" defaultValue={row.notes} className={inputClass} />
                          </Field>
                        </ActionForm>
                      </details>
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
      </div>
    </div>
  );
}
