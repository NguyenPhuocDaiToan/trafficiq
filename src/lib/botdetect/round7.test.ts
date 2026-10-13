import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessRequestSync,
  decide,
  MemoryRateLimiter,
  createCrawlerVerifier,
  verifyFcrdns,
  DEFAULT_THRESHOLDS,
} from "@/lib/botdetect";
import { uaSignals, headerSignals, looksAutomated, cleanUa, combineWeights } from "@/lib/botdetect/signals";
import { BOT_UA_REGEX, LEGACY_BROWSER_UA } from "@/lib/tracking/ua";
import { normalizeIp } from "@/lib/botdetect/fcrdns";
import { matchKnownCrawler } from "@/lib/botdetect/crawlers";

// ---------------------------------------------------------------- helpers

const DIR = join(process.cwd(), "src", "lib", "botdetect");
const signalsSrc = readFileSync(join(DIR, "signals.ts"), "utf8");

function extractRegex(name: string): RegExp {
  const m = signalsSrc.match(new RegExp(String.raw`const ${name} =\s*/(.*)/([a-z]*);\r?$`, "m"));
  assert.ok(m, `cannot extract ${name}`);
  return new RegExp(m![1], m![2]);
}
const HTTP_LIB_NEW = extractRegex("HTTP_LIBRARY_UA");
// LEGACY_BROWSER_UA nay nằm ở lib/tracking/ua.ts (dùng chung với botReason) nên import thay vì trích từ signals.ts.
const LEGACY = LEGACY_BROWSER_UA;
const HTTP_LIB_OLD = new RegExp(HTTP_LIB_NEW.source.replace("java\\/(?!asvm|semc|qvm|hwja|lgvm|jbed)", "java\\/"), "i");
const BOT_OLD = new RegExp(BOT_UA_REGEX.source.replace("java\\/(?!asvm|semc|qvm|hwja|lgvm|jbed)", "java\\/"), "i");

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BROWSER_HEADERS: Record<string, string> = {
  "sec-fetch-mode": "navigate",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
};
function hdr(ua: string, extra: Record<string, string> = BROWSER_HEADERS): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  h.set("user-agent", ua);
  return h;
}
const score = (ua: string, extra?: Record<string, string>) => assessRequestSync({ headers: hdr(ua, extra) }).score;
const ids = (ua: string, extra?: Record<string, string>) =>
  assessRequestSync({ headers: hdr(ua, extra) }).signals.map((s) => s.id);

// Node refuses some UA byte values in Headers; use a plain bag for exotic ones.
function bag(map: Record<string, string>) {
  const m = new Map(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n: string) => m.get(n.toLowerCase()) ?? null };
}

// ---------------------------------------------------------------- 1. Java/ASVM lookahead

test("item1: library keywords alongside Java/ASVM still match (both regexes)", () => {
  const uas = [
    "okhttp/4 Java/ASVM/1.1",
    "python-requests/2.31 Java/ASVM",
    "Java/ASVM curl/8",
    "Java/ASVM python",
    "Mozilla/5.0 (X11; Linux) HeadlessChrome/120 Java/ASVM",
    "Mozilla/5.0 Java/ASVM Playwright",
    "Java/ASVM Java/1.8.0_1",
    "Java/ASVM/1 apache-httpclient/4.5",
    "Java/ASVM Scrapy/2",
    "Java/ASVM Googlebot/2.1",
    "Java/ASVM bot",
    "Java/asvm axios/1",
    "JAVA/ASVM undici",
    "java/ asvm",
    "Java/ASV",
  ];
  for (const ua of uas) {
    const lib = HTTP_LIB_NEW.test(ua);
    const headless = /headless|playwright/i.test(ua);
    const botOnly = /bot/i.test(ua);
    if (/java\/ asvm|java\/asv$|java\/asvm java\/1/i.test(ua) === false && !/java\/asvm\s*$/i.test(ua)) {
      // keyword other than Java/ASVM present -> must still be caught
      if (!/^java\/asvm\/?1?\.?1?$/i.test(ua)) {
        assert.ok(
          lib || headless || BOT_UA_REGEX.test(ua) || botOnly,
          `escaped: ${ua}`,
        );
      }
    }
  }
  // explicit
  assert.ok(looksAutomated("okhttp/4 Java/ASVM/1.1"));
  assert.ok(looksAutomated("python-requests Java/ASVM"));
  assert.ok(looksAutomated("Mozilla/5.0 HeadlessChrome Java/ASVM"));
  assert.ok(BOT_UA_REGEX.test("okhttp/4 Java/ASVM/1.1"));
  assert.ok(BOT_UA_REGEX.test("Mozilla/5.0 headless Java/ASVM"));
  assert.ok(BOT_UA_REGEX.test("Java/ASVM Googlebot"));
  assert.ok(score("okhttp/4 Java/ASVM/1.1") >= 85);
  assert.ok(score("python-requests Java/ASVM") >= 85);
  assert.ok(score("Mozilla/5.0 HeadlessChrome Java/ASVM") >= 90);
  assert.ok(score("Java/ASVM python") >= 85);
});

test("item1: lookahead only changes verdict for UAs whose ONLY marker is Java/asvm*", () => {
  const rnd = mulberry32(7001);
  const pool = [
    "Java/ASVM", "java/asvm", "JAVA/ASVMx", "Java/ASVM/1.1", "Java/1.8", "Java/", "java/ ", "Java/ASV", "Java/AS",
    "Mozilla/5.0", "(Windows NT 10.0)", "okhttp/4", "curl/8", "x", "Profile/MIDP-2.1", "LG/U990/v1.0", "bot", "Cubot",
    "Googlebot/2.1", "node", "HeadlessChrome", "libwww-FM/2.14", "libwww-perl/6", "-", "", "  ", "ASVM", "asvm/1",
  ];
  let differing = 0;
  for (let i = 0; i < 60000; i++) {
    const n = 1 + Math.floor(rnd() * 5);
    const ua = Array.from({ length: n }, () => pool[Math.floor(rnd() * pool.length)]).join(rnd() < 0.5 ? " " : "");
    const oldLib = HTTP_LIB_OLD.test(ua);
    const newLib = HTTP_LIB_NEW.test(ua);
    const oldBot = BOT_OLD.test(ua);
    const newBot = BOT_UA_REGEX.test(ua);
    assert.ok(!(newLib && !oldLib), "new lib regex must be a subset of old");
    assert.ok(!(newBot && !oldBot), "new bot regex must be a subset of old");
    if (oldLib !== newLib || oldBot !== newBot) {
      differing++;
      // the only legal reason: contains java/asvm and removing every java/asvm occurrence leaves no match
      // Thay bằng CHỮ CÁI ("Jq"), không phải ký hiệu: quy tắc `bot` là một TỪ (không khớp "Caboto"), nên chữ liền trước "bot"
      // quyết định kết quả — "J#" biến "java/asvmbotxx" thành "J#botxx" (khớp) trong khi bản gốc ("…mbotxx") không khớp.
      // "Jq#": có "#" để phần còn lại ("/1.1") không dính liền thành "bot…/<số>" (mệnh đề token-có-phiên-bản) và tạo khớp giả.
      const neutral = ua.replace(/java\/(?:asvm|semc|qvm|hwja|lgvm|jbed)/gi, "Jq#");
      assert.equal(HTTP_LIB_NEW.test(ua), HTTP_LIB_OLD.test(neutral), `lib: ${JSON.stringify(ua)}`);
      assert.equal(BOT_UA_REGEX.test(ua), BOT_OLD.test(neutral), `bot: ${JSON.stringify(ua)}`);
    }
  }
  assert.ok(differing > 0);
});

test("item1: Java/ASVM-only abuse yields the same score as any custom non-browser UA (no extra discount)", () => {
  const base = score("Foo/1.0");
  for (const ua of ["Java/ASVM", "Java/asvm", "Java/ASVMx", "Java/ASVM/1.1"]) {
    assert.equal(score(ua), base, ua);
    assert.ok(score(ua) >= base);
  }
  assert.equal(score("Java/1.8.0_292"), 85);
});

test("item1: real LG feature-phone Java/ASVM UA is not flagged", () => {
  const ua = "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1";
  assert.ok(score(ua) < 30);
  assert.ok(!BOT_UA_REGEX.test(ua));
});

// ---------------------------------------------------------------- 2. legacy allowlist

const LEGACY_PREFIXES = [
  "LG/1 ", "LG/U990 ", "Nokia6230/", "NokiaN73-1 ", "HTC-x ", "MOT-x ", "Lynx/2 ", "Links (2 ", "SAMSUNG-x ",
  "UCWEB7 ", "UP.Browser/3 ", "portalmmm ", "MOTORIZR ", "SEC-x ", "SIE-x ", "Alcatel-x ", "BlackBerry9000/5 ", "SonyEricssonK800i/",
  "w3m/1 ", "elinks/1 ", "netsurf/1 ", "midori/1 ", "dolphin/1 ",
];
const LIB_OR_HEAD = ["curl/8", "python-requests/2", "HeadlessChrome/120", "Playwright/1", "okhttp/4", "Go-http-client/1.1", "node", "Scrapy/2", "wget", "Puppeteer"];
const BOTWORDS = ["Foobot/1", "MyCrawler", "spider", "Googlebot/2.1", "claude-user", "ChatGPT-User", "Nokia-Bot"];

test("item2: legacy prefix cannot hide library/headless/bot-keyword/AI UAs", () => {
  for (const p of LEGACY_PREFIXES) {
    for (const l of LIB_OR_HEAD) {
      for (const ua of [p + " " + l, p + "scraper " + l, p + " " + l + " Mozilla/5.0"]) {
        const plain = score(l);
        assert.ok(score(ua) >= Math.min(plain, 85), `lowered: ${ua} ${score(ua)} vs ${plain}`);
        assert.ok(looksAutomated(ua), ua);
      }
    }
    for (const b of BOTWORDS) {
      const ua = p + b;
      assert.ok(score(ua) >= 55, `bot hidden: ${ua} -> ${score(ua)}`);
    }
  }
});

test("item2: legacy prefix on generic scraper loses ONLY non-browser-ua (documented), never strong header signals", () => {
  const strong: Record<string, string>[] = [
    { ...BROWSER_HEADERS, "sec-ch-ua": '"HeadlessChrome";v="120"' },
    { ...BROWSER_HEADERS, "sec-fetch-mode": "cors" },
    { ...BROWSER_HEADERS, "sec-ch-ua-platform": '"Android"' },
  ];
  for (const p of LEGACY_PREFIXES) {
    for (const rest of ["scraper/1.0", "GuzzleHttp/7", "Ruby", "colly - x", "test"]) {
      const plainIds = new Set(ids(rest));
      const decIds = new Set(ids(p + rest));
      for (const id of plainIds) {
        if (!decIds.has(id)) assert.equal(id, "non-browser-ua", `${p}${rest} lost ${id}`);
      }
      for (const h of strong) {
        const a = new Set(ids(rest, h));
        const b = new Set(ids(p + rest, h));
        for (const id of a) {
          if (!b.has(id)) assert.equal(id, "non-browser-ua", `${p}${rest} w/ headers lost ${id}`);
        }
      }
    }
  }
});

test("item2: claimsBrowser path unchanged when legacy prefix precedes Mozilla/5.0 token", () => {
  const ua = "LG/1 Mozilla/5.0 (Windows NT 10.0) Chrome/120";
  assert.ok(ids(ua, {}).includes("no-sec-fetch"));
  assert.ok(ids(ua, {}).includes("no-accept"));
  assert.ok(ids(ua, { ...BROWSER_HEADERS, "sec-fetch-mode": "cors" }).includes("programmatic-fetch"));
});

test("item2: legitimate legacy / alt-browser UAs score < 30 and are not bot-regex hits", () => {
  const ok = [
    "Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2",
    "Links (2.29; Linux 6.1 x86_64; GNU C 12; text)",
    "ELinks/0.13.1 (textmode; Linux; 80x24-2)",
    "w3m/0.5.3+git20230121",
    "NetSurf/3.10 (Linux; x86_64)",
    "Nokia6230/2.0 (04.44) Profile/MIDP-2.0 Configuration/CLDC-1.1",
    "NokiaN73-1/2.0628.0.0.1 S60/3.0 Profile/MIDP-2.0 Configuration/CLDC-1.1",
    "NokiaC3-00/5.0 (07.20) Profile/MIDP-2.1 Configuration/CLDC-1.1 Mozilla/5.0 AppleWebKit/420+",
    "Nokia3510i/1.0 (04.44)",
    "BlackBerry9000/4.6.0.167 Profile/MIDP-2.0 Configuration/CLDC-1.1 VendorID/102",
    "BlackBerry8520/5.0.0.592 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/136",
    "SonyEricssonK800i/R1JG Browser/NetFront/3.3 Profile/MIDP-2.0 Configuration/CLDC-1.1",
    "SonyEricssonW810i/R4EA Browser/NetFront/3.3",
    "MOT-V3/0.50.83.00 MIB/2.2.1 Profile/MIDP-2.0 Configuration/CLDC-1.0",
    "MOTORIZR-Z8/46.00.00 Mozilla/4.0 (compatible; MSIE 6.0; Symbian OS; 356) Opera 8.65 [it]",
    "SAMSUNG-GT-S5230/S5230XXJK1 SHP/VPP/R5 Jasmine/1.0 Nextreaming SMM-MMS/1.2.0 profile/MIDP-2.1",
    "SAMSUNG-SGH-E250/1.0 Profile/MIDP-2.0 Configuration/CLDC-1.1 UP.Browser/6.2.3.3.c.1.101",
    "LG-GC900/V10a Obigo/WAP2.0 Profile/MIDP-2.1 Configuration/CLDC-1.1",
    "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1",
    "SEC-SGHX210/1.0 UP.Link/6.3.1.13.0",
    "SIE-S65/46 UP.Browser/7.0.0.1.181 (GUI) MMP/2.0",
    "HTC-8500/1.2 Mozilla/4.0 (compatible; MSIE 4.01; Windows CE; PPC; 240x320)",
    "Alcatel-BF3/1.0 UP.Browser/6.2.3.2 (GUI) MMP/1.0",
    "UCWEB7.0.2.37/28/999",
    "UCWEB/2.0 (MIDP-2.0; U; Adr 4.4.2; en-US; GT-I9500) U2/1.0.0 UCBrowser/10.1.0.527 U3/0.0.0 Mobile Safari/534.30",
    "UP.Browser/3.04-TS14 UP.Link/3.4.4",
    "portalmmm/2.0 N400i(c20;TB)",
    "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16",
    "Opera/9.80 (J2ME/MIDP; Opera Mini/4.2.14912/870; U; en) Presto/2.4.15",
  ];
  for (const ua of ok) {
    assert.ok(score(ua) < 30, `FP: ${ua} -> ${score(ua)} ${ids(ua)}`);
  }
});

test("item2: modern brand/app names do not accidentally match the legacy allowlist (they are Mozilla/5.0 UAs anyway)", () => {
  // None of these START with the legacy prefixes, so they never reach the allowlist.
  const modern = [
    "SamsungBrowser/23.0", "LGE-Browser", "LGWebOSTV", "HTC_Desire", "HTC_One", "Midorix", "Dolphinfish/1", "Linksys/1",
    "Linksys-Router", "Nokia/HMD", "Nokia-Lumia", "Samsung/Tizen", "Alcatel_One", "Lg", "LG", "Dolphin", "Links",
  ];
  for (const ua of modern) assert.ok(!LEGACY.test(ua), `unexpected legacy match: ${ua}`);
});

test("item2: Smart TV / console / e-reader UAs (Mozilla-led) score < 30", () => {
  const ok = [
    "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager",
    "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.84 TV Safari/537.36",
    "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
    "Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/601.6 (KHTML, like Gecko) NF/4.0.0.5.10 NintendoBrowser/5.1.0.13343",
    "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4.1 like Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; LG-P970 Build/IML74K) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30",
    "Mozilla/5.0 (Linux; Android 10; HTC_Desire_20 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; Alcatel_5033) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 DuckDuckGo/5",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/23.12.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0]",
    "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.29.110",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/100.0 Chrome/94.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/23.11 Yowser/2.5 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Slack/4.36 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 12; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 GSA/13.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Pinterest for iOS/12.0",
    "Mozilla/5.0 (Linux; Android 9; Mi A2 Lite) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36 MicroMessenger/8.0",
    "Mozilla/5.0 (Linux; Android 8.1.0; Redmi 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.80 Mobile Safari/537.36 Line/10.0",
    "Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
  ];
  for (const ua of ok) assert.ok(score(ua) < 30, `FP: ${ua} -> ${score(ua)} ${ids(ua)}`);
});

// ---------------------------------------------------------------- 3. verifier cache

function mkResolver(table: Record<string, string[]>, fwd: Record<string, string[]>) {
  const calls = { reverse: 0, resolve4: 0, resolve6: 0 };
  return {
    calls,
    reverse: async (ip: string) => {
      calls.reverse++;
      await new Promise((r) => setTimeout(r, 5));
      if (!(ip in table)) throw Object.assign(new Error("nf"), { code: "ENOTFOUND" });
      return table[ip];
    },
    resolve4: async (h: string) => {
      calls.resolve4++;
      return fwd[h] ?? [];
    },
    resolve6: async (h: string) => {
      calls.resolve6++;
      return fwd[h] ?? [];
    },
  };
}

test("item3: invalid IPs never hit DNS, never populate cache/inflight, return error", async () => {
  const r = mkResolver({}, {});
  const v = createCrawlerVerifier({ resolver: r, maxEntries: 5 });
  const bads = ["", " ", "garbage", "1.2.3.4, 5.6.7.8", "x".repeat(500_000), "1.2.3", "999.1.1.1", "::g", "1.2.3.4%eth0", "[1.2.3.4", "\u0000", "1.2.3.4\n5.6.7.8"];
  for (const b of bads) {
    const res = await v(b, ["googlebot.com"]);
    assert.equal(res.status, "error", JSON.stringify(b.slice(0, 20)));
  }
  assert.equal(r.calls.reverse + r.calls.resolve4 + r.calls.resolve6, 0);
  assert.equal(normalizeIp("x".repeat(500_000)), null);
});

test("item3: valid IP forms share ONE cache entry; in-flight dedupe; error ttl; bounded", async () => {
  let t = 1_000_000;
  const r = mkResolver(
    { "66.249.66.1": ["crawl-66-249-66-1.googlebot.com"], "2001:4860:4801:10:0:0:0:5": ["crawl-x.googlebot.com"] },
    { "crawl-66-249-66-1.googlebot.com": ["66.249.66.1"], "crawl-x.googlebot.com": ["2001:4860:4801:10:0:0:0:5"] },
  );
  const v = createCrawlerVerifier({ resolver: r, now: () => t, maxEntries: 3 });
  const sfx = ["googlebot.com"];
  // dedupe: 20 concurrent
  const rs = await Promise.all(Array.from({ length: 20 }, () => v("66.249.66.1", sfx)));
  assert.ok(rs.every((x) => x.status === "verified"));
  assert.equal(r.calls.reverse, 1);
  // other forms hit same cache
  for (const form of ["66.249.66.1:443", " 66.249.66.1 ", "::ffff:66.249.66.1", "[::ffff:66.249.66.1]:80", "::ffff:42f9:4201"]) {
    const x = await v(form, sfx);
    assert.equal(x.status, "verified", form);
  }
  assert.equal(r.calls.reverse, 1, "cache must be shared across forms");
  // IPv6 forms
  const a = await v("2001:4860:4801:10::5", sfx);
  assert.equal(a.status, "verified");
  const before = r.calls.reverse;
  for (const form of ["[2001:4860:4801:10::5]:443", "2001:4860:4801:0010:0000:0000:0000:0005", "2001:4860:4801:10::5%eth0", "2001:4860:4801:10:0:0:0:5"]) {
    assert.equal((await v(form, sfx)).status, "verified", form);
  }
  assert.equal(r.calls.reverse, before);
  // bounded size under key churn
  for (let i = 0; i < 100; i++) await v(`10.0.0.${i}`, sfx);
  // TTL: after 7h entry refreshed
  t += 7 * 3600_000;
  const c0 = r.calls.reverse;
  await v("66.249.66.1", sfx);
  assert.equal(r.calls.reverse, c0 + 1);
});

test("item3: DNS error is cached briefly (60s) then retried; spoof not verified", async () => {
  let t = 5_000;
  let fail = true;
  const calls = { n: 0 };
  const resolver = {
    reverse: async () => { calls.n++; if (fail) throw Object.assign(new Error("x"), { code: "ESERVFAIL" }); return ["evil.example.com"]; },
    resolve4: async () => [], resolve6: async () => [],
  };
  const v = createCrawlerVerifier({ resolver, now: () => t });
  assert.equal((await v("1.2.3.4", ["googlebot.com"])).status, "error");
  assert.equal((await v("1.2.3.4", ["googlebot.com"])).status, "error");
  assert.equal(calls.n, 1);
  t += 61_000; fail = false;
  assert.equal((await v("1.2.3.4", ["googlebot.com"])).status, "failed");
  assert.equal(calls.n, 2);
});

test("item3: resolver that throws synchronously or returns junk does not reject verify()", async () => {
  const sync = { reverse: () => { throw new Error("boom"); }, resolve4: () => { throw new Error("b"); }, resolve6: () => { throw new Error("b"); } } as never;
  const v = createCrawlerVerifier({ resolver: sync });
  const x = await v("1.2.3.4", ["googlebot.com"]);
  assert.equal(x.status, "error");
  const y = await verifyFcrdns("not-an-ip", ["googlebot.com"], sync);
  assert.equal(y.status, "error");
});

test("item3: key includes suffixes (different suffix sets do not alias)", async () => {
  const r = mkResolver({ "1.2.3.4": ["a.googlebot.com"] }, { "a.googlebot.com": ["1.2.3.4"] });
  const v = createCrawlerVerifier({ resolver: r });
  assert.equal((await v("1.2.3.4", ["googlebot.com"])).status, "verified");
  assert.equal((await v("1.2.3.4", ["search.msn.com"])).status, "failed");
});

// ---------------------------------------------------------------- 4. fuzz / differential

const UA_PIECES = [
  "Mozilla/5.0", "Mozilla/4.0", "Opera/9.80", "(Windows NT 10.0; Win64; x64)", "(X11; Linux x86_64)", "(Linux; Android 13; Pixel 7)",
  "(iPhone; CPU iPhone OS 17_0 like Mac OS X)", "AppleWebKit/537.36", "(KHTML, like Gecko)", "Chrome/120.0.0.0", "Safari/537.36",
  "Firefox/120.0", "Mobile", "curl/8.4.0", "python-requests/2.31", "HeadlessChrome/120", "Playwright/1.40", "Go-http-client/1.1",
  "okhttp/4.12", "Java/ASVM", "Java/ASVM/1.1", "Java/1.8.0_292", "java/asvm", "Java/ASVMx", "node", "Deno/1.0", "bun", "dart:io",
  "Googlebot/2.1", "bingbot/2.0", "Applebot/0.1", "facebookexternalhit/1.1", "Twitterbot/1.0", "YandexBot/3.0", "Baiduspider/2.0",
  "SemrushBot/7", "claude-user", "GPTBot", "Cubot", "-", "unknown", "null", "Mozilla", "LG/1", "Nokia6230/2.0", "HTC-x", "MOT-V3", "Lynx/2.9",
  "Links (2.29;", "SAMSUNG-GT-S5230", "UCWEB7.0", "Profile/MIDP-2.1", "libwww-FM/2.14", "libwww-perl/6", "Scrapy/2", "wget/1.2", "scraper/1.0",
  "\u00a0", "\u200b", "\ufeff", "\u212a", "\u0130", "\t", "  ", "é", "日本語", "🙂", ";", "(", ")", "bot", "BOT", "spider", "crawler", "selenium", "webdriver",
];

function genUa(rnd: () => number): string {
  const n = Math.floor(rnd() * 7);
  const sep = rnd() < 0.8 ? " " : rnd() < 0.5 ? "" : ";";
  let s = Array.from({ length: n }, () => UA_PIECES[Math.floor(rnd() * UA_PIECES.length)]).join(sep);
  if (rnd() < 0.03) s = s.toUpperCase();
  if (rnd() < 0.03) s = s.toLowerCase();
  return s;
}
const HEADER_NAMES = ["sec-fetch-mode", "accept", "accept-language", "sec-ch-ua", "sec-ch-ua-platform", "x-vercel-ip-as-number"];
const HEADER_VALUES: Record<string, string[]> = {
  "sec-fetch-mode": ["navigate", "cors", "no-cors", "same-origin", "websocket", "", "NAVIGATE, navigate"],
  accept: ["text/html,application/xhtml+xml", "*/*", "application/json, text/plain, */*", "", "text/html"],
  "accept-language": ["vi-VN", "en", "", "   "],
  "sec-ch-ua": ['"Chromium";v="120"', '"HeadlessChrome";v="120"', ""],
  "sec-ch-ua-platform": ['"Windows"', '"Android"', '"macOS"', '"Linux"', '"Unknown"', "iOS"],
  "x-vercel-ip-as-number": ["16509", "32934", "13414", "0x80A6", "00032934", "99999999999", "abc", "15169"],
};
function genHeaders(rnd: () => number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of HEADER_NAMES) {
    if (rnd() < 0.55) {
      const vs = HEADER_VALUES[n];
      out[n] = vs[Math.floor(rnd() * vs.length)];
    }
  }
  return out;
}
function recase(name: string, rnd: () => number): string {
  return [...name].map((c) => (rnd() < 0.5 ? c.toUpperCase() : c)).join("");
}

test("item4: seeded fuzz 80k — totality, range, classification/decide consistency, header-name case invariance", () => {
  const rnd = mulberry32(0x7a11d);
  let n = 0;
  for (; n < 80_000; n++) {
    const ua = genUa(rnd);
    const hs = genHeaders(rnd);
    const input = { headers: bag({ ...hs, "user-agent": ua }), ip: rnd() < 0.2 ? "1.2.3.4" : undefined };
    const a = assessRequestSync(input);
    assert.ok(Number.isInteger(a.score) && a.score >= 0 && a.score <= 100, `score ${a.score} for ${JSON.stringify(ua)}`);
    for (const s of a.signals) assert.ok(Number.isFinite(s.weight) && s.weight >= 0 && s.weight <= 100);
    // classification vs score
    if (a.classification === "verified-crawler") assert.equal(a.score, 0);
    else if (a.classification === "spoofed-crawler") assert.ok(a.score >= 95);
    else if (a.score >= 60) assert.equal(a.classification, "automated");
    else if (a.score >= 30) assert.equal(a.classification, "suspicious");
    else assert.equal(a.classification, "human-likely");
    // score == combine(signals)
    if (a.classification !== "verified-crawler") assert.equal(a.score, combineWeights(a.signals));
    // decide consistency (fresh limiter each time)
    const d = decide(a, { limiter: new MemoryRateLimiter(), key: "k" });
    if (a.classification === "verified-crawler") assert.equal(d.action, "allow");
    else if (a.score >= DEFAULT_THRESHOLDS.challenge) assert.equal(d.action, "challenge");
    else if (a.score >= DEFAULT_THRESHOLDS.flag) assert.equal(d.action, "flag");
    else assert.equal(d.action, "allow");
    // determinism
    assert.equal(assessRequestSync(input).score, a.score);
    // header-name case invariance (real Headers + shuffled-case names)
    if (n % 4 === 0) {
      try {
        const h = new Headers();
        for (const [k, v] of Object.entries(hs)) h.set(recase(k, rnd), v);
        h.set(recase("user-agent", rnd), ua);
        assert.equal(assessRequestSync({ headers: h, ip: input.ip }).score, a.score, JSON.stringify([ua, hs]));
      } catch (e) {
        if (!(e instanceof TypeError)) throw e; // Headers rejects some byte values
      }
      // case-insensitive custom bag
      const b2 = bag(Object.fromEntries(Object.entries({ ...hs, "user-agent": ua }).map(([k, v]) => [recase(k, rnd), v])));
      assert.equal(assessRequestSync({ headers: b2, ip: input.ip }).score, a.score);
    }
    // uaSignals / cleanUa idempotent
    assert.equal(cleanUa(cleanUa(ua)), cleanUa(ua));
  }
  assert.equal(n, 80_000);
});

test("item4: fuzz 40k — adding a library/headless/bot-keyword decoration never lowers the score", () => {
  const rnd = mulberry32(424242);
  const decor = ["curl/8", "HeadlessChrome/120", "Playwright/1", "python-requests/2", "okhttp/4", "Go-http-client/1.1", "selenium", "wget"];
  for (let i = 0; i < 40_000; i++) {
    const base = genUa(rnd);
    const hs = genHeaders(rnd);
    const d = decor[Math.floor(rnd() * decor.length)];
    // decoration placed in front, behind, or after a legacy prefix
    const variants = [`${base} ${d}`, `${d} ${base}`, `${LEGACY_PREFIXES[Math.floor(rnd() * LEGACY_PREFIXES.length)]} ${base} ${d}`];
    const sBase = assessRequestSync({ headers: bag({ ...hs, "user-agent": base }) }).score;
    for (const v of variants) {
      const s = assessRequestSync({ headers: bag({ ...hs, "user-agent": v }) }).score;
      // placeholders: a decorated placeholder replaces empty-ua 60 with 85/90 -> still higher; the library layer is >= 85
      assert.ok(s >= Math.min(sBase, 85), `lowered by decoration: base=${JSON.stringify(base)} (${sBase}) variant=${JSON.stringify(v)} (${s})`);
    }
  }
});

test("item4: fuzz 40k — legacy prefix: any score drop vs plain is explained by a documented UA-layer signal", () => {
  const rnd = mulberry32(99);
  const explained = new Set(["non-browser-ua", "empty-ua"]);
  for (let i = 0; i < 40_000; i++) {
    const base = genUa(rnd);
    const hs = genHeaders(rnd);
    const p = LEGACY_PREFIXES[Math.floor(rnd() * LEGACY_PREFIXES.length)];
    const dec = p + " " + base;
    const A = assessRequestSync({ headers: bag({ ...hs, "user-agent": base }) });
    const B = assessRequestSync({ headers: bag({ ...hs, "user-agent": dec }) });
    if (B.score < A.score) {
      const bIds = new Set(B.signals.map((s) => s.id));
      const lost = A.signals.filter((s) => !bIds.has(s.id));
      assert.ok(lost.length > 0, `drop without lost signal ${JSON.stringify([base, dec])}`);
      for (const s of lost) {
        assert.ok(explained.has(s.id) || s.id.startsWith("no-") || s.id === "wildcard-accept" || s.id === "non-document-accept" || s.id === "datacenter-asn" || s.id === "unknown-declared-bot" || s.id === "unverified-crawler",
          `unexplained lost signal ${s.id} for ${JSON.stringify([base, dec])}`);
      }
      // strong ids must never be lost
      for (const s of lost) assert.ok(!["headless-ua", "http-library-ua", "headless-client-hint", "platform-mismatch", "programmatic-fetch", "spoofed-crawler"].includes(s.id), `strong lost ${s.id} ${JSON.stringify([base, dec])}`);
    }
  }
});

test("item4: total function on hostile UA strings (assess + uaSignals + headerSignals)", () => {
  const rnd = mulberry32(5);
  for (let i = 0; i < 20_000; i++) {
    const len = Math.floor(rnd() * 40);
    let s = "";
    for (let j = 0; j < len; j++) s += String.fromCharCode(Math.floor(rnd() * 0x3000) + (rnd() < 0.3 ? 0 : 0x20));
    if (rnd() < 0.1) s = "\ud800" + s; // lone surrogate
    const a = assessRequestSync({ headers: bag({ "user-agent": s, ...genHeaders(rnd) }) });
    assert.ok(a.score >= 0 && a.score <= 100);
    uaSignals(s);
    headerSignals(bag({}), s);
  }
});

// ---------------------------------------------------------------- 5. ReDoS / perf + hygiene

test("item5: 1MB adversarial UAs finish quickly on every regex path", () => {
  const MB = 1_000_000;
  const rep = (u: string) => u.repeat(Math.ceil(MB / u.length)).slice(0, MB);
  const shapes: Record<string, string> = {
    a: rep("a"), spaces: " ".repeat(MB), javaSlash: rep("java/"), javaAsvm: rep("java/asvm"), javaAsvmThenJava: rep("java/asvm ") + "java/1",
    nokia: rep("nokia"), nokiaD: rep("nokia6"), lgDash: rep("lg-"), lgSlash: rep("lg/"), mot: rep("mot-"), links: rep("links ("),
    libwww: rep("libwww-fm"), libwww2: rep("libwww"), cubot: rep("cubot"), bot: rep("cu"), botEnd: rep("a") + "bot", mozilla: rep("mozilla/"),
    node: rep("node "), nodeParen: rep("(node;"), paren: rep("("), semi: rep(";"), nbsp: rep("\u00a0"), zw: rep("a\u200b"),
    sep: rep(" ; ( ) "), dotdigits: rep("1.2.3.4:"), yandex: rep("yandex"), yandexBot: rep("yandexbo"), applebot: rep("applebo") ,
    headless: rep("headles"), py: rep("pytho"), mixed: rep("Mozilla/5.0 (X11; Linux) "), upper: rep("JAVA/ASVM"),
    sindre: rep("sindresorhus/go"), okh: rep("okhttp".slice(0, 5)), trailingSpaceMid: "a" + " ".repeat(MB / 2) + "b" + " ".repeat(MB / 2 - 2),
    surrogates: rep("\ud83d\ude42"), long1: "Mozilla/5.0 " + rep("a-") + "bot",
  };
  for (const [name, ua] of Object.entries(shapes)) {
    const t0 = performance.now();
    const hd = { ...BROWSER_HEADERS, "user-agent": ua };
    assessRequestSync({ headers: bag(hd) });
    matchKnownCrawler(ua);
    BOT_UA_REGEX.test(ua);
    looksAutomated(ua);
    const dt = performance.now() - t0;
    assert.ok(dt < 1500, `slow shape ${name}: ${dt.toFixed(0)}ms`);
  }
});

test("item5: 1MB IP strings and header values are linear", () => {
  const MB = 1_000_000;
  const t0 = performance.now();
  for (const s of ["[" + "a".repeat(MB), "1.".repeat(MB / 2), ":".repeat(MB), "[" + ":".repeat(MB) + "]:1", "1.2.3.4:" + "1".repeat(MB), " ".repeat(MB) + "1.2.3.4", "::ffff:" + "1.".repeat(MB / 2), "%".repeat(MB)]) {
    normalizeIp(s);
  }
  const bigH = { ...BROWSER_HEADERS, accept: "x".repeat(MB), "accept-language": " ".repeat(MB), "sec-fetch-mode": ",".repeat(MB), "sec-ch-ua-platform": '"'.repeat(MB), "x-vercel-ip-as-number": "1".repeat(MB) };
  assessRequestSync({ headers: bag({ ...bigH, "user-agent": "Mozilla/5.0 (Windows) Chrome/120" }) });
  assert.ok(performance.now() - t0 < 3000);
});

test("item5: hygiene — no NUL/BOM/control chars/literal \\uXXXX escapes in comments of source, scripts, README, package.json", () => {
  const root = process.cwd();
  const files = [
    ...["assess", "challenge", "client-signals", "crawlers", "fcrdns", "index", "policy", "rate-limit", "signals", "types"].map((f) => join(root, "src/lib/botdetect", f + ".ts")),
    join(root, "src/lib/botdetect/README.md"), join(root, "src/lib/tracking/ua.ts"), join(root, "package.json"),
    join(root, "scripts/check-bot-detection.ts"), join(root, "scripts/check-botdetect-live.ts"), join(root, "scripts/check-probe-browser.ts"),
  ];
  const problems: string[] = [];
  for (const f of files) {
    const buf = readFileSync(f);
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) problems.push(`${f}: BOM`);
    const text = buf.toString("utf8");
    if (text.includes("\ufffd")) problems.push(`${f}: U+FFFD (bad utf8)`);
    text.split(/\r?\n/).forEach((line, i) => {
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(line)) problems.push(`${f}:${i + 1}: control char`);
      if (/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/.test(line)) problems.push(`${f}:${i + 1}: invisible char`);
      // literal escape text inside a comment line (// ... \uXXXX or * ... \uXXXX) or README prose
      const isComment = /^\s*(\/\/|\*|\/\*)/.test(line) || /\/\/.*\\u[0-9a-fA-F]{4}/.test(line);
      if (line.includes(String.raw`\u00a0`)) return; // deliberate: NBSP is invisible, the comment names it
      if (f.endsWith(".md") ? /\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/.test(line) : isComment && /\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/.test(line)) {
        problems.push(`${f}:${i + 1}: literal escape in comment/prose: ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(problems, []);
});

// ---------------------------------------------------------------- 6. README claims for this batch

test("item6: README claims vs code for touched items", () => {
  const readme = readFileSync(join(DIR, "README.md"), "utf8");
  // untrusted-events rule: 70, or 25 when <=2 synthetic AND >=1 trusted event
  const { telemetrySignals } = require_cs();
  const base = { wd: false, pl: 3, lg: 2, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1920, sh: 1080, hc: 8, ua: "u", ch: true, dw: 5000 };
  const w = (ev: number, ut: number) => telemetrySignals({ ...base, ev, ut }, "u").find((s) => s.id === "untrusted-events")?.weight;
  assert.equal(w(5, 1), 25);
  assert.equal(w(5, 2), 25);
  assert.equal(w(5, 3), 70);
  assert.equal(w(2, 2), 70); // no trusted event
  assert.equal(w(1, 1), 70);
  assert.match(readme, /70; chỉ 25 nếu có ≤ 2 sự kiện tổng hợp VÀ ít nhất một sự kiện tin cậy/);
  // weights table
  assert.equal(uaSignals("curl/8")[0].weight, 85);
  assert.equal(uaSignals("HeadlessChrome")[0].weight, 90);
  assert.equal(uaSignals("-")[0].weight, 60);
  assert.equal(uaSignals("Foo/1")[0].weight, 40);
  assert.match(readme, /`http-library-ua`[^\n]*\| 85 \|/);
  assert.match(readme, /`non-browser-ua`[^\n]*\| 40 \|/);
  // cache ttl claims
  assert.match(readme, /xác định 6h, lỗi 60s/);
});

// README statement: non-browser-ua = "UA không mở đầu bằng Mozilla/ hay Opera/". The legacy allowlist (Nokia/LG/Lynx…) is an
// exception implemented in signals.ts; if the README never mentions it, that is a doc mismatch for item (b).
test("BUG: README documents the legacy-browser allowlist exemption from non-browser-ua", () => {
  const readme = readFileSync(join(DIR, "README.md"), "utf8");
  assert.match(readme, /lynx|nokia|legacy|đời cũ|điện thoại đời/i, "README never mentions the legacy allowlist that exempts UAs from non-browser-ua");
});

test("BUG: README documents the Java/ASVM exemption from http-library-ua", () => {
  const readme = readFileSync(join(DIR, "README.md"), "utf8");
  assert.match(readme, /asvm/i, "README says Java => 85 but does not mention Java/ASVM exemption");
});

function require_cs() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/botdetect/client-signals") as typeof import("@/lib/botdetect/client-signals");
}
