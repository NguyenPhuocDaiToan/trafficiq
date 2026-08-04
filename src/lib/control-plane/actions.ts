"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  advertisers,
  campaigns,
  destinations,
  offers,
} from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/tracking/emit";
import { sanitizeLandingBody } from "@/lib/landing/sanitize-body";
import { invalidateRouteCache } from "@/lib/redirect/resolve";
import { slugify } from "@/lib/slug";
import {
  advertiserSchema,
  campaignSchema,
  campaignUpdateSchema,
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
  const raw = fields(formData);

  /*
   * Đường dẫn để trống => suy ra từ tên.
   *
   * Client đã điền sẵn khi admin gõ tên, nên nhánh này chạy khi JS chưa tải — và
   * đó chính là lý do nó phải tồn tại: field `slug` ở form tạo KHÔNG có `required`
   * để không chặn luồng no-JS. Dùng đúng `slugify` mà client dùng, nếu không thì
   * bật/tắt JS cho ra hai đường dẫn khác nhau cho cùng một tên.
   */
  if (!raw.slug || raw.slug.trim().length === 0) {
    const derived = slugify(raw.name ?? "");
    if (derived.length < 3) {
      // Tên toàn ký tự không phải a-z0-9 (ví dụ chỉ tiếng Nhật) — nói rõ thay vì
      // để zod trả "slug: Slug chỉ gồm a-z…" cho một field admin không hề nhập.
      return {
        ok: false,
        error:
          "Không sinh được đường dẫn từ tên này. Nhập đường dẫn tĩnh bằng tay (a-z, 0-9, dấu gạch ngang).",
      };
    }
    raw.slug = derived;
  }

  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const data = parsed.data;
  const now = new Date();
  const col = await campaigns();

  // Khai ngoài try để dùng được ở nhánh redirect bên dưới (redirect phải nằm
  // ngoài try/catch vì nó throw).
  let campaignId: string;

  try {
    const inserted = await col.insertOne({
      slug: data.slug,
      token: generateToken(),
      name: data.name,
      advertiserId: new ObjectId(data.advertiserId),
      status: "pending",
      landing: {
        headline: data.headline,
        subheadline: optional(data.subheadline),
        // Cùng sanitizer với updateCampaign — hai đường ghi khác nhau vào cùng
        // một field render bằng dangerouslySetInnerHTML là chỗ chắc chắn sẽ sót.
        bodyHtml: sanitizeLandingBody(data.bodyHtml),
        ctaLabel: data.ctaLabel,
        heroImageUrl: optional(data.heroImageUrl),
        autoRedirectSeconds: data.autoRedirectSeconds > 0 ? data.autoRedirectSeconds : undefined,
      },
      og: {
        title: data.ogTitle,
        description: data.ogDescription,
        imageUrl: optional(data.ogImageUrl),
      },
      createdAt: now,
      updatedAt: now,
    });
    campaignId = inserted.insertedId.toString();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Đường dẫn "${data.slug}" đã được dùng` };
    }
    throw err;
  }

  revalidatePath("/admin/campaigns");

  /*
   * `redirect` throw nên mọi nhánh dưới đây phải nằm NGOÀI try/catch ở trên.
   *
   * Nhánh "Tạo và xem trước": chiến dịch mới luôn ở trạng thái `pending`, tức nó
   * ĐÃ là bản nháp — nên xem trước lúc tạo không cần cơ chế nháp riêng, chỉ cần
   * lưu rồi mở đúng trang xem trước đang có. Làm cách này thì preview lúc tạo và
   * preview lúc sửa là một code path; dựng một bản render riêng cho nội dung chưa
   * lưu là tự tạo ra hai bản sẽ lệch nhau.
   */
  if (raw.afterCreate === "preview") {
    redirect(`/admin/campaigns/${campaignId}/preview`);
  }

  /*
   * Nhánh mặc định: về danh sách — ở lại trang tạo với một form rỗng thì không
   * thấy chiến dịch vừa tạo, và việc tiếp theo (thêm đích chuyển hướng) nằm ở
   * danh sách. Slug đi kèm để danh sách bung sẵn đúng chiến dịch này.
   */
  redirect(`/admin/campaigns?new=${data.slug}`);
}

/**
 * Sửa campaign đang có.
 *
 * `token` và `status` KHÔNG nằm trong schema nên không bao giờ bị sửa ở đây:
 * token là link đã đem đi chạy traffic, status có công tắc riêng ở danh sách.
 *
 * Ba chỗ dễ sai, đều đã xử lý bên dưới:
 *  1. slug đổi → phải revalidate CẢ đường dẫn cũ, không chỉ đường mới.
 *  2. slug đổi → phải `invalidateRouteCache(token)` vì `ResolvedRoute` mang theo
 *     `slug` (xem resolve.ts), cache in-memory sẽ giữ slug cũ tới 60s.
 *  3. slug trùng campaign khác → duplicate key, phải bắt như lúc tạo.
 */
export async function updateCampaign(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = campaignUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const data = parsed.data;
  const col = await campaigns();

  // Cần slug + token CŨ trước khi ghi: sau khi ghi thì không còn biết đường dẫn
  // nào phải revalidate.
  const before = await col.findOne(
    { _id: new ObjectId(data.id) },
    { projection: { slug: 1, token: 1 } },
  );
  if (!before) return { ok: false, error: "Không tìm thấy chiến dịch" };

  /*
   * Lọc thẻ HTML TẠI ĐÂY, trước khi ghi xuống Mongo. Đây là điểm duy nhất được
   * phép ghi `landing.bodyHtml` — nội dung đó render bằng
   * `dangerouslySetInnerHTML` trên một trang công khai, nên sanitize ở tầng render
   * là quá muộn (mọi đường đọc khác sẽ bỏ sót).
   */
  const bodyHtml = sanitizeLandingBody(data.bodyHtml);

  try {
    await col.updateOne(
      { _id: new ObjectId(data.id) },
      {
        $set: {
          slug: data.slug,
          name: data.name,
          advertiserId: new ObjectId(data.advertiserId),
          landing: {
            headline: data.headline,
            subheadline: optional(data.subheadline),
            bodyHtml,
            ctaLabel: data.ctaLabel,
            heroImageUrl: optional(data.heroImageUrl),
            autoRedirectSeconds: data.autoRedirectSeconds > 0 ? data.autoRedirectSeconds : undefined,
          },
          og: {
            title: data.ogTitle,
            description: data.ogDescription,
            imageUrl: optional(data.ogImageUrl),
          },
          updatedAt: new Date(),
        },
        /*
         * KHÔNG thêm `$unset: { "landing.bodyText": "" }` ở đây, dù mục tiêu là
         * bỏ field @deprecated đó:
         *
         *  1. Không cần — `$set` ở trên thay THẾ cả subdocument `landing`, nên
         *     `bodyText` biến mất sẵn. Đó cũng là cách dữ liệu cũ di trú: form sửa
         *     nạp `bodyHtml ?? bodyText` vào editor, lần lưu này ghi ra `bodyHtml`.
         *  2. Thêm vào là VỠ — MongoDB từ chối update có hai operator chồng path
         *     ("would create a conflict at 'landing'"), tức mọi lần lưu đều lỗi.
         */
      },
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: `Đường dẫn "${data.slug}" đã được chiến dịch khác dùng` };
    }
    throw err;
  }

  const slugChanged = before.slug !== data.slug;
  if (slugChanged) invalidateRouteCache(before.token);

  revalidatePath("/admin/campaigns");
  revalidatePath(`/c/${data.slug}`);
  if (slugChanged) revalidatePath(`/c/${before.slug}`);

  return {
    ok: true,
    message: slugChanged
      ? `Đã lưu. Đường dẫn đổi thành /c/${data.slug} — link /c/${before.slug} đã chia sẻ trước đây giờ không còn hoạt động.`
      : "Đã lưu thay đổi.",
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
