import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { ipHashSalt } from "@/lib/env";
import { parseUserAgent } from "@/lib/tracking/ua";
import type { ClickGeo } from "@/lib/types";

export const SUB_ID_PARAMS = [
  "sub_id1",
  "sub_id2",
  "sub_id3",
  "sub_id4",
  "sub_id5",
] as const;

const MAX_PARAM_LEN = 200;

/** Cắt độ dài mọi giá trị từ query — chống doc phình to trong M0 512MB. */
function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_PARAM_LEN);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Hash IP với salt. IP là PII — không bao giờ lưu thô.
 * Hash vẫn cho phép đếm unique/chống fraud mà không giữ định danh.
 */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(`${ip}|${ipHashSalt()}`).digest("hex");
}

function clientIp(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

/** Geo lấy từ header Vercel Edge Network — miễn phí, không cần GeoIP DB. */
export function readGeo(req: NextRequest): ClickGeo {
  const decode = (v: string | null) => {
    if (!v) return undefined;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: req.headers.get("x-vercel-ip-country") ?? undefined,
    region: req.headers.get("x-vercel-ip-country-region") ?? undefined,
    city: decode(req.headers.get("x-vercel-ip-city")),
  };
}

export interface ClickContext {
  source: string;
  subIds: Partial<
    Record<"subId1" | "subId2" | "subId3" | "subId4" | "subId5", string>
  >;
  geo: ClickGeo;
  device: ReturnType<typeof parseUserAgent>["device"];
  browser: string;
  os: string;
  referrer?: string;
  ipHash?: string;
  userAgent?: string;
}

export function readClickContext(req: NextRequest): ClickContext {
  const params = req.nextUrl.searchParams;
  const ua = req.headers.get("user-agent");
  const parsed = parseUserAgent(ua);

  const subIds: ClickContext["subIds"] = {};
  SUB_ID_PARAMS.forEach((param, index) => {
    const value = clean(params.get(param));
    if (value) subIds[`subId${index + 1}` as keyof ClickContext["subIds"]] = value;
  });

  return {
    source: clean(params.get("source")) ?? clean(params.get("utm_source")) ?? "direct",
    subIds,
    geo: readGeo(req),
    device: parsed.device,
    browser: parsed.browser,
    os: parsed.os,
    referrer: clean(req.headers.get("referer")),
    ipHash: hashIp(clientIp(req)),
    userAgent: ua?.slice(0, MAX_PARAM_LEN) ?? undefined,
  };
}
