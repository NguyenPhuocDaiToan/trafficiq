import type { EntityStatus } from "@/lib/types";

/**
 * Bộ lọc của danh sách chiến dịch (`?status=`). Mặc định chỉ hiện chiến dịch ĐANG CHẠY: chiến dịch tạm dừng là
 * thứ người dùng đã chủ động gác lại, để chung một danh sách là lúc nào cũng phải lướt qua chúng để tìm cái đang
 * chạy. Thuần hàm, không DB, để test được.
 */
export type CampaignFilter = "active" | "paused" | "pending" | "all";

export const DEFAULT_CAMPAIGN_FILTER: CampaignFilter = "active";

const VALID = new Set<string>(["active", "paused", "pending", "all"]);

/** Giá trị lạ hoặc thiếu → mặc định, không bao giờ lỗi (đây là tham số URL, ai cũng sửa được). */
export function parseCampaignFilter(raw: string | undefined): CampaignFilter {
  return raw && VALID.has(raw) ? (raw as CampaignFilter) : DEFAULT_CAMPAIGN_FILTER;
}

export function filterCampaigns<T extends { status: EntityStatus }>(rows: readonly T[], filter: CampaignFilter): T[] {
  return filter === "all" ? [...rows] : rows.filter((row) => row.status === filter);
}

export function countByStatus(rows: readonly { status: EntityStatus }[]): Record<EntityStatus | "all", number> {
  const counts = { active: 0, paused: 0, pending: 0, all: rows.length };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** `?status=` cho một bộ lọc; bộ lọc mặc định thì bỏ param để URL gọn (link `/admin/campaigns` là "đang chạy"). */
export function filterHref(filter: CampaignFilter): string {
  return filter === DEFAULT_CAMPAIGN_FILTER ? "/admin/campaigns" : `/admin/campaigns?status=${filter}`;
}
