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
  /**
   * Thân bài dạng HTML đã sanitize (`sanitizeLandingBody`). Đây là field đang
   * dùng — soạn bằng editor WYSIWYG ở /admin/campaigns/[id]/edit.
   *
   * KHÔNG BAO GIỜ ghi HTML thô từ form xuống field này. Nó được render bằng
   * `dangerouslySetInnerHTML` trên một trang công khai.
   */
  bodyHtml?: string;
  /**
   * @deprecated Thân bài phẳng của bản đầu, render bằng `split("\n")`.
   *
   * Còn giữ để campaign tạo trước khi có editor không mất nội dung. Renderer ưu
   * tiên `bodyHtml`; chỉ rơi về đây khi `bodyHtml` chưa có. Lần đầu admin mở
   * trang sửa, giá trị này được nạp vào editor và lần lưu sau sẽ thành `bodyHtml`.
   * Không ghi mới vào field này.
   */
  bodyText?: string;
  ctaLabel: string;
  heroImageUrl?: string;
  /** Tự động chuyển hướng tới CTA sau X giây (0 = tắt) */
  autoRedirectSeconds?: number;
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
/**
 * Lý do một request bị CHẶN ở `/go/[token]` — chỉ những tín hiệu đủ mạnh để
 * coi là crawler thật. Xem `lib/tracking/ua.ts`.
 */
export type BotReason = "ua-regex" | "twitter-asn";

/**
 * Tín hiệu đáng ngờ nhưng KHÔNG đủ để chặn: được ghi lại để đo, request vẫn
 * đi tiếp bình thường. Xem comment ở `botReason()`/`weakSignals()`.
 */
export type WeakSignal = "no-accept-language";

export interface ClickEvent {
  _id?: ObjectId;
  /** UUID — khóa nối clickEvents ↔ conversions. */
  clickId: string;
  ts: Date;
  campaignId: ObjectId;
  /**
   * Vắng mặt ở bản ghi bot: request bị chặn trước bước `pickCandidate()` nên
   * không có offer/destination nào được chọn. Đừng điền giá trị giả để cho
   * "đủ field" — bot không đi tới destination nào cả.
   */
  offerId?: ObjectId;
  destinationId?: ObjectId;
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
  /**
   * Chỉ có ở bản ghi `device: "bot"` — vì sao request bị chặn. Không có field
   * này thì traffic bị chặn biến mất im lặng và không ai trả lời được câu
   * "click của tôi đi đâu mất".
   */
  botReason?: BotReason;
  /** Ghi để đo, KHÔNG dùng để lọc. Rỗng thì bỏ trắng cho nhẹ doc. */
  weakSignals?: WeakSignal[];
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
