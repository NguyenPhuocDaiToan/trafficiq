/**
 * Round 6 — independent confirmation review. Written from scratch, no other test file was read.
 * Tests prefixed "BUG:" document real defects and are expected to FAIL until the library is fixed.
 */
import { test } from "node:test";
import v8 from "node:v8";
v8.setFlagsFromString("--expose-gc");
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assessRequestSync,
  decide,
  MemoryRateLimiter,
  issueChallenge,
  verifyChallenge,
  solveChallenge,
  createReplayGuard,
  parseTelemetry,
  telemetrySignals,
  DEFAULT_THRESHOLDS,
  HUMAN_RULE,
  SUSPECT_RULE,
  RATE_COSTS,
  createCrawlerVerifier,
} from "@/lib/botdetect";
import {
  cleanUa,
  combineWeights,
  headerSignals,
  uaSignals,
  isBrowserLikeUa,
  isPlaceholderUa,
  looksAutomated,
  readAsn,
} from "@/lib/botdetect/signals";
import { normalizeIp, hostMatchesSuffix } from "@/lib/botdetect/fcrdns";
import { BOT_UA_REGEX, LEGACY_BROWSER_UA } from "@/lib/tracking/ua";

// ---------------------------------------------------------------- helpers
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)];

function bag(h: Record<string, string>) {
  return new Headers(h);
}

const MODERN: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
};
// Old devices: no Sec-Fetch, but they do send Accept + Accept-Language most of the time.
const LEGACY: Record<string, string> = {
  accept: "text/html, application/xhtml+xml, */*",
  "accept-language": "en-US,en;q=0.5",
};
// Worst realistic legacy: no Accept-Language either.
const LEGACY_MIN: Record<string, string> = { accept: "text/html,*/*;q=0.1" };

function scoreOf(ua: string, h: Record<string, string>) {
  return assessRequestSync({ headers: bag({ ...h, "user-agent": ua }) }).score;
}

// ------------------------------------------------- 2. legit UA corpus
const MODERN_UAS: [string, string][] = [
  ["Chrome Win", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"],
  ["Firefox Linux", "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"],
  ["Safari iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
  ["Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"],
  ["Opera desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"],
  ["Coc Coc", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/120.0.6099.216 Chrome/114.0.5735.201 Safari/537.36"],
  ["Facebook iOS in-app", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.108;FBBV/600000000;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]"],
  ["Facebook Android in-app", "Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.46.109;]"],
  ["Instagram in-app", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.30.109 (iPhone14,2; iOS 17_5; vi_VN; vi-VN; scale=3.00; 1170x2532; 600000000)"],
  ["TikTok in-app", "Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.147 Mobile Safari/537.36 trill_2023500010 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/35.0.1 ByteLocale/vi-VN"],
  ["Zalo in-app", "Mozilla/5.0 (Linux; Android 11; Redmi Note 9 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Zalo/12.0.1"],
  ["Line in-app", "Mozilla/5.0 (Linux; Android 10; SM-G973F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 Line/13.0.0"],
  ["WeChat", "Mozilla/5.0 (Linux; Android 12; M2102J2SC Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5075 MMWEBSDK/20230504 MMWEBID/1 MicroMessenger/8.0.37.2380(0x28002537) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64"],
  ["UC Browser", "Mozilla/5.0 (Linux; U; Android 9; en-US; Redmi 7A Build/PKQ1.190319.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.108 UCBrowser/13.4.0.1306 Mobile Safari/537.36"],
  ["Opera Mini (Presto)", "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16"],
  ["Opera Mini (J2ME)", "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54"],
  ["Opera Mobi", "Opera/9.80 (Android 2.3.3; Linux; Opera Mobi/ADR-1111101157; U; es-ES) Presto/2.9.201 Version/11.50"],
  ["Nintendo Wii", "Opera/9.30 (Nintendo Wii; U; ; 3642; en)"],
  ["Nintendo DSi", "Opera/9.50 (Nintendo DSi; Opera/507; U; en-US)"],
  ["Nintendo Switch", "Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/609.4 (KHTML, like Gecko) NF/6.0.2.21.3 NintendoBrowser/5.1.0.22474"],
  ["Nintendo 3DS", "Mozilla/5.0 (Nintendo 3DS; U; ; en) Version/1.7412.EU"],
  ["PS5", "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15"],
  ["PS Vita", "Mozilla/5.0 (PlayStation Vita 3.74) AppleWebKit/537.73 (KHTML, like Gecko) Silk/3.2"],
  ["PSP", "Mozilla/4.0 (PSP (PlayStation Portable); 2.00)"],
  ["Xbox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.82 Safari/537.36 Edge/20.02"],
  ["Kindle", "Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+"],
  ["Kobo", "Mozilla/5.0 (Linux; U; Android 4.0; en-us; Kobo Touch) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30"],
  ["Tizen TV", "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36"],
  ["webOS TV", "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager"],
  ["Tesla", "Mozilla/5.0 (X11; GNU/Linux) AppleWebKit/601.1 (KHTML, like Gecko) Tesla QtCarBrowser Safari/601.1"],
  ["KaiOS Nokia 8110", "Mozilla/5.0 (Mobile; Nokia 8110 4G; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5"],
  ["Nokia S40 Ovi", "Mozilla/5.0 (Series40; Nokia200/11.81; Profile/MIDP-2.1 Configuration/CLDC-1.1) Gecko/20100401 S40OviBrowser/2.2.0.0.31"],
  ["BlackBerry 10", "Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.1.0.4633 Mobile Safari/537.10+"],
  ["Windows Phone", "Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)"],
  ["IE6", "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)"],
  ["IE 11", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko"],
  ["Silk", "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/118.5.1 like Chrome/118.0.0.0 Safari/537.36"],
  ["DuckDuckGo", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15"],
  ["Cubot phone", "Mozilla/5.0 (Linux; Android 11; CUBOT KingKong 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36"],
  ["Pinterest app", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]"],
  ["Mozilla locale-ish", "Mozilla/5.0 (X11; U; Linux i686; fr-FR; rv:1.9.0.1) Gecko/2008070206 Firefox/3.0.1"],
  ["Lynx", "Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2"],
  ["Lynx 2.9", "Lynx/2.9.0dev.12 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/3.7.8"],
  ["Links", "Links (2.29; Linux 6.1.0 x86_64; GNU C 12.2; text)"],
  ["ELinks", "ELinks/0.16.1.1 (textmode; Linux 6.1.0 x86_64; 211x56-2)"],
  ["w3m", "w3m/0.5.3+git20230121"],
  ["NetSurf", "NetSurf/3.10 (Linux; x86_64)"],
  ["Midori old", "Midori/0.5.11 (X11)"],
  ["Dolphin", "Dolphin/1.0"],
  ["Sailfish", "Mozilla/5.0 (Maemo; Linux; U; Jolla; Sailfish; Mobile; rv:38.0) Gecko/38.0 Firefox/38.0 SailfishBrowser/1.0"],
];
const LEGACY_PHONE_UAS: [string, string][] = [
  ["Samsung SGH-E250", "Samsung-SGH-E250/1.0 Profile/MIDP-2.0 Configuration/CLDC-1.1 UP.Browser/6.2.3.3.c.1.101 (GUI) MMP/2.0"],
  ["SAMSUNG SGH-A727", "SAMSUNG-SGH-A727/1.0 SHP/VPP/R5 NetFront/3.5"],
  ["SEC-SGHX210", "SEC-SGHX210/1.0 UP.Link/6.3.1.13.0"],
  ["SIE-S65", "SIE-S65/50 UP.Browser/7.0.0.1.181 (GUI) MMP/2.0"],
  ["MOT-V3", "MOT-V3/0E.43.04R MIB/2.2.1 Profile/MIDP-2.0 Configuration/CLDC-1.0"],
  ["LG-GC900", "LG-GC900/V10a Obigo/WAP2.0 Profile/MIDP-2.1 Configuration/CLDC-1.1"],
  ["Nokia6230i", "Nokia6230i/2.0 (03.25) Profile/MIDP-2.0 Configuration/CLDC-1.1"],
  ["NokiaN73", "NokiaN73-1/3.0638.0.0.1 Series60/3.0 Profile/MIDP-2.0 Configuration/CLDC-1.1"],
  ["Nokia5800", "Nokia5800d-1/10.0.1 (EN) Series60/5.0 Profile/MIDP-2.1"],
  ["Nokia C3", "NokiaC3-00/5.0 (07.20) Profile/MIDP-2.1 Configuration/CLDC-1.1"],
  ["BlackBerry9000", "BlackBerry9000/5.0.0.351 Profile/MIDP-2.0 Configuration/CLDC-1.1 VendorID/102"],
  ["SE K800", "SonyEricssonK800i/R1JG Browser/NetFront/3.3 Profile/MIDP-2.0 Configuration/CLDC-1.1"],
  ["portalmmm", "portalmmm/2.0 N400i(c20;TB)"],
  ["UCWEB", "UCWEB/2.0 (MIDP-2.0; U; Adr 4.0.4; en-US; GT-I9100) U2/1.0.0 UCBrowser/9.1.0.396 U2/1.0.0 Mobile"],
];
// Real device UAs that are NOT of the shapes the allowlist knows. Informational ("observations") —
// asserted in a separate, clearly-labelled test so the severity can be judged.
const LEGACY_PHONE_UAS_EXTRA: [string, string][] = [
  ["LG Viewty (Java/ASVM token)", "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1"],
  ["LG-KU990 Obigo+Java/ASVM", "LG-KU990/V10a Obigo/Q05A MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1"],
  ["Motorola MOTORIZR", "MOTORIZR-Z8/46.00.00 Mozilla/4.0 (compatible; MSIE 6.0; Symbian OS; 356) Opera 8.65 [it]"],
  ["UCWEB7 old format", "UCWEB7.0.2.37/28/999"],
  ["HTC WinMo", "HTC-8500/1.2 Mozilla/4.0 (compatible; MSIE 4.01; Windows CE; PPC; 240x320)"],
  ["Openwave", "UP.Browser/3.04-TS14 UP.Link/3.4.4"],
  ["Alcatel", "Alcatel-BF3/1.0 UP.Browser/6.1.0.6.1"],
];

test("legit modern/in-app/console/TV/text-browser UAs score < 30 with realistic headers", () => {
  const bad: string[] = [];
  for (const [name, ua] of MODERN_UAS) {
    const hdrs = /Mozilla\/5\.0 \((?:Windows NT 10|X11; Linux|iPhone)/.test(ua) ? MODERN : LEGACY;
    const s = scoreOf(ua, hdrs);
    if (s >= 30) bad.push(`${name}: ${s}`);
  }
  assert.deepEqual(bad, []);
});

test("legit modern UAs score < 30 even with the minimum header set (Accept only)", () => {
  const bad: string[] = [];
  for (const [name, ua] of MODERN_UAS) {
    const s = scoreOf(ua, LEGACY_MIN);
    if (s >= 30) bad.push(`${name}: ${s}`);
  }
  // Informational only: UAs that claim to be a browser and lack Accept-Language + Sec-Fetch score 20 (no-sec-fetch 10 + no-accept-language 10).
  assert.deepEqual(bad, []);
});

test("legacy feature-phone UAs the allowlist is designed for score 0 at the UA layer and < 30 overall", () => {
  const bad: string[] = [];
  for (const [name, ua] of LEGACY_PHONE_UAS) {
    const s = scoreOf(ua, LEGACY);
    if (s >= 30) bad.push(`${name}: ${s}`);
  }
  assert.deepEqual(bad, []);
});

test("BUG: real LG feature-phone UAs containing 'Java/ASVM' are scored as an HTTP library (85)", () => {
  for (const [name, ua] of LEGACY_PHONE_UAS_EXTRA.slice(0, 2)) {
    assert.ok(scoreOf(ua, LEGACY) < 30, `${name} -> ${scoreOf(ua, LEGACY)}`);
  }
});

test("BUG: real legacy UAs outside the allowlist shapes get non-browser-ua 40 (suspicious)", () => {
  const bad: string[] = [];
  for (const [name, ua] of LEGACY_PHONE_UAS_EXTRA.slice(2)) {
    const s = scoreOf(ua, LEGACY);
    if (s >= 30) bad.push(`${name}: ${s}`);
  }
  assert.deepEqual(bad, []);
});

test("allowlist prefixes do not exempt tool-ish UAs from bot / library detection", () => {
  const mustBeHigh = [
    "Nokia-Bot/1.0", "Midori-spider/1.0", "Lynx/2.8 curl/7.0", "Links (2.29; python-requests/2.31)", "NokiaN73-1 Playwright/1.4",
    "w3m/0.5.3 libwww-perl/5.8", "Dolphin/1.0 HeadlessChrome", "BlackBerry9000 Scrapy/2.0", "SAMSUNG-SGH-X Googlebot/2.1",
    "lg-GC900 python", "MOT-V3 node-fetch/3", "SIE-S65 okhttp/4.9", "portalmmm/2.0 wget/1.2", "ELinks/0.16 axios/1.0",
  ];
  for (const ua of mustBeHigh) assert.ok(scoreOf(ua, LEGACY) >= 55, `${ua} -> ${scoreOf(ua, LEGACY)}`);
});

test("plain non-browser UAs and near-miss allowlist shapes stay flagged (40)", () => {
  for (const ua of ["GuzzleHttp/7", "Ruby", "test", "NokiaScraper/1.0", "Lynx scraper/1.0", "Mozilla/Scraper", "Mozilla/", "Opera", "Linksys/1.0", "Midoriscraper", "Dolphinscraper/1"]) {
    const s = uaSignals(ua);
    assert.equal(combineWeights(s), 40, `${ua} -> ${JSON.stringify(s)}`);
  }
});

test("UA mang URL tự khai (https://…) nay bị nhận là bot khai danh (55), không còn chỉ là non-browser (40)", () => {
  assert.equal(combineWeights(uaSignals("colly - https://github.com/gocolly/colly")), 55);
});

test("UA starting with a digit / non-ASCII / quote scores as non-browser (40) unless placeholder", () => {
  for (const ua of ["5.0 (Windows)", "áMozilla/5.0", "\"Mozilla/5.0 (X11)\"", "ÿMozilla/5.0 (X11)", "1Mozilla/5.0"]) {
    assert.equal(combineWeights(uaSignals(ua)), 40, ua);
  }
});

test("NBSP / NEL / C1 / soft hyphen / ZWSP around a UA do not change its score", () => {
  const pads = [" ", "\u0085", "\u0080", "\u009f", "­", "​", "﻿", " ", "\t", " "];
  const cases = ["Mozilla/5.0 (X11; Linux x86_64)", "-", "Mozilla/5.0", "", "Nokia6230/2.0", "GuzzleHttp/7", "curl/8.0", "Googlebot/2.1"];
  for (const ua of cases) {
    const base = combineWeights([...uaSignals(ua), ...headerSignals(bag(MODERN), ua)]);
    for (const p of pads) {
      for (const [l, r] of [[p, ""], ["", p], [p, p], [p + p + p, p]] as const) {
        const u = l + ua + r;
        assert.equal(combineWeights([...uaSignals(u), ...headerSignals(bag(MODERN), u)]), base, JSON.stringify(u));
      }
    }
  }
});

// ------------------------------------------------- 3. property sweep (>= 50k cases)
const FRAGS = [
  "Mozilla/5.0", "Mozilla/4.0", "Mozilla/", "Mozilla", "Opera/9.80", "Opera", "Lynx/2.8", "Links (2.29", "Nokia6230/2.0", "NokiaN73-1",
  "(Windows NT 10.0; Win64; x64)", "(X11; Linux x86_64)", "(Linux; Android 13; SM-G991B)", "(iPhone; CPU iPhone OS 17_5 like Mac OS X)",
  "(Macintosh; Intel Mac OS X 10_15_7)", "(compatible; MSIE 8.0)", "AppleWebKit/537.36", "(KHTML, like Gecko)", "Chrome/126.0.0.0", "Safari/537.36",
  "Googlebot/2.1", "bingbot/2.0", "Applebot/0.1", "facebookexternalhit/1.1", "Twitterbot/1.0", "YandexBot/3.0", "Baiduspider/2.0",
  "curl/8.4.0", "python-requests/2.31", "Go-http-client/2.0", "okhttp/4.9", "node", "axios/1.6", "HeadlessChrome/120", "Playwright", "Selenium",
  "-", "unknown", "null", "undefined", "user-agent", "GuzzleHttp/7", "Ruby", "test", "SAMSUNG-SGH-E250/1.0", "LG-GC900", "MOT-V3", "SIE-S65",
  "BlackBerry9000/5.0", "SonyEricssonK800i", "portalmmm/2.0", "w3m/0.5", "bot", "Bot", "crawler", "spider", "Cubot", "CUBOT", "x", ";", "(", ")", " ", "  ",
  " ", "\u0085", "­", "​", "﻿", "\u0080", "\u009f", "\t", "é", "ạ", "Linux", "Windows", "Android", "iPhone", "CrOS", "Microsoft",
  "libwww-FM/2.14", "libwww-perl/6", "java/17", "Java/ASVM", "dart", "bun", "deno", "ucweb", "UCWEB/2.0 (", "Dolphin/1", "NetSurf/3", "Midori/0.5",
];
const HEADER_NAMES = ["accept", "accept-language", "sec-fetch-mode", "sec-ch-ua", "sec-ch-ua-platform", "x-vercel-ip-as-number", "sec-fetch-site", "user-agent"];
const HEADER_VALUES: Record<string, string[]> = {
  accept: ["", "*/*", "text/html", "application/json, text/plain, */*", "text/html,application/xhtml+xml,*/*;q=0.8", "image/png"],
  "accept-language": ["", " ", "en", "vi-VN,vi;q=0.9"],
  "sec-fetch-mode": ["navigate", "cors", "no-cors", "same-origin", "navigate, navigate", "websocket", "", "NAVIGATE", " navigate "],
  "sec-ch-ua": ['"Chromium";v="126"', '"HeadlessChrome";v="120"', "headlesschrome", ""],
  "sec-ch-ua-platform": ['"Windows"', '"Android"', '"Linux"', '"macOS"', '"iOS"', '"Chrome OS"', '"Unknown"', "Windows", '"Windows", "Android"', ""],
  "x-vercel-ip-as-number": ["16509", "32934", "13414", "0x80A6", "00032934", "-1", "4294967295", "4294967296", "abc", "", " 15169 "],
  "sec-fetch-site": ["none", "cross-site"],
};

function genUa(r: () => number): string {
  const n = 1 + Math.floor(r() * 6);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(pick(r, FRAGS));
  let ua = parts.join(r() < 0.8 ? " " : "");
  if (r() < 0.15) {
    const L = Math.floor(r() * 12);
    let junk = "";
    for (let i = 0; i < L; i++) junk += String.fromCharCode(Math.floor(r() * (r() < 0.5 ? 0x250 : 0x10000)));
    ua = r() < 0.5 ? junk + ua : ua + junk;
  }
  // Header values cannot contain control characters (other than tab) or non-latin1 in a real request.
  return ua.replace(/[\u0000-\u0008\u000a-\u001f\u007f]/g, "").replace(/[^\u0000-ÿ]/g, (c) => (r() < 0.5 ? "" : c));
}

function genHeaders(r: () => number, ua: string): Record<string, string> {
  const h: Record<string, string> = {};
  for (const name of HEADER_NAMES) {
    if (name === "user-agent") continue;
    if (r() < 0.5) h[name] = pick(r, HEADER_VALUES[name]);
  }
  h["user-agent"] = ua;
  return h;
}

function safeHeaders(h: Record<string, string>): Headers | null {
  try {
    return new Headers(h);
  } catch {
    return null; // non-ByteString value — cannot occur in a real request
  }
}

const OBS_ARRAY = ["human-likely", "suspicious", "automated", "verified-crawler", "spoofed-crawler"];

test("sweep 60k: totality, range, classification consistency, weights finite", () => {
  const r = rng(0xc0ffee);
  let cases = 0;
  for (let i = 0; i < 90_000; i++) {
    const ua = genUa(r);
    const h = safeHeaders(genHeaders(r, ua));
    if (!h) continue;
    const ip = r() < 0.3 ? pick(r, ["1.2.3.4", "::1", "2001:db8::1", "garbage", ""]) : undefined;
    const tel =
      r() < 0.3
        ? {
            wd: r() < 0.2, pl: Math.floor(r() * 3), lg: Math.floor(r() * 3), ow: Math.floor(r() * 3) * 400, oh: Math.floor(r() * 3) * 300,
            iw: Math.floor(r() * 3) * 400, ih: Math.floor(r() * 3) * 300, sw: pick(r, [0, 800, 1920]), sh: pick(r, [0, 600, 1080]),
            hc: Math.floor(r() * 3), ua: r() < 0.5 ? ua : "x", ch: r() < 0.5, ev: Math.floor(r() * 5), ut: Math.floor(r() * 4), dw: Math.floor(r() * 1000),
          }
        : undefined;
    const a = assessRequestSync({ headers: h, ip, telemetry: tel });
    cases++;
    assert.ok(Number.isInteger(a.score) && a.score >= 0 && a.score <= 100, `score ${a.score} for ${JSON.stringify(ua)}`);
    assert.ok(OBS_ARRAY.includes(a.classification));
    for (const s of a.signals) assert.ok(Number.isFinite(s.weight) && s.weight >= 0 && s.weight <= 100, s.id);
    if (a.classification === "human-likely") assert.ok(a.score < 30);
    if (a.classification === "suspicious") assert.ok(a.score >= 30 && a.score < 60);
    if (a.classification === "automated") assert.ok(a.score >= 60);
    if (a.classification === "verified-crawler") assert.equal(a.score, 0);
    // score equals noisy-OR of its own reported signals
    assert.equal(a.score, combineWeights(a.signals));
  }
  assert.ok(cases > 50_000, `only ${cases} cases ran`);
});

test("sweep 60k: header-name case does not change the score", () => {
  const r = rng(0xbadcafe);
  let n = 0;
  for (let i = 0; i < 60_000; i++) {
    const ua = genUa(r);
    const raw = genHeaders(r, ua);
    const lower = safeHeaders(raw);
    if (!lower) continue;
    const mixed: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      mixed[[...k].map((c) => (r() < 0.5 ? c.toUpperCase() : c)).join("")] = v;
    }
    const m = safeHeaders(mixed)!;
    // A Map-backed bag that does its OWN case folding, to rule out reliance on Headers semantics.
    const map = new Map(Object.entries(mixed).map(([k, v]) => [k.toLowerCase(), v]));
    const custom = { get: (name: string) => map.get(name.toLowerCase()) ?? null };
    const s1 = assessRequestSync({ headers: lower }).score;
    assert.equal(assessRequestSync({ headers: m }).score, s1);
    assert.equal(assessRequestSync({ headers: custom }).score, s1);
    n++;
  }
  assert.ok(n > 28_000, `only ${n}`);
});

test("sweep 40k: cleanUa idempotent, returns a contiguous slice, strips only whitespace/invisible", () => {
  const r = rng(0x5eed);
  const strippable = /^[\s\u0080-\u009f­͏᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]$/;
  // Independent (Unicode-property) oracle: anything cleanUa strips must be White_Space, Cf, Cc, or CGJ.
  const allowedToStrip = /^[\p{White_Space}\p{Cf}\p{Cc}͏]$/u;
  for (let i = 0; i < 40_000; i++) {
    const L = Math.floor(r() * 24);
    let s = "";
    for (let k = 0; k < L; k++) {
      const m = r();
      s += m < 0.35 ? pick(r, ["a", "M", "-", "(", "5", "é", "ạ", "😀"]) : m < 0.7 ? pick(r, [" ", "\t", " ", "\u0085", "­", "​", "﻿", "\u0080", "\u009f", " ", "　", "⁠", "᠎"]) : String.fromCharCode(Math.floor(r() * 0x10000));
    }
    const c = cleanUa(s);
    assert.equal(cleanUa(c), c, `not idempotent: ${JSON.stringify(s)}`);
    const at = s.indexOf(c);
    assert.ok(at >= 0 && (c !== "" || true), "result must be a slice");
    if (c !== "") {
      // find the actual slice position: leading chars removed are all strippable
      let st = 0;
      while (st < s.length && strippable.test(s[st])) st++;
      let en = s.length;
      while (en > st && strippable.test(s[en - 1])) en--;
      assert.equal(c, s.slice(st, en));
      assert.ok(!strippable.test(c[0]) && !strippable.test(c[c.length - 1]));
    } else {
      for (const ch of s) assert.ok(strippable.test(ch));
    }
    {
      let st = 0;
      while (st < s.length && strippable.test(s[st])) st++;
      let en = s.length;
      while (en > st && strippable.test(s[en - 1])) en--;
      for (const ch of s.slice(0, st) + s.slice(en)) assert.ok(allowedToStrip.test(ch), `stripped unexpected U+${ch.codePointAt(0)!.toString(16)}`);
    }
  }
});

test("cleanUa: exhaustive over every UTF-16 unit — strips only whitespace/invisible, and everything reachable over HTTP", () => {
  const allowedToStrip = /^[\p{White_Space}\p{Cf}\p{Cc}͏]$/u;
  const stripped: number[] = [];
  for (let c = 0; c < 0x10000; c++) {
    const ch = String.fromCharCode(c);
    if (cleanUa(ch + "x" + ch) !== "x") continue;
    stripped.push(c);
    assert.ok(allowedToStrip.test(ch) || c === 0x180e, `U+${c.toString(16)} stripped but is a visible character`);
  }
  // Bytes a conforming HTTP parser can deliver as a header value are TAB, 0x20-0x7E, 0x80-0xFF.
  // Of those, exactly these are blank: 09 20 80-9F A0 AD.
  const reachableBlank = new Set([0x09, 0x20, ...Array.from({ length: 0x20 }, (_, i) => 0x80 + i), 0xa0, 0xad]);
  for (let c = 0; c <= 0xff; c++) {
    if (c !== 0x09 && c < 0x20) continue;
    if (c === 0x7f) continue;
    assert.equal(stripped.includes(c), reachableBlank.has(c), `latin1 byte 0x${c.toString(16)}`);
  }
});

test("sweep 30k: monotonicity — adding strong evidence never lowers the score of an unclaimed UA", () => {
  const r = rng(0x1234abcd);
  let n = 0;
  for (let i = 0; i < 30_000; i++) {
    const ua = genUa(r);
    if (/googlebot|bingbot|applebot|facebookexternalhit|twitterbot|yandex|baiduspider|adsbot|mediapartners|google|bingpreview|msnbot|facebot|meta-/i.test(ua)) continue;
    const h = genHeaders(r, ua);
    const base = safeHeaders(h);
    if (!base) continue;
    const s0 = assessRequestSync({ headers: base }).score;
    for (const extra of [{ "sec-ch-ua": '"HeadlessChrome";v="120"' }, { "sec-fetch-mode": "cors" }, { "x-vercel-ip-as-number": "16509" }] as Record<string, string>[]) {
      const withExtra = safeHeaders({ ...h, ...extra })!;
      const s1 = assessRequestSync({ headers: withExtra }).score;
      // "x-vercel-ip-as-number" REPLACES an existing value; it can only add datacenter-asn, and
      // "sec-fetch-mode: cors" replaces navigate (removing nothing but adding programmatic-fetch).
      const replacedNavigate = "sec-fetch-mode" in extra === false ? false : false;
      assert.ok(s1 >= s0 || replacedNavigate, `${JSON.stringify(ua)} + ${JSON.stringify(extra)}: ${s0} -> ${s1}`);
    }
    const tel0 = { wd: false, pl: 1, lg: 1, ow: 1000, oh: 800, iw: 1000, ih: 700, sw: 1920, sh: 1080, hc: 8, ua: ua, ch: true, ev: 5, ut: 0, dw: 5000 };
    const a0 = assessRequestSync({ headers: base, telemetry: tel0 }).score;
    const a1 = assessRequestSync({ headers: base, telemetry: { ...tel0, wd: true } }).score;
    assert.ok(a1 >= a0 && a1 >= 75);
    n++;
  }
  assert.ok(n > 15_000);
});

test("sweep 30k: assessRequestSync equals noisy-OR(uaSignals + headerSignals) for UAs with no crawler claim", () => {
  const r = rng(0x77aa);
  let n = 0;
  for (let i = 0; i < 30_000; i++) {
    const ua = genUa(r);
    if (/googlebot|adsbot|mediapartners|google-|googleother|storebot|feedfetcher|apis-google|bingbot|bingpreview|msnbot|adidxbot|applebot|yandex|baiduspider|facebookexternalhit|facebot|meta-external|meta-webindexer|twitterbot|twittercardservice/i.test(ua)) continue;
    const h = safeHeaders(genHeaders(r, ua));
    if (!h) continue;
    const expected = combineWeights([...uaSignals(ua), ...headerSignals(h, ua)]);
    assert.equal(assessRequestSync({ headers: h }).score, expected, JSON.stringify(ua));
    n++;
  }
  assert.ok(n > 15_000);
});

test("constructive UA scoring: browser-shaped UAs get 0 at the UA layer, everything else exactly 40 / 55 / 60 / 85 / 90", () => {
  const r = rng(0x9999);
  const SAFE = ["Windows NT 10.0", "X11", "Linux x86_64", "AppleWebKit/537.36", "KHTML, like Gecko", "Safari/537.36", "Version/4.0", "Mobile", "Macintosh", "Gecko/20100101", "en-US", "Build/RP1A"];
  let n = 0;
  for (let i = 0; i < 20_000; i++) {
    const body = Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r, SAFE)).join("; ");
    const pre = pick(r, ["Mozilla/5.0", "mozilla/4.0", "MOZILLA/1.22", "Opera/9.80", "opera/12"]);
    assert.deepEqual(uaSignals(`${pre} (${body})`), [], `${pre} (${body})`);
    const nb = pick(r, ["Foo/1.0", "Zork", "Nokia/7", "Lynx", "Links2", "Samsung/SGH", "XG/U990", "MOT/V3", "Opera", "Mozilla", "5.0", "Dolphinx/1", "Sonyericsson/1", "BlackBerry", "SEC/1", "sie_s65"]);
    assert.equal(combineWeights(uaSignals(`${nb} (${body})`)), // vendor+mã máy ("Nokia/7", "MOT/V3", "SEC/1", "sie_s65"…) nay thuộc allowlist điện thoại đời cũ → 0
      nb === "Lynx" || LEGACY_BROWSER_UA.test(nb) ? 0 : 40, `${nb} (${body})`.slice(0, 80));
    n += 2;
  }
  assert.ok(n >= 40_000);
});

// ------------------------------------------------- 4. ReDoS / perf sweep
function regexLiterals(file: string): { src: string; flags: string; where: string }[] {
  const text = readFileSync(file, "utf8");
  const out: { src: string; flags: string; where: string }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
    const re = /(?:^|[=(,:?!&|{;]|\breturn|\bcase)\s*\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+)\/([dgimsuvy]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      try {
        new RegExp(m[1], m[2].replace(/g/g, ""));
        out.push({ src: m[1], flags: m[2], where: `${file.split(/[\\/]/).pop()}:${idx + 1}` });
      } catch {
        /* not a regex literal */
      }
    }
  });
  return out;
}

const BOT_DIR = join(process.cwd(), "src", "lib", "botdetect");
const SRC_FILES = readdirSync(BOT_DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => join(BOT_DIR, f))
  .concat(join(process.cwd(), "src", "lib", "tracking", "ua.ts"));

function shapesFor(src: string, n: number): [string, string][] {
  const words = [...new Set((src.match(/[A-Za-z][A-Za-z0-9_.-]{1,12}/g) ?? ([] as string[])).concat(["bot", "cu", "node", "libwww", "mozilla/5.0", "googlebot", "a"]))].slice(0, 14);
  const fillers = [" ", ";", "(", "a", "0", ".", "-", "/", "​", " ", ":", ",", "1.", "a-", "0:"];
  const out: [string, string][] = [];
  const fill = (u: string) => u.repeat(Math.ceil(n / u.length)).slice(0, n);
  for (const f of fillers) {
    out.push([`fill:${JSON.stringify(f)}`, fill(f)]);
    for (const w of words.slice(0, 8)) {
      out.push([`${JSON.stringify(f)}*N+${w}`, fill(f).slice(0, n - w.length) + w]);
      out.push([`${w}+${JSON.stringify(f)}*N`, w + fill(f).slice(0, n - w.length)]);
    }
  }
  for (const w of words) {
    out.push([`rep:${w}`, fill(w)]);
    out.push([`rep:${w} `, fill(w + " ")]);
    out.push([`rep:${w};`, fill(w + ";")]);
    out.push([`rep:(${w}`, fill("(" + w)]);
    out.push([`rep:${w}/9`, fill(w + "/9")]);
  }
  return out;
}

test("ReDoS: every regex literal in botdetect (non-test) + BOT_UA_REGEX is linear, < 500ms/MB (quadratic = giây/MB; ngưỡng rộng để không đỏ khi CPU bận)", () => {
  const regexes = SRC_FILES.flatMap(regexLiterals);
  assert.ok(regexes.length >= 40, `found only ${regexes.length} regex literals`);
  const slow: string[] = [];
  const time = (fn: () => void) => {
    const t = process.hrtime.bigint();
    fn();
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  const SMALL = 20_000;
  const BIG = 1_000_000;
  for (const { src, flags, where } of regexes) {
    const rx = new RegExp(src, flags.replace(/g/g, ""));
    const rxg = new RegExp(src, flags.includes("g") ? flags : flags + "g");
    const smallShapes = shapesFor(src, SMALL);
    const bigShapes = new Map(shapesFor(src, BIG));
    let skipBig = false;
    for (const [label, s] of smallShapes) {
      const t1 = time(() => {
        rx.test(s);
        rxg.lastIndex = 0;
        s.replace(rxg, "");
        s.split(rx);
      });
      if (t1 > 80) {
        // quadratic check: double the size
        const s2 = bigShapes.get(label)!.slice(0, SMALL * 2);
        const t2 = time(() => {
          rx.test(s2);
          rxg.lastIndex = 0;
          s2.replace(rxg, "");
          s2.split(rx);
        });
        slow.push(`${where} /${src.slice(0, 60)}/ shape ${label}: ${t1.toFixed(0)}ms@20k -> ${t2.toFixed(0)}ms@40k`);
        skipBig = true;
        break;
      }
    }
    if (skipBig) continue;
    for (const [label, s] of bigShapes) {
      // Lấy lần đo NHANH NHẤT trong 3: một lần đo đơn lẻ trên chuỗi 1MB dính GC/JIT (đo thật: `/baiduspider/`
      // và `/^[A-Za-z0-9._~-]+$/` — vốn tuyến tính tầm thường — đo ra 168–220ms vì nhiễu rồi pass ở lần sau).
      // Hồi quy quadratic thật thì CẢ BA lần đều chậm nên vẫn bị bắt.
      const t = Math.min(
        ...[0, 1, 2].map(() =>
          time(() => {
            rx.test(s);
            rxg.lastIndex = 0;
            s.replace(rxg, "");
          }),
        ),
      );
      if (t > 500) slow.push(`${where} /${src.slice(0, 60)}/ shape ${label}: ${t.toFixed(0)}ms/MB`);
    }
  }
  assert.deepEqual(slow, []);
});

test("perf: public functions on 1MB adversarial UA / header / ip / token inputs stay under ~300ms each", () => {
  const MB = 1_000_000;
  const shapes = [
    "a".repeat(MB), " ".repeat(MB), "​".repeat(MB), "  ".repeat(MB / 2), "bot".repeat(MB / 3), "cu".repeat(MB / 2) + "bot",
    "Mozilla/5.0 ".repeat(MB / 12), "( ".repeat(MB / 2), "; ".repeat(MB / 2), "node ".repeat(MB / 5), "libwww".repeat(MB / 6), "1.".repeat(MB / 2),
    " ".repeat(MB / 2) + "x" + " ".repeat(MB / 2), "Googlebot/2.1 ".repeat(MB / 14), "Applebot/0.1 ".repeat(MB / 13), "-bot".repeat(MB / 4),
    "Mozilla/5.0 (" + "a-".repeat(MB / 2), "yandexbot".repeat(MB / 9), "lynx/".repeat(MB / 5), "nokia".repeat(MB / 5), "sec-".repeat(MB / 4),
  ];
  const slow: string[] = [];
  const t = (name: string, fn: () => unknown) => {
    const s = process.hrtime.bigint();
    try {
      fn();
    } catch (e) {
      slow.push(`${name} threw ${(e as Error).message}`);
    }
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    if (ms > 300) slow.push(`${name}: ${ms.toFixed(0)}ms`);
  };
  for (const [i, s] of shapes.entries()) {
    const label = `shape#${i}(${JSON.stringify(s.slice(0, 10))})`;
    t(`cleanUa ${label}`, () => cleanUa(s));
    t(`uaSignals ${label}`, () => uaSignals(s));
    t(`isBrowserLikeUa ${label}`, () => isBrowserLikeUa(s));
    t(`isPlaceholderUa ${label}`, () => isPlaceholderUa(s));
    t(`looksAutomated ${label}`, () => looksAutomated(s));
    t(`BOT_UA_REGEX ${label}`, () => BOT_UA_REGEX.test(s));
    // Header values cannot be > latin1 in real life; skip shapes Headers rejects.
    const h = safeHeaders({ "user-agent": s, accept: s.slice(0, MB), "accept-language": s, "sec-fetch-mode": s, "sec-ch-ua": s, "sec-ch-ua-platform": s, "x-vercel-ip-as-number": s });
    if (h) t(`assessRequestSync ${label}`, () => assessRequestSync({ headers: h, ip: s }));
    t(`readAsn ${label}`, () => readAsn({ get: () => s }));
    t(`normalizeIp ${label}`, () => normalizeIp(s));
    t(`hostMatchesSuffix ${label}`, () => hostMatchesSuffix(s, "googlebot.com"));
    t(`verifyChallenge ${label}`, () => verifyChallenge(s, s, { secret: "x".repeat(32), subject: "a" }));
    t(`telemetrySignals ${label}`, () => telemetrySignals({ wd: false, pl: 1, lg: 1, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 1, ua: s, ch: true, ev: 1, ut: 0, dw: 1000 }, s));
    t(`parseTelemetry ${label}`, () => parseTelemetry({ wd: false, pl: 1, lg: 1, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 1, ua: s, ch: true, ev: 1, ut: 0, dw: 1000 }));
  }
  assert.deepEqual(slow, []);
});

test("assessRequest (async) with 1MB UA and 1MB ip is linear and never throws", async () => {
  const { assessRequest } = await import("@/lib/botdetect");
  const ua = "Googlebot/2.1 " + "a".repeat(1_000_000);
  const verifier = createCrawlerVerifier({ resolver: { reverse: async () => ["crawl-1.googlebot.com"], resolve4: async () => ["1.2.3.4"], resolve6: async () => [] } });
  const t0 = Date.now();
  const a = await assessRequest({ headers: bag({ "user-agent": ua }), ip: "1.2.3.4" }, verifier);
  const b = await assessRequest({ headers: bag({ "user-agent": ua }), ip: "9".repeat(1_000_000) }, verifier);
  assert.ok(Date.now() - t0 < 1500, `took ${Date.now() - t0}ms`);
  assert.ok(a.score >= 0 && b.score >= 0);
});

test("BUG: FCrDNS verifier cache keeps the full raw string of an invalid IP as a key (memory amplification)", async () => {
  const v = createCrawlerVerifier({ resolver: { reverse: async () => [], resolve4: async () => [], resolve6: async () => [] } });
  // The verifier is meant to be fed by header-derived IPs; invalid ones must not be cached by raw content.
  const gc = (await import("node:vm")).runInNewContext("gc", {}, {}) as () => void;
  gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 40; i++) await v(String(i) + "x".repeat(500_000), ["googlebot.com"]);
  gc();
  const grown = process.memoryUsage().heapUsed - before;
  // 40 * 500KB = 20MB of retained key text (latin1 strings: 1 byte per char). Expect none retained.
  assert.ok(grown < 5_000_000, `retained ~${(grown / 1e6).toFixed(1)}MB for invalid-ip keys`);
});

// ------------------------------------------------- 6. README claims vs code
test("README numeric claims match the code", () => {
  const readme = readFileSync(join(BOT_DIR, "README.md"), "utf8");
  // thresholds & buckets
  assert.deepEqual(DEFAULT_THRESHOLDS, { flag: 30, rateLimit: 60, challenge: 80 });
  assert.deepEqual(HUMAN_RULE, { capacity: 120, refillPerSec: 2 });
  assert.deepEqual(SUSPECT_RULE, { capacity: 30, refillPerSec: 0.5 });
  assert.equal(RATE_COSTS.suspicious, 5);
  assert.equal(SUSPECT_RULE.capacity / RATE_COSTS.suspicious, 6); // "≈ 6 burst"
  // noisy-OR example 10/10/12/15 -> 39
  const sig = (w: number) => ({ id: "no-accept" as const, weight: w });
  assert.equal(combineWeights([10, 10, 12, 15].map(sig)), 39);
  // signal weights per the table
  const idw = (ua: string, h: Record<string, string>) => Object.fromEntries(assessRequestSync({ headers: bag({ ...h, "user-agent": ua }) }).signals.map((s) => [s.id, s.weight]));
  assert.equal(idw("HeadlessChrome/1", {})["headless-ua"], 90);
  assert.equal(idw("curl/8", {})["http-library-ua"], 85);
  assert.equal(idw("", {})["empty-ua"], 60);
  assert.equal(idw("Zork/1", {})["non-browser-ua"], 40);
  assert.equal(idw("SomethingBot/1", {})["unknown-declared-bot"], 55);
  assert.equal(idw("Mozilla/5.0 (Windows NT 10.0)", { "sec-ch-ua-platform": '"Android"' })["platform-mismatch"], 45);
  assert.equal(idw("Mozilla/5.0 (X11)", { "sec-fetch-mode": "cors" })["programmatic-fetch"], 30);
  assert.equal(idw("Mozilla/5.0 (X11)", { "x-vercel-ip-as-number": "16509" })["datacenter-asn"], 20);
  assert.equal(idw("Mozilla/5.0 (X11)", { accept: "application/json" })["non-document-accept"], 20);
  assert.equal(idw("Mozilla/5.0 (X11)", { "sec-ch-ua": "HeadlessChrome" })["headless-client-hint"], 90);
  assert.equal(idw("Mozilla/5.0 (X11)", { accept: "*/*" })["wildcard-accept"], 18);
  assert.equal(idw("Mozilla/5.0 (X11)", {})["no-accept"], 15);
  // telemetry weights
  const tw = (o: object) => Object.fromEntries(telemetrySignals({ wd: false, pl: 1, lg: 1, ow: 1000, oh: 800, iw: 1000, ih: 700, sw: 1920, sh: 1080, hc: 8, ua: "Mozilla/5.0 Chrome/1", ch: true, ev: 5, ut: 0, dw: 5000, ...o }, "Mozilla/5.0 Chrome/1").map((s) => [s.id, s.weight]));
  assert.equal(tw({ wd: true })["webdriver-flag"], 75);
  assert.equal(tw({ ut: 5 })["untrusted-events"], 70);
  assert.equal(tw({ lg: 0 })["empty-languages"], 20);
  assert.equal(tw({ ow: 0 })["zero-window"], 15);
  assert.equal(tw({ sw: 800, sh: 600 })["default-screen"], 20);
  assert.equal(tw({ ev: 0, dw: 299 })["no-interaction"], 35);
  assert.equal(tw({ ev: 0, dw: 300 })["no-interaction"], undefined); // "< 300ms"
  assert.equal(tw({ ch: false })["no-chrome-object"], 12);
  assert.equal(tw({ pl: 0 })["no-plugins"], 8);
  assert.equal(tw({ hc: 0 })["no-hardware-concurrency"], 5);
  assert.equal(tw({ ua: "other" })["ua-mismatch"], 45);
  // README row: untrusted-events "chỉ 25 nếu có ≤ 2 sự kiện tổng hợp VÀ ít nhất một sự kiện tin cậy" (đã sửa
  // theo phát hiện của chính vòng 6: bản cũ ghi "< 2% tổng", không khớp code).
  assert.match(readme, /25 nếu có ≤ 2 sự kiện tổng hợp VÀ ít nhất một sự kiện tin cậy/);
});

test("untrusted-events: README now describes the real rule (<= 2 synthetic AND >= 1 trusted event => 25)", () => {
  const mk = (ut: number, ev: number) => telemetrySignals({ wd: false, pl: 1, lg: 1, ow: 1000, oh: 800, iw: 1000, ih: 700, sw: 1920, sh: 1080, hc: 8, ua: "Mozilla/5.0 Chrome/1", ch: true, ev, ut, dw: 5000 }, "Mozilla/5.0 Chrome/1").find((s) => s.id === "untrusted-events")!.weight;
  // 2 of 3 synthetic but one TRUSTED event present -> 25 (extension/FastClick); README now says so.
  assert.equal(mk(2, 3), 25);
  assert.equal(mk(2, 2), 70); // không có sự kiện tin cậy nào -> automation
});

test("README: rate-limit eviction scan 512, PoW limits, token cap, replay cap", () => {
  const readme = readFileSync(join(BOT_DIR, "README.md"), "utf8");
  assert.match(readme, /> 512 khoá/);
  // difficulty bounds 1..32, ttl <= 1h, secret >= 16, token <= 1024 (README lines)
  const secret = "s".repeat(16);
  assert.throws(() => issueChallenge({ secret: "s".repeat(15), subject: "a" }), RangeError);
  assert.throws(() => issueChallenge({ secret, subject: "a", difficultyBits: 0 }), RangeError);
  assert.throws(() => issueChallenge({ secret, subject: "a", difficultyBits: 33 }), RangeError);
  assert.throws(() => issueChallenge({ secret, subject: "a", ttlMs: 3_600_001 }), RangeError);
  assert.doesNotThrow(() => issueChallenge({ secret, subject: "a", difficultyBits: 32, ttlMs: 3_600_000 }));
  const c = issueChallenge({ secret, subject: "a", difficultyBits: 8 });
  assert.ok(c.token.length < 300);
  const nonce = solveChallenge(c.token, 8);
  assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "a" }), { ok: true });
  assert.equal((verifyChallenge("a".repeat(1025), nonce, { secret, subject: "a" }) as { reason: string }).reason, "malformed");
  // replay: <= 1/10 of table per subject
  const t = 1000;
  const g = createReplayGuard(() => t, 100);
  let accepted = 0;
  for (let i = 0; i < 50; i++) if (!g.seen("id" + i, t + 10_000, "subj")) accepted++;
  assert.equal(accepted, 10);
  // README policy table: 80+ challenge, 60-79 cost 5, 30-59 cost 1
  const lim = new MemoryRateLimiter();
  const fake = (score: number) => ({ score, classification: "automated" as const, signals: [] });
  assert.equal(decide(fake(80), { limiter: lim, key: "k" }).action, "challenge");
  assert.equal(decide(fake(79), { limiter: lim, key: "k" }).action, "flag");
});

test("rate limiter: 120 human burst, then denial; suspect bucket 30 burst / cost 5 = 6 flags", () => {
  const now = 0;
  const lim = new MemoryRateLimiter({ now: () => now });
  let ok = 0;
  for (let i = 0; i < 200; i++) if (decide({ score: 0, classification: "human-likely", signals: [] }, { limiter: lim, key: "a" }).action === "allow") ok++;
  assert.equal(ok, 120);
  let flagged = 0;
  for (let i = 0; i < 20; i++) if (decide({ score: 70, classification: "automated", signals: [] }, { limiter: lim, key: "b" }).action === "flag") flagged++;
  assert.equal(flagged, 6);
});
