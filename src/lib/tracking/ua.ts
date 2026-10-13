import type { NextRequest } from "next/server";
import type { BotReason, ClickEvent, WeakSignal } from "@/lib/types";

type Device = ClickEvent["device"];

/**
 * Đo bằng `npm run check:bot` (scripts/check-bot-detection.ts) — thêm/bớt mẫu
 * ở đó trước khi sửa regex này.
 *
 * Các nhóm sau được chọn vì chúng là QUY LUẬT, không phải tên crawler: `+<URL>` và `https?://`/`mailto:` (quy ước crawler tự khai bằng
 * một URL), gốc `crawl`, vài danh từ (`fetcher`, `scanner`, `monitor`, `checker`, `validator`, `harvest`, `extractor`, `indexer`,
 * `probe`), và tên AI agent không có chữ "bot". Chúng được chọn chỉ dựa trên một nửa (DEV) của danh sách `crawler-user-agents` rồi
 * kiểm trên nửa còn lại (HOLDOUT); một danh sách TÊN (`grub|findlinks|teoma|…`) bị loại vì chỉ vá đúng mẫu đã thấy, không khái quát.
 * Quy luật có thể chặn nhầm một số trình duyệt cổ (xem "Đánh đổi đã biết" trong lib/botdetect/README.md). Số đo trước/sau và lý do từng
 * quy luật: lib/botdetect/HISTORY.md (ghi chép một lần). Số HIỆN TẠI: `npm run check:bot-external`.
 *
 * Chưa bắt `DuplexWeb-Google`, `Google Favicon`, `googleweblight` (Google xếp vào "retired special-case crawlers", mang hình dạng
 * Chrome/WebView). Bắt `Google Favicon` và `DuplexWeb-Google` là an toàn (token độc nhất) nhưng chưa thêm vì chúng đã ngừng và ít giá trị;
 * `googleweblight` thì KHÔNG nên bắt: nó phục vụ một người đang duyệt thật. `amzn-user`, `google-cws`, `google-site-verification`
 * thì bắt được.
 *
 * Hai chỗ cố ý KHÔNG viết gọn:
 * - `(?<!cu)bot`: "bot" trần khớp cả CUBOT (hãng điện thoại, UA người thật).
 * - Không có `pinterest`/`duckduckgo` trần: app Pinterest và browser DuckDuckGo
 *   của người dùng mang đúng chuỗi đó. Crawler của hai bên vẫn bị bắt vì UA của
 *   họ chứa `bot.html` / `DuckDuckBot`.
 */
export const BOT_UA_REGEX =
  /(?<!cu)bots?(?![a-z])|(?<!cu)bot[a-z0-9_.-]{0,20}\/\d|crawl|spider|\+\s*(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})|https?:\/\/|mailto:|claude-user|claude-searchbot|perplexity-user|chatgpt-user|oai-searchbot|duckassistbot|mistralai-user|gemini-deep-research|google-extended|cohere-ai|youbot|amzn-user|google-cws|google-site-verification|fetcher|scanner|monitor|checker|validator|harvest|extractor|indexer|probe|twittercardservice|facebookexternalhit|facebookcatalog|meta-external|meta-webindexer|whatsapp|quora link preview|yahoo! slurp|curl|wget|python|aiohttp|node-fetch|undici|axios|sindresorhus\/got|go-http-client|okhttp|(?<!semc-)java\/(?!asvm|semc|qvm|hwja|lgvm|jbed)|apache-httpclient|libwww(?!-fm)|scrapy|headless|phantomjs|lighthouse|mediapartners|googleother|google-inspectiontool|google-read-aloud|feedfetcher|bingpreview|qwantify|embedly|skypeuripreview|vkshare|w3c_validator|anthropic-ai/i;

/**
 * Trình duyệt chữ / điện thoại đời cũ KHÔNG mở đầu bằng "Mozilla/" hay "Opera/". Đúng DẠNG UA thật,
 * không phải tiền tố tuỳ ý ("NokiaScraper/1.0", "Lynx scraper/1.0" không khớp): điện thoại có mã máy ngay
 * sau tên ("Nokia6230/2.0", "BlackBerry9000/5.0"), hoặc "MOT-V3/…", "SAMSUNG-GT-…", "LG-GC900/…",
 * "LG/U990/…", "UCWEB7.0", "UP.Browser/…", và các hãng đời cũ khác (DoCoMo, SoftBank, KDDI, Vodafone,
 * Pantech, Sharp, Siemens…; NetFront và Openwave nằm ở `BROWSER_TOKEN`, không ở đây). Danh sách này rộng CÓ CHỦ Ý: ở `botReason` chặn nhầm một người
 * nghĩa là họ nhận Social Card thay vì được redirect, tệ hơn nhiều so với bỏ sót một crawler hiếm.
 * Dùng chung với lib/botdetect/signals.ts.
 */
export const LEGACY_BROWSER_UA =
  /^(?:(?:lynx|w3m|links|elinks|netsurf|midori|dolphin|dillo|emacs-w3m)(?:\/|\s\()|ucweb[\d./]|up\.browser\/|(?:nokia|blackberry|sonyericsson|samsung|motorola|motorokr|motorizr|mot|lge?|htc|alcatel|sec|sie|sharp|panasonic|philips|benq|siemens|sanyo|kyocera|pantech|sagem|mitsu|ericsson|j-phone|kddi|docomo|softbank|vodafone|jig)[-_ /]?[a-z_-]{0,16}\d|lg\/[a-z]?\d|portalmmm|(?:mot|sie|sec|lge?|samsung|sagem|siemens|alcatel|htc|vk|amoi|o2|fly)-[a-z0-9]{1,10}[\/ ])/i;

/**
 * Token bên TRONG UA cho thấy đây là trình duyệt/thiết bị của người dùng dù UA không mở đầu bằng "Mozilla/":
 *  - tên ứng dụng đặt TRƯỚC "Mozilla/5.0" (webview, TV, trình duyệt Trung Quốc: "TV Bro/1.0 Mozilla/5.0 …",
 *    "MQQBrowser/5.2/Mozilla/5.0 …") và "Mozilla" viết lệch ("Mozilla / 5.0", "Mozilla 5.0", "Mozilla.5.0", "Mozzila/5.0");
 *  - tên bộ máy trình duyệt (AppleWebKit, Gecko/, Trident/, Presto/, KHTML, Chrome/, Firefox/, Safari/, MSIE…);
 *  - dấu hiệu Java ME / WAP của điện thoại đời cũ (Profile/MIDP, Configuration/CLDC, "UP.Browser", "WAP-Browser",
 *    "Screen-240X320") và vài trình duyệt cổ (Mosaic, IBrowse, AmigaVoyager);
 *  - vài trình duyệt/TV thật không theo quy ước (HbbTV, webOS, Tizen, UCBrowser, Huawei HMOS, "LG Browser"…).
 * Crawler tự khai thường có tên/URL bot nên đã bị `BOT_UA_REGEX` bắt trước khi tới đây; ai thêm các token này vào
 * UA của mình chỉ né được đúng quy luật `non-browser-ua`, vốn đã né được bằng cách viết "Mozilla/5.0".
 */
const BROWSER_TOKEN =
  /mo[sz]{1,3}[il]{1,3}a[\s/.]{0,8}\d|applewebkit|gecko\/|khtml|trident\/|presto\/|msie |chrome\/|firefox\/|safari\/|ucbrowser|opr\/|edg\/|profile\/midp|configuration\/cldc|wap browser|hbbtv|webos|tizen|smart-?tv|netfront|obigo|openwave|teleca|lg browser|onebrowser|simple browser|com\.huawei\.hmos\.browser|ucweb|fban\/|fbav\/|fb_iab|fbios|instagram [0-9]|micromessenger|bytedancewebview|musical_ly|zalo|kakaotalk|up\.browser|au\.browser|wap-?browser|maui-browser|midp|cldc|screen-[0-9]+x[0-9]+|\.browser\/\d|mosaic|amigavoyager|ibrowse|nook browser|bunjalloo|aplix|safari[/ ]?[0-9]|opera[/ ][0-9]|uc ?browser|mqqbrowser|qqbrowser|360%20browser|baiduhd|mxbrowser|sleipnir|yelpwebview|dolphin [0-9]|nf-browser|icab|uzbl|xombrero|konqueror|flock\/|palmscape|xiino|doris\/|symbian|astel\/|philips-|webkit/i;

/**
 * UA KHÔNG phải của một trình duyệt: không mở đầu bằng `Mozilla/<số>` hay `Opera/`, không chứa token trình
 * duyệt ở trên, và không phải dạng điện thoại/trình duyệt đời cũ. Hầu hết trình duyệt người dùng (cả webview, in-app)
 * mang ít nhất một dấu hiệu đó; "Blogtrottr/2.0", "TwilioProxy/1.1", "wheresitup.com/1.1", "NETVIGIE" là client tự viết.
 * Một số trình duyệt hiếm không mang dấu hiệu nào và BỊ chặn nhầm ("Blazer/4.0", "Browser/WAP2.0", "Browser/MAUI"):
 * xem "Đánh đổi đã biết" trong lib/botdetect/README.md.
 *
 * Đo trên danh sách `crawler-user-agents` (bên thứ ba, 2120 UA mẫu): đây là phần lớn crawler mà regex tên
 * không bao giờ liệt kê hết. UA RỖNG cố ý KHÔNG tính (không có gì để kết luận; xem weakSignals).
 *
 * Stack HTTP gốc của ứng dụng ("Dalvik/2.1.0", "CFNetwork", "Microsoft Office …", "Sonos") CỐ Ý bị tính là
 * không-phải-trình-duyệt: đó không phải một cú bấm link của người.
 */
export function isNonBrowserUa(ua: string): boolean {
  const t = ua.trim();
  if (t === "") return false;
  if (/^opera\//i.test(t)) return false;
  return !BROWSER_TOKEN.test(t) && !LEGACY_BROWSER_UA.test(t);
}

/**
 * Tên máy Android hay chứa chữ "bot"/"spider" ("M bot 54", "VR BOT 552", "XBot Junior", "Spider 8", "htc_botdugls"),
 * ở đoạn nền tảng "(Linux; Android …; MODEL Build/…)" VÀ ở đoạn lặp lại của app Instagram ("Instagram 267.0 Android
 * (31/12; …; HTC Desire 22 pro; htc_botdugls; …)"). Xoá hai đoạn đó trước khi tìm từ khoá bot — TRỪ KHI trong đoạn có
 * dấu hiệu của một crawler thật: token có phiên bản ("Storebot-Google/1.0"), URL/mailto, "+host.tld", hay chữ "crawler".
 * Tên máy không bao giờ có các dấu hiệu đó; crawler giấu tên trong đoạn này thì gần như luôn có.
 *
 * (Bản đầu xoá VÔ ĐIỀU KIỆN đoạn đầu và làm lọt Storebot-Google, YRSpider, GPTBot, Y!J-BRZ crawler — reviewer độc lập
 * phát hiện. Ai giấu tên bot trong đoạn đó mà KHÔNG kèm phiên bản/URL thì vẫn lọt, giống việc viết "Mozilla/5.0".)
 *
 * Nội dung ngoặc bị chặn ở 300 ký tự (`[^)]{0,300}`): với `[^)]*` không giới hạn, "instagram 1 android (" lặp nhiều lần mà
 * không có ")" đóng quét tới cuối chuỗi từ MỖI lần xuất hiện → bậc hai. Đoạn thiết bị thật ngắn hơn nhiều.
 * Mọi regex ở đây tuyến tính: `[a-z]/d` chỉ nhìn MỘT ký tự trước dấu "/", không dùng `[a-z0-9_-]*` trước nó (nhóm lặp đó
 * quét lại từ mỗi vị trí bắt đầu → bậc hai).
 */
const ANDROID_PLATFORM = /(mozilla\/\d[^(]{0,40})\(((?:[a-z0-9_]{1,12}; ){0,2}android[^)]{0,300})\)/i;
const INSTAGRAM_PLATFORM = /((?:instagram|barcelona) [0-9][0-9.]{0,20} android )\(([^)]{0,300})\)/i;
const CRAWLER_MARK = /[a-z]\/\d|https?:|mailto:|\+\s*[a-z0-9-]+\.[a-z]{2,}|crawler/i;
// Facebook in-app lặp lại hãng/tên máy ở các trường FBMF/FBBD/FBDV/FBDM ("FBDV/M bot 54"): chỉ làm trống GIÁ TRỊ của đúng các trường đó.
const FB_DEVICE_FIELD = /(fb(?:mf|bd|dv|dm)\/)[^;\]]{0,80}/gi;
const hasCrawlerMark = (inner: string): boolean => CRAWLER_MARK.test(inner.replace(/build\/[a-z0-9._-]+/gi, "build"));

/** Làm trống đoạn tên máy (Android/Instagram/FBDV…) trừ khi trong đó có dấu hiệu crawler; dùng chung với signals.ts. */
export function withoutDevicePlatform(ua: string): string {
  return ua
    .replace(FB_DEVICE_FIELD, (m, pre: string) => (hasCrawlerMark(m.slice(pre.length)) ? m : `${pre}x`))
    .replace(ANDROID_PLATFORM, (m, pre: string, inner: string) => (hasCrawlerMark(inner) ? m : `${pre}()`))
    .replace(INSTAGRAM_PLATFORM, (m, pre: string, inner: string) => (hasCrawlerMark(inner) ? m : `${pre}()`));
}

/**
 * UA tự khai là bot/crawler (theo từ khoá, URL, v.v.) — MỘT định nghĩa duy nhất cho `botReason` và `parseUserAgent`.
 * Trước đây `parseUserAgent` chạy regex thô nên người dùng "M bot 54" được redirect (botReason = null) nhưng click bị
 * ghi `device: "bot"` và loại khỏi mọi thống kê.
 *
 * Java ME: UA có Profile/MIDP hoặc Configuration/CLDC là điện thoại đời cũ, và mọi "Java/<vm>" trong đó ("Java/HWJa",
 * "Java/Jbed", "Java/LGVM") là máy ảo — không phải thư viện HTTP. Máy khách Java thật không bao giờ gửi MIDP.
 */
export function isDeclaredBotUa(ua: string): boolean {
  let t = withoutDevicePlatform(ua);
  if (/midp|cldc/i.test(t)) t = t.replace(/java\//gi, "jvm-");
  return BOT_UA_REGEX.test(t);
}

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
 * landing trỏ `/go/[token]`, nên người bị chặn nhận Social Card (200, meta refresh
 * về `/c/[slug]`) thay vì được chuyển tiếp; click vẫn được ghi (`device: "bot"` kèm
 * `botReason`) nhưng không tới advertiser. Giờ nó là
 * `WeakSignal`: vẫn ghi lại để đo, nhưng không chặn ai cả.
 */
export function botReason(req: NextRequest): BotReason | null {
  const ua = req.headers.get("user-agent") ?? "";
  if (isDeclaredBotUa(ua)) return "ua-regex";
  if (isNonBrowserUa(ua)) return "non-browser-ua";

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

  // UA rỗng lọt qua BOT_UA_REGEX (không có gì để khớp) nên `botReason()` coi là
  // người. Chỉ ghi lại — client HTTP tự viết hay bỏ UA, nhưng cũng có proxy xoá
  // header này, nên chưa đủ mạnh để chặn.
  const ua = req.headers.get("user-agent");
  if (!ua || ua.trim() === "") signals.push("no-user-agent");

  // Mọi browser hiện đại tự gắn Sec-Fetch-* khi điều hướng; curl/thư viện HTTP
  // thì không. Không chặn vì webview cũ (và vài in-app browser) không gửi nó,
  // mà đó lại là nguồn traffic thật của dự án.
  if (!req.headers.get("sec-fetch-mode")) signals.push("no-sec-fetch");

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

  if (isDeclaredBotUa(s)) {
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
