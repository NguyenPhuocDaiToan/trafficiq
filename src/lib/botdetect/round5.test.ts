import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  assessRequest,
  assessRequestSync,
} from "./assess";
import {
  cleanUa,
  combineWeights,
  headerSignals,
  isBrowserLikeUa,
  isPlaceholderUa,
  looksAutomated,
  readAsn,
  uaSignals,
} from "./signals";
import { hostMatchesSuffix, normalizeIp } from "./fcrdns";
import { matchKnownCrawler } from "./crawlers";
import { BOT_UA_REGEX } from "@/lib/tracking/ua";
import { telemetrySignals } from "./client-signals";

const hb = (h: Record<string, string>) => ({
  get: (n: string) => h[n.toLowerCase()] ?? null,
});
const modern = {
  "sec-fetch-mode": "navigate",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const legacy = { accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" };
const score = (ua: string, h: Record<string, string> = {}) =>
  assessRequestSync({ headers: hb({ "user-agent": ua, ...h }) });
const ids = (a: { signals: { id: string }[] }) => a.signals.map((s) => s.id);

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
describe("humans: real-world UAs must stay below 30", () => {
  const humans: [string, string, Record<string, string>][] = [
    ["Chrome Win", CHROME_WIN, { ...modern, "sec-ch-ua-platform": '"Windows"' }],
    ["Chrome Android", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", { ...modern, "sec-ch-ua-platform": '"Android"' }],
    ["ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", { ...modern, "sec-ch-ua-platform": '"Chrome OS"' }],
    ["Linux Chrome", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", { ...modern, "sec-ch-ua-platform": '"Linux"' }],
    ["macOS Chrome", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", { ...modern, "sec-ch-ua-platform": '"macOS"' }],
    ["Brave brands", CHROME_WIN, { ...modern, "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Brave";v="120"' }],
    ["Safari iPad desktop UA", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", modern],
    ["Opera Mini", "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16", { "sec-fetch-mode": "navigate", ...legacy }],
    ["UC Browser", "UCWEB/2.0 (Linux; U; Opera Mini/7.1.32052/30.3697; en-US; Nokia501) U2/1.0.0 UCBrowser/9.2.0.311 U2/1.0.0 Mobile", legacy],
    ["Nokia", "Nokia6230i/2.0 (03.25) Profile/MIDP-2.0 Configuration/CLDC-1.1", legacy],
    ["Lynx", "Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/3.6.14", legacy],
    ["Links", "Links (2.29; Linux 5.4.0 x86_64; GNU C 9.3; text)", { accept: "*/*" }],
    ["ELinks", "ELinks/0.13.2 (textmode; Linux 5.4.0 x86_64; 80x24-2)", { accept: "*/*" }],
    ["Cubot phone", "Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", modern],
    ["Node-RED editor", CHROME_WIN + " Node-RED/3.1", modern],
    ["Dartmouth in UA", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dartmouth/1.0 AppleWebKit/537.36 Chrome/120 Safari/537.36", modern],
    ["Kindle Silk", "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4.1 like Chrome/120.0.0.0 Safari/537.36", modern],
    ["ChromiumOS hint (unknown platform ignored)", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120 Safari/537.36", { ...modern, "sec-ch-ua-platform": '"Chromium OS"' }],
    ["WSA", "Mozilla/5.0 (Linux; Android 13; Subsystem for Android(TM)) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", { ...modern, "sec-ch-ua-platform": '"Android"' }],
    ["Platform Unknown hint", CHROME_WIN, { ...modern, "sec-ch-ua-platform": '"Unknown"' }],
    ["Proxy-duplicated hints", CHROME_WIN, { "sec-fetch-mode": "navigate, navigate", accept: modern.accept, "accept-language": "en", "sec-ch-ua-platform": '"Windows", "Windows"' }],
    ["Brand list with HeadlessX-like words but not HeadlessChrome", CHROME_WIN, { ...modern, "sec-ch-ua": '"Chromium";v="120", "Headless Browser Inc";v="1"' }],
  ];
  for (const [name, ua, h] of humans) {
    test(name, () => {
      const a = score(ua, h);
      assert.ok(a.score < 30, `${name}: ${a.score} ${ids(a).join(",")}`);
    });
  }

  test("BUG: feature-phone UAs (MOT-/SAMSUNG-/LG-) are flagged >=30 as 'non-browser-ua' (legacy allowlist incomplete)", () => {
    for (const ua of [
      "MOT-V3/0E.41.C3R MIB/2.2.1 Profile/MIDP-2.0 Configuration/CLDC-1.1 UP.Link/6.3.1.15.0",
      "SAMSUNG-GT-S5230/1.0 Profile/MIDP-2.0 Configuration/CLDC-1.1 Release/17.11.2008 Browser/NetFront/3.4",
      "LG-GC900/V10a Obigo/WAP2.0 Profile/MIDP-2.1 Configuration/CLDC-1.1",
    ]) {
      assert.ok(score(ua, legacy).score < 30, ua);
    }
  });
});

// ---------------------------------------------------------------------------
describe("headerSignals: strong signals for every UA", () => {
  test("headless client hint fires for any UA incl. library and legacy", () => {
    for (const ua of ["Mozilla/4.0 (compatible; MSIE 8.0)", "Opera/9.80", "curl/8", "Lynx/2.9", ""]) {
      assert.ok(ids({ signals: headerSignals(hb({ "sec-ch-ua": '"HeadlessChrome";v="120"' }), ua) }).includes("headless-client-hint"), ua);
    }
  });
  test("non-navigate modes: which values are flagged", () => {
    const flagged: string[] = [];
    for (const m of ["navigate", "same-origin", "cors", "no-cors", "websocket", "nested-navigate", "NAVIGATE", " navigate ", ""]) {
      const s = headerSignals(hb({ "sec-fetch-mode": m }), CHROME_WIN);
      if (s.some((x) => x.id === "programmatic-fetch")) flagged.push(JSON.stringify(m));
    }
    // characterisation: websocket / nested-navigate (old Chrome iframes) are flagged too; README says only cors/no-cors
    assert.deepEqual(flagged, ['"cors"', '"no-cors"', '"websocket"', '"nested-navigate"']);
  });
  test("two strong signals on one odd-but-human client (UA-switcher + non-navigate fetch) reach 'automated' (62)", () => {
    const a = score(CHROME_WIN, { ...modern, "sec-fetch-mode": "no-cors", "sec-ch-ua-platform": '"macOS"' });
    assert.equal(a.score, 62); // documents the double-strong pile-up (low severity design tradeoff)
  });
  test("a single platform mismatch alone is only 'suspicious'", () => {
    const a = score(CHROME_WIN, { ...modern, "sec-ch-ua-platform": '"macOS"' });
    assert.equal(a.classification, "suspicious");
  });
  test("absence signals do not apply to crawlers/libraries (no double count)", () => {
    const s = headerSignals(hb({}), "curl/8.0");
    assert.deepEqual(s, []);
    const g = headerSignals(hb({}), "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    assert.deepEqual(g, []);
  });
  test("noisy-OR monotonic and bounded", () => {
    assert.equal(combineWeights([]), 0);
    assert.equal(combineWeights([{ id: "x" as never, weight: NaN }]), 0);
    assert.ok(combineWeights([{ id: "x" as never, weight: 30 }, { id: "y" as never, weight: 45 }]) === 62);
  });
});

// ---------------------------------------------------------------------------
describe("uaSignals", () => {
  test("'bot' substrings in human UAs: Cubot exempt, others characterised", () => {
    assert.equal(BOT_UA_REGEX.test("CUBOT_X30"), false);
    // synthetic: inherited substring semantics from ua.ts (302 behaviour) -> 55 flag, never >= 60
    for (const w of ["Abbott", "Talbot", "Robot", "Botim"]) {
      const a = score(`Mozilla/5.0 (Linux; Android 11; ${w}) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36`, modern);
      assert.ok(a.score < 60, `${w} ${a.score}`);
    }
  });
  test("placeholder residue: 'Mozilla/5.0 Bot', '- Bot' not lower than bare placeholder", () => {
    assert.ok(score("Mozilla/5.0 Bot").score >= 60);
    assert.ok(score("- Bot").score >= 60);
    assert.ok(score("-").score >= 60);
    // real crawler UA keeps its own score
    const g = score("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    assert.ok(!ids(g).includes("empty-ua"));
  });
  test("Nokia-Bot / Midori-spider are bot-scored, not legacy-exempt", () => {
    assert.ok(score("Nokia-Bot/1.0").score >= 55);
    assert.ok(score("Midori-spider/1.0").score >= 55);
    assert.ok(score("NokiaScraper/1.0").score >= 40);
  });
  test("runtime tokens bounded", () => {
    for (const ua of ["node", "Node/18", "(node)", "x; deno/1", "bun", "Dart/2.19 (dart:io)", "foo bun;"]) {
      assert.ok(looksAutomated(ua), ua);
    }
    for (const ua of ["Node-RED", "Nodes", "Dartmouth", "Bunny", "nodemon", "Mozilla/5.0 (Linux; U; Android 4.0.3; BUN-LX1 Build/x)"]) {
      assert.ok(!looksAutomated(ua), ua);
    }
  });
  test("claimsBrowser: Mozilla/N and Opera/", () => {
    assert.ok(isBrowserLikeUa("Mozilla/4.0 (compatible; MSIE 8.0)"));
    assert.ok(isBrowserLikeUa("Opera/9.80"));
    assert.ok(!isBrowserLikeUa("Mozilla/5.0 Googlebot/2.1"));
  });
  test("BUG: 'Mozilla/' + junk scores 0 while 'Mozilla' (60) and 'Mozilla/5.0' with no headers (>=60) do not (uaSignals prefix check vs claimsBrowser digit check disagree)", () => {
    for (const ua of ["Mozilla/", "Mozilla/x", "Mozilla/Scraper"]) {
      const a = score(ua);
      assert.ok(a.score >= 30, `${JSON.stringify(ua)} -> ${a.score} [${ids(a)}]`);
    }
  });
  test("BUG: legacy-browser prefixes accept any suffix: 'Lynx scraper', 'Nokia1', 'Links (x)' with no headers score 0", () => {
    // "NokiaSpy1/1.0" cố ý KHÔNG còn trong danh sách: allowlist đã nới sang dạng vendor+mã máy ("Nokia-1606", "Nokia 3310",
    // "NOKIA-RM-11") sau khi đo 5.594 UA người bị chặn nhầm; scraper tên "NokiaSpy1" là rủi ro chấp nhận được.
    for (const ua of ["Lynx scraper/1.0", "Dolphin x"]) {
      const a = score(ua);
      assert.ok(a.score >= 30, `${ua} -> ${a.score}`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("cleanUa", () => {
  test("strips ends only", () => {
    assert.equal(cleanUa("​ a b ​"), "a b");
    assert.equal(cleanUa("a​b"), "a​b");
    assert.equal(cleanUa("a b"), "a b");
    assert.equal(cleanUa(""), "");
    assert.equal(cleanUa("​­\u0085﻿ "), "");
  });
  test("returns same string when nothing stripped; astral chars intact", () => {
    const s = "😀 x 😀";
    assert.equal(cleanUa(s), s);
    assert.equal(cleanUa("​😀​"), "😀");
  });
  test("class edges: 200b-200f, 202a-202e, 2060-2064, 2066-206f, 180e, 034f", () => {
    for (const c of [0x200b, 0x200f, 0x202a, 0x202e, 0x2060, 0x2064, 0x2066, 0x206f, 0x180e, 0x034f, 0xad, 0x85, 0xfeff]) {
      assert.equal(cleanUa(`${String.fromCharCode(c)}x${String.fromCharCode(c)}`), "x", c.toString(16));
    }
    for (const c of [0x200a /* is \s */, 0x2010, 0x2029, 0x2065 /* unassigned */]) {
      const r = cleanUa(`${String.fromCharCode(c)}x`);
      // 2010 (hyphen) must NOT be stripped
      if (c === 0x2010) assert.equal(r, "‐x");
    }
  });
  test("BUG: other latin-1 reachable invisible controls (U+0080..U+009F) are not trimmed: '-\\u0080' scores 40 not 60", () => {
    // Node decodes raw header bytes as latin-1, so C1 controls are the only extra invisibles that can really arrive.
    assert.equal(score("-\u0080").score, score("-").score);
  });
  test("isPlaceholderUa on messy input", () => {
    assert.ok(isPlaceholderUa(" - "));
    assert.ok(isPlaceholderUa("​Mozilla/5.0​"));
    assert.ok(!isPlaceholderUa("Mozilla/5.0 x"));
  });
});

// ---------------------------------------------------------------------------
describe("assess: crawler token stripping + exemption", () => {
  test("'Mozilla/5.0 Applebot/0.1' -> residue placeholder -> >= 82", () => {
    assert.ok(score("Mozilla/5.0 Applebot/0.1").score >= 82);
  });
  test("version strip: 'Applebot/curl' keeps http-library signal", () => {
    assert.ok(ids(score("Applebot/curl")).includes("http-library-ua"));
    assert.ok(ids(score("Applebot/1.0 curl/8")).includes("http-library-ua"));
  });
  test("verified crawler is exempt, but not with automation tokens in the UA", async () => {
    const verifier = async () => ({ status: "verified" as const, hostname: "crawl.googlebot.com" });
    const ok = await assessRequest({ headers: hb({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }), ip: "66.249.66.1" }, verifier);
    assert.equal(ok.score, 0);
    for (const ua of ["Googlebot/2.1 Playwright/1.40", "Googlebot/2.1 node", "Googlebot/2.1 (HeadlessChrome)", "Googlebot/2.1 python-requests/2"]) {
      const a = await assessRequest({ headers: hb({ "user-agent": ua }), ip: "66.249.66.1" }, verifier);
      assert.ok(a.score >= 85, `${ua} -> ${a.score}`);
      assert.notEqual(a.classification, "verified-crawler");
    }
  });
  test("verified exemption applies after cleanUa (NBSP-wrapped real Googlebot)", async () => {
    const verifier = async () => ({ status: "verified" as const, hostname: "x.googlebot.com" });
    const a = await assessRequest({ headers: hb({ "user-agent": " Googlebot/2.1 " }), ip: "66.249.66.1" }, verifier);
    assert.equal(a.score, 0);
  });
  test("ASN-verified Meta with real UA", () => {
    const a = score("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", { "x-vercel-ip-as-number": "32934" });
    assert.equal(a.classification, "verified-crawler");
    const spoof = score("facebookexternalhit/1.1", { "x-vercel-ip-as-number": "13414" });
    assert.equal(spoof.classification, "spoofed-crawler");
  });
  test("real crawler UAs never trigger library/headless tokens", () => {
    for (const ua of [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
      "Mozilla/5.0 (Device; OS_version) AppleWebKit/WebKit_version (KHTML, like Gecko) Version/Safari_version Safari/WebKit_version (Applebot/0.1; +http://www.apple.com/go/applebot)",
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "Twitterbot/1.0",
      "APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ]) {
      assert.ok(!looksAutomated(ua), ua);
    }
  });
  test("readAsn canonical decimal", () => {
    const r = (v: string) => readAsn(hb({ "x-vercel-ip-as-number": v }));
    assert.equal(r("32934"), 32934);
    assert.equal(r(" 32934 "), 32934);
    for (const bad of ["0x80A6", "00032934", "032934", "+32934", "32934.0", "3.2934e4", "-1", "4294967296", "99999999999", "٣٢٩٣٤", "", "abc", "32934\n1", "1_000"]) {
      assert.equal(r(bad), undefined, JSON.stringify(bad));
    }
    assert.equal(r("0"), 0);
    assert.equal(r("4294967295"), 4294967295);
  });
  test("matchKnownCrawler gets raw (uncleaned) UA", () => {
    assert.equal(matchKnownCrawler("​Googlebot")?.id, "google");
  });
});

// ---------------------------------------------------------------------------
describe("fcrdns helpers", () => {
  test("hostMatchesSuffix boundaries/charset", () => {
    const m = (h: string) => hostMatchesSuffix(h, "googlebot.com");
    assert.ok(m("crawl-1.googlebot.com"));
    assert.ok(m("crawl-1.GOOGLEBOT.com."));
    assert.ok(m("googlebot.com"));
    assert.ok(!m("evilgooglebot.com"));
    assert.ok(!m("googlebot.com.evil.net"));
    assert.ok(!m("evil\0.googlebot.com"));
    assert.ok(!m("evil.com#.googlebot.com"));
    assert.ok(!m("crawl.googlebot.com.."));
    assert.ok(!m("crawl.googlebot.com\n"));
    assert.ok(!m(" crawl.googlebot.com"));
    assert.ok(!m("crawl.googleboT.comK"));
    assert.ok(!m("crawl.googlebot.com".replace("o", "ő")));
    assert.ok(!m("a".repeat(64) + ".googlebot.com"));
    assert.ok(m("a".repeat(63) + ".googlebot.com"));
    assert.ok(!m("-a.googlebot.com"));
    assert.ok(!m("a-.googlebot.com"));
    assert.ok(!m(("a".repeat(60) + ".").repeat(5) + "googlebot.com")); // > 253
    assert.ok(!m(""));
    assert.ok(!m("."));
    assert.ok(!m(undefined as never));
    // Kelvin sign must not alias 'k'
    assert.ok(!hostMatchesSuffix("crawl.Killer.com", "killer.com"));
  });
  test("normalizeIp", () => {
    assert.equal(normalizeIp("1.2.3.4:443"), "1.2.3.4");
    assert.equal(normalizeIp("[::1]:443"), "0:0:0:0:0:0:0:1");
    assert.equal(normalizeIp("::ffff:1.2.3.4"), "1.2.3.4");
    assert.equal(normalizeIp("::FFFF:102:304"), "1.2.3.4");
    assert.equal(normalizeIp("fe80::1%eth0"), "fe80:0:0:0:0:0:0:1");
    assert.equal(normalizeIp("fe80::1%12"), "fe80:0:0:0:0:0:0:1");
    assert.equal(normalizeIp("1.2.3.4%eth0"), null);
    assert.equal(normalizeIp("fe80::1%"), null);
    assert.equal(normalizeIp("fe80::1%a b"), null);
    assert.equal(normalizeIp("fe80::1%a%b"), null);
    assert.equal(normalizeIp("1.2.3.4, 5.6.7.8"), null);
    assert.equal(normalizeIp("999.1.1.1:80"), null);
    assert.equal(normalizeIp("2001:db8::1::2"), null);
    assert.equal(normalizeIp(""), null);
  });
});

// ---------------------------------------------------------------------------
// ReDoS sweep: every regex in botdetect (+ shared BOT_UA_REGEX), via public entry points.
describe("ReDoS sweep (adversarial 1MB / 2MB)", () => {
  const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  const shapes: Record<string, (n: number) => string> = {
    spaces: (n) => rep(" ", n),
    "x spaces x": (n) => "x" + rep(" ", n) + "x",
    "spaces x": (n) => rep(" ", n) + "x",
    "x spaces": (n) => "x" + rep(" ", n),
    "zw x zw": (n) => rep("​", n / 2) + "x" + rep("​", n / 2),
    "x zw x": (n) => "x" + rep("​", n) + "x",
    "a..a bot": (n) => rep("a", n) + "bot",
    "a- .. bot": (n) => rep("a-", n) + "bot",
    "cu.. bot": (n) => rep("cu", n) + "bot",
    "bot bot ": (n) => rep("bot ", n),
    "Mozilla bot;": (n) => "Mozilla/5.0 " + rep("bot;", n),
    "- bot": (n) => "- " + rep("bot;", n),
    "(node ": (n) => rep("(node ", n),
    nodenode: (n) => rep("node", n),
    "Googlebot/1111": (n) => "Googlebot/" + rep("1", n),
    "Googlebot/1.1.1": (n) => "Googlebot/1" + rep(".1", n),
    "Applebot/1 nosep": (n) => rep("Applebot/1", n),
    "Applebot- ": (n) => rep("Applebot-", n),
    "yandex": (n) => rep("yandex", n),
    "libwww": (n) => rep("libwww", n),
    "java/": (n) => rep("java/", n),
    "compatible; ": (n) => rep("(compatible; ", n),
    label63: (n) => rep("a".repeat(63) + ".", n),
    label64: (n) => rep("a".repeat(64) + ".", n),
    "dash labels": (n) => rep("-".repeat(61) + "a.", n),
    "a-... !": (n) => rep("a-", n) + "!.googlebot.com",
    dots: (n) => "a" + rep(".a", n),
    "1.1.1.1 rep": (n) => rep("1.1.1.1", n),
    "[ ... ": (n) => "[" + rep("a", n),
    "[::]:": (n) => "[" + rep(":", n) + "]:1",
    "ipv6 zone": (n) => "fe80::1%" + rep("a", n) + "!",
    colons: (n) => rep(":", n),
    commas: (n) => rep(",", n),
    quotes: (n) => rep('"', n),
    nbsp: (n) => "x" + rep(" ", n),
    "astral": (n) => rep("😀", n),
  };
  const fns: Record<string, (s: string) => unknown> = {
    uaSignals: (s) => uaSignals(s),
    cleanUa: (s) => cleanUa(s),
    isPlaceholderUa: (s) => isPlaceholderUa(s),
    looksAutomated: (s) => looksAutomated(s),
    isBrowserLikeUa: (s) => isBrowserLikeUa(s),
    headerSignals: (s) => headerSignals(hb({ "sec-ch-ua": s, "sec-ch-ua-platform": s, "sec-fetch-mode": s, accept: s, "accept-language": s }), s),
    assess: (s) => assessRequestSync({ headers: hb({ "user-agent": s, accept: s, "x-vercel-ip-as-number": s }) }),
    "assess+googlebot": (s) => assessRequestSync({ headers: hb({ "user-agent": s + " Googlebot/2.1" }) }),
    "assess+applebot": (s) => assessRequestSync({ headers: hb({ "user-agent": "Mozilla/5.0 Applebot/0.1 " + s }) }),
    "assess+yandex": (s) => assessRequestSync({ headers: hb({ "user-agent": "YandexBot/3 " + s }) }),
    matchKnownCrawler: (s) => matchKnownCrawler(s),
    BOT_UA_REGEX: (s) => BOT_UA_REGEX.test(s),
    hostMatchesSuffix: (s) => hostMatchesSuffix(s, "googlebot.com"),
    normalizeIp: (s) => normalizeIp(s),
    readAsn: (s) => readAsn(hb({ "x-vercel-ip-as-number": s })),
    telemetrySignals: (s) => telemetrySignals({ wd: false, pl: 1, lg: 1, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 1, ua: s, ch: true, ev: 1, ut: 0, dw: 1000 }, s),
  };
  const time = (f: () => unknown) => {
    const t = process.hrtime.bigint();
    f();
    return Number(process.hrtime.bigint() - t) / 1e6;
  };
  test("linear and < 200ms per MB for every (function x shape)", () => {
    // warm up
    for (const f of Object.values(fns)) f("warm");
    const offenders: string[] = [];
    for (const [sn, sf] of Object.entries(shapes)) {
      for (const [fn, f] of Object.entries(fns)) {
        // guard against quadratic blow-ups hanging the suite: probe small first
        const t64 = time(() => f(sf(64 * 1024)));
        const t128 = time(() => f(sf(128 * 1024)));
        if (t128 > 150 || (t128 > 20 && t128 / Math.max(t64, 0.1) > 3)) {
          offenders.push(`${fn} <- ${sn}: 64k=${t64.toFixed(0)}ms 128k=${t128.toFixed(0)}ms`);
          continue;
        }
        const big = sf(1 << 20);
        const t1 = time(() => f(big));
        if (t1 > 200) offenders.push(`${fn} <- ${sn}: 1MB=${t1.toFixed(0)}ms`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});

// ---------------------------------------------------------------------------
describe("file hygiene", () => {
  const root = join(__dirname, "..", "..", "..");
  const dirs = [join(root, "src", "lib", "botdetect"), join(root, "scripts")];
  const files: string[] = [join(root, "package.json")];
  for (const d of dirs) for (const f of readdirSync(d)) if (statSync(join(d, f)).isFile() && !f.startsWith("round5.") && !f.startsWith("_r5")) files.push(join(d, f));
  const nonTest = files.filter((f) => !/\.test\.ts$/.test(f));
  test("no NUL / invalid UTF-8 / BOM / stray C0 controls", () => {
    for (const f of files) {
      const b = readFileSync(f);
      assert.equal(b.includes(0), false, `NUL in ${f}`);
      assert.ok(!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf), `BOM in ${f}`);
      const s = new TextDecoder("utf-8", { fatal: true }).decode(b);
      assert.equal(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s), false, `control char in ${f}`);
    }
  });
  test("no invisible/bidi characters in non-test sources (tests use them deliberately)", () => {
    for (const f of nonTest) {
      const s = readFileSync(f, "utf8");
      const m = /[​-‏‪-‮⁠-⁯﻿­ �]/.exec(s);
      assert.equal(m, null, `${f}: U+${m?.[0].codePointAt(0)?.toString(16)}`);
    }
  });
  test("package.json parses", () => {
    JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  });
  test("BUG (cosmetic): signals.ts comment lines contain literal '\\uXXXX' escape text instead of the Vietnamese characters", () => {
    const s = readFileSync(join(root, "src", "lib", "botdetect", "signals.ts"), "utf8");
    const bad = s.split(/\r?\n/).filter((l) => /^\s*\/\/.*\\u[0-9a-f]{4}/i.test(l) && /V\\u00f2ng|l\\u1eb7p/.test(l));
    assert.deepEqual(bad, []);
  });
});
