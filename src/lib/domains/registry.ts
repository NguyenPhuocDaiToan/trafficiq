import { shareDomains } from "@/lib/db/collections";
import type { ShareDomain } from "@/lib/types";

/** Đọc danh sách tên miền cho giao diện admin. Chỉ chạy ở trang admin — hot path `/go` không đụng tới. */

export interface DomainView {
  id: string;
  host: string;
  label?: string;
  status: ShareDomain["status"];
  verifiedAt?: string;
  createdByName?: string;
  createdAt: string;
}

export async function listDomains(): Promise<DomainView[]> {
  const docs = await (await shareDomains()).find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((d) => ({
    id: d._id!.toString(),
    host: d.host,
    label: d.label,
    status: d.status,
    verifiedAt: d.verifiedAt?.toISOString(),
    createdByName: d.createdBy?.name,
    createdAt: d.createdAt.toISOString(),
  }));
}

/**
 * Giá trị `shareDomain` của form có được ghi không: rỗng (tên miền chính), hoặc một host đang `verified`, hoặc
 * đúng giá trị campaign đang lưu (`unchanged`) — để sửa một campaign mà tên miền của nó đã bị tắt không buộc
 * người sửa đổi tên miền chỉ vì lưu một lỗi chính tả ở tiêu đề.
 */
export async function acceptShareDomain(
  value: string | undefined,
  unchanged?: string,
): Promise<{ ok: true; host: string | undefined } | { ok: false; error: string }> {
  if (!value) return { ok: true, host: undefined };
  if (value === unchanged) return { ok: true, host: value };
  const doc = await (await shareDomains()).findOne({ host: value, status: "verified" }, { projection: { _id: 1 } });
  return doc
    ? { ok: true, host: value }
    : { ok: false, error: `Tên miền "${value}" chưa được kiểm tra hoặc đã tắt — kiểm tra ở mục Tên miền trước.` };
}

/** Các host đang `verified` — tập duy nhất mà `resolveShareBase` chấp nhận. */
export async function verifiedHostSet(): Promise<ReadonlySet<string>> {
  const docs = await (await shareDomains())
    .find({ status: "verified" }, { projection: { host: 1 } })
    .limit(200)
    .toArray();
  return new Set(docs.map((d) => d.host));
}
