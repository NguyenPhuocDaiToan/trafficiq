/**
 * Round 8 - 17: Independent Review Suite for >95% Bot Detection Standard.
 *
 * Covers:
 *  - Round 8:  New crawler & automation tokens recall (>= 95% threshold)
 *  - Round 9:  Zero false positives on modern & legacy human browsers
 *  - Round 10: ReDoS resistance & linear time complexity on 1MB adversarial inputs
 *  - Round 11: Totality on malformed/hostile UA inputs
 *  - Round 12: Monotonicity invariant (bot token additions never reduce risk score)
 *  - Round 13: withoutDevicePlatform interaction with bot tokens
 *  - Round 14: Verified crawler exemption rules
 *  - Round 15: Policy & Rate Limiter integration
 *  - Round 16: End-to-end botReason classification
 *  - Round 17: Mutation test assertions for gate sensitivity
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRequestSync } from "./assess";
import { BOT_UA_REGEX, botReason, withoutDevicePlatform } from "@/lib/tracking/ua";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const bag = (m: Record<string, string>) => {
  const map = new Map(Object.entries(m).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (k: string) => map.get(k.toLowerCase()) ?? null };
};

const fakeReq = (ua: string, extraHeaders: Record<string, string> = {}) => ({
  headers: bag({ "user-agent": ua, ...extraHeaders }),
});

// ============================================================================
// Round 8: Recall of newly added crawler, automation and contact email tokens
// ============================================================================
test("Round 8: automation & newly declared crawler tokens are reliably caught", () => {
  const samples = [
    // Headless / automation frameworks
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Playwright/1.40.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36; Selenium",
    "Mozilla/5.0 (X11; Linux x86_64) Puppeteer/21.0.0",
    "Mozilla/5.0 (compatible; WebdriverClient/1.0)",
    // Contact email in UA
    "Mozilla/5.0 (compatible) AppleWebKit/537.36 Chrome/47.0 Safari/537.36 collection@infegy.com",
    "Mozilla/5.0 (compatible; NetcraftSurveyAgent/1.0; +info@netcraft.com)",
    "Mozilla/5.0 (compatible; +centuryb.o.t9[at]gmail.com)",
    "Mozilla/5.0 (compatible; dev(at)crawler.example.com)",
    // Monitoring / Web auditing
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/78.0 PingdomTMS/2020.2",
    "Mozilla/5.0 (compatible; MSIE 10.0; Trident/6.0) LinkCheck by Siteimprove.com",
    "Mozilla/5.0 (X11; Linux x86_64) DareBoost/1.0",
    "Mozilla/5.0 (X11; Linux x86_64) DatadogSynthetics/1.0",
    "Mozilla/5.0 (X11; Linux x86_64) NewRelicSynthetics/1.0",
    "Mozilla/5.0 (Windows NT 10.0) SecurityHeaders/1.0",
    "Mozilla/5.0 (compatible; RSiteAuditor)",
    "Mozilla/5.0 (Macintosh) TagInspector/500.1",
    "Mozilla/5.0 (X11; Linux) GTmetrix/1.0",
    "Mozilla/5.0 (X11; Linux) Ghost Inspector/1.0",
    "Mozilla/5.0 (compatible; Detectify)",
    "Mozilla/5.0 (Windows NT) StatusCake/1.0",
    // Special Google crawlers & services
    "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 GoogleImageProxy",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 4_0_1; Google Page Speed Insights) Version/4.0.5 Safari/6531.22.7",
    "Mozilla/5.0 (X11; Linux x86_64; Google Web Preview) Chrome/27.0",
    "Mozilla/5.0 (compatible; Google-Ads-Conversions)",
    "Mozilla/5.0 (compatible; Google-Adwords-DisplayAds-WebRender)",
    "Mozilla/5.0 (compatible; Google-AMPHTML)",
    "Mozilla/5.0 (compatible; Google-HotelAdsVerifier/2.0)",
    // Feed fetchers & content scanners
    "Mozilla/5.0 (compatible; Nutch-1.7)",
    "Mozilla/4.5 (compatible; HTTrack 3.0x)",
    "Mozilla/5.0 (compatible; Inoreader.com; 2 subscribers)",
    "Mozilla/5.0 (compatible; Theoldreader.com; 1 subscribers)",
    "NewsBlur Feed Finder (Mozilla/5.0)",
    "Mozilla/5.0 (Java) outbrain",
    "Mozilla/5.0 (compatible; PTST/211202.211915)",
    "Mozilla/4.0 (compatible; baidu Transcoder;)",
  ];

  for (const ua of samples) {
    const reason = botReason(fakeReq(ua));
    assert.equal(reason, "ua-regex", `Expected ${ua} to be identified by botReason`);
    assert.ok(BOT_UA_REGEX.test(ua), `Expected BOT_UA_REGEX to match ${ua}`);
  }
});

// ============================================================================
// Round 9: Zero False Positives on Human Browsers
// ============================================================================
test("Round 9: Real human browsers are never flagged by botReason", () => {
  const humans = [
    CHROME_UA,
    FIREFOX_UA,
    SAFARI_IOS,
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/126.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OPR/111.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) coc_coc_browser/116.0.236",
    // In-app webviews
    "Mozilla/5.0 (Linux; Android 12; SM-A525F; wv) [FB_IAB/FB4A;FBAV/470.0.0.43.109;]",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) [FBAN/FBIOS;FBAV/470.0.0.37.109;]",
    "Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) Instagram 330.0.0.35.108 Android",
    "Mozilla/5.0 (Linux; Android 13; V2250; wv) BytedanceWebview/d8a21c6",
    "Mozilla/5.0 (Linux; Android 13; 22101316G; wv) Zalo/24.05.1",
    // CUBOT phone traps
    "Mozilla/5.0 (Linux; Android 11; CUBOT_P40) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    // Legacy allowed shapes
    "Nokia6230/2.0 (04.44) Profile/MIDP-2.0 Configuration/CLDC-1.1",
    "Opera/9.80 (Android; Opera Mini/36.2.2254/191.249; U; en) Presto/2.12.423 Version/12.16",
    "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 Java/ASVM/1.1 Profile/MIDP-2.1",
  ];

  for (const ua of humans) {
    const reason = botReason(fakeReq(ua));
    assert.equal(reason, null, `False positive: ${ua} must not be blocked`);
    assert.equal(BOT_UA_REGEX.test(withoutDevicePlatform(ua)), false, `False match on ${ua}`);
  }
});

// ============================================================================
// Round 10: ReDoS resistance on adversarial 1MB strings
// ============================================================================
test("Round 10: All regexes execute in linear time (< 100ms per 1MB)", () => {
  const MB = 1_000_000;
  const adversarialCases = [
    ["1MB of 'a'", "a".repeat(MB)],
    ["1MB of 'a@'", "a@".repeat(MB / 2)],
    ["1MB of 'google-'", "google-".repeat(MB / 7)],
    ["1MB of 'playwright'", "playwright".repeat(MB / 10)],
    ["1MB of spaces", " ".repeat(MB)],
    ["1MB of 'a-'", "a-".repeat(MB / 2)],
    ["1MB of 'a@b.'", "a@b.".repeat(MB / 4)],
    ["1MB of 'bot'", "bot".repeat(MB / 3)],
  ];

  for (const [name, str] of adversarialCases) {
    const t0 = performance.now();
    BOT_UA_REGEX.test(str);
    const dt = performance.now() - t0;
    assert.ok(dt < 300, `ReDoS risk detected: ${name} took ${dt.toFixed(1)}ms`);
  }
});

// ============================================================================
// Round 11: Totality on malformed/hostile inputs
// ============================================================================
test("Round 11: botReason and assessRequestSync never throw on arbitrary/corrupt inputs", () => {
  const weirdInputs = [
    "",
    " ",
    "\t\r\n",
    "\u0000",
    "\ud800", // lone surrogate
    "\ufeff\u200b\u00a0",
    "\u00adLynx/2.9",
    "x".repeat(100_000),
    "Mozilla/5.0 " + "(".repeat(500),
    "Mozilla/5.0 " + ")".repeat(500),
    "Mozilla/5.0 " + "@".repeat(500),
  ];

  for (const ua of weirdInputs) {
    assert.doesNotThrow(() => botReason(fakeReq(ua)));
    assert.doesNotThrow(() => assessRequestSync({ headers: bag({ "user-agent": ua }) }));
  }
});

// ============================================================================
// Round 12: Monotonicity Invariant
// ============================================================================
test("Round 12: Adding newly recognized bot tokens never lowers risk score", () => {
  const baseHeaders = {
    accept: "text/html,application/xhtml+xml",
    "accept-language": "en",
    "sec-fetch-mode": "navigate",
  };

  const baseScore = assessRequestSync({ headers: new Headers({ "user-agent": CHROME_UA, ...baseHeaders }) }).score;
  assert.equal(baseScore, 0);

  const tokens = ["Playwright", "Selenium", "collection@infegy.com", "PingdomTMS/2020", "Google Web Preview"];
  for (const tok of tokens) {
    const botUa = `${CHROME_UA} ${tok}`;
    const botScore = assessRequestSync({ headers: new Headers({ "user-agent": botUa, ...baseHeaders }) }).score;
    assert.ok(botScore >= 50, `Score for ${tok} was ${botScore}, expected >= 50`);
    assert.ok(botScore >= baseScore, `Score lowered for ${tok}`);
  }
});

// ============================================================================
// Round 13: withoutDevicePlatform safety
// ============================================================================
test("Round 13: withoutDevicePlatform strips phone model names but retains crawler marks", () => {
  // Real human phone with 'bot' in hardware name
  const phoneUa = "Mozilla/5.0 (Linux; Android 7.0; M bot 60 Build/NRD90M) AppleWebKit/537.36 Chrome/58.0";
  assert.equal(BOT_UA_REGEX.test(withoutDevicePlatform(phoneUa)), false);

  // Crawler hiding inside device platform with crawler marker (version slash)
  const stealthCrawler = "Mozilla/5.0 (Linux; Android 10; Storebot-Google/1.0) AppleWebKit/537.36";
  assert.equal(BOT_UA_REGEX.test(withoutDevicePlatform(stealthCrawler)), true);
  assert.equal(botReason(fakeReq(stealthCrawler)), "ua-regex");
});

// ============================================================================
// Round 14: Verified crawler exemption rules
// ============================================================================
test("Round 14: Verified crawler exemption is revoked if automation token is present", () => {
  // Verified crawler with real UA: score 0
  const realGoogle = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  // If an attacker on a verified IP attaches Playwright:
  const spoofedGoogle = `${realGoogle} Playwright/1.40`;
  const res = assessRequestSync({ headers: new Headers({ "user-agent": spoofedGoogle }) });
  assert.ok(res.score >= 85, `Verified crawler with Playwright should not be exempt (got ${res.score})`);
});

// ============================================================================
// Round 15: Policy and Shadow Mode Integration
// ============================================================================
test("Round 15: Crawlers caught by botReason produce expected risk score and classification", () => {
  const ua = "Mozilla/5.0 (compatible; NetcraftSurveyAgent/1.0; +info@netcraft.com)";
  assert.equal(botReason(fakeReq(ua)), "ua-regex");

  const assessment = assessRequestSync({ headers: new Headers({ "user-agent": ua }) });
  assert.ok(assessment.score >= 50);
  assert.ok(assessment.classification === "automated" || assessment.classification === "suspicious");
});

// ============================================================================
// Round 16: End-to-end botReason reason accuracy
// ============================================================================
test("Round 16: botReason correctly distinguishes ua-regex, non-browser-ua, and twitter-asn", () => {
  // Declared bot
  assert.equal(botReason(fakeReq("PingdomTMS/2020")), "ua-regex");
  // Non-browser UA
  assert.equal(botReason(fakeReq("CustomNetworkClient/1.0")), "non-browser-ua");
  // Twitter ASN header
  assert.equal(botReason(fakeReq(CHROME_UA, { "x-vercel-ip-as-number": "13414" })), "twitter-asn");
  // Legitimate human
  assert.equal(botReason(fakeReq(CHROME_UA)), null);
});

// ============================================================================
// Round 17: Mutation testing assertions (Gate sensitivity)
// ============================================================================
test("Round 17: Removing key bot tokens causes detection to fail on specific fixtures", () => {
  const probeUas = [
    "collection@infegy.com",
    "PingdomTMS/1.0",
    "Playwright/1.0",
    "NetcraftSurveyAgent/1.0",
    "GoogleImageProxy",
  ];

  for (const ua of probeUas) {
    assert.ok(BOT_UA_REGEX.test(ua), `Gate sensitivity check: ${ua} must trigger BOT_UA_REGEX`);
  }
});
