import { campaigns } from "@/lib/db/collections";
import type { Campaign } from "@/lib/types";

export interface LandingCampaign {
  slug: string;
  token: string;
  name: string;
  status: Campaign["status"];
  landing: Campaign["landing"];
  og: Campaign["og"];
}

/**
 * Lấy campaign cho landing.
 *
 * Cho phép cả `pending` để preview OG trước khi activate — nhưng trang pending
 * bị noindex (xem generateMetadata). `paused` thì 404.
 */
export async function getLandingCampaign(slug: string): Promise<LandingCampaign | null> {
  const col = await campaigns();
  const doc = await col.findOne(
    { slug, status: { $in: ["active", "pending"] } },
    { projection: { slug: 1, token: 1, name: 1, status: 1, landing: 1, og: 1 } },
  );
  if (!doc) return null;

  return {
    slug: doc.slug,
    token: doc.token,
    name: doc.name,
    status: doc.status,
    landing: doc.landing,
    og: doc.og,
  };
}
