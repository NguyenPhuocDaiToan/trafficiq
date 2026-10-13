import { isDeclaredBotUa, LEGACY_BROWSER_UA, withoutDevicePlatform } from "@/lib/tracking/ua";
import type { HeaderBag, Signal } from "./types";

/**
 * Lớp 2 — heuristic trên UA + header, KHÔNG cần JS phía client và không tốn
 * I/O nên chạy được trên hot path.
 *
 * Giới hạn phải nói rõ: mọi thứ ở đây là header do client tự gửi. Automation
 * viết cẩn thận (Playwright + stealth) gửi đúng bộ header của Chrome thật và
 * qua hết lớp này. Lớp này lọc được công cụ lười, không lọc được đối thủ có chủ
 * đích — phần đó là việc của lớp 1 (danh tính) và lớp 3 (telemetry).
 */

/**
 * Tên công cụ headless/automation. Độc lập với BOT_UA_REGEX: chỉ `headless` và `phantomjs` trùng; `puppeteer`,
 * `playwright`, `selenium`, `webdriver` thì BOT_UA_REGEX không biết. Cả hai danh sách này được kiểm trên UA đã làm trống
 * đoạn tên máy (xem `withoutDevicePlatform`), giống `botReason`, nên một điện thoại tên "Node" hay "Probe" không bị chấm.
 */
const HEADLESS_UA = /headless|phantomjs|puppeteer|playwright|selenium|webdriver/i;
// Độc lập với BOT_UA_REGEX (ua.ts, quyết định 302/Social Card), nhưng KHÔNG tách rời hoàn toàn khỏi
// redirect: nhiều tên ở đây cũng bị `botReason` chặn qua BOT_UA_REGEX hoặc `non-browser-ua`.
// Riêng `dart` phải kèm `/` ("Dart/3.2 (dart:io)"): tên máy "DART KZ07" là điện thoại thật.
const HTTP_LIBRARY_UA =
  /curl|wget|python|aiohttp|node-fetch|undici|axios|sindresorhus\/got|go-http-client|okhttp|(?<!semc-)java\/(?!asvm|semc|qvm|hwja|lgvm|jbed)|java-http-client|apache-httpclient|libwww(?!-fm)|scrapy|postmanruntime|httpie|reqwest|(?:^|[\s(;])(?:node|deno|bun)(?:[/\s);]|$)|(?:^|[\s(;])dart\//i;
/**
 * Agent AI/crawler tự khai ("User" fetcher không có chữ "bot"). Danh sách này dùng để cho ĐIỂM
 * (`unknown-declared-bot`) và để loại UA khỏi `isBrowserLikeUa`; BOT_UA_REGEX (ua.ts) cũng đã bắt
 * các token này nên `botReason` trả `ua-regex` cho chúng. Cả hai nơi đều kiểm trên UA đã làm trống đoạn tên máy.
 */
const AI_AGENT_UA =
  /claude-user|claude-searchbot|perplexity-user|chatgpt-user|oai-searchbot|duckassistbot|mistralai-user|gemini-deep-research|google-extended|cohere-ai|youbot|meta-externalfetcher/i;
/** Trình duyệt chữ/điện thoại phổ thông thật mà không mở đầu bằng "Mozilla/". */
// Dùng chung với lib/tracking/ua.ts (isNonBrowserUa) — xem định nghĩa và giải thích ở đó.

/** Token (giữa các dấu cách/ngoặc/chấm phẩy) chứa từ khoá bot. */
const BOT_WORD = /bot|crawler|spider/i;
/** UA chỉ là chỗ giữ chỗ — client không buồn đặt UA. */
const PLACEHOLDER_UA = /^(-|mozilla|mozilla\/5\.0|user-agent|unknown|null|undefined)$/i;

/** UA mang tên công cụ automation/thư viện HTTP — một UA crawler thật không bao giờ có. */
export function looksAutomated(ua: string): boolean {
  const visible = withoutDevicePlatform(ua);
  return HEADLESS_UA.test(visible) || HTTP_LIBRARY_UA.test(visible);
}

/** UA chỉ là chỗ giữ chỗ ("-", "Mozilla", "Mozilla/5.0"…). Rỗng KHÔNG tính ở đây. */
export function isPlaceholderUa(ua: string): boolean {
  return PLACEHOLDER_UA.test(cleanUa(ua));
}

/** ASN của nhà cung cấp hosting — người dùng thật hiếm khi duyệt web từ đây. */
const DATACENTER_ASNS = new Set([
  16509, 14618, // Amazon AWS
  15169, 396982, // Google Cloud
  8075, // Microsoft Azure
  14061, // DigitalOcean
  16276, // OVH
  24940, // Hetzner
  63949, // Linode/Akamai
  20473, // Vultr
]);

export function readAsn(headers: HeaderBag): number | undefined {
  const raw = headers.get("x-vercel-ip-as-number");
  if (!raw) return undefined;
  // Chỉ số thập phân CHUẨN (không số 0 đứng đầu): Number("0x80A6") và Number("00032934") đều ra
  // 32934 và sẽ khớp ASN của Meta. Header thật từ Vercel luôn ở dạng chuẩn.
  if (!/^(0|[1-9]\d{0,9})$/.test(raw.trim())) return undefined;
  const n = Number(raw.trim());
  return n <= 4_294_967_295 ? n : undefined; // ASN là số 32-bit
}

/**
 * Chuẩn hoá UA MỘT lần, dùng cho mọi phép khớp. Node giao byte 0xA0 đầu chuỗi thành "\u00a0",
 * mà `^mozilla` trên chuỗi chưa cắt thì trượt trong khi `uaSignals` lại cắt rồi coi là bình
 * thường — UA đó thoát khỏi CẢ HAI nhánh chấm điểm và nhận 0. Cắt cả ký tự vô hình (zero-width,
 * BOM) vì `trim()` không cắt U+200B.
 */
export function cleanUa(ua: string): string {
  // Vòng lặp từ hai đầu, KHÔNG dùng regex `[\s…]+$`: nhánh đuôi đó là quadratic trên UA có dải
  // khoảng trắng dài ở giữa (đã đo là bậc hai) và hàm này chạy trên mọi request.
  let start = 0;
  let end = ua.length;
  while (start < end && INVISIBLE_OR_SPACE.test(ua[start])) start++;
  while (end > start && INVISIBLE_OR_SPACE.test(ua[end - 1])) end--;
  return start === 0 && end === ua.length ? ua : ua.slice(start, end);
}
// \s không gồm U+0085 (NEL) hay U+00AD (soft hyphen) — cả hai qua được HTTP và từng làm "-" (60) thành 40.
const INVISIBLE_OR_SPACE = /[\s\u0080-\u009f\u00ad\u034f\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/;

/**
 * UA tự xưng là trình duyệt (có token `Mozilla/5.0` Ở BẤT KỲ ĐÂU, không chỉ đầu chuỗi) và không
 * phải thư viện/headless đã biết. Không neo đầu chuỗi: đặt một token crawler TRƯỚC `Mozilla/5.0`
 * ("TwitterCardService Mozilla/5.0 …") từng làm UA đó thoát khỏi mọi tín hiệu header mạnh.
 */
function claimsBrowser(ua: string): boolean {
  // Mozilla/4.0 (IE cũ) và Opera/… cũng là trình duyệt: giới hạn ở "Mozilla/5.0" từng cho phép đổi UA
  // thành "Mozilla/4.0 (compatible; MSIE 8.0)" để tắt hẳn mọi tín hiệu header (90 → 0).
  return /mozilla\/\d|opera\//i.test(ua) && !looksAutomated(ua);
}

/** Trình duyệt "sạch": claimsBrowser và KHÔNG chứa từ khoá bot — được chấm đủ tín hiệu header. */
export function isBrowserLikeUa(ua: string): boolean {
  return claimsBrowser(ua) && !isDeclaredBotUa(ua) && !AI_AGENT_UA.test(withoutDevicePlatform(ua));
}

/** Lấy token đầu của header có thể bị proxy nhân đôi ("navigate, navigate"), hạ chữ thường. */
function firstToken(value: string | null): string | null {
  if (value === null) return null;
  return value.split(",")[0].trim().toLowerCase() || null;
}

const KNOWN_PLATFORMS = new Set(["android", "ios", "chrome os", "windows", "macos", "linux"]);

/** UA nói nền tảng nào — để đối chiếu với `sec-ch-ua-platform`. */
function platformFromUa(ua: string): string | undefined {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/\bcros\b/i.test(ua)) return "chrome os"; // không neo thì "Microsoft" khớp
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux|x11/i.test(ua)) return "linux";
  return undefined;
}

export function uaSignals(rawUa: string): Signal[] {
  const ua = cleanUa(rawUa);
  if (ua === "" || PLACEHOLDER_UA.test(ua)) return [{ id: "empty-ua", weight: 60 }];
  // Headless/thư viện kiểm TRƯỚC và độc lập với BOT_UA_REGEX: tên "Playwright" hay
  // "reqwest" trong UA không được phép lọt chỉ vì regex crawler không biết nó.
  const visible = withoutDevicePlatform(ua);
  if (HEADLESS_UA.test(visible)) return [{ id: "headless-ua", weight: 90 }];
  if (HTTP_LIBRARY_UA.test(visible)) return [{ id: "http-library-ua", weight: 85 }];

  const signals: Signal[] = [];
  // isDeclaredBotUa: CÙNG định nghĩa với botReason (làm trống tên máy Android "M bot 54", Java ME…).
  // Ngoại lệ có chủ đích: registry crawler (`matchKnownCrawler`, assess.ts) so khớp trên UA thô, nên một
  // thiết bị đặt tên đúng tên crawler ("Googlebot") nhận 55 ở đây dù botReason cho đi tiếp; không máy thật nào mang tên đó.
  if (isDeclaredBotUa(ua) || AI_AGENT_UA.test(visible)) {
    // Tự khai là bot nhưng không phải thư viện: crawler trung thực chưa được xác minh.
    signals.push({ id: "unknown-declared-bot", weight: 55 });
    // "- Bot" / "Mozilla/5.0 Bot": thêm một từ khoá bot vào UA giữ chỗ không được làm điểm GIẢM
    // (60 → 55). Bỏ các token bot rồi xem phần còn lại có phải giữ chỗ không. "Googlebot/2.1" còn
    // lại RỖNG và "Mozilla/5.0 (compatible; Googlebot/2.1)" còn lại "(compatible; )" nên crawler
    // thật không bị ảnh hưởng.
    // Tách token rồi lọc — KHÔNG dùng một regex `[a-z0-9_-]*bot…` toàn cục: tiền tố lặp đó là
    // quadratic trên chuỗi chữ-số dài có "bot" ở cuối (từng làm treo bộ test).
    const residue = ua.split(/[\s;()]+/).filter((t) => t !== "" && !BOT_WORD.test(t)).join(" ");
    if (residue !== "" && PLACEHOLDER_UA.test(residue)) signals.push({ id: "empty-ua", weight: 60 });
    return signals;
  }
  // Trình duyệt chữ/điện thoại phổ thông không mở đầu bằng "Mozilla/". Đứng SAU kiểm tra bot: nếu
  // đứng trước, "Nokia-Bot/1.0" hay "Midori-spider/1.0" (tiền tố khớp allowlist) nhận 0 điểm.
  if (LEGACY_BROWSER_UA.test(ua)) return [];
  // Hầu hết trình duyệt người dùng (kể cả webview/in-app) đều mở đầu bằng "Mozilla/" (Opera
  // Mini: "Opera/"); một phần nhỏ UA người trong các tập bên thứ ba (xem `check:bot-external`) thì không và nhận cờ này (chỉ điểm, không ảnh hưởng redirect —
  // quyết định redirect dùng `isNonBrowserUa` ở lib/tracking/ua.ts, rộng hơn: token bộ máy, Java ME, TV, app…). UA kiểu "GuzzleHttp/7", "Ruby", "test", "colly - …" là client tự
  // viết, và danh sách thư viện thì không bao giờ đủ — nên đảo lại: cái gì KHÔNG giống
  // trình duyệt thì có điểm. Điểm 40 dưới bậc rate-limit chặt (60) và challenge (80), nhưng vẫn dùng chung bucket `s:` nên vượt burst 30 thì bị 429.
  // `mozilla\/\d`, đồng bộ với claimsBrowser: "Mozilla/", "Mozilla/x", "Mozilla/Scraper" từng qua được
  // `^mozilla/` rồi không nhận tín hiệu nào (0 điểm) vì claimsBrowser lại đòi chữ số.
  if (!/^(?:mozilla\/\d|opera\/)/i.test(ua)) return [{ id: "non-browser-ua", weight: 40 }];
  return [];
}

/**
 * Tín hiệu header — CHỈ áp cho UA tự xưng là browser. Với thư viện HTTP,
 * "thiếu Sec-Fetch" là hiển nhiên và đã nằm trong trọng số của UA; cộng thêm sẽ
 * tính một sự thật hai lần.
 */
export function headerSignals(headers: HeaderBag, rawUa: string): Signal[] {
  const ua = cleanUa(rawUa);
  const signals: Signal[] = [];

  // ---- Bằng chứng MẠNH về automation: áp cho MỌI UA, không phụ thuộc UA nói gì về mình. Nếu chỉ áp
  // cho UA "Mozilla/5.0" thì đổi UA thành "Mozilla/4.0 (compatible; MSIE 8.0)" hay "Opera/9.80" là
  // tắt hết (90 → 0), và gắn thêm token crawler vào UA Chrome kèm client hint HeadlessChrome từng hạ
  // điểm 90 → 50. Cộng thêm cho thư viện HTTP là vô hại (noisy-OR đã bão hoà gần 100).

  // Headless Chrome cũ khai thẳng trong client hint, kể cả khi UA đã bị sửa.
  if (/headlesschrome/i.test(headers.get("sec-ch-ua") ?? "")) {
    signals.push({ id: "headless-client-hint", weight: 90 });
  }

  const claimed = platformFromUa(ua);
  const hinted = firstToken(headers.get("sec-ch-ua-platform"))?.replace(/"/g, "");
  // Chỉ so khi CẢ HAI thuộc tập đã biết: "Unknown"/FreeBSD/… không phải bằng chứng gì.
  if (claimed && hinted && KNOWN_PLATFORMS.has(hinted) && claimed !== hinted) {
    signals.push({ id: "platform-mismatch", weight: 45, detail: `${claimed} vs ${hinted}` });
  }

  const fetchMode = firstToken(headers.get("sec-fetch-mode"));
  // Click của người là điều hướng ("navigate"). `cors`/`no-cors` là fetch()/XHR do script gọi.
  if (fetchMode && fetchMode !== "navigate" && fetchMode !== "same-origin") {
    signals.push({ id: "programmatic-fetch", weight: 30, detail: fetchMode });
  }

  // ---- Tín hiệu "VẮNG header": chỉ cho UA trình duyệt sạch. Crawler thật (Googlebot…) vắng chúng một
  // cách hợp lệ, và với thư viện HTTP thì "thiếu Sec-Fetch" là hiển nhiên và đã nằm trong trọng số UA.
  if (!isBrowserLikeUa(ua)) return signals;

  if (!fetchMode) {
    // Weak: webview cũ không gửi (xem ua.ts weakSignals).
    signals.push({ id: "no-sec-fetch", weight: 10 });
  }

  const acceptLanguage = headers.get("accept-language");
  if (!acceptLanguage || acceptLanguage.trim() === "") {
    signals.push({ id: "no-accept-language", weight: 10 });
  }

  const accept = headers.get("accept");
  if (!accept) signals.push({ id: "no-accept", weight: 15 });
  else if (accept.trim() === "*/*") signals.push({ id: "wildcard-accept", weight: 18 });
  // Điều hướng của trình duyệt LUÔN có text/html (hoặc xhtml) trong Accept. Accept kiểu
  // axios ("application/json, text/plain, */*") là một lời gọi API, không phải ai đó bấm link.
  else if (!/text\/html|application\/xhtml/i.test(accept)) {
    signals.push({ id: "non-document-accept", weight: 20 });
  }

  const asn = readAsn(headers);
  if (asn !== undefined && DATACENTER_ASNS.has(asn)) {
    // Có người dùng VPN/cloud desktop thật — nên vừa phải, không đủ tự nó để chặn.
    signals.push({ id: "datacenter-asn", weight: 20, detail: `AS${asn}` });
  }

  return signals;
}

/**
 * Gộp trọng số bằng "noisy-OR": điểm = 1 − Π(1 − wᵢ).
 *
 * Vì sao không cộng: cộng thì 4 tín hiệu yếu 10 + 10 + 12 + 15 = 47 trong khi
 * một tín hiệu mạnh 90 + một tín hiệu 30 = 120 phải kẹp về 100 — mất thông tin
 * và dễ vượt trần. Noisy-OR luôn nằm trong [0,100], đơn điệu (thêm tín hiệu
 * không bao giờ làm điểm giảm), và hai tín hiệu yếu độc lập không dồn lên thành
 * mạnh một cách tuyến tính. Tương đương "xác suất ít nhất một tín hiệu đúng" nếu
 * coi các weight là xác suất độc lập.
 */
export function combineWeights(signals: readonly Signal[]): number {
  // Weight không hữu hạn (NaN) bị bỏ: NaN trong tích sẽ làm cả điểm thành NaN,
  // và `NaN >= ngưỡng` luôn false → request tệ nhất lại rơi vào "allow".
  // Sắp xếp để kết quả không phụ thuộc thứ tự cộng dồn số thực.
  const weights = signals
    .map((s) => s.weight)
    .filter((w) => Number.isFinite(w))
    .map((w) => Math.min(100, Math.max(0, w)) / 100)
    .sort((a, b) => a - b);
  let clean = 1;
  for (const w of weights) clean *= 1 - w;
  return Math.round((1 - clean) * 100);
}
