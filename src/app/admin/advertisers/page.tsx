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

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
  const rows = await listAdvertisers();

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-2xl font-semibold">Advertisers</h1>

      <Card
        title="Thêm advertiser"
        description="Đối tác mới luôn ở trạng thái pending — phải review rồi mới activate."
      >
        <ActionForm
          action={createAdvertiser}
          submitLabel="Tạo advertiser"
          className="grid gap-3 sm:grid-cols-3"
        >
          <Field label="Tên">
            <input name="name" required className={inputClass} placeholder="Acme Affiliate" />
          </Field>
          <Field label="Email" hint="(tùy chọn)">
            <input
              name="contactEmail"
              type="email"
              className={inputClass}
              placeholder="ops@acme.com"
            />
          </Field>
          <Field label="Ghi chú" hint="(tùy chọn)">
            <input name="notes" className={inputClass} placeholder="Nguồn, điều khoản payout…" />
          </Field>
        </ActionForm>
      </Card>

      <Card title={`Danh sách (${rows.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tên</Th>
                <Th>Email</Th>
                <Th>Trạng thái</Th>
                <Th>Đổi trạng thái</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>Chưa có advertiser nào.</EmptyRow>
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
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <StatusButton
                          action={setAdvertiserStatus}
                          id={row.id}
                          status="active"
                          label="Activate"
                        />
                        <StatusButton
                          action={setAdvertiserStatus}
                          id={row.id}
                          status="paused"
                          label="Pause"
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
