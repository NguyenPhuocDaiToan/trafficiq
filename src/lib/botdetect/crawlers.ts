/**
 * Crawler đã biết và cách XÁC MINH từng loại — chỉ dùng cơ chế mà chính nhà vận
 * hành công bố. Không ghi suffix "cho chắc": mỗi suffix thừa là một cánh cửa giả
 * mạo.
 *
 * Nguồn (đã đối chiếu khi viết):
 *   Google — developers.google.com/search/docs/crawling-indexing/verifying-googlebot
 *   Bing   — blogs.bing.com/webmaster/2012/08/31/how-to-verify-that-bingbot-is-bingbot
 *   Apple  — support.apple.com/en-us/119829
 *   Yandex — yandex.com/support/webmaster/en/robot-workings/check-yandex-robots.html
 *   Baidu  — CHỈ có nguồn bên thứ ba (Baidu không có trang xác minh chính thức
 *            tìm được); nếu Baidu quan trọng với bạn, kiểm lại trước khi tin.
 *   Meta   — developers.facebook.com/docs/sharing/webmasters/web-crawlers: Meta
 *            KHÔNG công bố rDNS, chỉ công bố UA và dải IP theo ASN 32934.
 *   X      — ASN 13414 (đang dùng trong lib/tracking/ua.ts).
 */
export interface KnownCrawler {
  id: string;
  /** UA tự khai là crawler này. Chưa phải bằng chứng — chỉ là lời khai. */
  ua: RegExp;
  /** Xác minh bằng FCrDNS: hostname phải kết thúc bằng một trong các suffix. */
  rdnsSuffixes?: readonly string[];
  /** Xác minh bằng ASN của IP nguồn (Vercel gửi `x-vercel-ip-as-number`). */
  asns?: readonly number[];
}

export const KNOWN_CRAWLERS: readonly KnownCrawler[] = [
  {
    id: "google",
    ua: /googlebot|adsbot-google|mediapartners-google|google-inspectiontool|googleother|storebot-google|feedfetcher-google|google-read-aloud|apis-google/i,
    // CỐ Ý không có "googleusercontent.com" trần: mọi VM Google Cloud của khách
    // hàng có PTR dạng *.bc.googleusercontent.com và forward khớp — nên ai thuê
    // một VM cũng giả được Googlebot. Google chỉ liệt kê gae.googleusercontent.com
    // cho user-triggered fetcher.
    rdnsSuffixes: ["googlebot.com", "google.com", "gae.googleusercontent.com"],
  },
  {
    id: "bing",
    ua: /bingbot|bingpreview|msnbot|adidxbot/i,
    rdnsSuffixes: ["search.msn.com"],
  },
  {
    id: "apple",
    ua: /applebot/i,
    rdnsSuffixes: ["applebot.apple.com"],
  },
  {
    id: "yandex",
    // CHỈ các UA crawler của Yandex. "yandex" trần khớp cả app người dùng
    // (YandexSearch/…), rồi người thật bị coi là Yandex giả → challenge.
    ua: /yandex\.com\/bots|yandex(bot|images|video|media|blogs|direct|metrika|webmaster|market|favicons|sitelinks|userproxy|accessibilitybot|mobilebot|screenshotbot|additional|renderresourcesbot)/i,
    rdnsSuffixes: ["yandex.ru", "yandex.net", "yandex.com"],
  },
  {
    id: "baidu",
    ua: /baiduspider/i,
    rdnsSuffixes: ["baidu.com", "baidu.jp"],
  },
  {
    id: "meta",
    ua: /facebookexternalhit|facebot|meta-external|meta-webindexer/i,
    asns: [32934],
  },
  {
    id: "x",
    ua: /twitterbot|twittercardservice/i,
    asns: [13414],
  },
];

export function matchKnownCrawler(userAgent: string): KnownCrawler | undefined {
  return KNOWN_CRAWLERS.find((c) => c.ua.test(userAgent));
}
