import { ActionForm, StatusButton } from "@/components/action-form";
import {
  Card,
  EmptyRow,
  Field,
  Notice,
  StatusBadge,
  Table,
  TableWrap,
  Th,
  Tr,
  inputClass,
} from "@/components/ui";
import { createDestination, setDestinationStatus } from "@/lib/control-plane/actions";
import { listActiveOptions, listDestinations } from "@/lib/control-plane/queries";

export const dynamic = "force-dynamic";

export default async function DestinationsPage() {
  const [rows, options] = await Promise.all([listDestinations(), listActiveOptions()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-semibold">Destinations (whitelist)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đây là danh sách URL DUY NHẤT mà redirect được phép trỏ tới. Không có
          đường nào khác để 302 ra ngoài — link /go không nhận URL từ query param.
        </p>
      </div>

      <Card
        title="Thêm destination"
        description="Chỉ http/https. Mới thêm là pending — phải activate mới redirect được."
      >
        {options.advertisers.length === 0 ? (
          <Notice>
            Chưa có advertiser nào ở trạng thái active. Activate một advertiser trước.
          </Notice>
        ) : (
          <ActionForm
            action={createDestination}
            submitLabel="Thêm vào whitelist"
            className="grid gap-3 sm:grid-cols-3"
          >
            <Field label="Advertiser">
              <select name="advertiserId" required className={inputClass}>
                {options.advertisers.map((advertiser) => (
                  <option key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL đích">
              <input
                name="url"
                required
                className={inputClass}
                placeholder="https://offer.example.com/lp"
              />
            </Field>
            <Field label="Category">
              <input name="category" required className={inputClass} placeholder="finance" />
            </Field>
          </ActionForm>
        )}
      </Card>

      <Card title={`Whitelist (${rows.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Advertiser</Th>
                <Th>Category</Th>
                <Th>Trạng thái</Th>
                <Th>Đổi trạng thái</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={5}>Whitelist đang rỗng.</EmptyRow>
              ) : (
                rows.map((row) => (
                  <Tr key={row.id}>
                    <td className="max-w-sm truncate px-3 py-2">
                      <code className="font-mono text-xs">{row.url}</code>
                    </td>
                    <td className="px-3 py-2">{row.advertiserName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <StatusButton
                          action={setDestinationStatus}
                          id={row.id}
                          status="active"
                          label="Activate"
                        />
                        <StatusButton
                          action={setDestinationStatus}
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
