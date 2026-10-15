/**
 * Twitter (X) Bot & In-App Browser Verification Suite.
 *
 * Verifies:
 *  1. Complete coverage of Twitter / X crawler variants (Twitterbot, TwitterCardService, Twitter-Image-Proxy, xbot, Grok).
 *  2. botReason only trusts the platform ASN header (XFF / IP / tracing headers are spoofable).
 *  3. (removed) CIDR matching: IP is not trusted evidence.
 *  4. Verification and anti-spoofing in assessRequestSync (verified-crawler via ASN vs spoofed-crawler).
 *  5. Anti-spoofing via Client Hints consistency (mobile-hint-mismatch).
 *  6. Strict human in-app browser exemption (Zero False Positive for Twitter for iPhone/Android/iPad/TweetDeck).
 *  7. ReDoS linear execution (< 300ms per 1MB) for Twitter/X tokens.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRequestSync } from "./assess";
import { matchKnownCrawler } from "./crawlers";
import { headerSignals } from "./signals";
import { BOT_UA_REGEX, botReason, parseUserAgent } from "@/lib/tracking/ua";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const bag = (m: Record<string, string>) => {
  const map = new Map(Object.entries(m).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (k: string) => map.get(k.toLowerCase()) ?? null };
};

const fakeReq = (ua: string, extraHeaders: Record<string, string> = {}) => ({
  headers: bag({ "user-agent": ua, ...extraHeaders }),
});

test("Twitter/X crawlers and AI fetchers are reliably caught by botReason and BOT_UA_REGEX", () => {
  const twitterUas = [
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; Twitterbot/1.0; +http://twitter.com/robot)",
    "Mozilla/5.0 (compatible; Twitterbot/1.0; +https://dev.twitter.com/cards/overview)",
    "TwitterCardService",
    "TwitterCardService/1.0",
    "TwitterCardService/2.0",
    "Twitter-Image-Proxy/1.0",
    "Xbot/1.0",
    "GrokBot/1.0 (+https://x.ai)",
    "xAI-Grok/1.0 (+https://grok.com)",
    "Grok-DeepSearch/1.0 (+https://x.ai)",
  ];

  for (const ua of twitterUas) {
    assert.ok(BOT_UA_REGEX.test(ua), `Expected BOT_UA_REGEX to match ${ua}`);
    assert.equal(botReason(fakeReq(ua)), "ua-regex", `Expected botReason to return ua-regex for ${ua}`);
  }
});

test("botReason chi tin header ASN cua nen tang; IP/XFF va header tracing KHONG duoc phep quyet dinh redirect", () => {
  // Header Vercel dat: ASN 13414
  assert.equal(botReason(fakeReq("Twitterbot/1.0", { "x-vercel-ip-as-number": "13414" })), "ua-regex");
  assert.equal(botReason(fakeReq(CHROME_UA, { "x-vercel-ip-as-number": "13414" })), "twitter-asn");

  // Nguoi that + mot header gia/vo tinh: PHAI van duoc redirect (botReason = null)
  const spoofable: Record<string, string>[] = [
    { "x-forwarded-for": "199.16.156.45" },
    { "x-forwarded-for": "2620:106:6000::1" },
    { "x-real-ip": "199.59.148.1" },
    { "cf-connecting-ip": "209.237.195.10" },
    { "x-b3-traceid": "463ac35c9f6413ad" },
    { "finagle-ctx-com.twitter.finagle.retries": "1" },
  ];
  for (const h of spoofable) {
    assert.equal(botReason(fakeReq(CHROME_UA, h)), null, `header gia lam mat redirect cua nguoi that: ${JSON.stringify(h)}`);
  }
});

test("assessRequestSync correctly distinguishes verified (via ASN), spoofed, and unverified Twitter/X crawlers", () => {
  // 1. Verified Twitterbot on AS13414
  const verifiedTwitterAsn = assessRequestSync({
    headers: new Headers({
      "user-agent": "Twitterbot/1.0",
      "x-vercel-ip-as-number": "13414",
    }),
  });
  assert.equal(verifiedTwitterAsn.classification, "verified-crawler");
  assert.equal(verifiedTwitterAsn.score, 0);
  assert.equal(verifiedTwitterAsn.crawler?.via, "asn");

  // 2. IP/XFF KHONG phai bang chung: Twitterbot + XFF thuoc dai cua X van chi la unverified (khong duoc diem 0)
  const forgedXff = assessRequestSync({
    headers: new Headers({ "user-agent": "Twitterbot/1.0", "x-forwarded-for": "199.16.156.5" }),
    ip: "199.16.156.5",
  });
  assert.equal(forgedXff.crawler?.verification, "unverified");
  assert.equal(forgedXff.score, 55);

  // 3. Spoofed Twitterbot claiming Twitterbot from unauthorized ASN (e.g., AWS 16509, DigitalOcean 14061)
  const spoofedTwitter = assessRequestSync({
    headers: new Headers({
      "user-agent": "Twitterbot/1.0",
      "x-vercel-ip-as-number": "16509",
    }),
  });
  assert.equal(spoofedTwitter.classification, "spoofed-crawler");
  assert.ok(spoofedTwitter.score >= 95);

  // 4. Unverified Twitterbot (offline / non-Vercel environment without ASN header and without verified IP)
  const unverified = assessRequestSync({
    headers: new Headers({ "user-agent": "Twitterbot/1.0" }),
  });
  assert.equal(unverified.crawler?.verification, "unverified");
  assert.equal(unverified.classification, "suspicious");
  assert.equal(unverified.score, 55);

  // 5. Verified crawler with attacker appending Playwright: exemption revoked
  const spoofWithPlaywright = assessRequestSync({
    headers: new Headers({
      "user-agent": "Twitterbot/1.0 Playwright/1.4",
      "x-vercel-ip-as-number": "13414",
    }),
  });
  assert.ok(spoofWithPlaywright.score >= 85);
});

test("headerSignals catches Client Hints mobile mismatch anti-spoofing", () => {
  // Windows desktop UA pretending to be mobile via Client Hints
  const signals1 = headerSignals(
    bag({
      "sec-fetch-mode": "navigate",
      "sec-ch-ua-platform": '"Windows"',
      "sec-ch-ua-mobile": "?1",
      accept: "text/html",
      "accept-language": "vi-VN",
    }),
    CHROME_UA,
  );
  assert.ok(signals1.some((s) => s.id === "mobile-hint-mismatch"));

  // Genuine Windows Chrome sends ?0: no mismatch
  const signals2 = headerSignals(
    bag({
      "sec-fetch-mode": "navigate",
      "sec-ch-ua-platform": '"Windows"',
      "sec-ch-ua-mobile": "?0",
      accept: "text/html",
      "accept-language": "vi-VN",
    }),
    CHROME_UA,
  );
  assert.equal(signals2.some((s) => s.id === "mobile-hint-mismatch"), false);
});

test("matchKnownCrawler matches all Twitter and xAI crawler identifiers", () => {
  const crawlerUas = [
    "Twitterbot/1.0",
    "TwitterCardService",
    "Twitter-Image-Proxy/1.0",
  ];
  // Crawler cua xAI (Grok) KHONG nam trong registry "x": khong co bang chung chung chay tren AS13414,
  // nen khong duoc gan ASN do (tren Vercel chung se thanh "spoofed"). Chung van bi botReason bat qua BOT_UA_REGEX.
  for (const ua of ["Xbot/1.0", "GrokBot/1.0", "xAI-Grok/1.0", "Grok-DeepSearch/1.0"]) {
    assert.equal(matchKnownCrawler(ua), undefined, `${ua} khong duoc nam trong registry x`);
  }
  for (const ua of crawlerUas) {
    const crawler = matchKnownCrawler(ua);
    assert.ok(crawler, `Expected matchKnownCrawler to match ${ua}`);
    assert.equal(crawler?.id, "x");
  }
});

test("Real human users in Twitter / X mobile apps and TweetDeck are NEVER blocked and recognized as Twitter In-App", () => {
  const twitterAppUas = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Twitter for iPhone",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone / 10.20",
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPad",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.231105.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 Twitter for Android",
    "Mozilla/5.0 (Linux; Android 13; SM-S918B; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 Twitter for Android / 10.15.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 X for iPhone",
    "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 X for Android",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 TweetDeck/5.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 TwitterWeb/1.0",
  ];

  for (const ua of twitterAppUas) {
    // 1. Never blocked by botReason
    assert.equal(botReason(fakeReq(ua)), null, `False positive: ${ua} must not be blocked`);
    // 2. parseUserAgent recognizes device and browser correctly
    const parsed = parseUserAgent(ua);
    assert.notEqual(parsed.device, "bot", `Device must not be bot for ${ua}`);
    assert.equal(parsed.browser, "Twitter In-App", `Expected Twitter In-App for ${ua}`);
  }
});

test("ReDoS: Twitter and xAI regex tokens execute in linear time (< 300ms per 1MB)", () => {
  const MB = 1_000_000;
  const adversarialCases = [
    ["1MB of 'twitter'", "twitter".repeat(MB / 7)],
    ["1MB of 'twittercardservice'", "twittercardservice".repeat(MB / 18)],
    ["1MB of 'xai-grok'", "xai-grok".repeat(MB / 8)],
    ["1MB of 'grokbot'", "grokbot".repeat(MB / 7)],
    ["1MB of 'xbot'", "xbot".repeat(MB / 4)],
  ];

  for (const [name, str] of adversarialCases) {
    const t0 = performance.now();
    BOT_UA_REGEX.test(str);
    const dt = performance.now() - t0;
    assert.ok(dt < 300, `ReDoS risk detected: ${name} took ${dt.toFixed(1)}ms`);
  }
});
