import type { ObjectId } from "mongodb";
import {
  advertisers,
  campaigns,
  destinations,
  offers,
} from "@/lib/db/collections";
import type { EntityStatus } from "@/lib/types";

/** View model đã serialize (ObjectId -> string) để truyền xuống client component. */
export interface AdvertiserView {
  id: string;
  name: string;
  contactEmail?: string;
  status: EntityStatus;
  createdAt: string;
}

export async function listAdvertisers(): Promise<AdvertiserView[]> {
  const col = await advertisers();
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    contactEmail: doc.contactEmail,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  }));
}

export interface DestinationView {
  id: string;
  url: string;
  category: string;
  status: EntityStatus;
  advertiserName: string;
}

export async function listDestinations(): Promise<DestinationView[]> {
  const col = await destinations();
  const docs = await col
    .aggregate<{
      _id: ObjectId;
      url: string;
      category: string;
      status: EntityStatus;
      advertiser: { name: string }[];
    }>([
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: "advertisers",
          localField: "advertiserId",
          foreignField: "_id",
          as: "advertiser",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
    ])
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    url: doc.url,
    category: doc.category,
    status: doc.status,
    advertiserName: doc.advertiser[0]?.name ?? "(đã xóa)",
  }));
}

export interface OfferView {
  id: string;
  name: string;
  weight: number;
  status: EntityStatus;
  destinationUrl: string;
  destinationStatus: EntityStatus;
}

export interface CampaignView {
  id: string;
  name: string;
  slug: string;
  token: string;
  status: EntityStatus;
  advertiserName: string;
  offers: OfferView[];
}

export async function listCampaigns(): Promise<CampaignView[]> {
  const col = await campaigns();
  const docs = await col
    .aggregate<{
      _id: ObjectId;
      name: string;
      slug: string;
      token: string;
      status: EntityStatus;
      advertiser: { name: string }[];
      offerList: {
        _id: ObjectId;
        name: string;
        weight: number;
        status: EntityStatus;
        destination: { url: string; status: EntityStatus }[];
      }[];
    }>([
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: "advertisers",
          localField: "advertiserId",
          foreignField: "_id",
          as: "advertiser",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "campaignId",
          as: "offerList",
          pipeline: [
            {
              $lookup: {
                from: "destinations",
                localField: "destinationId",
                foreignField: "_id",
                as: "destination",
                pipeline: [{ $project: { url: 1, status: 1 } }],
              },
            },
            { $project: { name: 1, weight: 1, status: 1, destination: 1 } },
          ],
        },
      },
    ])
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    token: doc.token,
    status: doc.status,
    advertiserName: doc.advertiser[0]?.name ?? "(đã xóa)",
    offers: doc.offerList.map((offer) => ({
      id: offer._id.toString(),
      name: offer.name,
      weight: offer.weight,
      status: offer.status,
      destinationUrl: offer.destination[0]?.url ?? "(đã xóa)",
      destinationStatus: offer.destination[0]?.status ?? "paused",
    })),
  }));
}

/** Dropdown: chỉ advertiser/destination đã active mới được gắn vào campaign. */
export async function listActiveOptions(): Promise<{
  advertisers: { id: string; name: string }[];
  destinations: { id: string; label: string }[];
}> {
  const [advertisersCol, destinationsCol] = await Promise.all([
    advertisers(),
    destinations(),
  ]);

  const [advertiserDocs, destinationDocs] = await Promise.all([
    advertisersCol
      .find({ status: "active" }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray(),
    destinationsCol
      .find({ status: "active" }, { projection: { url: 1, category: 1 } })
      .sort({ url: 1 })
      .toArray(),
  ]);

  return {
    advertisers: advertiserDocs.map((d) => ({ id: d._id.toString(), name: d.name })),
    destinations: destinationDocs.map((d) => ({
      id: d._id.toString(),
      label: `${d.url} [${d.category}]`,
    })),
  };
}

export async function countOffers(): Promise<number> {
  const col = await offers();
  return col.countDocuments({ status: "active" });
}
