import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import { botReason, isDeclaredBotUa, isNonBrowserUa, parseUserAgent } from "../tracking/ua";
import { assessRequest, assessRequestSync } from "./assess";
import { KNOWN_CRAWLERS } from "./crawlers";
import {
  CHALLENGE_CLIENT_SOLVER,
  createReplayGuard,
  issueChallenge,
  leadingZeroBits,
  solveChallenge,
  verifyChallenge,
} from "./challenge";
import { CLIENT_PROBE_SOURCE, parseTelemetry, telemetrySignals, type ClientTelemetry } from "./client-signals";
import {
  createCrawlerVerifier,
  hostMatchesSuffix,
  normalizeIp,
  verifyFcrdns,
  type DnsResolver,
} from "./fcrdns";
import { decide, DEFAULT_THRESHOLDS } from "./policy";
import { MemoryRateLimiter } from "./rate-limit";
import { combineWeights } from "./signals";
import type { Assessment, Signal } from "./types";

// ───────────────────────── fixtures ─────────────────────────

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Bộ header một lượt người thật bấm link trên Chrome Windows. */
function humanChrome(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "user-agent": CHROME_UA,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
    "sec-ch-ua-platform": '"Windows"',
    "x-vercel-ip-as-number": "18403", // FPT Telecom
    ...extra,
  });
}

/** Resolver giả: PTR và A/AAAA khai báo tường minh. */
function fakeDns(ptr: Record<string, string[]>, forward: Record<string, string[]>): DnsResolver {
  const notFound = () => Object.assign(new Error("not found"), { code: "ENOTFOUND" });
  return {
    reverse: async (ip) => {
      if (!ptr[ip]) throw notFound();
      return ptr[ip];
    },
    resolve4: async (h) => {
      if (!forward[h]) throw notFound();
      return forward[h].filter((a) => !a.includes(":"));
    },
    resolve6: async (h) => {
      if (!forward[h]) throw notFound();
      return forward[h].filter((a) => a.includes(":"));
    },
  };
}

const REAL_GOOGLEBOT_DNS = fakeDns(
  { "66.249.66.1": ["crawl-66-249-66-1.googlebot.com"] },
  { "crawl-66-249-66-1.googlebot.com": ["66.249.66.1"] },
);

// ───────────────────────── lớp 1: FCrDNS ─────────────────────────

describe("hostMatchesSuffix", () => {
  it("khớp theo ranh giới nhãn, không theo chuỗi con", () => {
    assert.equal(hostMatchesSuffix("crawl-1.googlebot.com", "googlebot.com"), true);
    assert.equal(hostMatchesSuffix("googlebot.com", "googlebot.com"), true);
    assert.equal(hostMatchesSuffix("crawl-1.googlebot.com.", "googlebot.com"), true);
    assert.equal(hostMatchesSuffix("evilgooglebot.com", "googlebot.com"), false);
    assert.equal(hostMatchesSuffix("googlebot.com.evil.net", "googlebot.com"), false);
    assert.equal(hostMatchesSuffix("CRAWL.GOOGLEBOT.COM", "googlebot.com"), true);
  });
});

describe("normalizeIp", () => {
  it("chuẩn hoá IPv6 về cùng một dạng", () => {
    assert.equal(normalizeIp("2001:4860:4801:10::1"), normalizeIp("2001:4860:4801:0010:0:0:0:1"));
    assert.equal(normalizeIp("::1"), "0:0:0:0:0:0:0:1");
    assert.equal(normalizeIp("[2001:db8::1]"), normalizeIp("2001:db8:0:0:0:0:0:1"));
    assert.equal(normalizeIp("fe80::1%eth0"), normalizeIp("fe80::1"));
  });
  it("đưa IPv4-mapped IPv6 về IPv4", () => {
    assert.equal(normalizeIp("::ffff:66.249.66.1"), "66.249.66.1");
  });
  it("từ chối chuỗi không phải IP", () => {
    for (const bad of ["", "not-an-ip", "1.2.3", "1.2.3.4.5", "999.1.1.1", ":::", "2001:db8::1::2"]) {
      assert.equal(normalizeIp(bad), null, bad);
    }
  });
});

describe("verifyFcrdns", () => {
  // Lấy từ registry THẬT: bản sao cục bộ từng che mất lỗ hổng *.googleusercontent.com.
  const google = KNOWN_CRAWLERS.find((c) => c.id === "google")!.rdnsSuffixes!;

  it("xác nhận Googlebot thật", async () => {
    const r = await verifyFcrdns("66.249.66.1", google, REAL_GOOGLEBOT_DNS);
    assert.deepEqual(r, { status: "verified", hostname: "crawl-66-249-66-1.googlebot.com" });
  });

  it("từ chối khi kẻ giả tự đặt PTR nhưng forward không khớp", async () => {
    // Chủ IP 203.0.113.9 đặt PTR = crawl-x.googlebot.com; A record của googlebot.com thì không trỏ về IP đó.
    const dns = fakeDns(
      { "203.0.113.9": ["crawl-x.googlebot.com"] },
      { "crawl-x.googlebot.com": ["66.249.66.2"] },
    );
    const r = await verifyFcrdns("203.0.113.9", google, dns);
    assert.deepEqual(r, { status: "failed", reason: "forward-mismatch" });
  });

  it("từ chối PTR sai domain", async () => {
    const dns = fakeDns({ "203.0.113.9": ["host.evil.net"] }, { "host.evil.net": ["203.0.113.9"] });
    assert.deepEqual(await verifyFcrdns("203.0.113.9", google, dns), { status: "failed", reason: "wrong-domain" });
  });

  it("từ chối domain chứa suffix làm chuỗi con", async () => {
    for (const host of ["evilgooglebot.com", "googlebot.com.evil.net"]) {
      const dns = fakeDns({ "203.0.113.9": [host] }, { [host]: ["203.0.113.9"] });
      assert.equal((await verifyFcrdns("203.0.113.9", google, dns)).status, "failed", host);
    }
  });

  it("KHÔNG chấp nhận VM Google Cloud (*.bc.googleusercontent.com) là Googlebot", async () => {
    // Bất kỳ khách hàng GCE nào cũng có PTR dạng này và forward khớp.
    const host = "9.113.0.203.bc.googleusercontent.com";
    const dns = fakeDns({ "203.0.113.9": [host] }, { [host]: ["203.0.113.9"] });
    assert.deepEqual(await verifyFcrdns("203.0.113.9", google, dns), { status: "failed", reason: "wrong-domain" });
  });

  it("chấp nhận user-triggered fetcher của Google (gae.googleusercontent.com)", async () => {
    const host = "1-2-3-4.gae.googleusercontent.com";
    const dns = fakeDns({ "35.1.2.4": [host] }, { [host]: ["35.1.2.4"] });
    assert.equal((await verifyFcrdns("35.1.2.4", google, dns)).status, "verified");
  });

  it("không có PTR → failed (crawler thật luôn có PTR)", async () => {
    assert.deepEqual(await verifyFcrdns("203.0.113.9", google, fakeDns({}, {})), { status: "failed", reason: "no-ptr" });
  });

  it("timeout/lỗi DNS → error, KHÔNG phải failed", async () => {
    const slow: DnsResolver = {
      reverse: () => new Promise(() => {}),
      resolve4: async () => [],
      resolve6: async () => [],
    };
    const r = await verifyFcrdns("66.249.66.1", google, slow, 20);
    assert.deepEqual(r, { status: "error", reason: "ETIMEOUT" });

    const servfail: DnsResolver = {
      ...slow,
      reverse: async () => {
        throw Object.assign(new Error("servfail"), { code: "ESERVFAIL" });
      },
    };
    assert.equal((await verifyFcrdns("66.249.66.1", google, servfail)).status, "error");
  });

  it("hoạt động với IPv6 (so khớp sau khi chuẩn hoá)", async () => {
    const dns: DnsResolver = {
      reverse: async () => ["crawl-2001-4860-4801-10--1.googlebot.com"],
      resolve4: async () => [],
      resolve6: async () => ["2001:4860:4801:0010:0:0:0:1"],
    };
    assert.equal((await verifyFcrdns("2001:4860:4801:10::1", google, dns)).status, "verified");
  });

  it("IP không parse được → error (không kết luận), KHÔNG phải failed/spoofed", async () => {
    assert.deepEqual(await verifyFcrdns("nope", google, REAL_GOOGLEBOT_DNS), { status: "error", reason: "invalid-ip" });
  });
});

describe("createCrawlerVerifier (cache)", () => {
  it("không hỏi DNS lần hai cho cùng IP, và hết hạn đúng lúc", async () => {
    let lookups = 0;
    const counting: DnsResolver = {
      reverse: async (ip) => {
        lookups++;
        return REAL_GOOGLEBOT_DNS.reverse(ip);
      },
      resolve4: (h) => REAL_GOOGLEBOT_DNS.resolve4(h),
      resolve6: (h) => REAL_GOOGLEBOT_DNS.resolve6(h),
    };
    let t = 0;
    const verify = createCrawlerVerifier({ resolver: counting, now: () => t, ttlMs: 1000 });

    await verify("66.249.66.1", ["googlebot.com"]);
    await verify("66.249.66.1", ["googlebot.com"]);
    assert.equal(lookups, 1);
    t = 1001;
    await verify("66.249.66.1", ["googlebot.com"]);
    assert.equal(lookups, 2);
  });

  it("cache lỗi ngắn hơn cache kết quả xác định", async () => {
    let fail = true;
    const flaky: DnsResolver = {
      reverse: async (ip) => {
        if (fail) throw Object.assign(new Error("x"), { code: "ESERVFAIL" });
        return REAL_GOOGLEBOT_DNS.reverse(ip);
      },
      resolve4: (h) => REAL_GOOGLEBOT_DNS.resolve4(h),
      resolve6: (h) => REAL_GOOGLEBOT_DNS.resolve6(h),
    };
    let t = 0;
    const verify = createCrawlerVerifier({ resolver: flaky, now: () => t, ttlMs: 3_600_000, errorTtlMs: 1000 });
    assert.equal((await verify("66.249.66.1", ["googlebot.com"])).status, "error");
    fail = false;
    t = 1500; // qua errorTtl, chưa gần ttl
    assert.equal((await verify("66.249.66.1", ["googlebot.com"])).status, "verified");
  });
});

// ───────────────────────── tổng hợp: người thật vs bot ─────────────────────────

describe("assessRequest — người thật", () => {
  it("Chrome desktop đầy đủ header → điểm thấp, allow", () => {
    const a = assessRequestSync({ headers: humanChrome() });
    assert.equal(a.classification, "human-likely");
    assert.ok(a.score < DEFAULT_THRESHOLDS.flag, `score=${a.score}`);
  });

  it("webview in-app thiếu Sec-Fetch/Client Hints vẫn dưới ngưỡng flag", () => {
    const h = new Headers({
      "user-agent":
        "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;]",
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "accept-language": "vi-VN,vi;q=0.9",
    });
    const a = assessRequestSync({ headers: h });
    assert.ok(a.score < DEFAULT_THRESHOLDS.flag, `score=${a.score} ${JSON.stringify(a.signals)}`);
  });

  it("Safari iPhone (không gửi client hints) → human-likely", () => {
    const h = new Headers({
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "vi-VN,vi;q=0.9",
      "sec-fetch-mode": "navigate",
    });
    assert.equal(assessRequestSync({ headers: h }).classification, "human-likely");
  });

  it("telemetry của người thật không làm tăng điểm", () => {
    const a = assessRequestSync({ headers: humanChrome(), telemetry: HUMAN_TELEMETRY });
    assert.equal(a.classification, "human-likely");
  });
});

describe("assessRequest — bot/automation", () => {
  const cases: [string, Headers, number][] = [
    ["curl", new Headers({ "user-agent": "curl/8.4.0", accept: "*/*" }), 80],
    ["python-requests", new Headers({ "user-agent": "python-requests/2.31.0" }), 80],
    ["Go-http-client", new Headers({ "user-agent": "Go-http-client/1.1" }), 80],
    ["HeadlessChrome UA", new Headers({ "user-agent": CHROME_UA.replace("Chrome/", "HeadlessChrome/") }), 80],
    ["UA rỗng", new Headers({ "user-agent": "" }), 55],
    ["HeadlessChrome trong client hint, UA đã sửa", humanChrome({ "sec-ch-ua": '"HeadlessChrome";v="126", "Chromium";v="126"' }), 80],
    ["UA Windows nhưng client hint nói Android", humanChrome({ "sec-ch-ua-platform": '"Android"' }), 40],
    ["fetch() từ script (sec-fetch-mode: cors)", humanChrome({ "sec-fetch-mode": "cors" }), 25],
  ];
  for (const [name, headers, min] of cases) {
    it(`${name} → score ≥ ${min}`, () => {
      const a = assessRequestSync({ headers });
      assert.ok(a.score >= min, `score=${a.score} ${JSON.stringify(a.signals)}`);
    });
  }

  it("script đội UA Chrome nhưng bỏ hết header → ít nhất suspicious", () => {
    const a = assessRequestSync({ headers: new Headers({ "user-agent": CHROME_UA }) });
    assert.notEqual(a.classification, "human-likely", JSON.stringify(a.signals));
  });

  it("datacenter ASN cộng điểm nhưng không tự nó vượt ngưỡng chặn", () => {
    const a = assessRequestSync({ headers: humanChrome({ "x-vercel-ip-as-number": "16509" }) });
    assert.ok(a.signals.some((s) => s.id === "datacenter-asn"));
    assert.ok(a.score < DEFAULT_THRESHOLDS.rateLimit);
  });

  it("GIỚI HẠN ĐÃ BIẾT: automation đội đủ header Chrome thật không bị lớp 2 phát hiện", () => {
    // Playwright + stealth gửi đúng bộ header này. Test này ghi lại sự thật đó
    // để không ai đọc điểm thấp thành "chắc chắn là người".
    const a = assessRequestSync({ headers: humanChrome() });
    assert.equal(a.classification, "human-likely");
  });

  it("…nhưng telemetry (navigator.webdriver) bắt được nếu không bị che", () => {
    const a = assessRequestSync({ headers: humanChrome(), telemetry: { ...HUMAN_TELEMETRY, wd: true } });
    assert.ok(a.score >= DEFAULT_THRESHOLDS.rateLimit, `score=${a.score}`);
  });
});

describe("assessRequest — danh tính crawler", () => {
  const googleHeaders = () => new Headers({ "user-agent": GOOGLEBOT_UA });

  it("Googlebot thật (FCrDNS đạt) → verified-crawler, điểm 0", async () => {
    const verifier = createCrawlerVerifier({ resolver: REAL_GOOGLEBOT_DNS });
    const a = await assessRequest({ headers: googleHeaders(), ip: "66.249.66.1" }, verifier);
    assert.equal(a.classification, "verified-crawler");
    assert.equal(a.score, 0);
    assert.equal(a.crawler?.via, "fcrdns");
  });

  it("UA Googlebot từ IP lạ → spoofed-crawler, điểm ≥ 90", async () => {
    const verifier = createCrawlerVerifier({ resolver: fakeDns({}, {}) });
    const a = await assessRequest({ headers: googleHeaders(), ip: "203.0.113.9" }, verifier);
    assert.equal(a.classification, "spoofed-crawler");
    assert.ok(a.score >= 90);
  });

  it("UA Googlebot từ VM Google Cloud của khách hàng → spoofed (không qua FCrDNS)", async () => {
    // PTR *.bc.googleusercontent.com + forward khớp: thuê một VM GCE là có ngay.
    const host = "9.113.0.203.bc.googleusercontent.com";
    const dns = fakeDns({ "203.0.113.9": [host] }, { [host]: ["203.0.113.9"] });
    const a = await assessRequest({ headers: googleHeaders(), ip: "203.0.113.9" }, createCrawlerVerifier({ resolver: dns }));
    assert.equal(a.classification, "spoofed-crawler");
  });

  it("DNS lỗi → unverified, KHÔNG bị coi là giả", async () => {
    const down: DnsResolver = {
      reverse: async () => {
        throw Object.assign(new Error("x"), { code: "ESERVFAIL" });
      },
      resolve4: async () => [],
      resolve6: async () => [],
    };
    const a = await assessRequest({ headers: googleHeaders(), ip: "66.249.66.1" }, createCrawlerVerifier({ resolver: down }));
    assert.equal(a.crawler?.verification, "unverified");
    assert.notEqual(a.classification, "spoofed-crawler");
  });

  it("thiếu IP → unverified", async () => {
    const a = await assessRequest({ headers: googleHeaders() }, createCrawlerVerifier({ resolver: REAL_GOOGLEBOT_DNS }));
    assert.equal(a.crawler?.verification, "unverified");
  });

  it("Meta xác minh bằng ASN 32934", () => {
    const ua = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    const real = assessRequestSync({ headers: new Headers({ "user-agent": ua, "x-vercel-ip-as-number": "32934" }) });
    assert.equal(real.classification, "verified-crawler");
    assert.equal(real.crawler?.via, "asn");

    const fake = assessRequestSync({ headers: new Headers({ "user-agent": ua, "x-vercel-ip-as-number": "16509" }) });
    assert.equal(fake.classification, "spoofed-crawler");
  });

  it("X (Twitterbot) xác minh bằng ASN 13414", () => {
    const real = assessRequestSync({ headers: new Headers({ "user-agent": "Twitterbot/1.0", "x-vercel-ip-as-number": "13414" }) });
    assert.equal(real.classification, "verified-crawler");
    const fake = assessRequestSync({ headers: new Headers({ "user-agent": "Twitterbot/1.0", "x-vercel-ip-as-number": "14061" }) });
    assert.equal(fake.classification, "spoofed-crawler");
  });

  it("thiếu header ASN (dev/ngoài Vercel) → unverified, không phải spoofed", () => {
    const a = assessRequestSync({ headers: new Headers({ "user-agent": "Twitterbot/1.0" }) });
    assert.equal(a.crawler?.verification, "unverified");
  });

  it("meta-externalads/agent/fetcher đều được nhận diện là Meta", () => {
    for (const ua of ["meta-externalads/1.1", "meta-externalagent/1.1", "meta-externalfetcher/1.1", "meta-webindexer/1.1"]) {
      const a = assessRequestSync({ headers: new Headers({ "user-agent": ua, "x-vercel-ip-as-number": "32934" }) });
      assert.equal(a.classification, "verified-crawler", ua);
    }
  });

  it("sync không bao giờ gọi DNS: Googlebot chỉ là unverified", () => {
    const a = assessRequestSync({ headers: googleHeaders(), ip: "66.249.66.1" });
    assert.equal(a.crawler?.verification, "unverified");
  });
});

// ───────────────────────── tính chất của điểm số ─────────────────────────

describe("combineWeights", () => {
  const sig = (...w: number[]): Signal[] => w.map((weight) => ({ id: "no-sec-fetch", weight }));

  it("rỗng → 0; luôn trong [0,100]", () => {
    assert.equal(combineWeights([]), 0);
    assert.ok(combineWeights(sig(100, 100, 100)) <= 100);
    assert.equal(combineWeights(sig(100)), 100);
    assert.equal(combineWeights(sig(-50, 500)), 100); // kẹp weight lạc
  });

  it("đơn điệu: thêm tín hiệu không bao giờ làm điểm giảm", () => {
    let prev = 0;
    for (const w of [10, 5, 30, 0, 12, 80, 1]) {
      const next = combineWeights(sig(...[10, 5, 30, 0, 12, 80, 1].slice(0, [10, 5, 30, 0, 12, 80, 1].indexOf(w) + 1)));
      assert.ok(next >= prev);
      prev = next;
    }
  });

  it("thứ tự tín hiệu không ảnh hưởng", () => {
    assert.equal(combineWeights(sig(10, 40, 70)), combineWeights(sig(70, 10, 40)));
  });

  it("nhiều tín hiệu yếu không dồn lên tuyến tính", () => {
    assert.ok(combineWeights(sig(10, 10, 10, 10)) < 40);
  });
});

// ───────────────────────── lớp 3: telemetry ─────────────────────────

const HUMAN_TELEMETRY: ClientTelemetry = {
  wd: false, pl: 5, lg: 2,
  ow: 1920, oh: 1040, iw: 1905, ih: 950,
  sw: 1920, sh: 1080, hc: 8,
  ua: CHROME_UA, ch: true,
  ev: 14, ut: 0, dw: 4200,
};

describe("telemetrySignals", () => {
  const ids = (t: ClientTelemetry) => telemetrySignals(t, CHROME_UA).map((s) => s.id);

  it("người thật → không tín hiệu nào", () => {
    assert.deepEqual(ids(HUMAN_TELEMETRY), []);
  });
  it("webdriver", () => assert.ok(ids({ ...HUMAN_TELEMETRY, wd: true }).includes("webdriver-flag")));
  it("sự kiện tổng hợp (isTrusted=false)", () => assert.ok(ids({ ...HUMAN_TELEMETRY, ut: 1 }).includes("untrusted-events")));
  it("UA JS ≠ UA header", () => assert.ok(ids({ ...HUMAN_TELEMETRY, ua: "Mozilla/5.0 other" }).includes("ua-mismatch")));
  it("languages rỗng", () => assert.ok(ids({ ...HUMAN_TELEMETRY, lg: 0 }).includes("empty-languages")));
  it("cửa sổ outer = 0 (headless cũ)", () => assert.ok(ids({ ...HUMAN_TELEMETRY, ow: 0, oh: 0 }).includes("zero-window")));
  it("màn hình mặc định 800x600", () => assert.ok(ids({ ...HUMAN_TELEMETRY, sw: 800, sh: 600 }).includes("default-screen")));
  it("bấm ngay lập tức, không tương tác", () => assert.ok(ids({ ...HUMAN_TELEMETRY, ev: 0, dw: 40 }).includes("no-interaction")));
  it("không tương tác nhưng đã ở lại lâu → không gắn cờ (người đọc lướt)", () =>
    assert.ok(!ids({ ...HUMAN_TELEMETRY, ev: 0, dw: 5000 }).includes("no-interaction")));
  it("điện thoại không bị phạt vì thiếu plugins", () => {
    const mobile = telemetrySignals({ ...HUMAN_TELEMETRY, pl: 0 }, "Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile Safari/537.36");
    assert.ok(!mobile.some((s) => s.id === "no-plugins"));
  });

  it("probe chạy được và trả đúng hình dạng (chạy trong vm với window giả)", () => {
    const listeners: Record<string, ((e: { isTrusted: boolean }) => void)[]> = {};
    const win: Record<string, unknown> = {
      navigator: { webdriver: false, plugins: { length: 5 }, languages: ["vi"], hardwareConcurrency: 8, userAgent: CHROME_UA },
      outerWidth: 1920, outerHeight: 1040, innerWidth: 1900, innerHeight: 950,
      screen: { width: 1920, height: 1080 },
      chrome: {},
      addEventListener: (n: string, fn: (e: { isTrusted: boolean }) => void) => (listeners[n] ??= []).push(fn),
    };
    let clock = 0;
    const ctx = { window: win, performance: { now: () => clock } };
    runInNewContext(CLIENT_PROBE_SOURCE, ctx);

    clock = 1000;
    listeners.mousemove[0]({ isTrusted: true });
    listeners.click[0]({ isTrusted: false });
    clock = 2500;
    const t = (win.__tiqProbe as () => ClientTelemetry)();

    assert.equal(t.wd, false);
    assert.equal(t.pl, 5);
    assert.equal(t.ev, 2);
    assert.equal(t.ut, 1);
    assert.equal(t.dw, 2500);
    assert.equal(t.sw, 1920);
    assert.ok(telemetrySignals(t, CHROME_UA).some((s) => s.id === "untrusted-events"));
  });
});

// ───────────────────────── hạn mức tần suất ─────────────────────────

describe("MemoryRateLimiter", () => {
  const rule = { capacity: 3, refillPerSec: 1 };

  it("cho burst tới capacity rồi từ chối, kèm retryAfter", () => {
    const t = 0;
    const rl = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 3; i++) assert.equal(rl.take("k", rule).allowed, true);
    const denied = rl.take("k", rule);
    assert.equal(denied.allowed, false);
    assert.equal(denied.retryAfterSec, 1);
  });

  it("hồi token theo thời gian, không vượt capacity", () => {
    let t = 0;
    const rl = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 3; i++) rl.take("k", rule);
    t = 2000;
    assert.equal(rl.take("k", rule).remaining, 1); // 2 token hồi, dùng 1
    t = 1_000_000;
    assert.equal(rl.take("k", rule).remaining, 2); // đầy 3, dùng 1
  });

  it("khoá khác nhau độc lập", () => {
    const rl = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) rl.take("a", rule);
    assert.equal(rl.take("a", rule).allowed, false);
    assert.equal(rl.take("b", rule).allowed, true);
  });

  it("giới hạn bộ nhớ: không vượt maxKeys", () => {
    const rl = new MemoryRateLimiter({ maxKeys: 5 });
    for (let i = 0; i < 100; i++) rl.take(`k${i}`, rule);
    assert.ok(rl.size <= 5);
  });
});

describe("decide (điểm → hành động)", () => {
  const withScore = (score: number, classification: Assessment["classification"] = "human-likely"): Assessment =>
    ({ score, classification, signals: [] });

  it("mỗi bậc điểm ra đúng hành động", () => {
    const rl = new MemoryRateLimiter();
    assert.equal(decide(withScore(10), { limiter: rl, key: "a" }).action, "allow");
    assert.equal(decide(withScore(45), { limiter: rl, key: "b" }).action, "flag");
    assert.equal(decide(withScore(70), { limiter: rl, key: "c" }).action, "flag");
    assert.equal(decide(withScore(85), { limiter: rl, key: "d" }).action, "challenge");
    assert.equal(decide(withScore(100), { limiter: rl, key: "e" }).action, "challenge");
  });

  it("bậc 60–79 bị rate-limit chặt sau vài request", () => {
    const t = 0;
    const rl = new MemoryRateLimiter({ now: () => t });
    const results = Array.from({ length: 10 }, () => decide(withScore(70), { limiter: rl, key: "bot" }).action);
    assert.equal(results[0], "flag");
    assert.ok(results.includes("rate-limited"));
  });

  it("người bình thường không bị rate-limit ở nhịp dùng thường", () => {
    let t = 0;
    const rl = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 30; i++) {
      t += 5000; // một click mỗi 5 giây
      assert.equal(decide(withScore(5), { limiter: rl, key: "human" }).action, "allow");
    }
  });

  it("crawler đã xác minh không bao giờ bị challenge", () => {
    const rl = new MemoryRateLimiter();
    assert.equal(decide(withScore(0, "verified-crawler"), { limiter: rl, key: "g" }).action, "allow");
  });
});

// ───────────────────────── PoW challenge ─────────────────────────

describe("PoW challenge", () => {
  const secret = "test-secret-do-not-use";
  const bits = 10; // thấp để test nhanh

  it("giải rồi xác minh được", () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: bits });
    const nonce = solveChallenge(c.token, bits);
    assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "ip1" }), { ok: true });
  });

  it("từ chối lời giải không đủ công", () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: 20 });
    const r = verifyChallenge(c.token, "0", { secret, subject: "ip1" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "insufficient-work");
  });

  it("từ chối token bị sửa (đổi độ khó xuống 0)", () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: 20 });
    const [body, sig] = c.token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.d = 0;
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    const r = verifyChallenge(forged, "0", { secret, subject: "ip1" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "bad-signature");
  });

  it("từ chối token ký bằng secret khác", () => {
    const c = issueChallenge({ secret: "another-secret-0123456789", subject: "ip1", difficultyBits: bits });
    const r = verifyChallenge(c.token, solveChallenge(c.token, bits), { secret, subject: "ip1" });
    assert.equal(r.ok, false);
  });

  it("từ chối khi hết hạn", () => {
    let t = 0;
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: bits, ttlMs: 1000, now: () => t });
    const nonce = solveChallenge(c.token, bits);
    t = 1000;
    const r = verifyChallenge(c.token, nonce, { secret, subject: "ip1", now: () => t });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "expired");
  });

  it("từ chối khi chủ thể khác (đem token đi giải hộ)", () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: bits });
    const r = verifyChallenge(c.token, solveChallenge(c.token, bits), { secret, subject: "ip2" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong-subject");
  });

  it("từ chối dùng lại lời giải (replay), nhưng lời giải SAI không đốt token", () => {
    const replay = createReplayGuard();
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: bits });
    const nonce = solveChallenge(c.token, bits);

    const wrong = verifyChallenge(c.token, "definitely-wrong-xyz", { secret, subject: "ip1", replay });
    if (wrong.ok) {
      // Cực hiếm: nonce bậy tình cờ đủ công. Bỏ qua để test không flaky.
      return;
    }
    assert.equal(verifyChallenge(c.token, nonce, { secret, subject: "ip1", replay }).ok, true);
    const again = verifyChallenge(c.token, nonce, { secret, subject: "ip1", replay });
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.reason, "replayed");
  });

  it("từ chối đầu vào rác mà không ném lỗi", () => {
    for (const [tok, n] of [["", "x"], ["abc", "x"], ["a.b", ""], ["a.b", "x".repeat(100)], ["....", "x"]]) {
      assert.equal(verifyChallenge(tok, n, { secret, subject: "ip1" }).ok, false, `${tok}|${n}`);
    }
  });

  it("leadingZeroBits đếm đúng", () => {
    assert.equal(leadingZeroBits(Buffer.from([0x00, 0x00, 0xff])), 16);
    assert.equal(leadingZeroBits(Buffer.from([0x00, 0x0f])), 12);
    assert.equal(leadingZeroBits(Buffer.from([0x80])), 0);
    assert.equal(leadingZeroBits(Buffer.from([0x01])), 7);
  });

  it("bộ giải trong browser cho kết quả mà server chấp nhận", async () => {
    const c = issueChallenge({ secret, subject: "ip1", difficultyBits: bits });
    const solve = runInNewContext(`${CHALLENGE_CLIENT_SOLVER}; solvePow`, {
      TextEncoder,
      Uint8Array,
      Math,
      crypto: globalThis.crypto,
    }) as (token: string, bits: number) => Promise<string>;
    const nonce = await solve(c.token, bits);
    assert.deepEqual(verifyChallenge(c.token, nonce, { secret, subject: "ip1" }), { ok: true });
  });
});

describe("hardening", () => {
  it("verifyChallenge từ chối token khổng lồ mà không tính HMAC", () => {
    const huge = "a".repeat(5000) + ".b";
    const r = verifyChallenge(huge, "x", { secret: "secret-long-enough-0123", subject: "ip" });
    assert.deepEqual(r, { ok: false, reason: "malformed" });
  });

  it("verifier gộp lookup đồng thời cho cùng IP (một cặp truy vấn DNS)", async () => {
    let reverseCalls = 0;
    const slow: DnsResolver = {
      reverse: async (ip) => {
        reverseCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return REAL_GOOGLEBOT_DNS.reverse(ip);
      },
      resolve4: (h) => REAL_GOOGLEBOT_DNS.resolve4(h),
      resolve6: (h) => REAL_GOOGLEBOT_DNS.resolve6(h),
    };
    const verify = createCrawlerVerifier({ resolver: slow });
    const results = await Promise.all(
      Array.from({ length: 25 }, () => verify("66.249.66.1", ["googlebot.com"])),
    );
    assert.equal(reverseCalls, 1);
    assert.ok(results.every((r) => r.status === "verified"));
  });

  it("parseTelemetry nhận payload đúng và từ chối payload hỏng", () => {
    assert.deepEqual(parseTelemetry(HUMAN_TELEMETRY), HUMAN_TELEMETRY);
    const bad: unknown[] = [
      null, "x", 42, [], {},
      { ...HUMAN_TELEMETRY, wd: "false" },
      { ...HUMAN_TELEMETRY, pl: NaN },
      { ...HUMAN_TELEMETRY, pl: Infinity },
      { ...HUMAN_TELEMETRY, ev: -1 },
      { ...HUMAN_TELEMETRY, dw: 1e12 },
      { ...HUMAN_TELEMETRY, ua: "x".repeat(10_000) },
      { ...HUMAN_TELEMETRY, ua: 123 },
    ];
    for (const b of bad) assert.equal(parseTelemetry(b), null, JSON.stringify(b)?.slice(0, 60));
  });

  it("parseTelemetry bỏ field thừa (không mang rác vào bộ nhớ/log)", () => {
    const parsed = parseTelemetry({ ...HUMAN_TELEMETRY, evil: "x".repeat(100) });
    assert.ok(parsed && !("evil" in parsed));
  });
});

describe("hiệu năng: không có đầu vào nào làm chấm điểm quadratic (hồi quy ReDoS)", () => {
  // Hai lần tác giả tự đưa regex quadratic vào NGAY SAU một vòng sửa (cắt khoảng trắng đuôi: 200k
  // khoảng trắng → 24 giây; `[a-z0-9_-]*bot` toàn cục: treo bộ test). Bài này giữ chúng không quay lại.
  // Ngưỡng rộng (đo thực ~40ms/MB) để không flaky; quadratic sẽ vượt xa.
  const SHAPES: Array<[string, string]> = [
    ["chữ-số dài rồi bot", "Mozilla/5.0 " + "a".repeat(1_000_000) + "bot"],
    ["'bo' lặp", "Mozilla/5.0 " + "bo".repeat(500_000)],
    ["200k khoảng trắng giữa chuỗi", "a" + " ".repeat(200_000) + "b"],
    ["khoảng trắng xen kẽ", "a ".repeat(500_000)],
    ["NBSP đầu + khoảng trắng đuôi", " ".repeat(500_000) + "Mozilla/5.0" + " ".repeat(500_000)],
    ["(; lặp rồi bot", "(;".repeat(300_000) + "bot"],
    ["Mozilla/5.0 lặp", "Mozilla/5.0 ".repeat(80_000)],
    ["slash lặp", "a/".repeat(500_000)],
    ["gạch ngang lặp", "-".repeat(1_000_000) + "x"],
  ];
  for (const [name, ua] of SHAPES) {
    it(`${name} (~${Math.round(ua.length / 1000)}KB) chấm điểm dưới 600ms`, () => {
      const t0 = performance.now();
      assessRequestSync({ headers: new Headers({ "user-agent": ua, accept: "*/*" }) });
      const ms = performance.now() - t0;
      assert.ok(ms < 600, `${ms.toFixed(0)}ms`);
    });
  }

  it("hostMatchesSuffix trên hostname 1MB toàn gạch ngang/chấm/gạch dưới", () => {
    for (const host of ["-".repeat(1_000_000), ("a".repeat(63) + ".").repeat(15_000), "_.".repeat(500_000), "a".repeat(1_000_000)]) {
      const t0 = performance.now();
      hostMatchesSuffix(host, "googlebot.com");
      assert.ok(performance.now() - t0 < 200, `${(performance.now() - t0).toFixed(0)}ms`);
    }
  });

  it("không có byte NUL trong mã nguồn botdetect (đã lọt vào hai lần do thoát ký tự)", () => {
    const dir = new URL(".", import.meta.url);
    for (const f of readdirSync(dir)) {
      if (!/\.(ts|md)$/.test(f)) continue;
      assert.equal(readFileSync(new URL(f, dir)).includes(0), false, `${f} chứa byte NUL`);
    }
  });
});

describe("vòng 6: điện thoại đời cũ, và allowlist không phải lối né", () => {
  const score = (ua: string) => assessRequestSync({ headers: new Headers({ "user-agent": ua, accept: "text/html", "accept-language": "vi" }) }).score;

  it("điện thoại/trình duyệt đời cũ thật không bị flag (< 30)", () => {
    for (const ua of [
      "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1",
      "LG-KU990/V10a Obigo/Q05A Java/ASVM/1.1 Profile/MIDP-2.1",
      "MOTORIZR-Z8/46.00.00 Mozilla/4.0 (compatible; MSIE 6.0; Symbian OS; 323) Opera 8.65",
      "HTC-8500/1.2 Mozilla/4.0 (compatible; MSIE 4.01; Windows CE; PPC; 240x320)",
      "UCWEB7.0.2.37/28/999",
      "UP.Browser/3.04-TS14 UP.Link/3.4.4",
      "Alcatel-BF3/1.0 UP.Browser/6.2.2.6.d.2 (GUI) MMP/1.0",
      "Nokia6230/2.0 (04.44) Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "Lynx/2.9.0 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2",
    ]) assert.ok(score(ua) < 30, `${ua.slice(0, 40)} -> ${score(ua)}`);
  });

  it("allowlist KHÔNG phải lối né: thư viện/headless vẫn bị bắt dù mang tiền tố cũ", () => {
    for (const ua of ["Nokia6230/2.0 curl/8.4", "LG/U990 python-requests/2.31", "HTC-8500 HeadlessChrome/126", "Lynx/2.9 Playwright/1.40", "Nokia6230 (compatible; Googlebot/2.1)"]) {
      assert.ok(score(ua) >= 55, `${ua} -> ${score(ua)}`);
    }
    for (const ua of ["NokiaScraper/1.0", "Lynx scraper/1.0", "Mozilla/Scraper", "Dolphin x"]) {
      assert.ok(score(ua) >= 40, `${ua} -> ${score(ua)}`);
    }
  });

  it("verifier không cache IP không parse được (không giữ chuỗi dài của client)", async () => {
    let calls = 0;
    const r: DnsResolver = { reverse: async () => { calls++; return []; }, resolve4: async () => [], resolve6: async () => [] };
    const verify = createCrawlerVerifier({ resolver: r });
    for (let i = 0; i < 3000; i++) assert.equal((await verify("x".repeat(1000) + i, ["googlebot.com"])).status, "error");
    assert.equal(calls, 0, "IP sai không được gọi DNS");
  });
});

describe("botReason: quy luật non-browser-ua và URL của bot (đo trên corpus bên thứ ba)", () => {
  const reason = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": ua } }));

  it("UA người thật KHÔNG bắt đầu bằng Mozilla/ không bị chặn (chặn nhầm = người nhận Social Card, không redirect)", () => {
    for (const ua of [
      "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54",
      "Nokia6230/2.0 (04.44) Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "NokiaN73-1/3.0649.0.0.1 Series60/3.0",
      "BlackBerry9000/4.6.0.167 Profile/MIDP-2.0",
      "SonyEricssonK800i/R1JG Browser/NetFront/3.3",
      "MOT-V3/0E.41.C3R MIB/2.2.1",
      "SAMSUNG-SGH-A867/A867UCHJ3 SHP/VPP/R5 NetFront/35",
      "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1",
      "DoCoMo/2.0 N905i(c100;TB;W24H16)",
      "SoftBank/1.0/910T/TJ001 Browser/NetFront/3.3",
      "UCWEB7.0.2.37/28/999",
      "UP.Browser/3.04-TS14 UP.Link/3.4.4",
      "Lynx/2.9.0 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2",
      "Links (2.29; Linux 5.15 x86_64; GNU C 12; text)",
    ]) assert.equal(reason(ua), null, ua);
  });

  it("UA rỗng KHÔNG bị chặn (không có gì để kết luận)", () => {
    assert.equal(reason(""), null);
    assert.equal(isNonBrowserUa(""), false);
    assert.equal(isNonBrowserUa("   "), false);
  });

  it("client không phải trình duyệt bị bắt, với lý do non-browser-ua", () => {
    for (const ua of ["Blogtrottr/2.0", "TwilioProxy/1.1", "wheresitup.com/1.1", "NETVIGIE", "alienfarm", "Feedbin feed-id:2005098 - 2 subscribers", "updown.io daemon 2.11"]) {
      assert.equal(reason(ua), "non-browser-ua", ua);
    }
  });

  it("tiền tố giả của allowlist KHÔNG qua mặt được (NokiaScraper, Lynx scraper)", () => {
    for (const ua of ["NokiaScraper/1.0", "Lynx scraper/1.0", "Dolphin x", "Nokia-x/1.0"]) {
      assert.notEqual(reason(ua), null, ua);
    }
  });

  it("crawler tự khai bằng URL (quy ước '+URL') bị bắt kể cả khi giống trình duyệt", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; PR-CY.RU; + https://a.pr-cy.ru)",
      "Mozilla/5.0 (compatible; Poduptime; +fediverse.observer)",
      "Mozilla/5.0 (compatible; Foo/1.0; +http://example.com/bot)",
      "Mozilla/5.0 (compatible; Bar; +www.example.org)",
    ]) assert.equal(reason(ua), "ua-regex", ua);
  });

  it("UA người thật hiện đại có '+', số phiên bản, 'compatible' không bị chặn nhầm", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)",
      "Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    ]) assert.equal(reason(ua), null, ua);
  });

  it("regex mới tuyến tính trên đầu vào bất lợi (dấu '+', khoảng trắng, nhãn dài)", () => {
    const shapes: string[] = [
      "+".repeat(1_000_000),
      "+ ".repeat(500_000),
      "+" + " ".repeat(1_000_000) + "x",
      ("+" + "a".repeat(500)).repeat(2_000),
      "+" + "a-".repeat(500_000),
      ("+a.").repeat(300_000),
      "Mozilla/5.0 " + "+x".repeat(500_000),
    ];
    for (const ua of shapes) {
      const t0 = performance.now();
      botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": ua } }));
      const ms = performance.now() - t0;
      assert.ok(ms < 600, `${ms.toFixed(0)}ms trên ${(ua.length / 1000).toFixed(0)}KB`);
    }
  });
});

describe("botReason vòng 10: các nhóm chặn nhầm người thật mà reviewer độc lập tìm ra (65k UA, Matomo 35k)", () => {
  // Dạng Node nhận UA từ socket: byte UTF-8 đọc thành Latin-1 (header HTTP không mang ký tự > 255; UA Cyrillic như "как Gecko" có thật).
  const reason = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": Buffer.from(ua, "utf8").toString("latin1") } }));

  it("A. tên ứng dụng đặt TRƯỚC Mozilla/5.0 (webview, TV, trình duyệt Trung Quốc) không bị chặn", () => {
    for (const ua of [
      "TV Bro/1.0 Mozilla/5.0 (Linux; Android 9; MiTV-AESP0 Build/PI; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0 Safari/537.36",
      "Kik/15.41.0.25917 (Android 10) Mozilla/5.0 (Linux; Android 10; VOG-L29 Build/HUAWEIVOG-L29; wv) AppleWebKit/537.36",
      "MQQBrowser/5.2/Mozilla/5.0 (Linux; Android 4.4.2; HUAWEI) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0 Mobile Safari/537.36",
      "com.douban.group/2.2.0(220) Mozilla/5.0 (Linux; U; Android 4.1.1; zh-cn; MI 2S Build/JRO03L) AppleWebKit/534.30",
      "Zeasn/2.0 NETTV/4.5.0 Mozilla/5.0 (Linux armv7i;CE-HTML/1.0;U;en) AppleWebKit/537.36",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
  });

  it("B. Mozilla viết lệch vẫn là trình duyệt", () => {
    for (const ua of [
      "Mozilla / 5.0 (Linux; Android 9; Titan) AppleWebKit / 537.36 (KHTML, как Gecko) Chrome/80.0 Safari/537.36",
      "Mozilla 5.0 (Linux; U; Android 4.1.2; zh-cn; SCH-I829) UC AppleWebKit 534.31",
      "Mozilla.5.0 (Linux; Android 8.0.0; SM-G950F) AppleWebKit/537.36",
      "Mozzila/5.0(Linux; U; Android 4.2.2; en-us; GT-I9500) AppleWebKit/534.30",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
  });

  it("C. trình duyệt thật ngoài allowlist: HbbTV, Dillo, Emacs-w3m, LG Browser, Huawei HMOS, OneBrowser, UCWEB", () => {
    for (const ua of [
      "HbbTV/1.4.1 (;Panasonic;Viera2017mid;4.101;0007-0000;)",
      "Dillo/3.0.5",
      "Emacs-w3m/1.4.4 w3m/0.5.2",
      "LG Browser/7.00.00(LGE; WEBOS1; 00.00.00) webOS.TV-2015",
      "com.huawei.hmos.browser (2in1;OpenHarmony-6.0.2.130;HAD-W24) NetworkSDK/8.0.10.309",
      "OneBrowser/3.1 (Nokia7230/06.90)",
      "JUC (Linux; U; 2.3.5; zh-cn; MB525; 320*480) UCWEB7.9.3.103/139/999",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
  });

  it("D. điện thoại đời cũ: biến thể dấu phân cách, và hãng thêm vào allowlist", () => {
    for (const ua of [
      "Nokia-1606 UP.Browser/6.3.0.8.c.1.101 (GUI) MMP/2.0", "NOKIA-RM-11/V H190V0700.nep.0 UP.Browser/7.0", "Nokia 3310/1.0",
      "Motorola-V3/0E.41.C3R MIB/2.2.1 Profile/MIDP-2.0", "MOTOROKR-E6/1.0 Linux/2.4.20 Profile/MIDP-2.0", "LGE-VX9100/1.0 UP.Browser/6.2",
      "J-PHONE/4.0/J-SH51/SNJSHA0", "SAMSUNG SGH-E250/1.0 Profile/MIDP-2.0", "SonyEricsson P990i/R100", "HTC_Touch_Diamond2_T5353/1.0 Mozilla/4.0",
      "Cricket-A310/1.0 UP.Browser/6.3.0.7 (GUI) MMP/2.0", "Karbonn K222s WAP-Browser/1.0.0", "TIANYU-KTOUCH/A930/Screen-240X320",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
  });

  it("F1. Java ME của điện thoại đời cũ (SEMC, QVM, ASVM) không phải thư viện Java", () => {
    for (const ua of [
      "SonyEricssonw580i/R4EA Java/SEMC-Java/2.0 Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "Vodafone/1.0/0Vodafone715/B116 Java/QVM/4.1 Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "LG/U990/v1.0 Java/ASVM/1.1 Profile/MIDP-2.1",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
    // …nhưng Java THẬT vẫn bị bắt
    for (const ua of ["Java/1.8.0_292", "Java/17.0.2", "Mozilla/5.0 Java/11"]) assert.notEqual(reason(ua), null, ua);
  });

  it("F2. 'bot' là một TỪ: không khớp Caboto/Abbott/Talbot; tên máy Android có 'bot' không bị chặn", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; Banca Caboto s.p.a.; rv:11.0) like Gecko",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Abbott Labs) AppleWebKit/537.36 Chrome/90.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 7.0; M bot 51) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 6.0; VR BOT 552 PLUS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 8.1.0; XBot Junior) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 7.1.1; M_bot_tab_1150 Build/N9F27F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0 Safari/537.36",
    ]) assert.equal(reason(ua), null, ua.slice(0, 60));
  });

  it("…nhưng crawler thật vẫn bị bắt dù mang UA Android (tên bot nằm NGOÀI đoạn nền tảng)", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)",
      "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
    ]) assert.equal(reason(ua), "ua-regex", ua.slice(0, 60));
  });

  it("URL trần / mailto / AI agent khai danh bị bắt; UA IE nhúng có 'from: http://' là chấp nhận được 1 chặn nhầm", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; alexa site audit/1.0; http://www.alexa.com/help/webmasters; )",
      "Mozilla/5.0 (compatible; um-LN/1.0; mailto: techinfo@ubermetrics-technologies.com)",
      "Mozilla/5.0 (WhatsMyIP.org GeoIP_Lookups) http://whatsmyip.org/ua",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    ]) assert.equal(reason(ua), "ua-regex", ua.slice(0, 60));
  });

  it("in-app webview (Facebook, Instagram, WeChat, Zalo) và Safari-digits không bị chặn kể cả khi không mở đầu bằng Mozilla", () => {
    for (const ua of [
      "[FBAN/FBIOS;FBAV/470.0.0.37.109;FBBV/616171000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5]",
      "Instagram 330.0.0.35.108 Android (33/13; 420dpi; 1080x2209; samsung; SM-G991B; o1s; exynos2100; vi_VN)",
      "MicroMessenger/8.0.40(0x28002837) Process/appbrand0 WeChat/arm64", "Zalo/24.05.1 Android", "Safari5533.22.3 CFNetwork/811.5.4",
    ]) assert.equal(reason(ua), null, ua.slice(0, 50));
  });
});

describe("botReason vòng 11: bản viết lại phải sửa các lỗi reviewer độc lập chỉ ra (và không tạo lỗi mới)", () => {
  const wire = (ua: string) => Buffer.from(ua, "utf8").toString("latin1");
  const reason = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": wire(ua) } }));

  it("2. crawler giấu tên trong ngoặc Android vẫn bị bắt khi có phiên bản/URL/crawler (bản đầu xoá vô điều kiện nên để lọt)", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Android 3.0; YRSpider; +http://www.yunrang.com/yrspider.html)",
      "Mozilla/5.0 (Linux; U; Android 2.3.3; ja-jp; sdk Build/GRI34; Y!J-BRZ/YATSHA crawler; http://help.yahoo.co.jp/help/jp/search/indexing/indexing-15.html) AppleWebKit/533.1",
      "Mozilla/5.0 (Linux; Android 10; GPTBot/1.0 +https://openai.com/gptbot)",
    ]) assert.equal(reason(ua), "ua-regex", ua.slice(0, 70));
    assert.equal(reason("Luminator-robots/2.0"), "ua-regex");
  });

  it("3. Instagram trên Android có tên máy chứa 'bot' ở đoạn lặp lại không bị chặn", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 12; HTC Desire 22 pro Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 267.0.0.18.93 Android (31/12; 420dpi; 1080x2400; HTC; HTC Desire 22 pro; htc_botdugls; mt6877; vi_VN; 442076012)",
      "Mozilla/5.0 (Linux; Android 6.0; M bot 51) AppleWebKit/537.36 Chrome/81.0 Mobile Safari/537.36 Instagram 100.0.0.17.129 Android (23/6.0; 320dpi; 720x1280; M bot; M bot 51; mt6580; vi_VN)",
    ]) assert.equal(reason(ua), null, ua.slice(0, 70));
  });

  it("4. Java ME: HWJa, LGVM, Jbed, và mọi 'Java/<vm>' khi có MIDP/CLDC không phải thư viện Java", () => {
    for (const ua of [
      "Nokia6230/2.0 Java/HWJa/1.0 Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "LG-KP500/V10a Java/LGVM/1.0 Profile/MIDP-2.1 Configuration/CLDC-1.1",
      "Mozilla/5.0 (Linux; U; Android 1.6; en-us; LG-GT540 Build/DRD35) AppleWebKit/528.5+ (KHTML, like Gecko) Version/3.1.2 Mobile Safari/525.20.1 Java/Jbed/7.0",
      "SonyEricssonK800i/R1JG Java/SEMC-Java/2.0 Profile/MIDP-2.0 Configuration/CLDC-1.1",
      "UnknownPhone/1.0 Java/XYZVM/9.9 Profile/MIDP-2.0 Configuration/CLDC-1.1",
    ]) assert.equal(reason(ua), null, ua.slice(0, 70));
    for (const ua of ["Java/1.8.0_292", "Java/17.0.2", "Mozilla/5.0 Java/11", "okhttp/4.12 Java/17"]) assert.notEqual(reason(ua), null, ua);
  });

  it("5. trình duyệt in-app / QQ / Sleipnir / Dolphin / Opera ở giữa chuỗi / MOT-EF… không bị chặn", () => {
    for (const ua of [
      "MQQBrowser/Mini2.2 (SAMSUNG-GT-C3510)", "QQBrowser (Linux; U; zh-cn; MI 2S Build/JRO03L)",
      "360%20Browser/5.3.2 CFNetwork/672.0.8 Darwin/14.0.0", "BaiduHD/2.3.0 CFNetwork/711.1.16 Darwin/14.0.0", "MxBrowser-iPhone/40 CFNetwork/672.0.8",
      "Sleipnir/4.5.1 CFNetwork/673.3 Darwin/13.2.0", "YelpWebView/1.5 Android/6.0.1 YelpApp/9.9.0", "Dolphin 7.4 (iPhone; iPhone OS 7.0.2; de_DE)",
      "UC Browser7.9.0.102/70/352", "HTC MAX 4G Opera/9.5 (Windows NT 5.1; U; en)", "MOT-EF/1.0 Mozilla/4.0", "SIE-SLIK/3.1 UP/4.1.19i",
    ]) assert.equal(reason(ua), null, ua.slice(0, 60));
  });

  it("5b. HbbTV có 'BOTECH' (nhà sản xuất) không bị coi là bot; 'bot' vẫn là một TỪ", () => {
    assert.equal(reason("Mozilla/5.0 (Linux; U; Android 4.4; BOTECH) AppleWebKit/537.36 HbbTV/1.6.1 (+DRM; LGE/KTC/BOTECH; 2018)"), null);
    for (const ua of ["Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "FooBot/1.0", "Mozilla/5.0 (compatible; MJ12bot/v1.4.8)", "SomeBots"]) assert.equal(reason(ua), "ua-regex", ua);
  });

  it("6. parseUserAgent và botReason dùng CÙNG định nghĩa bot (không còn: được redirect nhưng click ghi device:'bot')", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 13; M bot 54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 7.0; VR BOT 552 PLUS) AppleWebKit/537.36 Chrome/78.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; Banca Caboto s.p.a.; rv:11.0) like Gecko",
    ]) {
      assert.equal(reason(ua), null, ua.slice(0, 60));
      assert.notEqual(parseUserAgent(ua).device, "bot", ua.slice(0, 60));
    }
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 (Linux; Android 8.0; Storebot-Google/1.0) Mobile Safari/537.36"]) {
      assert.equal(isDeclaredBotUa(ua), true);
      assert.equal(parseUserAgent(ua).device, "bot", ua.slice(0, 60));
    }
  });

  it("ReDoS: các dạng đầu vào làm lộ bốn regex bậc hai đã gặp (và dạng của chính tôi) đều tuyến tính", () => {
    const rep = (u: string, n: number) => u.repeat(Math.max(1, Math.floor(n)));
    const shapes: [string, string][] = [
      ["mozilla + khoảng trắng + x (reviewer)", "mozilla" + " ".repeat(128_000) + "x"],
      ["com.com.com… (reviewer)", rep("com.", 32_000)],
      ["instagram 1 android ( lặp, không đóng ngoặc (của tôi: 28 giây)", rep("instagram 1 android (", 6_000)],
      ["Mozilla/5.0 (Linux; Android lặp, không đóng ngoặc", rep("Mozilla/5.0 (Linux; Android ", 4_500)],
      ["Android + a/ lặp", "Mozilla/5.0 (Linux; Android " + rep("a/", 60_000) + ")"],
      ["+ lặp", rep("+ ", 64_000)],
      ["mozzzz…", "mo" + "z".repeat(128_000) + "x"],
      ["screen-111…", rep("screen-" + "1".repeat(50), 2_200)],
    ];
    for (const [name, ua] of shapes) {
      const t0 = performance.now();
      isDeclaredBotUa(ua); isNonBrowserUa(ua);
      const ms = performance.now() - t0;
      assert.ok(ms < 150, `${name}: ${ms.toFixed(0)}ms trên ${(ua.length / 1000).toFixed(0)}KB`);
    }
  });
});

describe("botReason vòng 12: phần còn lại reviewer độc lập chỉ ra", () => {
  const reason = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": Buffer.from(ua, "utf8").toString("latin1") } }));

  it("trình duyệt thật ngoài danh sách (NF-Browser, iCab, Konqueror, Uzbl, Xombrero, Flock, Palm, Symbian…) không bị chặn", () => {
    for (const ua of [
      "Amoi 8512/R18.0 NF-Browser/3.3", "INQ1/R3.9.12 NF-Browser/3.5", "iCab/2.9.5 (Macintosh; U; PPC; Mac OS X)", "Doris/1.15 [en] (Symbian)",
      "ASTEL/1.0/J-0511.00/c10/smel", "PHILIPS-Fisio 620/3.1 UP/4.1.19k", "Uzbl (Webkit 1.1.10)", "Xombrero", "Konqueror/15.13 (CentOS Linux 7)",
      "Flock/2.16", "Palmscape/3.0J", "Xiino/1.0.9E",
    ]) assert.equal(reason(ua), null, ua);
  });

  it("app Facebook/Threads lặp lại tên máy có 'bot' (FBDV, Barcelona) không bị chặn; kể cả khi tên app đứng TRƯỚC Mozilla", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 6.0; M bot 51 Build/MRA58K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;FBMF/M bot;FBBD/M bot;FBDV/M bot 51;FBSV/6.0;]",
      "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A; wv) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 Barcelona 289.0.0.77.109 Android (31/12; 420dpi; 1080x2400; vendor; M bot 54; mt6877; vi_VN; 1)",
      "TV Bro/1.0 Mozilla/5.0 (Linux; Android 9; M bot 54 Build/PI; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0 Safari/537.36",
    ]) assert.equal(reason(ua), null, ua.slice(0, 70));
  });

  it("token tự khai có phiên bản chứa 'bot' vẫn bị bắt (BotPants/1.0, GoogleBotV2/2.0) dù 'bot' không đứng một mình", () => {
    for (const ua of ["Mozilla/5.0 (compatible; BotPants/1.0; Linux; +info@copypants.com) KHTML/3.5.5", "Mozilla/5.0 (compatible; GoogleBotV2/2.0)"]) {
      assert.equal(reason(ua), "ua-regex", ua);
    }
    // …nhưng không quay lại lỗi Caboto/BOTECH/Abbott
    for (const ua of ["Mozilla/5.0 (Windows NT 6.1; Trident/7.0; Banca Caboto s.p.a.; rv:11.0) like Gecko", "Mozilla/5.0 (Linux; U; Android 4.4; BOTECH) HbbTV/1.6.1 (+DRM; LGE/KTC/BOTECH; 2018)"]) {
      assert.equal(reason(ua), null, ua.slice(0, 60));
    }
  });

  it("điểm rủi ro dùng CÙNG định nghĩa bot với quyết định redirect ('M bot 54' không còn là unknown-declared-bot)", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; M bot 54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
    assert.equal(reason(ua), null);
    const a = assessRequestSync({ headers: new Headers({ "user-agent": ua, accept: "text/html", "accept-language": "vi", "sec-fetch-mode": "navigate" }) });
    assert.ok(!a.signals.some((x) => x.id === "unknown-declared-bot"), JSON.stringify(a.signals));
    assert.ok(a.score < 30, String(a.score));
  });
});

describe("botReason vòng 14: Yandex Browser (arm_64) và UA do nhà cung cấp công bố", () => {
  const reason = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": Buffer.from(ua, "utf8").toString("latin1") } }));

  it("Yandex Browser trên Android: '(Linux; arm_64; Android 12; M bot 54)' không bị chặn", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; arm_64; Android 12; M bot 54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/24.1.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; arm_64; Android 11; VR BOT 552) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/23.9 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; arm; Android 10; XBot Junior) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0 Mobile Safari/537.36",
    ]) assert.equal(reason(ua), null, ua.slice(0, 70));
  });

  it("…nhưng crawler có phiên bản/URL trong đoạn đó (kể cả khi có token arm_64) vẫn bị bắt", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; arm_64; Android 12; Storebot-Google/1.0) AppleWebKit/537.36 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; arm_64; Android 12; GPTBot/1.0 +https://openai.com/gptbot) AppleWebKit/537.36",
    ]) assert.equal(reason(ua), "ua-regex", ua.slice(0, 70));
  });

  it("UA do chính nhà cung cấp công bố: Amzn-User, Google-CWS, Google-Site-Verification bị bắt", () => {
    for (const ua of [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/116.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; Google-CWS)", "Mozilla/5.0 (compatible; Google-Site-Verification/1.0)",
    ]) assert.equal(reason(ua), "ua-regex", ua.slice(0, 70));
  });

  it("Google Favicon / DuplexWeb-Google / googleweblight CỐ Ý không bị bắt (hình dạng Chrome/WebView theo thiết kế của Google)", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 Google Favicon",
      "Mozilla/5.0 (Linux; Android 11; Pixel 5 Build/RQ3A.210705.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 DuplexWeb-Google/1.0",
    ]) assert.equal(reason(ua), null, ua.slice(0, 70));
  });

  it("ReDoS: nhiều token 'a; ' trước Android và các dạng lặp (nhóm {0,2} mới)", () => {
    const rep = (u: string, n: number) => u.repeat(Math.max(1, Math.floor(n)));
    for (const ua of [
      "Mozilla/5.0 (" + rep("a; ", 40_000) + "Android x)", rep("Mozilla/5.0 (a; b; ", 6_000), "Mozilla/5.0 (" + rep("a_1; ", 30_000),
      rep("Mozilla/5.0 (Linux; arm_64; Android ", 4_000),
    ]) {
      const t0 = performance.now();
      isDeclaredBotUa(ua);
      const ms = performance.now() - t0;
      assert.ok(ms < 150, `${ms.toFixed(0)}ms trên ${(ua.length / 1000).toFixed(0)}KB`);
    }
  });
});

describe("tên máy trùng tên runtime", () => {
  it("điện thoại 'DART KZ07' không bị chấm là thư viện HTTP, còn 'Dart/3.2 (dart:io)' thì có", () => {
    const phone = "Mozilla/5.0 (Linux; Android 5.1; DART KZ07 Build/LMY47I) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0 Mobile Safari/537.36";
    assert.ok(assessRequestSync({ headers: humanChrome({ "user-agent": phone, "sec-ch-ua-platform": '"Android"' }) }).score < 30);
    assert.ok(assessRequestSync({ headers: new Headers({ "user-agent": "Dart/3.2 (dart:io)" }) }).score >= 60);
  });
});

describe("vòng 21", () => {
  it("tên máy trùng tên công cụ (Node, Curl, Playwright…) không bị chấm là automation, nhưng token có phiên bản/URL thì có", () => {
    for (const name of ["Node", "Bun", "Deno", "Curl", "Python", "Wget", "Playwright", "Puppeteer", "Selenium"]) {
      const ua = `Mozilla/5.0 (Linux; Android 13; ${name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`;
      const h = humanChrome({ "user-agent": ua, "sec-ch-ua-platform": '"Android"' });
      assert.ok(assessRequestSync({ headers: h }).score < 30, name);
    }
    const bad = "Mozilla/5.0 (Linux; Android 13; curl/8.4.0) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
    assert.ok(assessRequestSync({ headers: humanChrome({ "user-agent": bad, "sec-ch-ua-platform": '"Android"' }) }).score >= 60);
  });
  it("trường FBDM/FBDV mang bot có phiên bản/URL vẫn bị bắt, tên máy thường thì không", () => {
    const fb = (v: string) => `Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/440.0;FBDM/${v};FBDV/SM-G991B;]`;
    assert.equal(isDeclaredBotUa(fb("GPTBot/1.0 (+https://openai.com/gptbot)")), true);
    assert.equal(isDeclaredBotUa(fb("curl/8.4.0")), true);
    assert.equal(isDeclaredBotUa(fb("{density=2.625,width=1080,height=2280}")), false);
    assert.equal(isDeclaredBotUa(fb("M bot 54")), false);
  });
  it("issueChallenge nén subject quá dài thay vì phát token mà verifyChallenge từ chối", () => {
    assert.throws(() => issueChallenge({ secret: "x".repeat(32), subject: "中".repeat(256) }), RangeError);
    const ok = issueChallenge({ secret: "x".repeat(32), subject: "a".repeat(64) });
    assert.ok(ok.token.length < 1024);
  });
});

describe("vòng 22", () => {
  const droid = (inner: string) => `Mozilla/5.0 (Linux; Android 11; ${inner}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`;
  const score = (ua: string) => assessRequestSync({ headers: humanChrome({ "user-agent": ua, "sec-ch-ua-platform": '"Android"' }) }).score;
  it("tiền tố Build/<id> không che dấu hiệu crawler (phiên bản, URL, crawler) trong đoạn tên máy", () => {
    for (const inner of ["K Build/RP1A curl/8.4.0", "K Build/curl/8.4.0", "K Build/x HeadlessChrome/120.0.0.0", "K Build/x python-requests/2.31.0", "K Build/x GPTBot/1.0 +https://openai.com/gptbot", "K Build/x foo crawler"]) {
      assert.equal(isDeclaredBotUa(droid(inner)) || score(droid(inner)) >= 60, true, inner);
    }
    // Tên máy thật có Build/<id> vẫn là người.
    for (const inner of ["SM-G991B Build/TP1A.220624.014", "Pixel 7 Build/UQ1A.231205.015; wv", "M bot 54 Build/LMY47I"]) {
      assert.equal(isDeclaredBotUa(droid(inner)), false, inner);
      assert.ok(score(droid(inner)) < 30, inner);
    }
  });
  it("điểm và botReason đồng ý về agent AI đặt trong tên máy", () => {
    for (const name of ["Claude-User", "ChatGPT-User", "youbot"]) {
      assert.ok(score(droid(name)) < 30, name);
      assert.equal(isDeclaredBotUa(droid(name)), false, name);
    }
  });
});
