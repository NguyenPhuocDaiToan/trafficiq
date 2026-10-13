import { test } from "node:test";
import assert from "node:assert/strict";
import { assessRequest, assessRequestSync } from "@/lib/botdetect";
import { cleanUa, headerSignals, uaSignals, looksAutomated, isPlaceholderUa, readAsn } from "./signals";
import { KNOWN_CRAWLERS, matchKnownCrawler } from "./crawlers";
import { hostMatchesSuffix, normalizeIp, createCrawlerVerifier } from "./fcrdns";
import { BOT_UA_REGEX } from "@/lib/tracking/ua";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function bag(h: Record<string, string>) {
  const m = new Map(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (k: string) => m.get(k.toLowerCase()) ?? null };
}
const FULL = {
  accept: "text/html,application/xhtml+xml",
  "accept-language": "en",
  "sec-fetch-mode": "navigate",
};
function score(ua: string, extra: Record<string, string> = {}) {
  return assessRequestSync({ headers: bag({ "user-agent": ua, ...FULL, ...extra }) });
}
function bare(ua: string, extra: Record<string, string> = {}) {
  return assessRequestSync({ headers: bag({ "user-agent": ua, ...extra }) });
}

// ---------------------------------------------------------------- (1) score-lowering
test("BUG: headless client hint is ignored unless UA contains 'mozilla/5.0' (README: 'Bắt cả khi UA đã bị sửa')", () => {
  const hint = { "sec-ch-ua": '"HeadlessChrome";v="120", "Chromium";v="120"' };
  const plain = score(CHROME_UA, hint).score;
  const m4 = score("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)", hint).score;
  const opera = score("Opera/9.80 (Windows NT 6.1) Presto/2.12.388 Version/12.18", hint).score;
  assert.equal(plain, 90);
  assert.ok(m4 >= plain, `Mozilla/4.0 + HeadlessChrome hint scored ${m4}, Mozilla/5.0 scored ${plain}`);
  assert.ok(opera >= plain, `Opera/9.80 + HeadlessChrome hint scored ${opera}`);
});

test("BUG: Mozilla/4.0 UA gets no header signals; Mozilla/5.0 identical headers does (score lowering)", () => {
  const a = bare(CHROME_UA, { accept: "*/*" }).score;
  const b = bare("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)", { accept: "*/*" }).score;
  assert.ok(b >= a, `Mozilla/4.0: ${b}, Mozilla/5.0: ${a}`);
});

test("BUG: platform-mismatch / programmatic-fetch ignored for Mozilla/4.0 UA", () => {
  const ex = { "sec-fetch-mode": "cors", "sec-ch-ua-platform": '"Android"' };
  const a = score(CHROME_UA, ex).score;
  const b = score("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)", ex).score;
  assert.ok(b >= a, `${b} vs ${a}`);
});

test("BUG: legacy-browser prefix (Nokia/Links/Midori...) is checked before bot keywords -> declared bot scores 0", () => {
  const plain = bare("MyBot/1.0 (+http://x.example)").score; // 55
  for (const ua of ["Nokia-Bot/1.0 (+http://x.example)", "Linkscrawler/1.0", "Midori-spider/1.0", "NokiaScraper/1.0", "Lynxbot/1"]) {
    const s = bare(ua).score;
    assert.ok(s >= 40, `${JSON.stringify(ua)} scored ${s}, plain bot scored ${plain}`);
  }
});

test("BUG: invisible chars that survive the wire (U+00AD, U+0085) lower placeholder UA 60 -> 40", () => {
  const base = bare("-").score;
  for (const pre of ["­", "\u0085", "‎", "‮", "⁢"]) {
    const s = bare(pre + "-").score;
    assert.ok(s >= base, `prefix U+${pre.charCodeAt(0).toString(16)}: ${s} < ${base}`);
  }
});

test("BUG: crawler-token stripper swallows a library token after '/' or '-' (loses http-library-ua)", () => {
  const plainer = bare("Mozilla Applebot curl").score; // http-library + unverified
  const tricked = bare("Mozilla Applebot/curl").score;
  assert.ok(tricked >= plainer, `Applebot/curl ${tricked} vs Applebot curl ${plainer}`);
  const t2 = bare("Mozilla Applebot-python").signals.map((s) => s.id);
  assert.ok(t2.includes("http-library-ua"), `signals ${t2}`);
});

test("BUG: appending a generic bot word to a placeholder UA lowers the score (60/72 -> 55, crosses the rate-limit threshold) (fuzz)", () => {
  const seed = 1337;
  let x = seed;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bases = [CHROME_UA, "curl/8.0", "HeadlessChrome/120", "python-requests/2", "-", "Mozilla/5.0", "MyScraper/1.0", "Googlebot/2.1", "Applebot/0.1"];
  const suffixes = [" ", "​", " Bot", " Googlebot/2.1", " Applebot/0.1", " ", "  	"];
  for (let i = 0; i < 400; i++) {
    const b = bases[Math.floor(rnd() * bases.length)];
    const s = suffixes[Math.floor(rnd() * suffixes.length)];
    for (const hdr of [{}, { accept: "*/*" }, FULL] as Record<string, string>[]) {
      const a = bare(b, hdr).score;
      const d = bare(b + s, hdr).score;
      assert.ok(d >= a, `seed=${seed} ${JSON.stringify(b)}+${JSON.stringify(s)} hdr=${JSON.stringify(hdr)}: ${d} < ${a}`);
    }
  }
});

test("zero-width inside token: still no throw", () => {
  const s = bare("Mozilla/5.0 Head​less").score;
  assert.ok(Number.isFinite(s));
});

test("leading/trailing invisible handled for cleanUa set", () => {
  for (const c of [" ", "​", "‌", "‍", "⁠", "﻿", "　", " "]) {
    assert.equal(bare(c + "-" + c).score, bare("-").score);
    assert.equal(bare(c + CHROME_UA + c, FULL).score, bare(CHROME_UA, FULL).score);
  }
});

// ---------------------------------------------------------------- (2) false positives
const HUMAN_UAS = [
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/118.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/80.0.3987.163 Chrome/80.0.3987.163 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Gojek/4.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Bundle/1.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Dartmouth/2.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 NodeBB/3.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Nodemon/1.0",
  "Mozilla/5.0 (Linux; Android 10; BUN-LX1) AppleWebKit/537.36 Chrome/100 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; Dart-L) AppleWebKit/537.36 Chrome/100 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16",
  "Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 DuckDuckGo/5",
];
test("human UAs with full headers stay human-likely and never looksAutomated", () => {
  for (const ua of HUMAN_UAS) {
    const a = score(ua);
    assert.equal(a.classification, "human-likely", `${ua} -> ${a.score} ${JSON.stringify(a.signals)}`);
    assert.equal(looksAutomated(ua), false, ua);
  }
});

test("BUG: unbounded 'bun/' 'deno/' 'dart/' alternatives make app tokens ending in those letters look like HTTP libraries", () => {
  for (const tok of ["AsahiShimbun/9.0", "Shinbun/1.0", "Lodeno/1.0", "Smartdart/1.0", "Pandeno/2"]) {
    const ua = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${tok}`;
    assert.equal(looksAutomated(ua), false, `${tok} -> ${score(ua).score} ${score(ua).classification}`);
  }
});

test("bounded node/deno/bun/dart do not fire inside words", () => {
  for (const w of ["Ubuntu", "Bundle", "Dartmouth", "Nodebb", "Gojek", "Nodemcu", "Bunny", "Denon", "Darth"]) {
    assert.equal(looksAutomated(`Mozilla/5.0 (X11; ${w}; Linux) ${w}/1.0 Safari/537`), false, w);
  }
});

test("substring library words in human-ish UA (informational; BOT_UA_REGEX has the same pre-existing words)", () => {
  const hits: string[] = [];
  for (const w of ["Securly", "Pythonista", "Curly", "Reqwestful", "Httpiez"]) {
    const ua = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ${w}/1.0`;
    if (looksAutomated(ua)) hits.push(w);
  }
  console.log("substring FP (informational):", hits.join(","));
});

test("claimsBrowser anywhere: native app with Mozilla/5.0 later does not get >=60 w/ normal headers", () => {
  const a = score("MyApp/2.1 CFNetwork/1335 Darwin/21 (Mozilla/5.0 compatible)");
  assert.ok(a.score < 60, `${a.score} ${JSON.stringify(a.signals)}`);
});

test("cleanUa idempotent and does not eat inner content", () => {
  for (const s of ["", " ", "​", " a b ", " Mozilla/5.0 x​", "a​b"]) {
    assert.equal(cleanUa(cleanUa(s)), cleanUa(s));
  }
  assert.equal(cleanUa("a​b"), "a​b");
});

// ---------------------------------------------------------------- (4) verified denial
const REAL_CRAWLER_UAS: [string, string][] = [
  ["google", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["google", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.175 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["google", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/125.0.6422.175 Safari/537.36"],
  ["google", "Googlebot/2.1 (+http://www.google.com/bot.html)"],
  ["google", "Googlebot-Image/1.0"],
  ["google", "Googlebot-Video/1.0"],
  ["google", "Googlebot-News"],
  ["google", "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)"],
  ["google", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.175 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0)"],
  ["google", "AdsBot-Google (+http://www.google.com/adsbot.html)"],
  ["google", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)"],
  ["google", "Mediapartners-Google"],
  ["google", "Mozilla/5.0 (Linux; Android 7.0; SM-G930V Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)"],
  ["google", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36 Storebot-Google/1.0"],
  ["google", "FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)"],
  ["google", "APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)"],
  ["google", "GoogleOther"],
  ["google", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; GoogleOther)"],
  ["google", "DoCoMo/2.0 N905i(c100;TB;W24H16) (compatible; Googlebot-Mobile/2.1; +http://www.google.com/bot.html)"],
  ["bing", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36"],
  ["bing", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["bing", "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["bing", "Mozilla/5.0 (Windows Phone 8.1; ARM; Trident/7.0; Touch; rv:11.0; IEMobile/11.0; NOKIA; Lumia 530) like Gecko (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["bing", "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b"],
  ["bing", "msnbot/2.0b (+http://search.msn.com/msnbot.htm)"],
  ["bing", "msnbot-media/1.1 (+http://search.msn.com/msnbot.htm)"],
  ["bing", "Mozilla/5.0 (compatible; adidxbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["apple", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)"],
  ["apple", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 (Applebot/0.1; +http://www.apple.com/go/applebot)"],
  ["apple", "Mozilla/5.0 (Device; OS_version) AppleWebKit/WebKit_version (KHTML, like Gecko) Version/Safari_version Safari/WebKit_version (Applebot/Applebot_version; +http://www.apple.com/go/applebot)"],
  ["yandex", "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"],
  ["yandex", "Mozilla/5.0 (compatible; YandexAccessibilityBot/3.0; +http://yandex.com/bots)"],
  ["yandex", "Mozilla/5.0 (compatible; YandexRenderResourcesBot/1.0; +http://yandex.com/bots)"],
  ["yandex", "Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)"],
  ["yandex", "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12B411 Safari/600.1.4 (compatible; YandexMobileBot/3.0; +http://yandex.com/bots)"],
  ["baidu", "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"],
  ["baidu", "Mozilla/5.0 (Linux;u;Android 4.2.2;zh-cn;) AppleWebKit/534.46 (KHTML,like Gecko) Version/5.1 Mobile Safari/10600.6.3 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"],
  ["baidu", "Baiduspider-image+(+http://www.baidu.com/search/spider.htm)"],
  ["meta", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["meta", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) Mozilla/5.0 (compatible)"],
  ["meta", "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
  ["meta", "meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
  ["meta", "Mozilla/5.0 (compatible; Facebot/1.0)"],
  ["x", "Twitterbot/1.0"],
  ["x", "Mozilla/5.0 (compatible; Twitterbot/1.0)"],
];
test("real published crawler UAs: never looksAutomated, and a verified one scores 0 / verified-crawler", async () => {
  const resolver = (ptr: string) => ({
    reverse: async () => [ptr],
    resolve4: async () => ["66.249.66.1"],
    resolve6: async () => [],
  });
  const suffix: Record<string, string> = {
    google: "crawl-66-249-66-1.googlebot.com", bing: "msnbot-1.search.msn.com", apple: "17-1.applebot.apple.com",
    yandex: "spider.yandex.com", baidu: "baiduspider-1.crawl.baidu.com",
  };
  const asn: Record<string, string> = { meta: "32934", x: "13414" };
  for (const [id, ua] of REAL_CRAWLER_UAS) {
    assert.equal(looksAutomated(ua), false, `looksAutomated: ${ua}`);
    assert.equal(matchKnownCrawler(ua)?.id, id, `match ${ua}`);
    const headers = bag({ "user-agent": ua, ...(asn[id] ? { "x-vercel-ip-as-number": asn[id] } : {}) });
    const verifier = createCrawlerVerifier({ resolver: resolver(suffix[id] ?? "x.example") });
    const r = await assessRequest({ headers, ip: "66.249.66.1" }, verifier);
    assert.equal(r.classification, "verified-crawler", `${ua} -> ${JSON.stringify(r)}`);
    assert.equal(r.score, 0);
  }
});

test("verified + automation token is denied exemption (and still scores >=85)", async () => {
  const v = createCrawlerVerifier({ resolver: { reverse: async () => ["crawl.googlebot.com"], resolve4: async () => ["1.2.3.4"], resolve6: async () => [] } });
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1) HeadlessChrome/120", "Googlebot/2.1 curl/8", "Googlebot/2.1 node", "Googlebot node-fetch/1"]) {
    const r = await assessRequest({ headers: bag({ "user-agent": ua }), ip: "1.2.3.4" }, v);
    assert.notEqual(r.classification, "verified-crawler", ua);
    assert.ok(r.score >= 85, `${ua} ${r.score}`);
  }
});

test("BUG: verified crawler + automation token behind '/' after crawler token loses the token's signal", async () => {
  const v = createCrawlerVerifier({ resolver: { reverse: async () => ["crawl.googlebot.com"], resolve4: async () => ["1.2.3.4"], resolve6: async () => [] } });
  const plain = await assessRequest({ headers: bag({ "user-agent": "Mozilla Googlebot curl" }), ip: "1.2.3.4" }, v);
  const tricked = await assessRequest({ headers: bag({ "user-agent": "Mozilla Googlebot/curl" }), ip: "1.2.3.4" }, v);
  assert.ok(tricked.score >= plain.score, `${tricked.score} < ${plain.score}`);
});

// ---------------------------------------------------------------- (3) ReDoS / perf
const SIZES = [100_000, 1_000_000, 2_000_000];
function adversarial(n: number): Record<string, string> {
  const rep = (s: string) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  return {
    spaces: rep(" "),
    spacesMid: "a" + rep(" ") + "b",
    parens: rep("("),
    semis: rep(";"),
    slashes: rep("/"),
    bots: rep("bot"),
    moz: rep("Mozilla/5.0 "),
    mozNoSpace: rep("Mozilla/5.0"),
    zw: rep("​"),
    zwMid: "x" + rep("​") + "y",
    mixedWs: rep(" ​\t "),
    cubot: rep("cubot"),
    libwww: rep("libwww-FM"),
    applebot: rep("Applebot/0.1 "),
    applebotDash: "Applebot" + rep("-"),
    applebotWord: "Applebot/" + rep("a"),
    appleDots: "Applebot/" + rep(".+~-"),
    nodes: rep(" node"),
    nodeSp: "node" + rep(" "),
    nodeParen: rep("(node"),
    yandex: rep("yandex"),
    yandexCom: rep("yandex.com/bot"),
    googles: rep("google-"),
    headless: rep("headles"),
    wordsA: rep("a"),
    curlish: rep("cur"),
    sindre: rep("sindresorhus/go"),
    nonAscii: rep("Kſ"),
  };
}
test("no regex path exceeds 100ms/MB on adversarial UAs (also sec-ch-ua / accept / ASN headers)", async () => {
  const slow: string[] = [];
  const log: string[] = [];
  const times = new Map<string, number>();
  for (const n of SIZES) {
    const cases = adversarial(n);
    for (const [name, ua] of Object.entries(cases)) {
      // Lấy lần đo NHANH NHẤT trong 3: một lần đo đơn lẻ trên chuỗi MB dính GC/JIT và làm tỉ lệ 2MB/1MB
      // nhảy lung tung (flaky đo được). Hồi quy quadratic thật thì CẢ BA lần đều chậm nên vẫn bị bắt.
      let worst = Infinity;
      let bestLog = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const t0 = performance.now();
        assessRequestSync({ headers: bag({ "user-agent": ua, ...FULL, "sec-ch-ua": ua, "sec-ch-ua-platform": ua, accept: ua, "x-vercel-ip-as-number": ua }) });
        const t1 = performance.now();
        looksAutomated(ua); isPlaceholderUa(ua); uaSignals(ua); headerSignals(bag({ "sec-ch-ua": ua }), ua);
        for (const c of KNOWN_CRAWLERS) c.ua.test(ua);
        BOT_UA_REGEX.test(ua);
        const t2 = performance.now();
        await assessRequest({ headers: bag({ "user-agent": ua }), ip: "1.2.3.4" }, async () => ({ status: "error", reason: "x" }));
        const t3 = performance.now();
        const w = Math.max(t1 - t0, t2 - t1, t3 - t2);
        if (w < worst) {
          worst = w;
          bestLog = `${name} n=${n} sync=${(t1 - t0).toFixed(0)} rx=${(t2 - t1).toFixed(0)} async=${(t3 - t2).toFixed(0)}`;
        }
      }
      times.set(`${name}@${n}`, worst);
      log.push(bestLog);
    }
  }
  // Linear growth: doubling 1MB -> 2MB must not more than ~triple the time (ReDoS would be 4x+ / explode),
  // and 100KB must stay tiny.
  for (const name of Object.keys(adversarial(10))) {
    const a = times.get(`${name}@1000000`)!, b = times.get(`${name}@2000000`)!;
    if (b > 40 && b / Math.max(a, 1) > 3.2) slow.push(`${name}: 1MB ${a.toFixed(0)}ms -> 2MB ${b.toFixed(0)}ms (superlinear)`);
    if (b > 1000) slow.push(`${name}: 2MB ${b.toFixed(0)}ms`);
  }
  if (slow.length) console.log(log.join("\n"));
  assert.deepEqual(slow, [], slow.join("\n"));
});

test("fcrdns / ip helpers don't blow up on huge inputs", () => {
  const t0 = performance.now();
  for (const n of [100_000, 1_000_000]) {
    for (const s of [":".repeat(n), "[".repeat(n), "1.".repeat(n), "a".repeat(n), "a.".repeat(n), "%".repeat(n), "::ffff:" + "1".repeat(n)]) {
      normalizeIp(s);
      hostMatchesSuffix(s, "googlebot.com");
      readAsn(bag({ "x-vercel-ip-as-number": s }));
    }
  }
  assert.ok(performance.now() - t0 < 2000, `took ${performance.now() - t0}`);
});

// ---------------------------------------------------------------- (5) stripper robustness
test("stripper never throws/hangs on crafted UAs and never lowers verdict below spoofed/unverified floor", () => {
  let x = 99;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const toks = ["Googlebot", "Applebot", "bingbot", "yandex.com/bots", "YandexBot", "Twitterbot", "Mozilla/5.0", "Mozilla", "-", "/", "-", ".", "+", "~", "(", ")", ";", " ", "​", " ", "curl", "node", "Headless", "null", "unknown", "facebookexternalhit", "1.0", "\\", "[", "*", "$", "^", "?", "|"];
  for (let i = 0; i < 3000; i++) {
    let ua = "";
    const len = 1 + Math.floor(rnd() * 12);
    for (let j = 0; j < len; j++) ua += toks[Math.floor(rnd() * toks.length)];
    for (const hdr of [{}, FULL, { "x-vercel-ip-as-number": "32934" }, { "x-vercel-ip-as-number": "1" }] as Record<string, string>[]) {
      const a = assessRequestSync({ headers: bag({ "user-agent": ua, ...hdr }) });
      assert.ok(Number.isInteger(a.score) && a.score >= 0 && a.score <= 100, `seed=99 ${JSON.stringify(ua)}`);
      if (a.crawler?.verification === "unverified") assert.ok(a.score >= 55, `seed=99 ${JSON.stringify(ua)} ${a.score}`);
      if (a.crawler?.verification === "spoofed") assert.ok(a.score >= 95, `seed=99 ${JSON.stringify(ua)} ${a.score}`);
      if (a.classification !== "verified-crawler" && a.crawler?.verification !== "verified" && looksAutomated(ua))
        assert.ok(a.score >= 80, `seed=99 ${JSON.stringify(ua)} ${a.score} ${JSON.stringify(a.signals)}`);
    }
  }
});
