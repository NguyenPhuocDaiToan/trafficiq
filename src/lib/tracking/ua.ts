import type { NextRequest } from "next/server";
import type { BotReason, ClickEvent, WeakSignal } from "@/lib/types";

type Device = ClickEvent["device"];

const BOT_UA_REGEX =
  /bot|crawler|spider|crawling|twitterbot|twittercardservice|facebookexternalhit|facebot|facebookcatalog|telegrambot|whatsapp|linkedinbot|pinterest|discordbot|slackbot|quora link preview|yahoo! slurp|bingbot|googlebot|duckduckgo|baiduspider|yandexbot|applebot|curl|wget|python|node-fetch|axios|go-http-client|headless/i;

/**
 * Vì sao request này bị coi là crawler — `null` nghĩa là cho đi tiếp.
 *
 * CHỈ chứa tín hiệu đủ mạnh để chặn, tức những thứ crawler TỰ KHAI hoặc xác
 * minh được ở tầng mạng. Chặn nhầm ở đây tốn đúng một click thật của người
 * dùng (họ bị đẩy về `/c/[slug]`, không tới được trang advertiser, không có
 * conversion, không có hoa hồng) — nên ngưỡng phải cao.
 *
 * `accept-language` từng nằm ở đây và ĐÃ ĐƯỢC GỠ: nó là suy đoán, không phải
 * xác minh. Header đó vắng mặt ở một số webview trong app và trình duyệt chặn
 * header, mà đó lại đúng là nguồn traffic chính của dự án. Tệ hơn: CTA trên
 * landing trỏ `/go/[token]`, nên người bị chặn sẽ bị 302 ngược về đúng trang
 * họ vừa bấm — một vòng lặp không lối ra, không log, không đếm. Giờ nó là
 * `WeakSignal`: vẫn ghi lại để đo, nhưng không chặn ai cả.
 */
export function botReason(req: NextRequest): BotReason | null {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT_UA_REGEX.test(ua)) return "ua-regex";

  // Header Vercel Edge: ASN 13414 = Twitter/X.
  if (req.headers.get("x-vercel-ip-as-number") === "13414") return "twitter-asn";

  return null;
}

/**
 * Tín hiệu đáng ngờ nhưng KHÔNG chặn. Ghi kèm clickEvent để về sau đo được
 * "nhóm này có convert không" rồi mới quyết định có nâng lên thành tín hiệu
 * chặn hay không — thay vì chặn trước rồi đoán.
 */
export function weakSignals(req: NextRequest): WeakSignal[] {
  const signals: WeakSignal[] = [];

  const acceptLang = req.headers.get("accept-language");
  if (!acceptLang || acceptLang.trim() === "") signals.push("no-accept-language");

  return signals;
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
