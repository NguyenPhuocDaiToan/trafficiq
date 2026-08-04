import type { NextRequest } from "next/server";
import type { ClickEvent } from "@/lib/types";

type Device = ClickEvent["device"];

const BOT_UA_REGEX =
  /bot|crawler|spider|crawling|twitterbot|twittercardservice|facebookexternalhit|facebot|facebookcatalog|telegrambot|whatsapp|linkedinbot|pinterest|discordbot|slackbot|quora link preview|yahoo! slurp|bingbot|googlebot|duckduckgo|baiduspider|yandexbot|applebot|curl|wget|python|node-fetch|axios|go-http-client|headless/i;

/**
 * Kiểm tra đa tầng xem Request có phải từ Bot/Crawler hay không.
 */
export function isBotRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_UA_REGEX.test(ua)) return true;

  // Trình duyệt người dùng thật luôn gửi accept-language
  const acceptLang = req.headers.get("accept-language");
  if (!acceptLang || acceptLang.trim() === "") return true;

  // Vercel Edge Header: Twitter ASN 13414
  const asn = req.headers.get("x-vercel-ip-as-number");
  if (asn === "13414") return true;

  return false;
}

/**
 * Parse UA "đủ dùng" cho MVP, không dep ngoài.
 * Nếu cần chính xác hơn về sau: thay bằng ua-parser-js, interface không đổi.
 */
export function parseUserAgent(ua: string | null | undefined): {
  device: Device;
  browser: string;
  os: string;
} {
  if (!ua) return { device: "unknown", browser: "unknown", os: "unknown" };

  const s = ua.toLowerCase();

  if (BOT_UA_REGEX.test(s)) {
    return { device: "bot", browser: detectBrowser(s), os: detectOs(s) };
  }

  let device: Device = "desktop";
  if (/ipad|tablet|playbook|silk|kindle/.test(s) || (/android/.test(s) && !/mobile/.test(s))) {
    device = "tablet";
  } else if (/mobi|iphone|ipod|android|blackberry|windows phone|opera mini/.test(s)) {
    device = "mobile";
  }

  return { device, browser: detectBrowser(s), os: detectOs(s) };
}

function detectBrowser(s: string): string {
  // Thứ tự quan trọng: Edge/Opera/Samsung đều chứa "chrome" trong UA.
  if (/edg\//.test(s)) return "Edge";
  if (/opr\/|opera/.test(s)) return "Opera";
  if (/samsungbrowser/.test(s)) return "Samsung Internet";
  if (/fban|fbav|fb_iab/.test(s)) return "Facebook In-App";
  if (/instagram/.test(s)) return "Instagram In-App";
  if (/tiktok|bytelo/.test(s)) return "TikTok In-App";
  if (/zalo/.test(s)) return "Zalo In-App";
  if (/firefox|fxios/.test(s)) return "Firefox";
  if (/chrome|crios/.test(s)) return "Chrome";
  if (/safari/.test(s)) return "Safari";
  return "other";
}

function detectOs(s: string): string {
  if (/iphone|ipad|ipod|ios/.test(s)) return "iOS";
  if (/android/.test(s)) return "Android";
  if (/windows/.test(s)) return "Windows";
  if (/mac os x|macintosh/.test(s)) return "macOS";
  if (/cros/.test(s)) return "ChromeOS";
  if (/linux/.test(s)) return "Linux";
  return "other";
}
