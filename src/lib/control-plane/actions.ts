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
import { ogVersion } from "@/lib/landing/share-link";
import { invalidateRouteCache } from "@/lib/redirect/resolve";
import {
  advertiserSchema,
  advertiserUpdateSchema,
  campaignSchema,
  campaignUpdateSchema,
  destinationSchema,
  destinationUpdateSchema,
  offerSchema,
  statusChangeSchema,
  type ActionResult,
} from "@/lib/control-plane/schemas";
import {
  DEFAULT_DESTINATION_CATEGORY,
  applyCreateDefaults,
  hostLabel,
  parseDestinationUrls,
  withSlugSuffix,
} from "@/lib/control-plane/campaign-defaults";
import { generateToken } from "@/lib/control-plane/token";
import { actorOf, requireUser } from "@/lib/auth/current-user";
import { acceptShareDomain } from "@/lib/domains/registry";

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
  await requireUser();
  const parsed = advertiserSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date();
  const col = await advertisers();
  await col.insertOne({
    name: parsed.data.name,
    contactEmail: optional(parsed.data.contactEmail),
    notes: optional(parsed.data.notes),
    // Đối tác mới chạy ngay: không còn bước duyệt tay. (Đối tác chỉ là nhãn gom đích; trạng thái của nó không
    // chặn redirect — công tắc Tạm dừng vẫn còn để ngưng một đối tác khi cần.)
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/admin/advertisers");
  return { ok: true, message: `Đã thêm đối tác "${parsed.data.name}"` };
}

export async function setAdvertiserStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
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

export async function updateAdvertiser(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = advertiserUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  // Ô để trống nghĩa là xoá giá trị đó (không lưu chuỗi rỗng vào Mongo). Hai operator ở hai path khác nhau.
  const unset: Record<string, ""> = {};
  if (!optional(data.contactEmail)) unset.contactEmail = "";
  if (!optional(data.notes)) unset.notes = "";

  const result = await (await advertisers()).updateOne(
    { _id: new ObjectId(data.id) },
    {
      $set: {
        name: data.name,
        ...(optional(data.contactEmail) ? { contactEmail: data.contactEmail } : {}),
        ...(optional(data.notes) ? { notes: data.notes } : {}),
        updatedAt: new Date(),
      },
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Không tìm thấy đối tác" };

  revalidatePath("/admin/advertisers");
  revalidatePath("/admin/destinations");
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `Đã lưu đối tác "${data.name}"` };
}

// --------------------------------------------------------------- destinations

export async function createDestination(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = destinationSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date();
  const col = await destinations();
  try {
    await col.insertOne({
      advertiserId: new ObjectId(parsed.data.advertiserId),
      url: parsed.data.url,
      category: parsed.data.category,
      // Chạy ngay: không còn bước duyệt tay. Luật kiểm URL (chỉ http/https) vẫn là `destinationSchema` ở trên.
      status: "active",
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
  invalidateRouteCache();
  return { ok: true, message: "Đã thêm URL đích — dùng được ngay." };
}

export async function setDestinationStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
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

/**
 * Sửa URL đích. Đây là chỗ thay đổi nơi traffic đang chảy tới, nên có ba điều cần giữ:
 *  - Luật kiểm URL là `destinationSchema` (chỉ http/https) — cùng luật với lúc tạo, không có đường sửa nào
 *    được lách qua nó (bất biến 3: redirect chỉ tới URL trong whitelist).
 *  - Trạng thái KHÔNG đổi theo: đích đang chạy vẫn chạy, nhưng về URL mới. Muốn tạm dừng thì dùng công tắc.
 *  - `invalidateRouteCache()` (xoá cả cache): routing map của mọi campaign dùng đích này mang theo URL cũ, và
 *    nó nằm trong RAM của instance tới 60 giây (bất biến 8).
 */
export async function updateDestination(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = destinationUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  try {
    const result = await (await destinations()).updateOne(
      { _id: new ObjectId(data.id) },
      {
        $set: {
          advertiserId: new ObjectId(data.advertiserId),
          url: data.url,
          category: data.category,
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Không tìm thấy URL đích" };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "URL này đã có trong whitelist" };
    }
    throw err;
  }

  invalidateRouteCache();
  revalidatePath("/admin/destinations");
  revalidatePath("/admin/campaigns");
  return {
    ok: true,
    message: "Đã lưu. Link đang chạy dùng đích này sẽ chuyển tới URL mới trong tối đa khoảng 1 phút.",
  };
}

// ------------------------------------------------------------------ campaigns

/**
 * Đối tác cho chiến dịch mới. Người tạo không phải chọn: nếu họ không chọn thì suy ra từ URL đích.
 *   1. Đã chọn → dùng (phải tồn tại).
 *   2. Một URL đích đã có sẵn trong whitelist → dùng đối tác của nó.
 *   3. Đã có đối tác tên đúng bằng tên miền của URL → dùng.
 *   4. Chưa có gì → tạo đối tác mới tên là tên miền, ĐANG CHẠY (không còn bước duyệt tay).
 */
async function resolveAdvertiserId(
  requested: string | undefined,
  existingDestinationAdvertiser: ObjectId | undefined,
  host: string,
): Promise<{ ok: true; id: ObjectId } | { ok: false; error: string }> {
  const col = await advertisers();

  if (requested && requested.trim().length > 0) {
    if (!/^[a-f0-9]{24}$/i.test(requested)) return { ok: false, error: "Đối tác không hợp lệ" };
    const found = await col.findOne({ _id: new ObjectId(requested) }, { projection: { _id: 1 } });
    return found ? { ok: true, id: found._id } : { ok: false, error: "Không tìm thấy đối tác đã chọn" };
  }
  if (existingDestinationAdvertiser) return { ok: true, id: existingDestinationAdvertiser };

  const name = host || "Đối tác mới";
  const byName = await col.findOne({ name }, { projection: { _id: 1 } });
  if (byName) return { ok: true, id: byName._id };

  const now = new Date();
  const inserted = await col.insertOne({ name, status: "active", createdAt: now, updatedAt: now });
  return { ok: true, id: inserted.insertedId };
}

/**
 * TẠO chiến dịch — chỉ cần ảnh và URL đích, mọi thứ khác hệ thống tự điền (`campaign-defaults.ts`).
 *
 * Chiến dịch tạo xong CHẠY NGAY: trạng thái `active`, URL đích và đối tác mới cũng `active`. Trước đây mọi thứ vào
 * ở `pending` và phải bấm "Kích hoạt" ba lần (đối tác, URL, chiến dịch) trước khi link chạy; chủ dự án đã quyết bỏ
 * bước duyệt tay đó. Hệ quả cần nhớ: whitelist đích (bất biến 3) giờ được nạp ngay khi tạo chiến dịch, nên luật
 * duy nhất giữ `javascript:`/`data:` ra ngoài là `destinationSchema` — mọi URL đi qua nó, KHÔNG có nhánh nào bỏ qua.
 *
 * Thứ tự ghi để một lần tạo hỏng không để lại chiến dịch "đang chạy mà không có đích": URL đích → offer (với
 * `campaignId` cấp sẵn) → CHIẾN DỊCH. Chiến dịch ghi cuối cùng; nếu nó lỗi (trùng đường dẫn) thì xoá các offer vừa
 * ghi. Đối tác/URL đích đã tạo ở bước trước được giữ lại — chúng hợp lệ và dùng lại được.
 */
export async function createCampaign(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const input = fields(formData);

  // 1. URL đích: bắt buộc, mỗi URL qua `destinationSchema` (luật http/https duy nhất).
  const list = parseDestinationUrls(input.destinationUrls);
  if (!list.ok) return { ok: false, error: list.error };
  for (const url of list.urls) {
    const check = destinationSchema.shape.url.safeParse(url);
    if (!check.success) return { ok: false, error: `URL đích không hợp lệ: ${url.slice(0, 80)} — chỉ nhận http hoặc https.` };
  }
  const urls = list.urls;
  const host = hostLabel(urls[0]);

  // 2. Điền field trống, rồi kiểm toàn bộ bằng `campaignSchema`. `advertiserId` chưa biết (có thể phải tạo mới)
  // nên dùng giá trị giữ chỗ để kiểm phần còn lại trước — chưa ghi gì xuống DB nếu form sai.
  const { raw, slugAuto } = applyCreateDefaults(input, urls[0]);
  const requestedAdvertiser = raw.advertiserId;
  const parsed = campaignSchema.safeParse({
    ...raw,
    advertiserId: /^[a-f0-9]{24}$/i.test(requestedAdvertiser ?? "") ? requestedAdvertiser : "0".repeat(24),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;

  const domain = await acceptShareDomain(data.shareDomain);
  if (!domain.ok) return { ok: false, error: domain.error };

  // 3. URL đích: dùng lại cái đã có, tạo cái mới (active). Đích đang tạm dừng mà người ta chủ động nhập lại vào
  // chiến dịch mới thì bật lại — ý định rõ ràng; số lượng được báo ở thông báo sau khi tạo.
  const destCol = await destinations();
  const existing = await destCol.find({ url: { $in: urls } }).toArray();
  const byUrl = new Map(existing.map((d) => [d.url, d]));

  const advertiser = await resolveAdvertiserId(
    requestedAdvertiser,
    urls.map((u) => byUrl.get(u)?.advertiserId).find((id) => id !== undefined),
    host,
  );
  if (!advertiser.ok) return { ok: false, error: advertiser.error };

  const now = new Date();
  let reactivated = 0;
  const destinationIds: { id: ObjectId; url: string }[] = [];
  for (const url of urls) {
    const found = byUrl.get(url);
    if (found) {
      if (found.status !== "active") {
        await destCol.updateOne({ _id: found._id }, { $set: { status: "active", updatedAt: now } });
        reactivated += 1;
      }
      destinationIds.push({ id: found._id as ObjectId, url });
      continue;
    }
    try {
      const inserted = await destCol.insertOne({
        advertiserId: advertiser.id,
        url,
        category: DEFAULT_DESTINATION_CATEGORY,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      destinationIds.push({ id: inserted.insertedId, url });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Hai người cùng thêm một URL một lúc: lấy bản vừa được ghi.
      const raced = await destCol.findOne({ url });
      if (!raced) throw err;
      destinationIds.push({ id: raced._id as ObjectId, url });
    }
  }

  // 4. Offer (cấp sẵn campaignId) rồi tới chiến dịch.
  const campaignId = new ObjectId();
  const offersCol = await offers();
  const offerDocs = destinationIds.map(({ id, url }) => ({
    campaignId,
    destinationId: id,
    name: hostLabel(url) || "Đích",
    weight: 1,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  }));
  const insertedOffers = await offersCol.insertMany(offerDocs);

  const col = await campaigns();
  let slug = data.slug;
  let savedSlug: string | undefined;

  // `redirect` throw nên mọi nhánh redirect phải nằm NGOÀI try/catch.
  for (let attempt = 0; attempt < 4 && !savedSlug; attempt += 1) {
    try {
      await col.insertOne({
        _id: campaignId,
        slug,
        token: generateToken(),
        name: data.name,
        advertiserId: advertiser.id,
        status: "active",
        landing: {
          headline: data.headline,
          subheadline: optional(data.subheadline),
          // Cùng sanitizer với updateCampaign — hai đường ghi khác nhau vào cùng một field render bằng
          // dangerouslySetInnerHTML là chỗ chắc chắn sẽ sót.
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
        ...(domain.host ? { shareDomain: domain.host } : {}),
        createdBy: actorOf(user),
        updatedBy: actorOf(user),
        createdAt: now,
        updatedAt: now,
      });
      savedSlug = slug;
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        await offersCol.deleteMany({ _id: { $in: Object.values(insertedOffers.insertedIds) } });
        throw err;
      }
      // Đường dẫn do ta sinh mà trùng → thêm đuôi và thử lại. Đường dẫn người dùng tự gõ thì báo lỗi: tự đổi nó
      // là đổi địa chỉ người ta đã chọn.
      if (!slugAuto) {
        await offersCol.deleteMany({ _id: { $in: Object.values(insertedOffers.insertedIds) } });
        return { ok: false, error: `Đường dẫn "${slug}" đã được dùng` };
      }
      slug = withSlugSuffix(data.slug);
    }
  }
  if (!savedSlug) {
    await offersCol.deleteMany({ _id: { $in: Object.values(insertedOffers.insertedIds) } });
    return { ok: false, error: "Không tạo được đường dẫn riêng cho chiến dịch. Thử lại hoặc nhập đường dẫn tay." };
  }

  // Routing map trong RAM chưa biết token mới (cache miss 15 giây) và URL đích có thể vừa được bật lại.
  invalidateRouteCache();
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/destinations");
  revalidatePath("/admin/advertisers");

  /*
   * Nhánh "Tạo và xem trước": mở trang xem trước đang có (cùng một code path với lúc sửa — không dựng bản render
   * riêng cho nội dung chưa lưu, vì đó là bản render thứ hai sẽ lệch khỏi trang thật). Chiến dịch đã chạy rồi nên
   * "xem trước" chỉ là xem, không còn nghĩa là "bản nháp".
   */
  if (raw.afterCreate === "preview") {
    redirect(`/admin/campaigns/${campaignId.toString()}/preview`);
  }

  // Về LẠI trang tạo (không phải danh sách): trang đó hiện link vừa tạo để sao chép và form trống sẵn cho lần
  // kế tiếp — người dùng chủ yếu tạo nhiều chiến dịch liên tiếp, mỗi lần đi qua danh sách là một lần bấm thừa.
  redirect(`/admin/campaigns/new?created=${savedSlug}${reactivated > 0 ? `&reactivated=${reactivated}` : ""}`);
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
  const user = await requireUser();
  const parsed = campaignUpdateSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const data = parsed.data;
  const col = await campaigns();

  // Cần slug + token CŨ trước khi ghi: sau khi ghi thì không còn biết đường dẫn
  // nào phải revalidate.
  const before = await col.findOne(
    { _id: new ObjectId(data.id) },
    { projection: { slug: 1, token: 1, og: 1, shareDomain: 1 } },
  );
  if (!before) return { ok: false, error: "Không tìm thấy chiến dịch" };

  const domain = await acceptShareDomain(data.shareDomain, before.shareDomain);
  if (!domain.ok) return { ok: false, error: domain.error };

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
          updatedBy: actorOf(user),
          updatedAt: new Date(),
          ...(domain.host ? { shareDomain: domain.host } : {}),
        },
        // Form sửa luôn gửi field này (kể cả rỗng = tên miền chính), nên rỗng nghĩa là gỡ. Hai operator ở
        // hai path khác nhau (`shareDomain` vs `landing`/`og`) nên không đụng nhau.
        ...(domain.host ? {} : { $unset: { shareDomain: "" } }),
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

  // Thẻ chia sẻ (tiêu đề/mô tả/ảnh) có đổi không? Nếu có, link ĐÃ đăng trước đây có thể còn hiện
  // thẻ cũ ở X/Facebook (họ lưu theo URL) — người dùng chỉ đi gửi link nên phải được báo ngay lúc
  // lưu, cùng mã mới để copy lại. Xem `lib/landing/share-link.ts`.
  const versionBefore = before.og ? ogVersion(before.og) : undefined;
  const versionAfter = ogVersion({
    title: data.ogTitle,
    description: data.ogDescription,
    imageUrl: optional(data.ogImageUrl),
  });
  const cardChanged = versionBefore !== undefined && versionBefore !== versionAfter;

  const slugChanged = before.slug !== data.slug;
  if (slugChanged) invalidateRouteCache(before.token);

  revalidatePath("/admin/campaigns");
  revalidatePath(`/c/${data.slug}`);
  if (slugChanged) revalidatePath(`/c/${before.slug}`);

  const saved = slugChanged
    ? `Đã lưu. Đường dẫn đổi thành /c/${data.slug} — link /c/${before.slug} đã chia sẻ trước đây giờ không còn hoạt động.`
    : "Đã lưu thay đổi.";
  return {
    ok: true,
    message: cardChanged
      ? `${saved} Thẻ chia sẻ đã đổi: dùng link có đuôi ?v=${versionAfter} khi đăng lên X/Facebook. Link đã đăng trước đây có thể còn hiện thẻ cũ.`
      : saved,
  };
}

export async function setCampaignStatus(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
