import type { CampaignOg } from "@/lib/types";
import { shareUrl } from "@/lib/landing/share-link";

/**
 * Dựng link chia sẻ theo TÊN MIỀN ĐƯỢC CHỌN của campaign. Thuần hàm, không DB.
 *
 * `shareDomain` chỉ là nhãn hiển thị của link. Nó KHÔNG đổi hành vi của `/go`: cùng một deployment phục vụ mọi
 * tên miền, cùng một whitelist đích, cùng một thẻ chia sẻ và `canonical` luôn là `/c/<slug>` của tên miền chính
 * (xem `og-card.ts`). Không có nhánh nào trong redirect đọc `Host` để đối xử khác nhau.
 *
 * Tên miền chỉ được dùng khi nó đang `verified`. Campaign trỏ tới một tên miền đã bị tắt/xoá rơi về tên miền
 * chính và `resolveShareBase` báo `fellBack` để giao diện cảnh báo, thay vì im lặng đưa ra một link chết.
 */

export interface ShareBase {
  baseUrl: string;
  /** Campaign có chọn một tên miền, nhưng nó không còn dùng được nên đang rơi về tên miền chính. */
  fellBack: boolean;
}

export function resolveShareBase(
  shareDomain: string | undefined,
  verifiedHosts: ReadonlySet<string>,
  primaryBaseUrl: string,
): ShareBase {
  if (!shareDomain) return { baseUrl: primaryBaseUrl, fellBack: false };
  if (verifiedHosts.has(shareDomain)) return { baseUrl: `https://${shareDomain}`, fellBack: false };
  return { baseUrl: primaryBaseUrl, fellBack: true };
}

export function campaignShareUrl(
  campaign: { token: string; og: Pick<CampaignOg, "title" | "description" | "imageUrl">; shareDomain?: string },
  verifiedHosts: ReadonlySet<string>,
  primaryBaseUrl: string,
): { url: string; fellBack: boolean } {
  const { baseUrl, fellBack } = resolveShareBase(campaign.shareDomain, verifiedHosts, primaryBaseUrl);
  return { url: shareUrl(baseUrl, campaign.token, campaign.og), fellBack };
}
