import { strict as assert } from "node:assert";
import test, { describe } from "node:test";
import { assessRequestSync } from "./assess";
import { headerSignals, uaSignals } from "./signals";
import { botReason, BOT_UA_REGEX } from "@/lib/tracking/ua";
import type { HeaderBag } from "./types";

function hb(entries: Record<string, string | undefined>): HeaderBag {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined) map.set(k.toLowerCase(), v);
  }
  return {
    get: (k: string) => map.get(k.toLowerCase()) ?? null,
  };
}

describe("Round 9: State-of-the-Art Algorithmic Bot Detection", () => {
  // ---------------------------------------------------------------------------
  describe("1. Client Hints Brand Mismatch Anti-Spoofing", () => {
    test("Firefox UA with Chromium sec-ch-ua hint is flagged as client-hints-brand-mismatch (weight 45: flag only, UA-switcher extensions look identical)", () => {
      const firefoxUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";
      const headers = hb({
        "user-agent": firefoxUa,
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      });

      const assessment = assessRequestSync({ headers });
      const signalIds = assessment.signals.map((s) => s.id);

      assert.ok(signalIds.includes("client-hints-brand-mismatch"), "Must detect client-hints-brand-mismatch");
      assert.ok(assessment.score >= 30 && assessment.score < 60, `Score must stay in flag tier, got ${assessment.score}`);
    });

    test("Safari macOS UA with Chromium sec-ch-ua hint is flagged as client-hints-brand-mismatch (weight 45: flag only, UA-switcher extensions look identical)", () => {
      const safariUa =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
      const headers = hb({
        "user-agent": safariUa,
        "sec-ch-ua": '"Google Chrome";v="128", "Chromium";v="128"',
        "sec-ch-ua-platform": '"macOS"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      });

      const assessment = assessRequestSync({ headers });
      const signalIds = assessment.signals.map((s) => s.id);

      assert.ok(signalIds.includes("client-hints-brand-mismatch"), "Must detect client-hints-brand-mismatch on Safari");
      assert.ok(assessment.score >= 30 && assessment.score < 60, `Score must stay in flag tier, got ${assessment.score}`);
    });

    test("Real Firefox and Safari without sec-ch-ua never trigger client-hints-brand-mismatch", () => {
      const realFirefox = hb({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.5",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      });
      const realSafari = hb({
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        accept: "text/html,application/xhtml+xml,*/*",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      });

      for (const h of [realFirefox, realSafari]) {
        const a = assessRequestSync({ headers: h });
        const ids = a.signals.map((s) => s.id);
        assert.ok(!ids.includes("client-hints-brand-mismatch"));
        assert.equal(a.score, 0);
      }
    });

    test("Legitimate Chrome browser with matching sec-ch-ua does not trigger brand mismatch", () => {
      const chromeHeaders = hb({
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,vi;q=0.8",
      });

      const a = assessRequestSync({ headers: chromeHeaders });
      assert.ok(!a.signals.map((s) => s.id).includes("client-hints-brand-mismatch"));
      assert.equal(a.score, 0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("2. Fetch Metadata Destination Inconsistency", () => {
    test("mode: navigate paired with dest: script/image/font/style triggers fetch-dest-mismatch (weight 45)", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
      for (const dest of ["script", "image", "font", "style"]) {
        const headers = hb({
          "user-agent": ua,
          "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
          "sec-ch-ua-platform": '"Windows"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": dest,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        });

        const a = assessRequestSync({ headers });
        const ids = a.signals.map((s) => s.id);
        assert.ok(ids.includes("fetch-dest-mismatch"), `Expected fetch-dest-mismatch for dest:${dest}`);
        assert.ok(a.score >= 45, `Score should be >= 45, got ${a.score}`);
      }
    });

    test("mode: navigate paired with dest: empty/embed/frame (prefetch, <embed>) is NOT a mismatch", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
      for (const dest of ["empty", "embed", "frame", "object"]) {
        const headers = hb({
          "user-agent": ua,
          "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
          "sec-ch-ua-platform": '"Windows"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": dest,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        });
        const ids = assessRequestSync({ headers }).signals.map((x) => x.id);
        assert.equal(ids.includes("fetch-dest-mismatch"), false, `dest:${dest}`);
      }
    });

    test("dest: document paired with mode: cors triggers fetch-dest-mismatch (weight 45)", () => {
      const headers = hb({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      });

      const a = assessRequestSync({ headers });
      const ids = a.signals.map((s) => s.id);
      assert.ok(ids.includes("fetch-dest-mismatch"));
      assert.ok(ids.includes("programmatic-fetch"));
      assert.ok(a.score >= 60, `Combined score should be >= 60, got ${a.score}`);
    });

    test("Standard user click with mode: navigate and dest: document has 0 mismatch", () => {
      const headers = hb({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      });

      const a = assessRequestSync({ headers });
      assert.ok(!a.signals.map((s) => s.id).includes("fetch-dest-mismatch"));
      assert.equal(a.score, 0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("3. Expanded Datacenter / Commercial Proxy ASNs", () => {
    test("Cloudflare WARP/Private Relay (AS13335) is NOT datacenter-asn", () => {
      const headers = hb({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="128", "Google Chrome";v="128"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "x-vercel-ip-as-number": "13335",
      });

      const a = assessRequestSync({ headers });
      const ids = a.signals.map((s) => s.id);
      assert.equal(ids.includes("datacenter-asn"), false, "Cloudflare (Private Relay/WARP) la nguoi that");
      assert.equal(a.score, 0);
    });

    test("Major cloud/proxy providers (Leaseweb, Contabo, Scaleway, Alibaba, Tencent, Oracle, Hostinger) trigger datacenter-asn", () => {
      const asns = [16265, 28753, 51167, 12876, 37963, 45102, 132203, 132591, 31898, 47583, 53667, 50673, 54825];
      for (const asn of asns) {
        const headers = hb({
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
          "x-vercel-ip-as-number": String(asn),
        });

        const a = assessRequestSync({ headers });
        assert.ok(a.signals.map((s) => s.id).includes("datacenter-asn"), `Expected datacenter-asn for AS${asn}`);
        assert.equal(a.score, 20);
      }
    });

    test("Residential consumer ISP ASNs (Viettel AS7552, VNPT AS45899, Comcast AS7922) do not trigger datacenter-asn", () => {
      for (const asn of ["7552", "45899", "7922", "18403"]) {
        const headers = hb({
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "vi-VN,vi;q=0.9",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
          "x-vercel-ip-as-number": asn,
        });

        const a = assessRequestSync({ headers });
        assert.ok(!a.signals.map((s) => s.id).includes("datacenter-asn"));
        assert.equal(a.score, 0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe("4. Modern Stealth Scraper & Automation Framework Detection", () => {
    test("New generation scraping tools are identified by botReason and uaSignals", () => {
      const modernScrapers = [
        "crawlee/3.8.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Camoufox/124.0",
        "tls-client/1.7.2",
        "curl-impersonate/0.6.1",
        "Mozilla/5.0 brightdata/1.2",
        "zenrows-crawler/2.0",
        "cloudscraper/1.2.68",
      ];

      for (const ua of modernScrapers) {
        assert.ok(BOT_UA_REGEX.test(ua), `BOT_UA_REGEX should match ${ua}`);
        assert.equal(botReason({ headers: hb({ "user-agent": ua }) }), "ua-regex", `botReason should catch ${ua}`);

        const signals = uaSignals(ua);
        assert.ok(signals.length > 0, `uaSignals should flag ${ua}`);
        assert.ok(signals[0].weight >= 85, `weight should be >= 85 for ${ua}`);
      }
    });

    test("Real mobile and desktop browser UAs are NEVER falsely blocked by botReason", () => {
      const realBrowsers = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.67",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
        "Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
      ];

      for (const ua of realBrowsers) {
        assert.equal(botReason({ headers: hb({ "user-agent": ua }) }), null, `Real browser falsely blocked: ${ua}`);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe("5. ReDoS Safety & Linear Execution Bounds", () => {
    test("BOT_UA_REGEX and HTTP_LIBRARY_UA process 1MB adversarial payloads in < 150ms", () => {
      const adversarial1Mb = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " + "a-".repeat(500000) + " camoufox";
      const start = process.hrtime.bigint();
      const res = BOT_UA_REGEX.test(adversarial1Mb);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

      assert.ok(res);
      assert.ok(elapsedMs < 150, `BOT_UA_REGEX took ${elapsedMs.toFixed(2)}ms (> 150ms) on 1MB`);
    });

    test("headerSignals executes in < 50ms on 500KB input", () => {
      const hugeSecChUa = '"Chromium";v="128", ' + '"TestBrand";v="1", '.repeat(30000);
      const headers = hb({
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
        "sec-ch-ua": hugeSecChUa,
      });

      const start = process.hrtime.bigint();
      const sigs = headerSignals(headers, "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0");
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

      assert.ok(sigs.some((s) => s.id === "client-hints-brand-mismatch"));
      assert.ok(elapsedMs < 50, `headerSignals took ${elapsedMs.toFixed(2)}ms (> 50ms) on 500KB`);
    });
  });
});
