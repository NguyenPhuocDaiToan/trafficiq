import { z } from "zod";

export const statusSchema = z.enum(["pending", "active", "paused"]);

export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "ObjectId không hợp lệ");

export const advertiserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactEmail: z.email().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Validate URL đích trước khi vào whitelist.
 * Chỉ http/https — chặn javascript:, data:, file: ngay từ cửa vào.
 */
export const destinationSchema = z.object({
  advertiserId: objectIdSchema,
  url: z
    .string()
    .trim()
    .min(8)
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          url.hostname.length > 0
        );
      } catch {
        return false;
      }
    }, "URL phải là http(s) hợp lệ"),
  category: z.string().trim().min(2).max(60),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  advertiserId: objectIdSchema,
  slug: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine(
      (value) => /^[a-z0-9-]{3,60}$/.test(value),
      "Slug chỉ gồm a-z, 0-9, dấu gạch ngang (3–60 ký tự)",
    ),
  headline: z.string().trim().min(3).max(140),
  subheadline: z.string().trim().max(200).optional().or(z.literal("")),
  /*
   * Thân bài HTML từ editor WYSIWYG.
   *
   * Giới hạn 20000 ký tự (không phải 2000 như bản textarea cũ) vì thẻ HTML tự nó
   * đã ăn hết vài nghìn ký tự: một danh sách 6 bullet là ~200 ký tự thẻ. Đây là
   * chặn trên chống dán cả một trang web vào, KHÔNG phải hạn mức nội dung —
   * density 4/10 của landing mới là thứ giới hạn độ dài thật.
   *
   * Zod chỉ kiểm ĐỘ DÀI. Việc lọc thẻ do `sanitizeLandingBody` làm ở action —
   * đừng cố validate HTML bằng regex ở đây.
   */
  bodyHtml: z.string().trim().max(20000).optional().or(z.literal("")),
  ctaLabel: z.string().trim().min(2).max(60),
  heroImageUrl: z.url().trim().optional().or(z.literal("")),
  autoRedirectSeconds: z.coerce.number().int().min(0).max(10).default(0),
  ogTitle: z.string().trim().min(3).max(140),
  ogDescription: z.string().trim().min(3).max(300),
  ogImageUrl: z.url().trim().optional().or(z.literal("")),
});

/**
 * Sửa campaign: cùng field với lúc tạo, thêm `id`.
 *
 * Dùng `.extend` trên chính `campaignSchema` chứ không khai lại: hai schema tách
 * rời sẽ lệch nhau ngay lần thêm field kế tiếp, và lệch ở đây có nghĩa là form
 * sửa âm thầm bỏ mất một field mà form tạo có.
 *
 * `token` KHÔNG có trong schema và sẽ không bao giờ có: nó là link đã đem đi chạy
 * traffic, và mọi `clickEvent` lịch sử neo vào campaign qua nó.
 */
export const campaignUpdateSchema = campaignSchema.extend({
  id: objectIdSchema,
});

export const offerSchema = z.object({
  campaignId: objectIdSchema,
  destinationId: objectIdSchema,
  name: z.string().trim().min(2).max(120),
  weight: z.coerce.number().int().min(1).max(1000).default(1),
});

export const statusChangeSchema = z.object({
  id: objectIdSchema,
  status: statusSchema,
});

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };
