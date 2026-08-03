"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  advertisers,
  campaigns,
  destinations,
  offers,
} from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/tracking/emit";
import { invalidateRouteCache } from "@/lib/redirect/resolve";
import {
  advertiserSchema,
  campaignSchema,
  destinationSchema,
  offerSchema,
  statusChangeSchema,
  type ActionResult,
} from "@/lib/control-plane/schemas";
import { generateToken } from "@/lib/control-plane/token";

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".")}: ${issue.message}` : "Dữ liệu không hợp lệ";
}

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** "" -> undefined, để không lưu chuỗi rỗng vào Mongo. */
function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------- advertisers

export async function createAdvertiser(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = advertiserSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date();
  const col = await advertisers();
  await col.insertOne({
    name: parsed.data.name,
    contactEmail: optional(parsed.data.contactEmail),
    notes: optional(parsed.data.notes),
    // Đối tác mới luôn pending — phải review trước khi chạy traffic.
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/admin/advertisers");
  return { ok: true, message: `Đã tạo advertiser "${parsed.data.name}" (pending)` };
}

export async function setAdvertiserStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const col = await advertisers();
  await col.updateOne(
    { _id: new ObjectId(parsed.data.id) },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );

  revalidatePath("/admin/advertisers");
  return { ok: true, message: `Trạng thái advertiser → ${parsed.data.status}` };
}

// --------------------------------------------------------------- destinations

export async function createDestination(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = destinationSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date();
  const col = await destinations();
  try {
    await col.insertOne({
      advertiserId: new ObjectId(parsed.data.advertiserId),
      url: parsed.data.url,
      category: parsed.data.category,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "URL này đã có trong whitelist" };
    }
    throw err;
  }

  revalidatePath("/admin/destinations");
  return { ok: true, message: "Đã thêm destination (pending — cần activate để redirect được)" };
}

export async function setDestinationStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const col = await destinations();
  await col.updateOne(
    { _id: new ObjectId(parsed.data.id) },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );

  // Destination đổi trạng thái => routing map cũ sai. Xóa toàn bộ cache.
  invalidateRouteCache();
  revalidatePath("/admin/destinations");
  return { ok: true, message: `Trạng thái destination → ${parsed.data.status}` };
}

// ------------------------------------------------------------------ campaigns

export async function createCampaign(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = campaignSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const data = parsed.data;
  const now = new Date();
  const col = await campaigns();

  try {
    await col.insertOne({
      slug: data.slug,
      token: generateToken(),
      name: data.name,
      advertiserId: new ObjectId(data.advertiserId),
      status: "pending",
      landing: {
        headline: data.headline,
        subheadline: optional(data.subheadline),
        bodyText: optional(data.bodyText),
        ctaLabel: data.ctaLabel,
        heroImageUrl: optional(data.heroImageUrl),
      },
      og: {
        title: data.ogTitle,
        description: data.ogDescription,
        imageUrl: optional(data.ogImageUrl),
      },
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Slug "${data.slug}" đã được dùng` };
    }
    throw err;
  }

  revalidatePath("/admin/campaigns");
  return {
    ok: true,
    message: `Đã tạo campaign "${data.name}". Thêm offer rồi activate để link /go hoạt động.`,
  };
}

export async function setCampaignStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const col = await campaigns();
  const campaign = await col.findOneAndUpdate(
    { _id: new ObjectId(parsed.data.id) },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
    { returnDocument: "after", projection: { token: 1, slug: 1 } },
  );

  if (campaign?.token) invalidateRouteCache(campaign.token);
  revalidatePath("/admin/campaigns");
  if (campaign?.slug) revalidatePath(`/c/${campaign.slug}`);
  return { ok: true, message: `Trạng thái campaign → ${parsed.data.status}` };
}

// --------------------------------------------------------------------- offers

export async function createOffer(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = offerSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date();
  const offersCol = await offers();
  await offersCol.insertOne({
    campaignId: new ObjectId(parsed.data.campaignId),
    destinationId: new ObjectId(parsed.data.destinationId),
    name: parsed.data.name,
    weight: parsed.data.weight,
    // Offer active ngay: campaign status mới là công tắc chính.
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  invalidateRouteCache();
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `Đã thêm offer "${parsed.data.name}"` };
}

export async function setOfferStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const col = await offers();
  await col.updateOne(
    { _id: new ObjectId(parsed.data.id) },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );

  invalidateRouteCache();
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `Trạng thái offer → ${parsed.data.status}` };
}
