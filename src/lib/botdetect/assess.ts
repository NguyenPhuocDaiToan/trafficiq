import { matchKnownCrawler, type KnownCrawler } from "./crawlers";
import { telemetrySignals, type ClientTelemetry } from "./client-signals";
import { createCrawlerVerifier } from "./fcrdns";
import { cleanUa, combineWeights, headerSignals, isPlaceholderUa, looksAutomated, readAsn, uaSignals } from "./signals";
import type {
  Assessment,
  Classification,
  CrawlerClaim,
  HeaderBag,
  Signal,
} from "./types";

export interface AssessInput {
  headers: HeaderBag;
  /** IP nguồn. Thiếu thì không thể FCrDNS → crawler tự khai là "unverified". */
  ip?: string;
  telemetry?: ClientTelemetry;
}

export type CrawlerVerifier = ReturnType<typeof createCrawlerVerifier>;

const defaultVerifier = createCrawlerVerifier();

/**
 * Chấm điểm KHÔNG có I/O: không DNS, an toàn trên hot path `/go`. Crawler tự
 * khai chỉ được đối chiếu ASN (đọc từ header, miễn phí); loại cần FCrDNS thì
 * dừng ở "unverified". Muốn xác minh đầy đủ thì gọi `assessRequest()` ở nơi
 * chịu được vài trăm ms — ví dụ trong `after()`.
 */
export function assessRequestSync(input: AssessInput): Assessment {
  return build(input, verifyByAsn(input));
}

export async function assessRequest(
  input: AssessInput,
  verifier: CrawlerVerifier = defaultVerifier,
): Promise<Assessment> {
  const ua = input.headers.get("user-agent") ?? "";
  const crawler = matchKnownCrawler(ua);
  let claim: CrawlerClaim | undefined;
  if (crawler) {
    try {
      claim = await verifyClaim(crawler, input, verifier);
    } catch {
      // Verifier hỏng (resolver ném, cache lỗi…) không được làm sập request, và cũng
      // không phải bằng chứng giả mạo.
      claim = { id: crawler.id, verification: "unverified" };
    }
  }
  return build(input, claim);
}

function verifyByAsn(input: AssessInput): CrawlerClaim | undefined {
  const ua = input.headers.get("user-agent") ?? "";
  const crawler = matchKnownCrawler(ua);
  if (!crawler) return undefined;
  const byAsn = checkAsn(crawler, input);
  return byAsn ?? { id: crawler.id, verification: "unverified" };
}

function checkAsn(crawler: KnownCrawler, input: AssessInput): CrawlerClaim | undefined {
  if (!crawler.asns) return undefined;
  const asn = readAsn(input.headers);
  // Không có header ASN (dev, host ngoài Vercel): không có bằng chứng nào, nên
  // "unverified" chứ KHÔNG phải "spoofed".
  if (asn === undefined) return { id: crawler.id, verification: "unverified" };
  return crawler.asns.includes(asn)
    ? { id: crawler.id, verification: "verified", via: "asn" }
    : { id: crawler.id, verification: "spoofed", via: "asn" };
}

async function verifyClaim(
  crawler: KnownCrawler,
  input: AssessInput,
  verifier: CrawlerVerifier,
): Promise<CrawlerClaim> {
  const byAsn = checkAsn(crawler, input);
  if (byAsn) return byAsn;

  if (!crawler.rdnsSuffixes || !input.ip) {
    return { id: crawler.id, verification: "unverified" };
  }

  const result = await verifier(input.ip, crawler.rdnsSuffixes);
  switch (result.status) {
    case "verified":
      return { id: crawler.id, verification: "verified", via: "fcrdns", hostname: result.hostname };
    case "failed":
      return { id: crawler.id, verification: "spoofed", via: "fcrdns" };
    case "error":
      return { id: crawler.id, verification: "unverified" };
  }
}

function build(input: AssessInput, claim: CrawlerClaim | undefined): Assessment {
  const ua = cleanUa(input.headers.get("user-agent") ?? "");
  // Crawler đã xác minh là bạn, không phải mối đe doạ: điểm 0 và bỏ qua mọi
  // heuristic — UA của Googlebot thiếu Accept-Language, và đó là bình thường.
  // NGOẠI LỆ: UA mang tên công cụ automation ("… Playwright/1.40", "node …") không được miễn dù
  // IP/ASN khớp — UA crawler thật không bao giờ chứa chúng, nên lời khai và UA mâu thuẫn nhau.
  if (claim?.verification === "verified" && !looksAutomated(ua)) {
    return { score: 0, classification: "verified-crawler", signals: [], crawler: claim };
  }

  const signals: Signal[] = [];

  if (claim?.verification === "spoofed") {
    signals.push({ id: "spoofed-crawler", weight: 95, detail: claim.id });
  } else if (claim?.verification === "unverified") {
    // 55 = bằng "unknown-declared-bot": một bot tự khai KHÔNG được nhận điểm thấp hơn chỉ vì nó
    // khai thêm một crawler đã biết ("SemrushBot/7" 55 → "SemrushBot/7 Bingbot/2.0" 50).
    signals.push({ id: "unverified-crawler", weight: 55, detail: claim.id });
  }

  // UA chỉ còn là chỗ giữ chỗ sau khi bỏ token crawler ("Mozilla/5.0 Applebot/0.1"): chấm điểm
  // trên phần còn lại, nếu không "thêm lời khai" biến UA 60 điểm (empty-ua) thành 50. UA crawler
  // thật luôn còn phần phức tạp hơn thế (comment, phiên bản, URL) nên không bị ảnh hưởng; phần còn
  // lại RỖNG ("GoogleOther" trần) thì cố ý không tính.
  let scored = ua;
  if (claim) {
    const crawler = matchKnownCrawler(ua);
    if (crawler) {
      // Bỏ cả phiên bản đi kèm ("Applebot/0.1" → "", không để lại "/0.1"). Phiên bản phải bắt đầu
      // bằng chữ số: "Applebot/curl" còn nguyên "/curl" để tín hiệu thư viện không bị nuốt mất.
      // String.raw: trong template literal thường `\w` bị bỏ gạch chéo thành "w" và regex hỏng.
      const token = new RegExp(String.raw`(?:${crawler.ua.source})(?:[/-]v?\d[\w.+~-]*)?`, "gi");
      const rest = cleanUa(ua.replace(token, ""));
      if (rest !== "" && isPlaceholderUa(rest)) scored = rest;
    }
  }

  // Mỗi UA luôn được chấm độc lập với lời khai crawler: gắn thêm "Googlebot" vào UA
  // của curl/Playwright không được làm điểm GIẢM. Chỉ "unknown-declared-bot" là
  // thừa khi crawler đã được nhận diện (nó chính là lời khai đó).
  for (const s of uaSignals(scored)) {
    const redundant = s.id === "unknown-declared-bot" || s.id === "non-browser-ua";
    // Với crawler bị coi là GIẢ (điểm đã ≥ 95) giữ nguyên mọi tín hiệu để không tụt so với UA gốc.
    if (claim && claim.verification !== "spoofed" && redundant) continue;
    signals.push(s);
  }

  signals.push(...headerSignals(input.headers, scored));
  if (input.telemetry) signals.push(...telemetrySignals(input.telemetry, ua || null));

  const score = combineWeights(signals);
  return {
    score,
    classification: classify(score, claim),
    signals,
    ...(claim ? { crawler: claim } : {}),
  };
}

function classify(score: number, claim: CrawlerClaim | undefined): Classification {
  if (claim?.verification === "spoofed") return "spoofed-crawler";
  if (score >= 60) return "automated";
  if (score >= 30) return "suspicious";
  return "human-likely";
}
