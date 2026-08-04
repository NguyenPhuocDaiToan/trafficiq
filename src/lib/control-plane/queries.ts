import { ObjectId } from "mongodb";
import {
  advertisers,
  campaigns,
  destinations,
  offers,
} from "@/lib/db/collections";
import type { CampaignLanding, CampaignOg, EntityStatus } from "@/lib/types";

/** View model đã serialize (ObjectId -> string) để truyền xuống client component. */
export interface AdvertiserView {
  id: string;
  name: string;
  contactEmail?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
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
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export interface DestinationView {
  id: string;
  url: string;
  category: string;
  status: EntityStatus;
  advertiserName: string;
  updatedAt: string;
}

export async function listDestinations(): Promise<DestinationView[]> {
  const col = await destinations();
  const docs = await col
    .aggregate<{
      _id: ObjectId;
      url: string;
      category: string;
      status: EntityStatus;
      updatedAt: Date;
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
    updatedAt: doc.updatedAt.toISOString(),
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

/** Campaign đầy đủ để nạp vào form sửa. */
export interface CampaignEditView {
  id: string;
  name: string;
  slug: string;
  token: string;
  status: EntityStatus;
  advertiserId: string;
  landing: CampaignLanding;
  og: CampaignOg;
}

/**
 * Lấy một campaign theo id để sửa / xem trước.
 *
 * KHÔNG lọc theo status — khác `getLandingCampaign` (chỉ nhận active|pending).
 * Đó là điểm chính: campaign `paused` phải xem và sửa được, vì tạm dừng chính là
 * lúc người ta cần mở ra sửa rồi chạy lại. Lọc status ở đây là tự khoá mình khỏi
 * nội dung của chính mình.
 */
export async function getCampaignById(id: string): Promise<CampaignEditView | null> {
  if (!ObjectId.isValid(id)) return null;

  const col = await campaigns();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    token: doc.token,
    status: doc.status,
    advertiserId: doc.advertiserId.toString(),
    landing: doc.landing,
    og: doc.og,
  };
}

/**
 * Dropdown đối tác cho form SỬA: advertiser đang active, CỘNG advertiser hiện tại
 * của campaign nếu nó không còn active.
 *
 * Vì sao phải cộng thêm: `listActiveOptions` chỉ trả advertiser active. Nếu đối
 * tác của campaign này đã bị tạm dừng thì nó không có trong danh sách, `<select>`
 * rơi về option đầu tiên, và một lần bấm Lưu sẽ ĐỔI ĐỐI TÁC của campaign mà admin
 * không hề chọn — mất luôn dấu vết ai là chủ chiến dịch.
 */
export async function listAdvertiserOptionsForEdit(
  currentAdvertiserId: string,
): Promise<{ id: string; name: string }[]> {
  const col = await advertisers();
  const docs = await col
    .find(
      {
        $or: [
          { status: "active" },
          ...(ObjectId.isValid(currentAdvertiserId)
            ? [{ _id: new ObjectId(currentAdvertiserId) }]
            : []),
        ],
      },
      { projection: { name: 1, status: 1 } },
    )
    .sort({ name: 1 })
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    // Nói rõ đối tác không còn chạy, thay vì để nó trông như một lựa chọn bình thường.
    name: doc.status === "active" ? doc.name : `${doc.name} (${doc.status === "paused" ? "đã tạm dừng" : "chờ duyệt"})`,
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
