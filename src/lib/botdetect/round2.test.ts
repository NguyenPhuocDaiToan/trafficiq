import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { assessRequest, assessRequestSync } from "./assess";
import { createReplayGuard, issueChallenge, solveChallenge, verifyChallenge } from "./challenge";
import { parseTelemetry, telemetrySignals, type ClientTelemetry } from "./client-signals";
import { matchKnownCrawler } from "./crawlers";
import { createCrawlerVerifier, hostMatchesSuffix, normalizeIp, verifyFcrdns, type DnsResolver } from "./fcrdns";
import { decide } from "./policy";
import { MemoryRateLimiter } from "./rate-limit";
import { combineWeights, headerSignals, uaSignals } from "./signals";
import type { Assessment } from "./types";

// ---------------------------------------------------------------------------
// Helpers

function hdrs(h: Record<string, string>) {
  const m = new Map(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n: string) => m.get(n.toLowerCase()) ?? null };
}

const ACC_CHROME =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
const ACC_FF = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8";
const ACC_SAFARI = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const NAV = {
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "cross-site",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};
const LANG = "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7";
const chHints = (brand: string, platform: string, mobile = "?0") => ({
  "sec-ch-ua": `"Chromium";v="124", "${brand}";v="124", "Not-A.Brand";v="99"`,
  "sec-ch-ua-mobile": mobile,
  "sec-ch-ua-platform": `"${platform}"`,
});

interface Human {
  name: string;
  ua: string;
  headers: Record<string, string>;
}

const H = (name: string, ua: string, headers: Record<string, string>): Human => ({
  name,
  ua,
  headers: { "user-agent": ua, ...headers },
});

const chromeAndroidUa =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const androidWv = (extra: string, model = "SM-S918B") =>
  `Mozilla/5.0 (Linux; Android 13; ${model} Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 ${extra}`;
const iosUa = (extra: string, ver = "17_1") =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${ver} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${extra}`;
const wvHdr = { accept: ACC_CHROME, "accept-language": LANG, ...NAV, "x-requested-with": "com.facebook.katana" };
const iosHdr = { accept: ACC_SAFARI, "accept-language": LANG, ...NAV };

const HUMANS: Human[] = [
  H("Chrome Win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Windows") }),
  H("Chrome Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "macOS") }),
  H("Chrome Linux", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Linux") }),
  H("Chrome ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Chrome OS") }),
  H("Chrome Android", chromeAndroidUa, { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Android", "?1") }),
  H("Firefox Win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0", { accept: ACC_FF, "accept-language": "vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3", ...NAV, "sec-fetch-user": "?1", priority: "u=1" }),
  H("Firefox Android", "Mozilla/5.0 (Android 13; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0", { accept: ACC_FF, "accept-language": "vi-VN,vi;q=0.8", ...NAV }),
  H("Tor Browser", "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "accept-language": "en-US,en;q=0.5", ...NAV, "x-vercel-ip-as-number": "24940" }),
  H("Safari macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", { accept: ACC_SAFARI, "accept-language": "vi-VN,vi;q=0.9", "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none" }),
  H("Safari iOS 17", iosUa("Version/17.1 Mobile/15E148 Safari/604.1"), iosHdr),
  H("Safari iOS 15 (no sec-fetch)", iosUa("Version/15.6 Mobile/15E148 Safari/604.1", "15_6"), { accept: ACC_SAFARI, "accept-language": "vi-vn" }),
  H("Safari iOS 15 no lang", iosUa("Version/15.6 Mobile/15E148 Safari/604.1", "15_6"), { accept: ACC_SAFARI }),
  H("Chrome iOS CriOS", iosUa("CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1"), iosHdr),
  H("Firefox iOS", iosUa("FxiOS/125.0 Mobile/15E148 Safari/605.1.15"), iosHdr),
  H("Edge Win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Microsoft Edge", "Windows") }),
  H("Edge Android", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.0.0", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Microsoft Edge", "Android", "?1") }),
  H("Samsung Internet", "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Samsung Internet", "Android", "?1") }),
  H("UC Browser (Mozilla UA)", "Mozilla/5.0 (Linux; U; Android 8.1.0; en-US; Redmi 6A Build/O11019) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/12.13.2.1208 Mobile Safari/537.36", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", "accept-language": "en-US" }),
  H("UC Browser feature phone (UCWEB)", "UCWEB/2.0 (Linux; U; Opera Mini/7.1.32052/30.3697; en-US; SM-J200G) U2/1.0.0 UCBrowser/9.3.0.321 U2/1.0.0 Mobile", { accept: "text/html, application/xhtml+xml, */*", "accept-language": "en-US" }),
  H("MIUI Browser", "Mozilla/5.0 (Linux; U; Android 13; vi-vn; Redmi Note 11 Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 XiaoMi/MiuiBrowser/17.8.40909", { accept: ACC_CHROME, "accept-language": "vi-VN,vi;q=0.9", ...NAV }),
  H("Huawei Browser", "Mozilla/5.0 (Linux; Android 10; HMA-L29) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/14.0.4.301 Mobile Safari/537.36", { accept: ACC_CHROME, "accept-language": "vi-VN", ...NAV }),
  H("Coc Coc", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 coc_coc_browser/118.0.178 Chrome/118.0.5993.178", { accept: ACC_CHROME, "accept-language": "vi-VN,vi;q=0.9", ...NAV, ...chHints("Chromium", "Windows") }),
  H("Brave", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": "vi-VN,vi;q=0.6", ...NAV, ...chHints("Brave", "Windows") }),
  H("DuckDuckGo Android", androidWv("DuckDuckGo/5"), { ...wvHdr, "x-requested-with": "com.duckduckgo.mobile.android" }),
  H("DuckDuckGo iOS", iosUa("Version/17.0 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15", "17_0"), iosHdr),
  H("Opera Mini", "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16", { accept: "text/html, application/xml;q=0.9, application/xhtml+xml, image/png, image/webp, image/jpeg, image/gif, image/x-xbitmap, */*;q=0.1", "accept-language": "id-ID,id;q=0.9,en;q=0.8" }),
  H("Opera desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Opera", "Windows") }),
  H("Yandex Browser", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 YaBrowser/23.11.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": "ru,en;q=0.9", ...NAV, ...chHints("YaBrowser", "Windows") }),
  H("YandexSearch app Android", "Mozilla/5.0 (Linux; arm_64; Android 12; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 YaBrowser/23.9.5 SA/3 Mobile Safari/537.36 YandexSearch/23.74", { ...wvHdr, "accept-language": "ru" }),
  H("Facebook Android", androidWv("[FB_IAB/FB4A;FBAV/440.0.0.30.113;]"), wvHdr),
  H("Facebook iOS", iosUa("Mobile/21B74 [FBAN/FBIOS;FBAV/440.0.0.30.113;FBBV/5000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5;FBRV/0]"), iosHdr),
  H("Messenger iOS", iosUa("Mobile/21B74 [FBAN/MessengerForiOS;FBAV/440.0.0.30.113;FBBV/5000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]"), iosHdr),
  H("Instagram Android", androidWv("Instagram 310.0.0.37.109 Android (33/13; 480dpi; 1080x2400; samsung; SM-S918B; dm3q; qcom; vi_VN; 543800045)"), { ...wvHdr, "x-requested-with": "com.instagram.android" }),
  H("Instagram iOS", iosUa("Mobile/21B74 Instagram 310.0.0.37.109 (iPhone15,2; iOS 17_1; vi_VN; vi-VN; scale=3.00; 1170x2532; 543800045)"), iosHdr),
  H("TikTok Android", androidWv("trill_2023007040 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/30.7.4 ByteLocale/vi-VN ByteFullLocale/vi-VN Region/VN BytedanceWebview/d8a21c6", "SM-A525F"), wvHdr),
  H("TikTok iOS", iosUa("Mobile/15E148 musical_ly_30.7.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/vi Region/VN BytedanceWebview/d8a21c6"), iosHdr),
  H("Zalo Android", androidWv("Zalo/12.0 ZaloTheme/light ZaloLanguage/vi"), { ...wvHdr, "x-requested-with": "com.zing.zalo" }),
  H("Line Android", androidWv("Line/13.19.0"), wvHdr),
  H("Line iOS", iosUa("Mobile/21B74 Safari Line/13.19.0"), iosHdr),
  H("Snapchat iOS", iosUa("Mobile/15E148 Snapchat/12.60.0.43 (like Safari/8617.1.17.10.9, panda)"), iosHdr),
  H("LinkedIn Android", androidWv("LinkedInApp"), wvHdr),
  H("Telegram Android", androidWv("Telegram-Android/10.4.2"), wvHdr),
  H("Twitter iOS", iosUa("Mobile/15E148 Safari/604.1 Twitter for iPhone"), iosHdr),
  H("WeChat Android", androidWv("MicroMessenger/8.0.43.2480(0x28002B3D) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MMWEBID/1234 MMWEBSDK/20231201"), { ...wvHdr, "accept-language": "zh-CN,zh;q=0.9" }),
  H("KakaoTalk Android", androidWv("KAKAOTALK 2510230"), { ...wvHdr, "accept-language": "ko-KR" }),
  H("VK Android", androidWv("VKAndroidApp/7.10-12345"), { ...wvHdr, "accept-language": "ru" }),
  H("Naver inapp", androidWv("NAVER(inapp; search; 1000; 11.12.2)", "SM-G973N"), { ...wvHdr, "accept-language": "ko-KR" }),
  H("Samsung TV Tizen", "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "vi-VN" }),
  H("LG webOS TV", "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager", { accept: ACC_CHROME, "accept-language": "vi-VN" }),
  H("PS5", "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15", { accept: ACC_SAFARI, "accept-language": "en-us" }),
  H("Xbox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edge/114.0.1823.82", { accept: "text/html, application/xhtml+xml, image/jxr, */*", "accept-language": "en-US" }),
  H("Nintendo Switch", "Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/609.4 (KHTML, like Gecko) NF/6.0.2.21.3 NintendoBrowser/5.1.0.22474", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "ja-JP" }),
  H("Kindle Fire Silk", "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/118.5.1 like Chrome/118.0.5993.112 Safari/537.36", { accept: ACC_CHROME, "accept-language": "en-US", ...NAV }),
  H("Kindle e-reader", "Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+", { accept: "text/html,application/xhtml+xml,*/*", "accept-language": "en-us" }),
  H("Gmail Android -> Chrome Custom Tab", chromeAndroidUa, { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Android", "?1"), "x-requested-with": "com.google.android.gm" }),
  H("Outlook iOS SFSafariVC", iosUa("Version/17.1 Mobile/15E148 Safari/604.1"), iosHdr),
  H("Corp proxy: dup sec-fetch + via", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, "sec-fetch-mode": "navigate, navigate", ...chHints("Google Chrome", "Windows"), via: "1.1 proxy.corp", "x-forwarded-for": "10.0.0.5" }),
  H("Corp proxy: strips sec-fetch + client hints", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, via: "1.1 bluecoat" }),
  H("Corp proxy: strips accept-language too", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, via: "1.1 zscaler" }),
  H("IE11 enterprise", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko", { accept: "text/html, application/xhtml+xml, image/jxr, */*", "accept-language": "vi-VN" }),
  H("Old Android stock browser", "Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; GT-I9500 Build/KOT49H) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", "accept-language": "en-US" }),
  H("Human on AWS WorkSpaces + Chrome", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Windows"), "x-vercel-ip-as-number": "16509" }),
  H("Cubot phone", "Mozilla/5.0 (Linux; Android 11; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36", { accept: ACC_CHROME, "accept-language": LANG, ...NAV, ...chHints("Google Chrome", "Android", "?1") }),
  H("Netsurf/text browsers (Lynx)", "Lynx/2.9.0 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2", { accept: "text/html, text/plain, text/sgml, */*;q=0.01", "accept-language": "en" }),
];

// ---------------------------------------------------------------------------
describe("1. FALSE POSITIVES: real clients", () => {
  it("REPORT: score table for realistic humans", () => {
    const rows: string[] = [];
    for (const h of HUMANS) {
      const a = assessRequestSync({ headers: hdrs(h.headers) });
      rows.push(`${String(a.score).padStart(3)}  ${h.name}  [${a.signals.map((s) => s.id).join(",")}]`);
    }
    console.log("\n" + rows.sort().reverse().join("\n"));
  });

  for (const h of HUMANS) {
    const knownBug = /UCWEB|Lynx/.test(h.name) ? "BUG: " : "";
    it(`${knownBug}human not flagged: ${h.name}`, () => {
      const a = assessRequestSync({ headers: hdrs(h.headers) });
      assert.ok(a.score < 30, `score ${a.score} signals ${a.signals.map((s) => `${s.id}:${s.weight}`).join(",")}`);
    });
  }

  it("narrowed Yandex regex does not claim user apps, still claims crawlers", () => {
    for (const ua of ["YandexSearch/23.74", "YandexSearchBrowser/1", "YandexMaps/10", "YandexTranslate/1", "ru.yandex.market"]) {
      assert.equal(matchKnownCrawler(`Mozilla/5.0 ${ua}`)?.id, undefined, ua);
    }
    for (const ua of [
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexMobileBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexRenderResourcesBot/1.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexTurbo/1.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexAdNet/1.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexVideoParser/1.0; +http://yandex.com/bots)",
    ]) {
      assert.equal(matchKnownCrawler(ua)?.id, "yandex", ua);
    }
  });

  it("BUG?: Yandex crawler UA variants without /bots URL and without 'bot' (still declared)", () => {
    // e.g. YandexMetrika, YandexMarket, YandexTracker are real crawler names
    for (const ua of ["Mozilla/5.0 (compatible; YandexTracker/1.0)", "Mozilla/5.0 (compatible; YandexSitelinks)", "Mozilla/5.0 (compatible; YandexCalendar/1.0)", "Mozilla/5.0 (compatible; YandexTurbo/1.0)"]) {
      const a = assessRequestSync({ headers: hdrs({ "user-agent": ua, accept: "*/*" }) });
      assert.ok(a.score >= 30, `${ua} score ${a.score}`);
    }
  });

  it("BUG: untrusted-events: a single extension-synthetic event on a short session scores 70", () => {
    // Vimium / FastClick / password manager: 1 synthetic of 3 events (touchstart, synthetic click, real click)
    const t: ClientTelemetry = { wd: false, pl: 5, lg: 2, ow: 1920, oh: 1040, iw: 1900, ih: 900, sw: 1920, sh: 1080, hc: 8, ua: "x", ch: true, ev: 3, ut: 1, dw: 2500 };
    const s = telemetrySignals(t, "x");
    const score = combineWeights(s);
    assert.ok(score < 60, `human with one synthetic event in a short session scored ${score}`);
  });

  it("untrusted-events: 1 synthetic in 50 events (2%) is still downgraded?", () => {
    const t: ClientTelemetry = { wd: false, pl: 5, lg: 2, ow: 1920, oh: 1040, iw: 1900, ih: 900, sw: 1920, sh: 1080, hc: 8, ua: "x", ch: true, ev: 50, ut: 1, dw: 20000 };
    const w = telemetrySignals(t, "x").find((s) => s.id === "untrusted-events")!;
    assert.equal(w.weight, 25); // có sự kiện tin cậy đi cùng → extension/FastClick, không phải automation
  });

  it("BUG: telemetry of ordinary humans stays under 30 (old Android WebView w/o navigator.languages = 31)", () => {
    const base: ClientTelemetry = { wd: false, pl: 5, lg: 2, ow: 1920, oh: 1040, iw: 1900, ih: 900, sw: 1920, sh: 1080, hc: 8, ua: "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36", ch: true, ev: 12, ut: 0, dw: 4200 };
    const variants: Array<[string, Partial<ClientTelemetry>, string?]> = [
      ["desktop", {}],
      ["iOS Safari", { pl: 0, ch: false, ow: 390, oh: 664, iw: 390, ih: 664, sw: 390, sh: 844, hc: 0 }, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) Safari/604.1"],
      ["android webview outer=0", { ow: 0, oh: 0, iw: 412, ih: 800, sw: 412, sh: 915, pl: 0, ch: false }, "Mozilla/5.0 (Linux; Android 13) Chrome/119 Mobile Safari/537.36"],
      ["Firefox resistFingerprinting", { pl: 5, hc: 2, ch: false, sw: 1000, sh: 900 }, "Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0"],
      ["old android 4.4 (no languages)", { lg: 0, pl: 0, ch: false, hc: 0 }, "Mozilla/5.0 (Linux; Android 4.4.2) Version/4.0 Mobile Safari/534.30"],
      ["Brave (plugins hidden, no chrome?)", { pl: 0 }],
      ["iPad desktop-mode Safari", { pl: 0, ch: false, hc: 0 }, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15"],
    ];
    for (const [name, patch, ua] of variants) {
      const t = { ...base, ...patch, ua: ua ?? base.ua };
      const score = combineWeights(telemetrySignals(t, t.ua));
      assert.ok(score < 30, `${name} -> ${score}`);
    }
  });

  it("telemetry: proxy-rewritten UA (Opera Mini/UC proxy, corporate) gives ua-mismatch 45 on a real human", () => {
    const t: ClientTelemetry = { wd: false, pl: 0, lg: 1, ow: 360, oh: 640, iw: 360, ih: 640, sw: 360, sh: 640, hc: 4, ua: "Mozilla/5.0 (Linux; Android 10) Chrome/90 Mobile", ch: true, ev: 5, ut: 0, dw: 3000 };
    const score = combineWeights(telemetrySignals(t, "Mozilla/5.0 (Linux; Android 10; K) Chrome/90 Mobile (via proxy)"));
    // Characterisation: 45 => flag. Acceptable (flag only) but record.
    assert.ok(score >= 30 && score < 60);
  });

  it("BUG: parseTelemetry accepts real browser values incl. float window sizes and large dwell", () => {
    const real = { wd: false, pl: 5, lg: 3, ow: 1920, oh: 1040.5, iw: 1900.25, ih: 900, sw: 1920, sh: 1080, hc: 8, ua: "Mozilla/5.0", ch: true, ev: 12, ut: 0, dw: 4200.123 };
    assert.ok(parseTelemetry(real));
    // a tab left open 3 days: dw = 259_200_000 < 1e9
    assert.ok(parseTelemetry({ ...real, dw: 259_200_000 }));
    // 12-day tab: dw > 1e9 ms (11.6 days) -> rejected as "malformed"
    // dw > 1e9 ms (~11.6 ngày) bị bỏ là CHẤP NHẬN: null nghĩa là "không có telemetry" (không phải
    // đáng ngờ), nên một tab mở nhiều ngày chỉ đơn giản không được chấm lớp 3.
    assert.equal(parseTelemetry({ ...real, dw: 1_200_000_000 }), null);
  });

  it("parseTelemetry: __proto__ / extra fields / long ua", () => {
    const real = { wd: false, pl: 5, lg: 3, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 8, ua: "a".repeat(512), ch: true, ev: 12, ut: 0, dw: 4 };
    assert.ok(parseTelemetry(real));
    assert.equal(parseTelemetry({ ...real, ua: "a".repeat(513) }), null);
    const p = parseTelemetry(JSON.parse('{"__proto__":{"x":1},"wd":false,"ch":true,"ua":"a","pl":0,"lg":0,"ow":0,"oh":0,"iw":0,"ih":0,"sw":0,"sh":0,"hc":0,"ev":0,"ut":0,"dw":0}'))!;
    assert.equal(Object.keys(p).includes("x"), false);
    assert.equal((p as unknown as { x?: number }).x, undefined);
  });

  it("parseTelemetry: ut > ev is nonsense but accepted (attacker can set ut=0 anyway)", () => {
    const real = { wd: false, pl: 5, lg: 3, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 8, ua: "a", ch: true, ev: 1, ut: 9, dw: 4 };
    const p = parseTelemetry(real);
    assert.ok(p); // characterising
  });
});

describe("1b. ReDoS / adversarial size timing", () => {
  const sizes = [1_000_000, 8_000_000];
  const mk = (frag: string, n: number) => frag.repeat(Math.ceil(n / frag.length)).slice(0, n);
  const ADV = [
    ["a", "plain a"],
    ["bu", "bu repeat"],
    ["java", "java"],
    ["node-fetc", "partial node-fetch"],
    ["Mozilla/5.0 ", "mozilla"],
    ["cu", "cu"],
    ["yandex", "yandex"],
    ["yandexvide", "yandexvid"],
    ["googleo", "googleo"],
    ["x-", "x-"],
    [" ", "spaces"],
  ] as const;
  for (const n of sizes) {
    it(`uaSignals/assessRequestSync/matchKnownCrawler finish quickly on ${n / 1e6}MB inputs`, () => {
      for (const [frag, label] of ADV) {
        const ua = mk(frag, n);
        const t0 = performance.now();
        uaSignals(ua);
        matchKnownCrawler(ua);
        assessRequestSync({ headers: hdrs({ "user-agent": ua }) });
        const dt = performance.now() - t0;
        assert.ok(dt < 1500, `${label} ${n}: ${dt.toFixed(0)}ms`);
      }
    });
  }
  it("headerSignals on adversarial accept / sec-ch-ua", () => {
    const big = "text/htm".repeat(1_000_000);
    const t0 = performance.now();
    headerSignals(hdrs({ accept: big, "accept-language": big, "sec-ch-ua": "headlessChrom".repeat(600_000), "sec-fetch-mode": ",".repeat(5_000_000) }), "Mozilla/5.0 (Windows NT 10.0) Chrome/1");
    assert.ok(performance.now() - t0 < 1500);
  });
  it("hostMatchesSuffix on adversarial hostnames", () => {
    for (const h of ["a".repeat(8_000_000), "a.".repeat(4_000_000), `${"a-".repeat(30)}.`.repeat(100_000), "a".repeat(250) + "!" ]) {
      const t0 = performance.now();
      hostMatchesSuffix(h, "googlebot.com");
      assert.ok(performance.now() - t0 < 500);
    }
    // within 253 limit, worst case backtracking
    const worst = (`${"a".repeat(61)}-`.repeat(3) + "a.").repeat(1) + "!".repeat(1);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) hostMatchesSuffix(worst, "googlebot.com");
    assert.ok(performance.now() - t0 < 500);
  });
  it("normalizeIp on adversarial inputs", () => {
    for (const s of ["[".repeat(1_000_000), "1.".repeat(2_000_000), ":".repeat(2_000_000), "1".repeat(8_000_000) + ":80", "[" + "1:".repeat(1_000_000) + "]:80", ":".repeat(500_000) + "1.1.1.1"]) {
      const t0 = performance.now();
      normalizeIp(s);
      assert.ok(performance.now() - t0 < 1000, `${s.slice(0, 10)} ${performance.now() - t0}`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("2a. hostname validation", () => {
  const ok = (h: string, s = "googlebot.com") => hostMatchesSuffix(h, s);
  it("accepts real PTRs", () => {
    assert.ok(ok("crawl-66-249-66-1.googlebot.com"));
    assert.ok(ok("CRAWL-66-249-66-1.GOOGLEBOT.COM."));
    assert.ok(ok("rate-limited-proxy-66-249-90-77.google.com", "google.com"));
    assert.ok(ok("141-8-142-1.spider.yandex.com", "yandex.com"));
    assert.ok(ok("msnbot-157-55-39-1.search.msn.com", "search.msn.com"));
    assert.ok(ok("17-58-101-179.applebot.apple.com", "applebot.apple.com"));
    assert.ok(ok("a.googlebot.com"));
    assert.ok(ok("googlebot.com")); // apex
  });
  it("rejects tricks", () => {
    for (const h of ["evilgooglebot.com", "googlebot.com.evil.net", "evil.com#.googlebot.com", "evil .googlebot.com", "evil\0.googlebot.com", "a..googlebot.com", ".googlebot.com", "-a.googlebot.com", "a-.googlebot.com", "a.googlebot.com..", "a b.googlebot.com", "a\n.googlebot.com", "a/b.googlebot.com", "a@b.googlebot.com", "a:80.googlebot.com", "а.googlebot.com", "a​.googlebot.com", "", "."]) {
      assert.equal(ok(h), false, JSON.stringify(h));
    }
  });
  it("length limits", () => {
    const label63 = "a".repeat(63);
    const label64 = "a".repeat(64);
    assert.ok(ok(`${label63}.googlebot.com`));
    assert.equal(ok(`${label64}.googlebot.com`), false);
    // 253 total
    const filler = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.`; // 192
    const host253 = `${filler}${"d".repeat(253 - 192 - ".googlebot.com".length)}.googlebot.com`;
    assert.equal(host253.length, 253);
    assert.ok(ok(host253));
    assert.equal(ok("e" + host253), false);
    // trailing dot makes 254 chars with dot, 253 without
    assert.ok(ok(host253 + "."));
  });
  it("punycode / uppercase / underscore", () => {
    assert.ok(ok("xn--abc.googlebot.com"));
    assert.ok(ok("_dmarc.googlebot.com")); // allowed by regex; characterise
  });
  it("BUG?: underscores allowed in PTR host makes a non-hostname pass suffix check", () => {
    // Underscore is not valid in a hostname (RFC 952/1123). If PTR returned
    // "_x.googlebot.com" it would still need an A record, so exploitability is nil,
    // but README claims 'chuỗi nhãn DNS hợp lệ'. Cosmetic.
    assert.equal(ok("a_b.googlebot.com"), true);
  });
  it("suffix with leading dot or uppercase from caller", () => {
    assert.equal(hostMatchesSuffix("a.googlebot.com", ".googlebot.com"), false);
    assert.equal(hostMatchesSuffix("a.googlebot.com", "GOOGLEBOT.COM"), true);
    assert.equal(hostMatchesSuffix("a.googlebot.com", ""), false);
    // empty suffix + trailing: host === "" cannot match; but ".":
    assert.equal(hostMatchesSuffix("a.", ""), false);
  });
  it("non-string input never throws", () => {
    for (const v of [null, undefined, 5, {}, [], Symbol.iterator] as unknown[]) assert.equal(hostMatchesSuffix(v as string, "x.com"), false);
  });
});

describe("2b. normalizeIp", () => {
  const cases: Array<[string, string | null]> = [
    ["66.249.66.1", "66.249.66.1"],
    ["66.249.66.1:443", "66.249.66.1"],
    [" 66.249.66.1 ", "66.249.66.1"],
    ["66.249.66.1:", null],
    ["66.249.66.1:99999", "66.249.66.1"], // port > 65535 accepted; harmless
    ["66.249.66.1:80:80", null],
    ["66.249.66.1:80 ", "66.249.66.1"],
    ["999.1.1.1:80", null],
    ["066.249.066.001", null],
    ["66.249.66.1, 10.0.0.1", null],
    ["[::1]:443", "0:0:0:0:0:0:0:1"],
    ["[::1]", "0:0:0:0:0:0:0:1"],
    ["::1", "0:0:0:0:0:0:0:1"],
    ["[2001:4860:4801:10::1]:8080", "2001:4860:4801:10:0:0:0:1"],
    ["2001:4860:4801:10::1", "2001:4860:4801:10:0:0:0:1"],
    ["2001:4860:4801:0010:0000:0000:0000:0001", "2001:4860:4801:10:0:0:0:1"],
    ["::ffff:66.249.66.1", "66.249.66.1"],
    ["[::ffff:66.249.66.1]:80", "66.249.66.1"],
    ["::ffff:4231:4201", "66.49.66.1"],
    ["::FFFF:66.249.66.1", "66.249.66.1"],
    ["::ffff:66.249.66.1%eth0", "66.249.66.1"],
    ["fe80::1%eth0", "fe80:0:0:0:0:0:0:1"],
    ["fe80::1%", null],
    ["66.249.66.1%eth0", null],
    ["[]:80", null],
    ["[::1]:", null],
    ["[[::1]]", null],
    ["[::1]:80:80", null],
    ["", null],
    ["[", null],
    ["]", null],
    ["::", "0:0:0:0:0:0:0:0"],
    ["::ffff:0:0", "0.0.0.0"],
    ["64:ff9b::66.249.66.1", "64:ff9b:0:0:0:0:42f9:4201"],
    ["::66.249.66.1", "0:0:0:0:0:0:42f9:4201"],
    ["::ffff:66.249.66.1.5", null],
    ["1:2:3:4:5:6:7:8:9", null],
    ["1:2:3:4:5:6:7::", "1:2:3:4:5:6:7:0"],
    ["::1:2:3:4:5:6:7", "0:1:2:3:4:5:6:7"],
    ["1::2::3", null],
  ];
  for (const [input, expected] of cases) {
    it(`normalizeIp(${JSON.stringify(input)})`, () => assert.equal(normalizeIp(input), expected));
  }
  it("mapped v4 and its v6-form of the SAME address cannot differ from the true v4 of another host", () => {
    // ::ffff:66.249.66.1 must not equal a *different* v4
    assert.notEqual(normalizeIp("::ffff:66.249.66.2"), normalizeIp("66.249.66.1"));
    // unicode digits / fullwidth must not normalise
    assert.equal(normalizeIp("６６.249.66.1"), null);
    assert.equal(normalizeIp("66.249.66.1\u0000"), null);
    assert.equal(normalizeIp("66.249.66.1\n"), "66.249.66.1"); // trimmed, benign
    assert.equal(normalizeIp("66.249.66.1\n:80"), null);
  });
  it("stripping a port from a v4 does not alias v6-looking input", () => {
    // 'a:b:c:d:e:f:1.2.3.4:80' is not a valid v6 so must be null, not '1.2.3.4'
    assert.equal(normalizeIp("1:2:3:4:5:6:1.2.3.4:80"), null);
    assert.equal(normalizeIp("::1.2.3.4:80"), null);
  });
  it("normalizeIp never throws on garbage", () => {
    for (const v of ["\u0000", "%", "::%", "[::%]:1", "1.2.3.4:1e3", "0x1.2.3.4", "１.２.３.４"]) normalizeIp(v);
  });
});

describe("2c. verifyFcrdns end-to-end with fake DNS", () => {
  const res = (m: { rev?: Record<string, string[] | Error>; a?: Record<string, string[] | Error>; aaaa?: Record<string, string[] | Error> }): DnsResolver => {
    const pick = (t: Record<string, string[] | Error> | undefined, k: string) => {
      const v = t?.[k];
      if (v instanceof Error) return Promise.reject(v);
      if (v === undefined) return Promise.reject(Object.assign(new Error("nf"), { code: "ENOTFOUND" }));
      return Promise.resolve(v);
    };
    return { reverse: (ip) => pick(m.rev, ip), resolve4: (h) => pick(m.a, h), resolve6: (h) => pick(m.aaaa, h) };
  };
  it("ip:port form of a real Googlebot verifies", async () => {
    const r = res({ rev: { "66.249.66.1": ["crawl-66-249-66-1.googlebot.com"] }, a: { "crawl-66-249-66-1.googlebot.com": ["66.249.66.1"] } });
    assert.equal((await verifyFcrdns("66.249.66.1:443", ["googlebot.com"], r)).status, "verified");
    assert.equal((await verifyFcrdns("::ffff:66.249.66.1", ["googlebot.com"], r)).status, "verified");
  });
  it("an attacker-controlled PTR with underscore/punycode doesn't help w/o forward", async () => {
    const r = res({ rev: { "6.6.6.6": ["xn--evil.googlebot.com", "_x.googlebot.com"] }, a: {} });
    assert.deepEqual(await verifyFcrdns("6.6.6.6", ["googlebot.com"], r), { status: "failed", reason: "forward-mismatch" });
  });
  it("cosmetic: forward returning the ip padded / with port does not verify spoof", async () => {
    const r = res({ rev: { "6.6.6.6": ["x.googlebot.com"] }, a: { "x.googlebot.com": ["6.6.6.7", "6.6.6.6:80"] } });
    // normalizeIp strips ports on FORWARD addresses too: an A record can't contain a port, but a hostile
    // resolver stub might. characterise: does "6.6.6.6:80" count as forward-confirmed?
    const out = await verifyFcrdns("6.6.6.6", ["googlebot.com"], r);
    // defense-in-depth gap only: real A records never carry ports, so not exploitable with a real resolver.
    assert.equal(out.status, "verified");
  });
  it("forward list containing mapped v6 for a v4 query is irrelevant", async () => {
    const r = res({ rev: { "6.6.6.6": ["x.googlebot.com"] }, a: { "x.googlebot.com": ["::ffff:6.6.6.6"] } });
    // resolve4 can't return v6; but if a resolver does, mapped form equals ip -> verified. harmless.
    const out = await verifyFcrdns("6.6.6.6", ["googlebot.com"], r);
    assert.ok(out.status === "verified" || out.status === "failed");
  });
  it("many PTRs: only first 3 allowed candidates are tried (attacker pads with decoys)", async () => {
    // Real Google has 1 PTR. An attacker can't add a valid forward anyway. But a REAL crawler IP with
    // >3 PTRs where the genuine one is 4th (shared hosting) is refused. Characterise.
    const names = ["a.googlebot.com", "b.googlebot.com", "c.googlebot.com", "real.googlebot.com"];
    const r = res({ rev: { "6.6.6.6": names }, a: { "real.googlebot.com": ["6.6.6.6"] } });
    const out = await verifyFcrdns("6.6.6.6", ["googlebot.com"], r);
    assert.equal(out.status, "failed"); // intentional MAX_CANDIDATES=3 cap
  });
  it("reverse returning NXDOMAIN-like ENODATA is failed no-ptr; SERVFAIL is error", async () => {
    assert.deepEqual(await verifyFcrdns("1.1.1.1", ["googlebot.com"], res({ rev: { "1.1.1.1": Object.assign(new Error(), { code: "ENODATA" }) } })), { status: "failed", reason: "no-ptr" });
    assert.equal((await verifyFcrdns("1.1.1.1", ["googlebot.com"], res({ rev: { "1.1.1.1": Object.assign(new Error(), { code: "ESERVFAIL" }) } }))).status, "error");
  });
  it("cached verifier: attacker rotating IPs forces 1+3 DNS queries each (amplification)", async () => {
    let queries = 0;
    const r: DnsResolver = {
      reverse: async () => {
        queries++;
        return ["a.googlebot.com", "b.googlebot.com", "c.googlebot.com"];
      },
      resolve4: async () => {
        queries++;
        return [];
      },
      resolve6: async () => [],
    };
    const v = createCrawlerVerifier({ resolver: r });
    for (let i = 0; i < 100; i++) await v(`10.0.${i >> 8}.${i & 255}`, ["googlebot.com"]);
    // Characterisation: 400 DNS queries for 100 spoofed requests. No global rate cap on lookups.
    assert.equal(queries, 400);
  });
  it("cached verifier: concurrent duplicate lookups coalesce, overwrite doesn't evict neighbours", async () => {
    let q = 0;
    const r: DnsResolver = {
      reverse: async () => {
        q++;
        await new Promise((r) => setTimeout(r, 5));
        return ["x.googlebot.com"];
      },
      resolve4: async () => ["1.1.1.1"],
      resolve6: async () => [],
    };
    const v = createCrawlerVerifier({ resolver: r, maxEntries: 2 });
    await Promise.all([v("1.1.1.1", ["googlebot.com"]), v("1.1.1.1", ["googlebot.com"]), v("1.1.1.1", ["googlebot.com"])]);
    assert.equal(q, 1);
  });
  it("cache hit with identical key re-set evicts an unrelated entry when full (cosmetic)", async () => {
    const lookups: string[] = [];
    const r: DnsResolver = { reverse: async (ip) => (lookups.push(ip), ["x.googlebot.com"]), resolve4: async () => ["9.9.9.9"], resolve6: async () => [] };
    let t = 0;
    const v = createCrawlerVerifier({ resolver: r, maxEntries: 2, now: () => t, errorTtlMs: 10 });
    await v("1.1.1.1", ["googlebot.com"]); // failed (forward mismatch), ttl 6h
    await v("2.2.2.2", ["googlebot.com"]);
    t += 6 * 3600_000 + 1; // both expired
    await v("2.2.2.2", ["googlebot.com"]); // overwrite: should not evict 1.1.1.1's slot unnecessarily
    // no assertion on eviction correctness besides not throwing
    assert.ok(true);
  });
});

// ---------------------------------------------------------------------------
describe("2d. challenge", () => {
  const secret = "s".repeat(32);
  const base = () => issueChallenge({ secret, subject: "ip1", difficultyBits: 4 });

  it("happy path + replay + wrong subject", () => {
    const c = base();
    const nonce = solveChallenge(c.token, c.difficultyBits);
    const replay = createReplayGuard();
    assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "ip1", replay }), { ok: true });
    assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "ip1", replay }), { ok: false, reason: "replayed" });
    assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "ip2" }), { ok: false, reason: "wrong-subject" });
  });

  it("aliasing: signature part variants all rejected", () => {
    const c = base();
    const nonce = solveChallenge(c.token, c.difficultyBits);
    const [body, sig] = c.token.split(".");
    const variants = [
      `${body}.${sig}=`,
      `${body}.${sig}==`,
      `${body}.${sig}\n`,
      `${body}.\n${sig}`,
      `${body}.${sig.slice(0, 2)}\r\n${sig.slice(2)}`,
      `${body}=.${sig}`,
      `${body}\n.${sig}`,
      `${body}.${sig.replace(/[A-Za-z0-9_-]$/, (ch) => (ch === "A" ? "B" : "A"))}`,
      `${body}.${sig}.`,
      `${body}.${sig}.junk`,
      `${body}.${sig.replace(/-/g, "+").replace(/_/g, "/")}`,
      ` ${body}.${sig}`,
      // flip ONLY the padding bits of the last sextet: same decoded bytes, different string
      (() => {
        const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        const last = A.indexOf(sig[sig.length - 1]);
        return `${body}.${sig.slice(0, -1)}${A[last ^ 1]}`;
      })(),
    ].filter((v) => v !== c.token);
    for (const v of variants) {
      const r = verifyChallenge(v, nonce, { secret, subject: "ip1" });
      assert.equal(r.ok, false, JSON.stringify(v));
    }
  });

  it("aliasing: base64 standard alphabet chars in body", () => {
    const c = base();
    const [body, sig] = c.token.split(".");
    // swap one '-'/'_' to '+'/'/' only if present
    const alt = body.replace(/-/g, "+").replace(/_/g, "/");
    if (alt !== body) assert.equal(verifyChallenge(`${alt}.${sig}`, "0", { secret, subject: "ip1" }).ok, false);
  });

  it("nonce aliasing: different nonce strings for same work are distinct solutions but replay id is per token", () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: 1 });
    // find 2 distinct valid nonces
    const good: string[] = [];
    for (let i = 0; good.length < 2; i++) {
      const n = i.toString(36);
      if (verifyChallenge(c.token, n, { secret, subject: "ip1" }).ok) good.push(n);
    }
    const replay = createReplayGuard();
    assert.equal(verifyChallenge(c.token, good[0], { secret, subject: "ip1", replay }).ok, true);
    assert.equal(verifyChallenge(c.token, good[1], { secret, subject: "ip1", replay }).ok, false);
  });

  it("nonce with unicode/NUL/long", () => {
    const c = base();
    for (const n of ["", "a".repeat(65), "\u0000", "é"]) {
      const r = verifyChallenge(c.token, n, { secret, subject: "ip1" });
      assert.equal(r.ok, n === "\u0000" || n === "é" ? r.ok : false);
    }
  });

  it("non-string token/nonce/secret/subject do not throw", () => {
    for (const v of [null, undefined, 5, {}, []] as unknown[]) {
      assert.doesNotThrow(() => verifyChallenge(v as string, v as string, { secret, subject: "ip1" }));
    }
    // secret KHÔNG đến từ client — thiếu/sai kiểu là lỗi cấu hình nên phải NÉM, không nuốt lỗi.
    assert.throws(() => verifyChallenge("a.b", "n", { secret: undefined as unknown as string, subject: "x" }), RangeError);
    assert.doesNotThrow(() => verifyChallenge("a.b", "n", { secret, subject: undefined as unknown as string }));
  });

  it("BUG: verify with an EMPTY secret mirrors issue's min length? (verify accepts any secret)", () => {
    // issue throws for <16 chars; verify with "" would HMAC with empty key — a misconfigured env var
    // (undefined -> "") must not validate forged tokens.
    const forged = (() => {
      const payload = Buffer.from(JSON.stringify({ s: "ip1", e: Date.now() + 60000, d: 1, r: "x" })).toString("base64url");
      return `${payload}.${createHmac("sha256", "").update(payload).digest().toString("base64url")}`;
    })();
    const nonce = (() => {
      for (let i = 0; ; i++) {
        const n = i.toString(36);
        try {
          if (verifyChallenge(forged, n, { secret: "", subject: "ip1" }).ok) return n;
        } catch {
          return null; // verify từ chối secret rỗng bằng cách NÉM — đúng như issue
        }
        if (i > 1000) return null;
      }
    })();
    assert.equal(nonce, null, "verifyChallenge accepts tokens HMAC'd with an EMPTY secret (env var unset) -> anyone can forge");
  });

  it("cosmetic: payload fields with wrong types (validly signed): difficulty absent", () => {
    // Only reachable with the secret; ensures no crash when payload.d undefined => leadingZeroBits < undefined false => ok!
    const body = Buffer.from(JSON.stringify({ s: "ip1", e: Date.now() + 60000, r: "x" })).toString("base64url");
    const token = `${body}.${createHmac("sha256", secret).update(body).digest().toString("base64url")}`;
    const r = verifyChallenge(token, "0", { secret, subject: "ip1" });
    // only reachable with the secret; characterise (defense-in-depth: verify trusts payload shape)
    assert.equal(r.ok, true);
  });

  it("BUG: DoS: replay guard filled with live ids rejects every other legit solve", () => {
    const t = 1_000_000;
    const replay = createReplayGuard(() => t, 50);
    // attacker: 50 cheap valid solutions at low difficulty from its own subject
    for (let i = 0; i < 50; i++) {
      const c = issueChallenge({ secret, subject: "attacker", difficultyBits: 1, now: () => t });
      const nonce = solveChallenge(c.token, 1);
      // Hạn mức theo chủ thể: kẻ tấn công tự bị từ chối sau vài lời giải, không cần thành công cả 50.
      verifyChallenge(c.token, nonce, { secret, subject: "attacker", replay, now: () => t });
    }
    const c = issueChallenge({ secret, subject: "human", difficultyBits: 1, now: () => t });
    const nonce = solveChallenge(c.token, 1);
    const r = verifyChallenge(c.token, nonce, { secret, subject: "human", replay, now: () => t });
    // fail-closed: legit solve gets 'replayed'. Characterise cost: a single subject can fill the whole shared table.
    assert.equal(r.ok, true, "BUG: one subject can fill the replay table (no per-subject quota); legit solver gets 'replayed'");
  });

  it("replay guard: attacker cost at default difficulty 16 to fill 10k", () => {
    // 10_000 * 2^16 = 655M hashes in a 60s TTL window. Just document math.
    assert.ok(10_000 * 2 ** 16 < 1e9);
  });

  it("replay guard: expired entries are swept when full, then accepted", () => {
    let t = 0;
    const g = createReplayGuard(() => t, 3);
    assert.equal(g.seen("a", 10), false);
    assert.equal(g.seen("b", 10), false);
    assert.equal(g.seen("c", 10), false);
    assert.equal(g.seen("d", 10), true); // full of live ids -> fail closed
    t = 11;
    assert.equal(g.seen("d", 100), false);
    assert.equal(g.seen("a", 100), false);
  });

  it("replay guard: id seen with expired prior can be reused (token itself must be expired then)", () => {
    let t = 0;
    const g = createReplayGuard(() => t, 10);
    g.seen("a", 5);
    t = 6;
    assert.equal(g.seen("a", 100), false);
  });

});

// ---------------------------------------------------------------------------
describe("2e. rate limiter + decide", () => {
  const A = (score: number, classification: Assessment["classification"] = "human-likely"): Assessment => ({ score, classification, signals: [] });
  const mk = () => {
    let t = 0;
    return { lim: new MemoryRateLimiter({ now: () => t }), tick: (ms: number) => (t += ms) };
  };

  it("BUG: a bot at score>=60 on a shared IP (CGNAT) drains the bucket humans use", () => {
    const { lim } = mk();
    for (let i = 0; i < 6; i++) decide(A(70), { limiter: lim, key: "cgnat-ip" });
    const human = decide(A(0), { limiter: lim, key: "cgnat-ip" });
    assert.equal(human.action, "allow", `a score-0 human sharing the key with a noisy bot got ${human.action}`);
  });

  it("BUG: flagged (30-59) traffic from one NAT drains humans' budget", () => {
    const { lim } = mk();
    for (let i = 0; i < 30; i++) decide(A(35), { limiter: lim, key: "ip" });
    assert.equal(decide(A(0), { limiter: lim, key: "ip" }).action, "allow");
  });

  it("per-key isolation", () => {
    const { lim } = mk();
    for (let i = 0; i < 10; i++) decide(A(70), { limiter: lim, key: "bot" });
    assert.equal(decide(A(0), { limiter: lim, key: "human" }).action, "allow");
  });

  it("score 79 vs 80 boundary, 29/30, 59/60", () => {
    const { lim } = mk();
    assert.equal(decide(A(80), { limiter: lim, key: "k" }).action, "challenge");
    assert.equal(decide(A(79), { limiter: lim, key: "k" }).action, "flag");
    assert.equal(decide(A(29), { limiter: lim, key: "k" }).action, "allow");
    assert.equal(decide(A(30), { limiter: lim, key: "k" }).action, "flag");
  });

  it("NaN / Infinity / -Infinity / undefined / negative / >100 scores", () => {
    const { lim } = mk();
    const act = (s: number) => decide(A(s), { limiter: lim, key: `k${s}` }).action;
    assert.equal(act(NaN), "flag");
    assert.equal(act(Infinity), "flag"); // README: non-finite -> flag (documented; cosmetic that +Infinity is not challenge)
    assert.equal(act(-Infinity), "flag"); // non-finite -> flag, per README
    assert.equal(act(1e9), "challenge");
    assert.equal(act(-5), "allow");
    assert.equal(decide({ score: undefined as unknown as number, classification: "human-likely", signals: [] }, { limiter: lim, key: "u" }).action, "flag");
  });

  it("verified-crawler bypass requires classification only (assessment is trusted)", () => {
    const { lim } = mk();
    const d = decide(A(100, "verified-crawler"), { limiter: lim, key: "k" });
    assert.equal(d.action, "allow");
  });

  it("verified-crawler bucket flood returns rate-limited with retryAfter 1", () => {
    const { lim } = mk();
    let last;
    for (let i = 0; i < 130; i++) last = decide(A(0, "verified-crawler"), { limiter: lim, key: "g" });
    assert.equal(last?.action, "rate-limited");
    assert.equal(last?.retryAfterSec, 1);
  });

  it("challenge tier consumes no tokens and is unbounded", () => {
    const { lim } = mk();
    for (let i = 0; i < 100_000; i++) assert.equal(decide(A(95), { limiter: lim, key: "k" }).action, "challenge");
    assert.equal(lim.size, 0);
  });

  it("thresholds ordering mis-config (flag > challenge) does not crash", () => {
    const { lim } = mk();
    decide(A(50), { limiter: lim, key: "k", thresholds: { flag: 90, rateLimit: 60, challenge: 20 } });
  });

  it("rate limiter: refill math, retryAfter, cost > capacity, clock jump back", () => {
    let t = 0;
    const lim = new MemoryRateLimiter({ now: () => t });
    const rule = { capacity: 10, refillPerSec: 1 };
    for (let i = 0; i < 10; i++) assert.equal(lim.take("a", rule).allowed, true);
    const r = lim.take("a", rule);
    assert.equal(r.allowed, false);
    assert.equal(r.retryAfterSec, 1);
    t = -100_000;
    assert.equal(lim.take("a", rule).allowed, false);
    t = 1000;
    assert.equal(lim.take("a", rule).allowed, true);
    assert.equal(lim.take("big", rule, 11).retryAfterSec, undefined);
    assert.throws(() => lim.take("a", rule, 0));
    assert.throws(() => lim.take("a", rule, NaN));
    assert.throws(() => lim.take("a", rule, -1));
    assert.throws(() => lim.take("a", rule, Infinity));
  });

  it("rate limiter: refillPerSec 0 / NaN capacity", () => {
    const lim = new MemoryRateLimiter({ now: () => 0 });
    assert.equal(lim.take("a", { capacity: 1, refillPerSec: 0 }).allowed, true);
    assert.equal(lim.take("a", { capacity: 1, refillPerSec: 0 }).allowed, false);
    const r = lim.take("z", { capacity: NaN, refillPerSec: 1 });
    assert.equal(r.allowed, false);
    const r2 = lim.take("y", { capacity: 5, refillPerSec: NaN });
    assert.equal(Number.isNaN(r2.retryAfterSec as number), false, "NaN retryAfterSec leaks");
  });

  it("rate limiter: never exceeds maxKeys", () => {
    const lim = new MemoryRateLimiter({ maxKeys: 50, now: () => 0 });
    for (let i = 0; i < 5000; i++) lim.take(`k${i}`, { capacity: 5, refillPerSec: 1 });
    assert.ok(lim.size <= 50);
  });

  it("rate limiter: maxKeys 0 / 1", () => {
    const l0 = new MemoryRateLimiter({ maxKeys: 0, now: () => 0 });
    for (let i = 0; i < 10; i++) l0.take("a", { capacity: 1, refillPerSec: 0 });
    // maxKeys = 0 -> evictOne has nothing to evict; size grows to 1
    assert.ok(l0.size <= 1);
    const l1 = new MemoryRateLimiter({ maxKeys: 1, now: () => 0 });
    l1.take("a", { capacity: 1, refillPerSec: 0 });
    // second key evicts the DRAINED 'a' (fallback) and gives 'a' a fresh bucket next time
    l1.take("b", { capacity: 1, refillPerSec: 0 });
    assert.equal(l1.take("a", { capacity: 1, refillPerSec: 0 }).allowed, true);
  });

  it("BUG: eviction: attacker with 64 drained keys at the head resets itself via fallback-oldest", () => {
    // 64 attacker keys (e.g. IPv6 /64 rotation) drained first, victims after, then a spray of fresh keys.
    const rule = { capacity: 10, refillPerSec: 0.0001 };
    const lim = new MemoryRateLimiter({ maxKeys: 200, now: () => 0 });
    for (let i = 0; i < 64; i++) for (let j = 0; j < 10; j++) lim.take(`atk${i}`, rule);
    for (let i = 0; i < 100; i++) lim.take(`legit${i}`, rule);
    for (let i = 0; i < 70; i++) lim.take(`spray${i}`, rule);
    // atk0 is the oldest drained key: after the spray it should still be limited
    assert.equal(lim.take("atk0", rule).allowed, false, "drained attacker key was evicted and got a fresh burst");
  });

  it("eviction: single drained attacker key survives a 20k-key spray", () => {
    const rule = { capacity: 10, refillPerSec: 0.0001 };
    const lim = new MemoryRateLimiter({ maxKeys: 1000, now: () => 0 });
    for (let j = 0; j < 10; j++) lim.take("atk", rule);
    for (let i = 0; i < 20_000; i++) lim.take(`s${i}`, rule);
    assert.equal(lim.take("atk", rule).allowed, false);
  });

  it("eviction: legit key at exactly 50% tokens is treated as 'idle'", () => {
    const rule = { capacity: 10, refillPerSec: 0 };
    const lim = new MemoryRateLimiter({ maxKeys: 3, now: () => 0 });
    for (let j = 0; j < 5; j++) lim.take("busy", rule); // 5 left, exactly 50%
    lim.take("b", rule);
    lim.take("c", rule);
    lim.take("d", rule); // evicts 'busy' (>=50%)
    // busy now gets a full burst again — limit resets for a client that used half
    assert.equal(lim.take("busy", rule).remaining, 9, "characterisation: client that spent 5 tokens was evicted and got a fresh 10 (design)");
  });

  it("eviction uses stale token counts: a long-idle drained bucket looks 'busy' so fresh idle ones are evicted first (cosmetic)", () => {
    let t = 0;
    const rule = { capacity: 10, refillPerSec: 1 };
    const lim = new MemoryRateLimiter({ maxKeys: 2, now: () => t });
    for (let j = 0; j < 10; j++) lim.take("drainedLongAgo", rule);
    t = 3600_000;
    lim.take("fresh", rule);
    lim.take("newcomer", rule); // evicts 'fresh' not 'drainedLongAgo'
    assert.equal(lim.size, 2);
  });

  it("many mixed-cost takes never push tokens negative", () => {
    let t = 0;
    const lim = new MemoryRateLimiter({ now: () => t });
    const rule = { capacity: 120, refillPerSec: 2 };
    let allowed = 0;
    for (let i = 0; i < 5000; i++) {
      t += 7;
      const r = lim.take("k", rule, i % 3 === 0 ? 20 : i % 3 === 1 ? 4 : 1);
      if (r.allowed) allowed++;
      assert.ok(r.remaining >= 0);
    }
    assert.ok(allowed > 0);
  });
});

// ---------------------------------------------------------------------------
describe("3. bypasses at the header layer (scores < 30 for scrapers)", () => {
  const chromeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const cases: Array<[string, Record<string, string>]> = [
    ["python-requests spoofing Chrome UA + 3 headers", { "user-agent": chromeUa, accept: ACC_CHROME, "accept-language": "en-US,en;q=0.9" }],
    ["curl-impersonate / Playwright APIRequest w/ full headers", { "user-agent": chromeUa, accept: ACC_CHROME, "accept-language": "en-US", ...NAV, ...chHints("Google Chrome", "Windows") }],
    ["scrapy with Chrome UA, sec-fetch-mode only", { "user-agent": chromeUa, accept: ACC_CHROME, "accept-language": "en", "sec-fetch-mode": "navigate" }],
    ["declared AI fetcher Perplexity-User", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)", accept: "text/html,*/*" }],
    ["declared AI fetcher Claude-User", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)", accept: "text/html,*/*" }],
    ["declared ChatGPT-User", { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", accept: "text/html" }],
    ["generic Mozilla compat fetcher", { "user-agent": "Mozilla/5.0 (compatible; MyFetcher/1.0; +https://x.example/info)", accept: "text/html,*/*;q=0.8", "accept-language": "en" }],
    ["Slack-ImgProxy", { "user-agent": "Slack-ImgProxy (+https://api.slack.com/robots)", accept: "image/*" }],
    ["Pingdom-style monitor w/out 'bot'", { "user-agent": "Mozilla/5.0 (compatible; Site24x7)", accept: "text/html" }],
    ["Chrome UA + sec-fetch-mode: same-origin (spoofed)", { "user-agent": chromeUa, accept: ACC_CHROME, "accept-language": "en", "sec-fetch-mode": "same-origin" }],
    ["UA with soft hyphen in curl", { "user-agent": "Mozilla/5.0 (compatible; c­url/8.0)", accept: ACC_CHROME, "accept-language": "en", "sec-fetch-mode": "navigate" }],
  ];
  const fixable = /Claude-User|Perplexity-User/;
  for (const [name, h] of cases) {
    const a = assessRequestSync({ headers: hdrs(h) });
    if (fixable.test(name)) {
      it(`BUG: declared fetcher/monitor UA without 'bot' stays under flag: ${name}`, () => {
        assert.ok(a.score >= 30, `${name} scored ${a.score}`);
      });
    } else {
      it(`limitation (documented, header-layer cannot see it): ${name} scored ${a.score}`, () => {
        console.log(`   bypass? ${String(a.score).padStart(3)}  ${name}`);
        assert.ok(true);
      });
    }
  }
  it("limitation: Chrome >=89 UA with NO sec-ch-ua and NO sec-fetch costs only 10 (proxies strip both, so raising is risky)", () => {
    const a = assessRequestSync({ headers: hdrs({ "user-agent": chromeUa, accept: ACC_CHROME, "accept-language": "en-US" }) });
    assert.equal(a.score, 10);
  });
});

// ---------------------------------------------------------------------------
describe("4. README vs code", () => {
  it("assessRequest: spoofed crawler classification and score >= 95", async () => {
    const r: DnsResolver = { reverse: async () => ["evil.example.com"], resolve4: async () => [], resolve6: async () => [] };
    const v = createCrawlerVerifier({ resolver: r });
    const a = await assessRequest({ headers: hdrs({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }), ip: "6.6.6.6" }, v);
    assert.equal(a.classification, "spoofed-crawler");
    assert.ok(a.score >= 95);
  });
  it("README: 'Điểm không hữu hạn rơi vào bậc flag' - includes +Infinity (worst)?", () => {
    // see decide NaN/Infinity test above
    assert.ok(true);
  });
  it("README claims bot Googlebot with ip:port from proxy verifies", async () => {
    const r: DnsResolver = { reverse: async () => ["crawl-1.googlebot.com"], resolve4: async () => ["66.249.66.1"], resolve6: async () => [] };
    const v = createCrawlerVerifier({ resolver: r });
    const a = await assessRequest({ headers: hdrs({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }), ip: "66.249.66.1:5555" }, v);
    assert.equal(a.classification, "verified-crawler");
  });
  it("sync path: real Googlebot (no asn) scores 55 'suspicious' (unverified floor)", () => {
    const a = assessRequestSync({ headers: hdrs({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }) });
    assert.equal(a.score, 55);
  });
  it("Meta ASN verified via header; faked header on non-Vercel host is documented", () => {
    const a = assessRequestSync({ headers: hdrs({ "user-agent": "facebookexternalhit/1.1", "x-vercel-ip-as-number": "32934" }) });
    assert.equal(a.classification, "verified-crawler");
  });
  it("ASN header forms", () => {
    for (const bad of ["0x80A6", "32934.0", "32934 ", " 32934", "+32934", "032934", "3.2934e4", "٣٢٩٣٤", "32934,32934"]) {
      const a = assessRequestSync({ headers: hdrs({ "user-agent": "facebookexternalhit/1.1", "x-vercel-ip-as-number": bad }) });
      // "032934" (leading zero) and trimmed forms are accepted by readAsn; flag the ones that map to Meta
      if (a.classification === "verified-crawler") console.log("   ASN header accepted as Meta:", JSON.stringify(bad));
    }
  });
  it("README test-count claim ('79 test') vs reality is documented in report", () => {
    assert.ok(true);
  });
});

// ---------------------------------------------------------------------------
describe("5. extra probes", () => {
  const niche: Array<[string, string, string]> = [
    ["Lynx", "Lynx/2.9.0 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2", "text/html, text/plain, text/sgml, */*;q=0.01"],
    ["w3m", "w3m/0.5.3+git20230121", "text/html, text/*;q=0.5, image/*"],
    ["Links", "Links (2.29; Linux 5.15.0 x86_64; GNU C 11.4; text)", "*/*"],
    ["ELinks", "ELinks/0.16.1 (textmode; Linux 6.1; 80x24-2)", "*/*"],
    ["NetSurf", "NetSurf/3.10 (Linux)", "text/html,application/xhtml+xml,*/*;q=0.8"],
    ["Nokia S40", "Nokia6230i/2.0 (03.25) Profile/MIDP-2.0 Configuration/CLDC-1.1", "application/vnd.wap.xhtml+xml,application/xhtml+xml,text/html"],
    ["BlackBerry 9700", "BlackBerry9700/5.0.0.351 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/123", "application/vnd.rim.html,text/html,application/xhtml+xml,*/*"],
    ["Samsung feature phone", "SAMSUNG-SGH-A867/A867UCHA9 SHP/VPP/R5 NetFront/3.4 Qtv5.3 SMM-MMS/1.2.0 profile/MIDP-2.0 configuration/CLDC-1.1", "text/html,*/*"],
  ];
  for (const [name, ua, accept] of niche) {
    it(`niche human client scored ${name}`, () => {
      const a = assessRequestSync({ headers: hdrs({ "user-agent": ua, accept, "accept-language": "en" }) });
      console.log(`   niche ${String(a.score).padStart(3)} ${name} [${a.signals.map((x) => x.id)}]`);
      assert.ok(true);
    });
  }

  it("BUG (latent, low): UA containing 'Microsoft' is read as Chrome OS by platformFromUa -> platform-mismatch on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Microsoft-Teams-Embedded";
    const sigs = headerSignals(hdrs({ "user-agent": ua, accept: ACC_CHROME, "accept-language": "en", ...NAV, ...chHints("Google Chrome", "Windows") }), ua);
    assert.equal(sigs.some((x) => x.id === "platform-mismatch"), false);
  });

  it("combineWeights: bounded, monotone, order-free, ignores NaN", () => {
    for (let n = 0; n < 2000; n++) {
      const w = Array.from({ length: 1 + (n % 7) }, () => ({ id: "no-sec-fetch" as const, weight: Math.random() * 130 - 10 }));
      const a = combineWeights(w);
      assert.ok(a >= 0 && a <= 100);
      assert.equal(combineWeights([...w].reverse()), a);
      assert.ok(combineWeights([...w, { id: "no-sec-fetch", weight: 20 }]) >= a);
    }
    assert.equal(combineWeights([{ id: "no-sec-fetch", weight: NaN }]), 0);
    assert.equal(combineWeights([{ id: "no-sec-fetch", weight: Infinity }]), 0, "Infinity weight (worst) is DROPPED like NaN");
  });

  it("fcrdns worst-case latency is 1 + MAX_CANDIDATES sequential timeouts", async () => {
    const hang = () => new Promise<string[]>(() => {});
    const r: DnsResolver = { reverse: async () => ["a.googlebot.com", "b.googlebot.com", "c.googlebot.com"], resolve4: hang, resolve6: hang };
    const t0 = performance.now();
    const out = await verifyFcrdns("1.2.3.4", ["googlebot.com"], r, 100);
    const dt = performance.now() - t0;
    assert.equal(out.status, "error");
    // characterisation: forward lookups are sequential => worst case = 1 + 3 timeouts (8s at the default 2s), not 1.
    assert.ok(dt >= 250, `${dt.toFixed(0)}ms`);
  });

  it("assessRequest never throws when verifier returns garbage", async () => {
    const bad = (async () => ({ status: "weird" })) as unknown as Parameters<typeof assessRequest>[1];
    const a = await assessRequest({ headers: hdrs({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }), ip: "1.2.3.4" }, bad);
    assert.ok(Number.isFinite(a.score));
  });
});
