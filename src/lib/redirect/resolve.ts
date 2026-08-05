import type { ObjectId } from "mongodb";
import { campaigns } from "@/lib/db/collections";
import type { CampaignOg } from "@/lib/types";

export interface RouteCandidate {
  offerId: ObjectId;
  destinationId: ObjectId;
  /** URL đã được whitelist. Đây là URL DUY NHẤT được phép 302 tới. */
  url: string;
  weight: number;
}

export interface ResolvedRoute {
  campaignId: ObjectId;
  slug: string;
  /**
   * Đủ để `/go/[token]` tự trả Social Card cho crawler mà KHÔNG cần query thêm —
   * nó đi kèm trong chính aggregation resolve token, và nằm trong cùng cache 60s.
   */
  og: CampaignOg;
  candidates: RouteCandidate[];
}

interface CacheEntry {
  value: ResolvedRoute | null;
  expiresAt: number;
}

/**
 * GOTCHA 4.3 — latency redirect.
 *
 * Cache routing map ở module scope: warm instance phục vụ redirect mà không
 * chạm Mongo, nên p50 chỉ còn cold start + tính toán. Cache sống theo lifetime
 * của instance nên không cần invalidate thủ công — chỉ cần TTL ngắn.
 *
 * Bước tối ưu tiếp theo (khi latency thành vấn đề): chuyển route handler sang
 * Edge runtime + đặt routing map vào Vercel Edge Config. Lưu ý Edge runtime
 * KHÔNG dùng được driver Mongo (không có TCP), nên khi đó việc ghi clickEvent
 * phải đẩy sang một Node route riêng.
 */
const globalForCache = globalThis as unknown as {
  __tiqRouteCache?: Map<string, CacheEntry>;
};

const routeCache = (globalForCache.__tiqRouteCache ??= new Map());

const TTL_HIT_MS = Number(process.env.ROUTE_CACHE_TTL_MS ?? 60_000);
/** Token sai (bot quét link) cache ngắn hơn để không hammer DB. */
const TTL_MISS_MS = 15_000;
/** Chặn cache phình vô hạn trên instance sống lâu. */
const MAX_CACHE_ENTRIES = 500;

export async function resolveToken(token: string): Promise<ResolvedRoute | null> {
  const now = Date.now();
  const cached = routeCache.get(token);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await queryRoute(token);

  if (routeCache.size >= MAX_CACHE_ENTRIES) routeCache.clear();
  routeCache.set(token, {
    value,
    expiresAt: now + (value ? TTL_HIT_MS : TTL_MISS_MS),
  });

  return value;
}

/**
 * Chỉ xóa cache của INSTANCE đang chạy. Các instance warm khác vẫn giữ route cũ
 * tối đa TTL_HIT_MS (60s) — nên sau khi pause một campaign, hãy tính là link còn
 * sống thêm ~1 phút. Muốn invalidate tức thì trên mọi instance thì phải đổi sang
 * store dùng chung (Edge Config / Redis), không phải cache in-memory.
 */
export function invalidateRouteCache(token?: string): void {
  if (token) routeCache.delete(token);
  else routeCache.clear();
}

/** Một round-trip duy nhất: campaign + offers + destinations. */
async function queryRoute(token: string): Promise<ResolvedRoute | null> {
  const col = await campaigns();

  const docs = await col
    .aggregate<{
      _id: ObjectId;
      slug: string;
      og: CampaignOg;
      offers: { _id: ObjectId; destinationId: ObjectId; weight: number }[];
      destinations: { _id: ObjectId; url: string }[];
    }>([
      { $match: { token, status: "active" } },
      { $limit: 1 },
      {
        $lookup: {
          from: "offers",
          let: { cid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$campaignId", "$$cid"] }, status: "active" } },
            { $project: { destinationId: 1, weight: 1 } },
          ],
          as: "offers",
        },
      },
      {
        $lookup: {
          from: "destinations",
          let: { ids: "$offers.destinationId" },
          pipeline: [
            // Chỉ destination đang active mới ra được — whitelist ở tầng DB.
            { $match: { $expr: { $in: ["$_id", "$$ids"] }, status: "active" } },
            { $project: { url: 1 } },
          ],
          as: "destinations",
        },
      },
      { $project: { slug: 1, og: 1, offers: 1, destinations: 1 } },
    ])
    .toArray();

  const doc = docs[0];
  if (!doc) return null;

  const urlById = new Map(doc.destinations.map((d) => [d._id.toString(), d.url]));

  const candidates: RouteCandidate[] = doc.offers.flatMap((offer) => {
    const url = urlById.get(offer.destinationId.toString());
    if (!url) return [];
    return [
      {
        offerId: offer._id,
        destinationId: offer.destinationId,
        url,
        weight: offer.weight > 0 ? offer.weight : 1,
      },
    ];
  });

  if (candidates.length === 0) return null;

  return { campaignId: doc._id, slug: doc.slug, og: doc.og, candidates };
}

/** Weighted random pick. Với 1 candidate thì trả luôn — không tốn random. */
export function pickCandidate(candidates: RouteCandidate[]): RouteCandidate {
  if (candidates.length === 1) return candidates[0];

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

export interface TargetParams {
  clickId: string;
  source: string;
  subIds: Record<string, string | undefined>;
}

/**
 * Build URL đích từ URL whitelist + tham số tracking.
 *
 * Bắt đầu từ `destinationUrl` (đã whitelist), CHỈ thêm param — không bao giờ
 * nhận URL từ input người dùng. Đây là chỗ open-redirect thường lọt.
 */
export function buildTargetUrl(destinationUrl: string, params: TargetParams): string {
  const url = new URL(destinationUrl);
  url.searchParams.set("click_id", params.clickId);
  if (params.source) url.searchParams.set("source", params.source);
  for (const [key, value] of Object.entries(params.subIds)) {
    if (!value) continue;
    // subId1 -> sub_id1
    url.searchParams.set(key.replace(/^subId/, "sub_id"), value);
  }
  return url.toString();
}
