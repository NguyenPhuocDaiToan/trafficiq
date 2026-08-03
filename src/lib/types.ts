import type { ObjectId } from "mongodb";

export type EntityStatus = "pending" | "active" | "paused";

export interface Advertiser {
  _id?: ObjectId;
  name: string;
  contactEmail?: string;
  status: EntityStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WHITELIST URL đích. Redirect chỉ được phép trỏ tới URL có trong đây.
 * Không bao giờ 302 tới URL lấy từ query param (open-redirect).
 */
export interface Destination {
  _id?: ObjectId;
  advertiserId: ObjectId;
  url: string;
  category: string;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignLanding {
  headline: string;
  subheadline?: string;
  bodyText?: string;
  ctaLabel: string;
  heroImageUrl?: string;
}

export interface CampaignOg {
  title: string;
  description: string;
  imageUrl?: string;
}

export interface Campaign {
  _id?: ObjectId;
  /** Slug công khai của landing: /c/[slug] */
  slug: string;
  /** Token mờ (opaque) của redirect: /go/[token]. Không đoán được, không lộ id. */
  token: string;
  name: string;
  advertiserId: ObjectId;
  status: EntityStatus;
  landing: CampaignLanding;
  og: CampaignOg;
  createdAt: Date;
  updatedAt: Date;
}

/** Ánh xạ campaign ↔ destination. `weight` để dành cho A/B split sau này. */
export interface Offer {
  _id?: ObjectId;
  campaignId: ObjectId;
  destinationId: ObjectId;
  name: string;
  weight: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClickGeo {
  country?: string;
  region?: string;
  city?: string;
}

/** Append-only. Có TTL index trên `ts`. */
export interface ClickEvent {
  _id?: ObjectId;
  /** UUID — khóa nối clickEvents ↔ conversions. */
  clickId: string;
  ts: Date;
  campaignId: ObjectId;
  offerId: ObjectId;
  destinationId: ObjectId;
  source: string;
  subId1?: string;
  subId2?: string;
  subId3?: string;
  subId4?: string;
  subId5?: string;
  geo: ClickGeo;
  device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  browser: string;
  os: string;
  referrer?: string;
  /** sha256(ip + salt) — không lưu IP thô. */
  ipHash?: string;
  userAgent?: string;
}

export interface Conversion {
  _id?: ObjectId;
  /** unique index → postback idempotent. */
  clickId: string;
  ts: Date;
  payout: number;
  currency: string;
  status: "approved" | "pending" | "rejected";
  transactionId?: string;
  /** Denormalize để aggregation không phải $lookup. */
  campaignId?: ObjectId;
  source?: string;
  raw?: Record<string, string>;
}

/**
 * Tin nhắn từ form ở /lien-he.
 *
 * KHÔNG có TTL: đây là thư của người thật, xóa tự động sau 30 ngày là mất liên hệ.
 * Cùng luật PII với clickEvents — chỉ lưu `ipHash`, không lưu IP thô.
 */
export interface ContactMessage {
  _id?: ObjectId;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: Date;
  /** Đã đọc/xử lý chưa — đánh dấu trong hộp thư ở admin. */
  handled: boolean;
  /** sha256(ip + salt), để lần ra spam theo nguồn mà không lưu IP. */
  ipHash?: string;
  userAgent?: string;
}

/** Tổng hợp giờ × campaign × source × country. Giữ dài hạn thay cho raw. */
export interface Rollup {
  _id?: ObjectId;
  hour: Date;
  campaignId: ObjectId;
  source: string;
  country: string;
  clicks: number;
  conversions: number;
  payout: number;
  updatedAt: Date;
}
