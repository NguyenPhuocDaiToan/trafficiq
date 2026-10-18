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
import { createDestination, setDestinationStatus, updateDestination } from "@/lib/control-plane/actions";
import { listActiveOptions, listAdvertisers, listDestinations } from "@/lib/control-plane/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "URL đích" };

export default async function DestinationsPage() {
  const [rows, options, allAdvertisers] = await Promise.all([
    listDestinations(),
    listActiveOptions(),
    // Form sửa cần cả đối tác chưa active: đích có thể đang thuộc về một đối tác đã tạm dừng, và nếu ô chọn
    // không có họ thì bấm Lưu sẽ âm thầm đổi chủ của đích sang người đứng đầu danh sách.
    listAdvertisers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">URL đích (danh sách cho phép)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đây là danh sách URL <strong>duy nhất</strong> mà redirect được phép trỏ
          tới. Không có đường nào khác để chuyển hướng ra ngoài — link{" "}
          <code className="font-mono text-xs">/go</code> không nhận URL từ tham số
          trên thanh địa chỉ.
        </p>
      </div>

      <div data-tour="destination-form">
      <Card
        title="Thêm URL đích"
        description="Chỉ nhận http/https. URL mới dùng được ngay. Tạo chiến dịch cũng tự thêm URL đích vào đây."
      >
        {options.advertisers.length === 0 ? (
          <Notice>
            Chưa có đối tác nào. Thêm một đối tác ở mục Đối tác trước.
          </Notice>
        ) : (
          <ActionForm
            action={createDestination}
            submitLabel="Thêm vào danh sách cho phép"
            className="grid gap-3 sm:grid-cols-3"
          >
            <Field label="Đối tác">
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
            <Field label="Phân loại" hint="để nhóm lại khi có nhiều URL">
              <input name="category" required className={inputClass} placeholder="tai-chinh" />
            </Field>
          </ActionForm>
        )}
      </Card>
      </div>

      <div data-tour="destination-list">
      <Card title={`Danh sách cho phép (${rows.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Đối tác</Th>
                <Th>Phân loại</Th>
                <Th>Trạng thái</Th>
                <Th>Cập nhật lúc</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={6}>
                  Danh sách đang rỗng — chưa URL nào được phép nhận redirect.
                </EmptyRow>
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
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex gap-2">
                        <StatusButton
                          action={setDestinationStatus}
                          id={row.id}
                          status="active"
                          label="Kích hoạt"
                        />
                        <StatusButton
                          action={setDestinationStatus}
                          id={row.id}
                          status="paused"
                          label="Tạm dừng"
                        />
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-primary">Sửa</summary>
                        <ActionForm
                          action={updateDestination}
                          submitLabel="Lưu"
                          submitVariant="secondary"
                          resetOnSuccess={false}
                          className="mt-2 flex w-80 max-w-full flex-col gap-3"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <Field label="Đối tác">
                            <select name="advertiserId" required defaultValue={row.advertiserId} className={inputClass}>
                              {allAdvertisers.map((advertiser) => (
                                <option key={advertiser.id} value={advertiser.id}>
                                  {advertiser.status === "active"
                                    ? advertiser.name
                                    : `${advertiser.name} (${advertiser.status === "paused" ? "đã tạm dừng" : "chờ duyệt"})`}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="URL đích">
                            <input name="url" required defaultValue={row.url} className={inputClass} />
                          </Field>
                          <Field label="Phân loại">
                            <input name="category" required defaultValue={row.category} className={inputClass} />
                          </Field>
                          {row.status === "active" ? (
                            <p className="text-xs text-warning">
                              Đích đang chạy: sau khi lưu, người bấm link sẽ được chuyển tới URL mới trong tối đa
                              khoảng 1 phút.
                            </p>
                          ) : null}
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
