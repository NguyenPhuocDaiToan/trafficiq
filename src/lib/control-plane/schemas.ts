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
  bodyText: z.string().trim().max(2000).optional().or(z.literal("")),
  ctaLabel: z.string().trim().min(2).max(60),
  heroImageUrl: z.url().trim().optional().or(z.literal("")),
  ogTitle: z.string().trim().min(3).max(140),
  ogDescription: z.string().trim().min(3).max(300),
  ogImageUrl: z.url().trim().optional().or(z.literal("")),
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
