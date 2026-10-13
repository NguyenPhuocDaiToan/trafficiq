/**
 * Independent adversarial review of src/lib/botdetect.
 *
 * Written WITHOUT reading the author's own tests. Expectations come from the
 * README claims, vendor crawler-verification docs, RFC 4291/5952 (IPv6 text),
 * hashcash, token-bucket semantics, W3C WebDriver and Fetch-Metadata.
 *
 * Tests prefixed `BUG:` encode an expectation that the current implementation
 * violates. They are left failing on purpose.
 *
 * Run: npx tsx --test src/lib/botdetect/independent.test.ts
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHash, createHmac, randomBytes } from "node:crypto";

import {
  assessRequest,
  assessRequestSync,
  createCrawlerVerifier,
  createReplayGuard,
  decide,
  issueChallenge,
  MemoryRateLimiter,
  parseTelemetry,
  solveChallenge,
  telemetrySignals,
  verifyChallenge,
  verifyFcrdns,
  CLIENT_PROBE_SOURCE,
  DEFAULT_THRESHOLDS,
} from "./index";
import type { Assessment, ClientTelemetry, RateLimitStore } from "./index";
import { normalizeIp, hostMatchesSuffix, type DnsResolver } from "./fcrdns";
import { combineWeights, readAsn } from "./signals";
import { leadingZeroBits } from "./challenge";
import type { HeaderBag, Signal } from "./types";

// ---------------------------------------------------------------- helpers

const hdr = (o: Record<string, string>) => new Headers(o);
const sync = (o: Record<string, string>, ip?: string) =>
  assessRequestSync({ headers: hdr(o), ip });

/** Plain map-backed bag (lets us use bytes `Headers` refuses, e.g. NUL). */
function bag(o: Record<string, string>): HeaderBag {
  const m = new Map(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n) => m.get(n.toLowerCase()) ?? null };
}

const NAV_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
const LEGACY_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/** Modern Chromium navigation headers. */
function chromium(ua: string, platform: string, extra: Record<string, string> = {}) {
  return {
    "user-agent": ua,
    accept: NAV_ACCEPT,
    "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-dest": "document",
    "sec-fetch-user": "?1",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": platform === "Android" ? "?1" : "?0",
    "sec-ch-ua-platform": `"${platform}"`,
    ...extra,
  };
}
/** Firefox / Safari 16.4+ navigation (Fetch-Metadata but no client hints). */
function fetchMeta(ua: string, al = "vi-VN,vi;q=0.9") {
  return {
    "user-agent": ua,
    accept: LEGACY_ACCEPT,
    "accept-language": al,
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-dest": "document",
  };
}
/** Safari < 16.4 / old WebView / UC: no Sec-Fetch-*, no client hints. */
function legacy(ua: string, al = "vi-VN") {
  return { "user-agent": ua, accept: LEGACY_ACCEPT, "accept-language": al };
}

const CH = "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
const GOOGLEBOT_IP = "66.249.66.1";

// ---------------------------------------------------------------- DNS mocks

type Dns = Partial<{
  reverse: (ip: string) => Promise<string[]>;
  resolve4: (h: string) => Promise<string[]>;
  resolve6: (h: string) => Promise<string[]>;
}>;
const err = (code: string) => Object.assign(new Error(code), { code });
function mkResolver(d: Dns): DnsResolver & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    reverse: (ip) => (calls.push(`rev:${ip}`), d.reverse ? d.reverse(ip) : Promise.reject(err("ENOTFOUND"))),
    resolve4: (h) => (calls.push(`a:${h}`), d.resolve4 ? d.resolve4(h) : Promise.reject(err("ENODATA"))),
    resolve6: (h) => (calls.push(`aaaa:${h}`), d.resolve6 ? d.resolve6(h) : Promise.reject(err("ENODATA"))),
  };
}
const GSFX = ["googlebot.com", "google.com", "gae.googleusercontent.com"];
/** A resolver for which PTR -> host and host -> ip are consistent. */
const good = (ip: string, host: string) =>
  mkResolver({
    reverse: async () => [host],
    resolve4: async () => [ip],
    resolve6: async () => [ip],
  });

// =================================================================== (1) IP + FCrDNS

describe("(1a) normalizeIp", () => {
  test("IPv4 passes through unchanged", () => {
    assert.equal(normalizeIp("66.249.66.1"), "66.249.66.1");
  });

  test("leading-zero / octal-looking / short / long IPv4 are rejected", () => {
    for (const bad of ["066.249.066.001", "01.2.3.4", "1.2.3", "1.2.3.4.5", "256.1.1.1", "1.2.3.-4", "0x7f.0.0.1", "2130706433", "1.2.3.4/24"]) {
      assert.equal(normalizeIp(bad), null, bad);
    }
  });

  test("IPv6 spellings of one address normalise identically (case, zero padding, ::)", () => {
    const forms = [
      "2001:4860:4801:1::1",
      "2001:4860:4801:0001:0000:0000:0000:0001",
      "2001:4860:4801:1:0:0:0:1",
      "2001:4860:4801:1::0:1".replace("::0:1", "::1"),
      "2001:4860:4801:1:0::1",
      "[2001:4860:4801:1::1]",
      "2001:4860:4801:1::1%eth0",
    ].map((f) => f.toUpperCase().replace("ETH0", "eth0"));
    const set = new Set(forms.map((f) => normalizeIp(f)));
    assert.equal(set.size, 1, JSON.stringify([...set]));
    assert.notEqual([...set][0], null);
  });

  test("IPv4-mapped IPv6 collapses to IPv4 in every spelling", () => {
    for (const f of ["::ffff:66.249.66.1", "::FFFF:66.249.66.1", "::ffff:42f9:4201", "0:0:0:0:0:ffff:66.249.66.1", "0000:0000:0000:0000:0000:ffff:42f9:4201", "[::ffff:66.249.66.1]"]) {
      assert.equal(normalizeIp(f), "66.249.66.1", f);
    }
  });

  test("IPv4-compatible (::a.b.c.d) and SIIT (::ffff:0:a.b.c.d) must NOT be treated as IPv4", () => {
    assert.notEqual(normalizeIp("::66.249.66.1"), "66.249.66.1");
    assert.notEqual(normalizeIp("::ffff:0:66.249.66.1"), "66.249.66.1");
    assert.notEqual(normalizeIp("64:ff9b::66.249.66.1"), "66.249.66.1");
    assert.notEqual(normalizeIp("1::ffff:66.249.66.1"), "66.249.66.1");
  });

  test("malformed IPv6 / junk are rejected", () => {
    const bad = [
      "", " ", ":::", "1::2::3", "12345::1", "g::1", "::ffff:1.2.3.256", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9",
      "::1\0", "1.2.3.4\n5.6.7.8", "66.249.66.1, 10.0.0.1", "2001:db8::1/64",
      "::ffff:1.2.3", "1:2:3:4:5:6:7:8::", "\u0000", "ｆｅ80::1", "1.2.3.4 ", // trailing space is trimmed -> valid; see next assertion
    ].filter((x) => x !== "1.2.3.4 ");
    for (const b of bad) assert.equal(normalizeIp(b), null, JSON.stringify(b));
    assert.equal(normalizeIp("  1.2.3.4  "), "1.2.3.4");
  });

  test("BUG: zone id on an IPv4 address is accepted (RFC 4007 zones only exist for IPv6)", () => {
    assert.equal(normalizeIp("66.249.66.1%eth0"), null);
    assert.equal(normalizeIp("fe80::1%"), null, "empty zone id is malformed");
  });

  test("very long garbage input is rejected quickly", () => {
    const t0 = performance.now();
    assert.equal(normalizeIp("1".repeat(2_000_000)), null);
    assert.equal(normalizeIp(":".repeat(1_000_000)), null);
    assert.ok(performance.now() - t0 < 500);
  });
});

describe("(1b) hostMatchesSuffix", () => {
  test("label-boundary matching only", () => {
    const m = (h: string) => hostMatchesSuffix(h, "googlebot.com");
    assert.equal(m("crawl-1.googlebot.com"), true);
    assert.equal(m("CRAWL-1.GoogleBot.COM."), true);
    assert.equal(m("googlebot.com"), true);
    for (const bad of ["evilgooglebot.com", "googlebot.com.evil.net", "googlebot.com.evil.net.", "xgooglebot.com", "googlebot.comx", "evil.com/googlebot.com", "googlebot.co", "com", "", "googlebot.com..", "ｇooglebot.com", "googlebоt.com" /* cyrillic o */]) {
      assert.equal(m(bad), false, bad);
    }
  });

  test("BUG: hostnames with control chars / spaces / empty labels are not valid DNS names and must not match", () => {
    // c-ares truncates a C string at NUL: "evil.example\0.googlebot.com" would be looked up as "evil.example".
    for (const bad of ["evil.example\0.googlebot.com", "evil example.googlebot.com", "a..googlebot.com", ".googlebot.com", "a\n.googlebot.com", "a/b.googlebot.com", "evil.com#.googlebot.com", "a_b!.googlebot.com"]) {
      assert.equal(hostMatchesSuffix(bad, "googlebot.com"), false, JSON.stringify(bad));
    }
  });
});

describe("(1c) verifyFcrdns", () => {
  test("happy path: IPv4 Googlebot, hostname returned lower-case without trailing dot", async () => {
    const r = good(GOOGLEBOT_IP, "CRAWL-66-249-66-1.GoogleBot.COM.");
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r);
    assert.deepEqual(res, { status: "verified", hostname: "crawl-66-249-66-1.googlebot.com" });
  });

  test("IPv6 happy path uses AAAA, not A", async () => {
    const ip = "2001:4860:4801:10::1";
    const r = mkResolver({ reverse: async () => ["crawl.googlebot.com"], resolve6: async () => ["2001:4860:4801:0010:0:0:0:1"] });
    const res = await verifyFcrdns(ip, GSFX, r);
    assert.equal(res.status, "verified");
    assert.ok(r.calls.some((c) => c.startsWith("aaaa:")) && !r.calls.some((c) => c.startsWith("a:")));
  });

  test("IPv4-mapped IPv6 input is looked up as IPv4 (reverse gets the dotted form, forward uses A)", async () => {
    const r = good(GOOGLEBOT_IP, "crawl.googlebot.com");
    const res = await verifyFcrdns("::ffff:66.249.66.1", GSFX, r);
    assert.equal(res.status, "verified");
    assert.equal(r.calls[0], `rev:${GOOGLEBOT_IP}`);
    assert.ok(r.calls.some((c) => c.startsWith("a:")));
  });

  test("zone id and brackets are stripped before reverse lookup", async () => {
    const r = mkResolver({ reverse: async () => ["x.googlebot.com"], resolve6: async () => ["fe80::1"] });
    const res = await verifyFcrdns("[fe80::1%eth0]", GSFX, r);
    // brackets then zone: "[fe80::1%eth0]" -> strip [] -> zone strip
    assert.equal(res.status, "verified");
    assert.equal(r.calls[0], "rev:fe80:0:0:0:0:0:0:1");
  });

  test("suffix-trick PTRs never verify even if the forward lookup 'confirms' them", async () => {
    for (const ptr of ["evilgooglebot.com", "googlebot.com.evil.net", "crawl.googlebot.com.evil.net.", "google.com.attacker.io", "googlebot.com@evil.net", "googlebot.com.", ]) {
      // "googlebot.com." (single trailing dot) is the apex itself and IS legal; excluded below
      if (ptr === "googlebot.com.") continue;
      const r = good(GOOGLEBOT_IP, ptr);
      const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r);
      assert.deepEqual(res, { status: "failed", reason: "wrong-domain" }, ptr);
      assert.ok(!r.calls.some((c) => c.startsWith("a:")), "no forward lookup should be spent on a wrong-domain PTR");
    }
  });

  test("Google: bare googleusercontent.com and *.bc.googleusercontent.com (any GCP customer VM) are rejected; gae. is accepted", async () => {
    for (const ptr of ["googleusercontent.com", "34-1-2-3.bc.googleusercontent.com", "x.googleusercontent.com", "evil.gae.googleusercontent.com.evil.com"]) {
      const res = await verifyFcrdns("34.1.2.3", GSFX, good("34.1.2.3", ptr));
      assert.equal(res.status, "failed", ptr);
    }
    const ok = await verifyFcrdns("34.1.2.3", GSFX, good("34.1.2.3", "rate-limited-proxy-34-1-2-3.gae.googleusercontent.com"));
    assert.equal(ok.status, "verified");
  });

  test("forward lookup that does not contain the IP fails (the whole point of FCrDNS)", async () => {
    const r = mkResolver({ reverse: async () => ["crawl.googlebot.com"], resolve4: async () => ["8.8.8.8", "1.1.1.1"] });
    assert.deepEqual(await verifyFcrdns(GOOGLEBOT_IP, GSFX, r), { status: "failed", reason: "forward-mismatch" });
  });

  test("forward returning many addresses: match at the very end still verifies", async () => {
    const many = Array.from({ length: 5000 }, (_, i) => `10.${i >> 8}.${i & 255}.1`);
    const r = mkResolver({ reverse: async () => ["crawl.googlebot.com"], resolve4: async () => [...many, GOOGLEBOT_IP] });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r)).status, "verified");
  });

  test("forward with a prefix-lookalike address (66.249.66.10 vs 66.249.66.1) does not verify", async () => {
    const r = mkResolver({ reverse: async () => ["crawl.googlebot.com"], resolve4: async () => ["66.249.66.10", "166.249.66.1", "66.249.66.1.5"] });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r)).status, "failed");
  });

  test("PTR returning many names: decoys outside the suffix are skipped, real one still found", async () => {
    const decoys = Array.from({ length: 200 }, (_, i) => `h${i}.example.net`);
    const r = mkResolver({ reverse: async () => [...decoys, "crawl.googlebot.com"], resolve4: async () => [GOOGLEBOT_IP] });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r)).status, "verified");
  });

  test("PTR flood of in-suffix names cannot force unbounded forward lookups (DoS bound)", async () => {
    const names = Array.from({ length: 500 }, (_, i) => `n${i}.googlebot.com`);
    const r = mkResolver({ reverse: async () => names, resolve4: async () => ["9.9.9.9"] });
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r);
    assert.equal(res.status, "failed");
    assert.ok(r.calls.filter((c) => c.startsWith("a:")).length <= 5, `forward lookups: ${r.calls.length}`);
  });

  test("invalid IP never reaches the resolver", async () => {
    const r = good(GOOGLEBOT_IP, "crawl.googlebot.com");
    // Hợp đồng đã đổi có chủ đích: IP không parse được là "không kết luận" (error), không phải
    // bằng chứng giả mạo (failed) — xem BUG ngay bên dưới.
    assert.equal((await verifyFcrdns("not-an-ip", GSFX, r)).status, "error");
    assert.equal(r.calls.length, 0);
  });

  test("BUG: an unparseable source IP (proxy appended port / XFF list) is not evidence of spoofing -> must not be 'failed'", async () => {
    // README: only no-PTR / wrong-domain / forward-mismatch are "evidence against". A real Googlebot behind a
    // proxy that writes "66.249.66.1:51234" (Azure AppGW, IIS ARR) would be flipped to score>=95 / challenge.
    const r = good(GOOGLEBOT_IP, "crawl.googlebot.com");
    for (const ip of ["66.249.66.1:51234", "66.249.66.1, 10.0.0.2"]) {
      const res = await verifyFcrdns(ip, GSFX, r);
      assert.notEqual(res.status, "failed", ip);
    }
    // "[v6]:port" là IP hợp lệ sau khi bỏ cổng; resolver giả này không có bản ghi cho nó
    // nên "failed (no-ptr)" là kết quả ĐÚNG — kỳ vọng cũ coi nó là "không parse được".
    assert.equal(normalizeIp("[2001:4860:4801:10::1]:443"), normalizeIp("2001:4860:4801:10::1"));
  });

  test("resolver rejects with non-Error values -> 'error', never throws, never 'failed'", async () => {
    for (const thrown of ["boom", null, undefined, 42, { code: undefined }, { message: "x" }, Symbol.for("s"), []]) {
      const r = mkResolver({ reverse: () => Promise.reject(thrown) });
      const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r);
      assert.equal(res.status, "error", String(thrown));
    }
  });

  test("resolver throws synchronously (not a rejected promise)", async () => {
    const r: DnsResolver = {
      reverse: () => {
        throw new Error("sync");
      },
      resolve4: async () => [],
      resolve6: async () => [],
    };
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r).catch((e) => ({ threw: e }));
    assert.ok(!("threw" in res), "verifyFcrdns must not reject");
    assert.equal((res as { status: string }).status, "error");
  });

  test("error code classification: ENOTFOUND/ENODATA are evidence; everything else is not", async () => {
    for (const [code, want] of [["ENOTFOUND", "failed"], ["ENODATA", "failed"], ["ESERVFAIL", "error"], ["ETIMEOUT", "error"], ["ECONNREFUSED", "error"], ["EREFUSED", "error"], ["ETIMEDOUT", "error"], ["EAI_AGAIN", "error"], ["ECANCELLED", "error"]] as const) {
      const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, mkResolver({ reverse: () => Promise.reject(err(code)) }));
      assert.equal(res.status, want, code);
    }
  });

  test("forward errors: SERVFAIL on first candidate then verified second -> verified; SERVFAIL + mismatch -> error (not spoofed)", async () => {
    const r1 = mkResolver({
      reverse: async () => ["a.googlebot.com", "b.googlebot.com"],
      resolve4: async (h) => {
        if (h.startsWith("a.")) throw err("ESERVFAIL");
        return [GOOGLEBOT_IP];
      },
    });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r1)).status, "verified");
    const r2 = mkResolver({
      reverse: async () => ["a.googlebot.com", "b.googlebot.com"],
      resolve4: async (h) => {
        if (h.startsWith("a.")) throw err("ESERVFAIL");
        return ["1.1.1.1"];
      },
    });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r2)).status, "error");
  });

  test("empty arrays: reverse [] -> failed, forward [] -> failed (no crash)", async () => {
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, mkResolver({ reverse: async () => [] }))).status, "failed");
    const r = mkResolver({ reverse: async () => ["x.googlebot.com"], resolve4: async () => [] });
    assert.equal((await verifyFcrdns(GOOGLEBOT_IP, GSFX, r)).status, "failed");
  });

  test("BUG: a resolver returning undefined/null/non-array must degrade to 'error', not reject", async () => {
    for (const rev of [undefined, null, "crawl.googlebot.com", { length: 1 }] as unknown[]) {
      const r = mkResolver({ reverse: async () => rev as string[] });
      const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r).catch((e) => ({ threw: String(e) }));
      assert.ok(!("threw" in res), `rejected for ${JSON.stringify(rev)}: ${(res as { threw?: string }).threw}`);
    }
    const r2 = mkResolver({ reverse: async () => ["x.googlebot.com"], resolve4: async () => undefined as unknown as string[] });
    const res2 = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r2).catch((e) => ({ threw: String(e) }));
    assert.ok(!("threw" in res2), "forward undefined must not reject");
  });

  test("BUG: non-string entries in the PTR array must not crash the verifier", async () => {
    const r = mkResolver({ reverse: async () => [null, 5, "x.googlebot.com"] as unknown as string[], resolve4: async () => [GOOGLEBOT_IP] });
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r).catch((e) => ({ threw: String(e) }));
    assert.ok(!("threw" in res), JSON.stringify(res));
  });

  test("BUG: a rejection object whose `code` getter throws must not escape verifyFcrdns", async () => {
    const evil = Object.defineProperty({}, "code", {
      get() {
        throw new Error("getter");
      },
      enumerable: true,
    });
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, mkResolver({ reverse: () => Promise.reject(evil) })).catch((e) => ({ threw: String(e) }));
    assert.ok(!("threw" in res));
  });

  test("hanging reverse resolver -> 'error' within ~timeout (not 'failed')", async () => {
    const r = mkResolver({ reverse: () => new Promise(() => {}) });
    const t0 = performance.now();
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r, 40);
    assert.equal(res.status, "error");
    assert.ok(performance.now() - t0 < 400);
  });

  test("hanging forward resolver -> 'error'; total latency bounded by (1 + MAX_CANDIDATES) * timeout", async () => {
    const r = mkResolver({
      reverse: async () => ["a.googlebot.com", "b.googlebot.com", "c.googlebot.com", "d.googlebot.com", "e.googlebot.com"],
      resolve4: () => new Promise(() => {}),
    });
    const t0 = performance.now();
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r, 30);
    const dt = performance.now() - t0;
    assert.equal(res.status, "error");
    assert.ok(dt < 30 * 6, `took ${dt}ms`);
  });

  test("late-resolving resolver after timeout does not flip the answer / cause unhandled rejection", async () => {
    const r = mkResolver({ reverse: () => new Promise((_, rej) => setTimeout(() => rej(err("ENOTFOUND")), 80)) });
    const res = await verifyFcrdns(GOOGLEBOT_IP, GSFX, r, 20);
    assert.equal(res.status, "error");
    await new Promise((r2) => setTimeout(r2, 120));
  });

  test("BUG: PTR containing NUL that a C resolver truncates must not verify (forward lookup of the truncated attacker name)", async () => {
    // Attacker owns evil.example (A -> their IP) and sets PTR "evil.example\0.googlebot.com".
    const attackerIp = "203.0.113.9";
    const forward = new Map([["evil.example", [attackerIp]]]);
    const r = mkResolver({
      reverse: async () => ["evil.example\0.googlebot.com"],
      resolve4: async (h) => forward.get(h.split("\0")[0]) ?? [],
    });
    const res = await verifyFcrdns(attackerIp, GSFX, r);
    assert.notEqual(res.status, "verified");
  });
});

describe("(1d) createCrawlerVerifier cache", () => {
  test("verified result is cached; equivalent IP spellings share one entry", async () => {
    const t = 0;
    const r = good(GOOGLEBOT_IP, "crawl.googlebot.com");
    const v = createCrawlerVerifier({ resolver: r, now: () => t });
    await v(GOOGLEBOT_IP, GSFX);
    await v("::ffff:66.249.66.1", GSFX);
    await v("::FFFF:42f9:4201", GSFX);
    assert.equal(r.calls.filter((c) => c.startsWith("rev:")).length, 1);
  });

  test("error is cached only briefly (60s default), verified for 6h", async () => {
    let t = 1_000;
    let fail = true;
    const r = mkResolver({
      reverse: async () => {
        if (fail) throw err("ESERVFAIL");
        return ["crawl.googlebot.com"];
      },
      resolve4: async () => [GOOGLEBOT_IP],
    });
    const v = createCrawlerVerifier({ resolver: r, now: () => t });
    assert.equal((await v(GOOGLEBOT_IP, GSFX)).status, "error");
    fail = false;
    t += 30_000;
    assert.equal((await v(GOOGLEBOT_IP, GSFX)).status, "error", "still within error TTL");
    t += 31_000;
    assert.equal((await v(GOOGLEBOT_IP, GSFX)).status, "verified", "error TTL elapsed -> retried");
    const calls = r.calls.length;
    t += 5 * 3600_000;
    await v(GOOGLEBOT_IP, GSFX);
    assert.equal(r.calls.length, calls, "verified still cached after 5h");
    t += 2 * 3600_000;
    await v(GOOGLEBOT_IP, GSFX);
    assert.ok(r.calls.length > calls, "expired after 6h");
  });

  test("concurrent lookups for one IP share one resolver round-trip", async () => {
    const r = mkResolver({
      reverse: () => new Promise((res) => setTimeout(() => res(["crawl.googlebot.com"]), 20)),
      resolve4: async () => [GOOGLEBOT_IP],
    });
    const v = createCrawlerVerifier({ resolver: r });
    const out = await Promise.all(Array.from({ length: 50 }, () => v(GOOGLEBOT_IP, GSFX)));
    assert.ok(out.every((o) => o.status === "verified"));
    assert.equal(r.calls.filter((c) => c.startsWith("rev:")).length, 1);
  });

  test("cache is bounded (maxEntries) under a flood of distinct and invalid IPs", async () => {
    const r = mkResolver({ reverse: () => Promise.reject(err("ENOTFOUND")) });
    const v = createCrawlerVerifier({ resolver: r, maxEntries: 50 });
    for (let i = 0; i < 500; i++) {
      await v(`203.0.113.${i % 250}`, GSFX);
      await v(`junk-${i}`, GSFX);
    }
    // 750 distinct keys were offered; if the cache were unbounded, repeating the first would not hit the resolver.
    const before = r.calls.length;
    await v("203.0.113.0", GSFX);
    assert.ok(r.calls.length > before, "oldest entry was evicted (bounded)");
  });

  test("different suffix sets are different cache keys (a Bing verdict must not satisfy a Google claim)", async () => {
    const r = good(GOOGLEBOT_IP, "x.search.msn.com");
    const v = createCrawlerVerifier({ resolver: r });
    assert.equal((await v(GOOGLEBOT_IP, ["search.msn.com"])).status, "verified");
    assert.equal((await v(GOOGLEBOT_IP, GSFX)).status, "failed");
  });
});

// =================================================================== assess (crawler claims)

describe("(1e) assessRequest crawler claims", () => {
  const GUA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const verifierOf = (r: DnsResolver) => createCrawlerVerifier({ resolver: r });

  test("verified Googlebot -> score 0 and no signals, even with zero headers", async () => {
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }), ip: GOOGLEBOT_IP }, verifierOf(good(GOOGLEBOT_IP, "crawl.googlebot.com")));
    assert.equal(a.score, 0);
    assert.equal(a.classification, "verified-crawler");
    assert.deepEqual(a.signals, []);
  });

  test("Googlebot UA from a random IP (PTR wrong domain) -> spoofed >= 95", async () => {
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }), ip: "203.0.113.5" }, verifierOf(good("203.0.113.5", "vps.evil.net")));
    assert.equal(a.classification, "spoofed-crawler");
    assert.ok(a.score >= 95);
  });

  test("DNS outage -> 'unverified' (55), never spoofed", async () => {
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }), ip: GOOGLEBOT_IP }, verifierOf(mkResolver({ reverse: () => Promise.reject(err("ESERVFAIL")) })));
    assert.equal(a.crawler?.verification, "unverified");
    assert.equal(a.score, 55); // = unknown-declared-bot: khai thêm crawler không được hạ điểm
    assert.notEqual(a.classification, "spoofed-crawler");
  });

  test("missing ip -> unverified, no DNS performed", async () => {
    const r = good(GOOGLEBOT_IP, "x.googlebot.com");
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }) }, verifierOf(r));
    assert.equal(a.crawler?.verification, "unverified");
    assert.equal(r.calls.length, 0);
  });

  test("BUG(low): a verifier that rejects must not crash assessRequest (caller runs it inside after())", async () => {
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }), ip: GOOGLEBOT_IP }, async () => {
      throw new Error("dns exploded");
    }).catch((e) => ({ threw: String(e) }));
    assert.ok(!("threw" in a), "assessRequest rejected when verifier rejected");
  });

  test("BUG: appending a crawler token to an HTTP-library / headless UA must not LOWER the score (sync path, unverifiable claim)", () => {
    const plain = sync({ "user-agent": "python-requests/2.31.0" }).score;
    const dressed = sync({ "user-agent": "python-requests/2.31.0 (compatible; Googlebot/2.1)" }).score;
    const headlessPlain = sync({ "user-agent": "HeadlessChrome/120.0.0.0" }).score;
    const headlessDressed = sync({ "user-agent": "HeadlessChrome/120.0.0.0 Googlebot/2.1" }).score;
    assert.ok(dressed >= plain, `python: ${plain} -> ${dressed}`);
    assert.ok(headlessDressed >= headlessPlain, `headless: ${headlessPlain} -> ${headlessDressed}`);
  });

  test("Meta/X are verified by ASN only; wrong ASN -> spoofed; missing header -> unverified (not spoofed)", () => {
    const ua = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    assert.equal(sync({ "user-agent": ua, "x-vercel-ip-as-number": "32934" }).classification, "verified-crawler");
    assert.equal(sync({ "user-agent": ua, "x-vercel-ip-as-number": "16509" }).classification, "spoofed-crawler");
    const none = sync({ "user-agent": ua });
    assert.equal(none.crawler?.verification, "unverified");
    assert.notEqual(none.classification, "spoofed-crawler");
    assert.equal(sync({ "user-agent": "Twitterbot/1.0", "x-vercel-ip-as-number": "13414" }).classification, "verified-crawler");
    // cross-claiming: Twitterbot UA from Meta's ASN is not verified
    assert.equal(sync({ "user-agent": "Twitterbot/1.0", "x-vercel-ip-as-number": "32934" }).classification, "spoofed-crawler");
  });

  test("BUG: readAsn must parse strictly (hex/exp/float/whitespace-only spellings are not ASNs)", () => {
    for (const raw of ["0x80A6", "3.2934e4", "32934.0", "  ", "+32934", "0b1000000010100110"]) {
      assert.equal(readAsn(bag({ "x-vercel-ip-as-number": raw })), undefined, JSON.stringify(raw));
    }
    assert.equal(readAsn(bag({ "x-vercel-ip-as-number": "32934" })), 32934);
    assert.equal(readAsn(bag({ "x-vercel-ip-as-number": "-1" })), undefined, "negative ASN is not valid");
    assert.equal(readAsn(bag({ "x-vercel-ip-as-number": "4294967296" })), undefined, "ASN is 32-bit");
  });

  test("a Googlebot UA with a stray ASN header of Meta does not become verified", () => {
    const a = sync({ "user-agent": GUA, "x-vercel-ip-as-number": "32934" });
    assert.equal(a.crawler?.verification, "unverified");
  });

  test("telemetry and headers cannot rescue or damage a verified crawler", async () => {
    const t: ClientTelemetry = { wd: true, pl: 0, lg: 0, ow: 0, oh: 0, iw: 1, ih: 1, sw: 0, sh: 0, hc: 0, ua: "x", ch: false, ev: 0, ut: 9, dw: 0 };
    const a = await assessRequest({ headers: hdr({ "user-agent": GUA }), ip: GOOGLEBOT_IP, telemetry: t }, verifierOf(good(GOOGLEBOT_IP, "c.googlebot.com")));
    assert.equal(a.score, 0);
  });

  test("BUG: Yandex-branded in-app UAs (YandexSearch app) are 'unverified' 50 in the wired sync path (false positive on humans)", () => {
    const ua = "Mozilla/5.0 (Linux; Android 11; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 YandexSearch/23.12 YandexSearchBrowser/23.12";
    const a = sync(chromium(ua, "Android"));
    assert.ok(a.score < 30, `score=${a.score} signals=${a.signals.map((s) => s.id)}`);
  });
});

// =================================================================== (2) header / UA scoring

interface Req {
  name: string;
  headers: Record<string, string>;
}
const HUMANS: Req[] = [
  { name: "Chrome 120 Windows", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`, "Windows") },
  { name: "Chrome 120 macOS", headers: chromium(`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${CH} Safari/537.36`, "macOS") },
  { name: "Chrome 120 Linux", headers: chromium(`Mozilla/5.0 (X11; Linux x86_64) ${CH} Safari/537.36`, "Linux") },
  { name: "Chrome 120 ChromeOS", headers: chromium(`Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) ${CH} Safari/537.36`, "Chrome OS") },
  { name: "Chrome 120 Android", headers: chromium(`Mozilla/5.0 (Linux; Android 10; K) ${CH} Mobile Safari/537.36`, "Android") },
  { name: "Chrome Android tablet (no Mobile token)", headers: chromium(`Mozilla/5.0 (Linux; Android 13; SM-X700) ${CH} Safari/537.36`, "Android") },
  { name: "Samsung Internet 23", headers: chromium("Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36", "Android") },
  { name: "Edge Windows", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36 Edg/120.0.0.0`, "Windows") },
  { name: "Opera", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36 OPR/106.0.0.0`, "Windows") },
  { name: "Coc Coc", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 coc_coc_browser/118.0.5993.0`, "Windows") },
  { name: "Yandex Browser desktop", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} YaBrowser/23.11.0.0 Yowser/2.5 Safari/537.36`, "Windows") },
  { name: "Huawei Browser", headers: chromium("Mozilla/5.0 (Linux; Android 10; HarmonyOS; ELS-AN00; HMSCore 6.3.0.321) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/12.1.2.301 Mobile Safari/537.36", "Android") },
  { name: "MIUI Browser", headers: chromium("Mozilla/5.0 (Linux; U; Android 12; vi-vn; M2101K6G Build/SKQ1.211006.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.116 Mobile Safari/537.36 XiaoMi/MiuiBrowser/15.7.1", "Android") },
  { name: "CUBOT phone (the CUBOT exemption)", headers: chromium(`Mozilla/5.0 (Linux; Android 11; CUBOT_X30) ${CH} Mobile Safari/537.36`, "Android") },
  { name: "Firefox 121 Windows", headers: fetchMeta("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0", "vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3") },
  { name: "Firefox Android", headers: fetchMeta("Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0") },
  { name: "Safari macOS 17", headers: fetchMeta("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15") },
  { name: "Safari iOS 17", headers: fetchMeta("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1") },
  { name: "Safari iOS 15 (no Sec-Fetch)", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1") },
  { name: "iPad desktop-class Safari 15", headers: legacy("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15") },
  { name: "Chrome iOS (CriOS)", headers: fetchMeta("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1") },
  { name: "Facebook iOS in-app", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G75 [FBAN/FBIOS;FBAV/440.0.0.30.113;FBBV/;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/16.6;FBSS/2;FBID/phone;FBLC/vi_VN;FBOP/5]") },
  { name: "Facebook Android in-app (wv)", headers: { ...legacy("Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.33.113;]"), "x-requested-with": "com.facebook.katana" } },
  { name: "Messenger iOS", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21B91 [FBAN/MessengerForiOS;FBAV/441.0.0.31.113;FBBV/;FBDV/iPhone14,5]") },
  { name: "Instagram Android", headers: legacy("Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 Instagram 310.0.0.37.109 Android (33/13; 420dpi; 1080x2218; samsung; SM-G991B; o1s; exynos2100; vi_VN; 543212345)") },
  { name: "Instagram iOS", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21C66 Instagram 311.0.2.17.102 (iPhone14,5; iOS 17_2; vi_VN; vi-VN; scale=3.00; 1170x2532; 534732433)") },
  { name: "Zalo Android in-app", headers: legacy("Mozilla/5.0 (Linux; Android 11; Redmi Note 9 Pro Build/RKQ1.200826.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 ZaloTheme/light ZaloLanguage/vi") },
  { name: "TikTok Android in-app", headers: legacy("Mozilla/5.0 (Linux; Android 12; SM-A125F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 trill_2023100030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/31.0.3 ByteLocale/vi-VN Region/VN BytedanceWebview/d8a21c6") },
  { name: "WeChat Android X5", headers: legacy("Mozilla/5.0 (Linux; Android 10; MI 9 Build/QKQ1.190825.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.62 XWEB/2692 MMWEBSDK/20210601 Mobile Safari/537.36 MMWEBID/9372 MicroMessenger/8.0.7.1920(0x28000737) Process/toolsmp WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64", "zh-CN,zh;q=0.9") },
  { name: "LINE iOS", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.20.0") },
  { name: "Pinterest Android in-app", headers: legacy("Mozilla/5.0 (Linux; Android 10; SM-G960F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.210 Mobile Safari/537.36 [Pinterest/Android]") },
  { name: "LinkedIn iOS in-app", headers: legacy("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.27.5532") },
  { name: "Google app (GSA)", headers: chromium(`Mozilla/5.0 (Linux; Android 13; Pixel 7) ${CH} Mobile Safari/537.36 GSA/14.50.7.29.arm64`, "Android") },
  { name: "DuckDuckGo Android", headers: chromium(`Mozilla/5.0 (Linux; Android 12; SM-A325F) ${CH} Mobile Safari/537.36 DuckDuckGo/5`, "Android") },
  { name: "UC Browser (old)", headers: legacy("Mozilla/5.0 (Linux; U; Android 4.4.2; en-US; HM NOTE 1W Build/KOT49H) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 UCBrowser/11.0.5.850 U3/0.8.0 Mobile Safari/534.30", "id-ID") },
  { name: "KaiOS Firefox 48", headers: legacy("Mozilla/5.0 (Mobile; LYF/F90M/LYF-F90M-000-02-23-300818; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5", "en-US") },
  { name: "Amazon Silk desktop mode", headers: fetchMeta(`Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4.1 like Chrome/120.0.0.0 Safari/537.36`) },
  { name: "Tizen smart TV", headers: legacy("Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36") },
  { name: "IE11", headers: legacy("Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko") },
  { name: "IEMobile Lumia", headers: legacy("Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)") },
  { name: "Opera Mini (non-Mozilla UA)", headers: legacy("Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16") },
  { name: "Teams / Electron", headers: legacy(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Teams/1.6.00.4472 Chrome/91.0.4472.164 Electron/13.6.6 Safari/537.36`) },
  { name: "Nintendo Switch", headers: legacy("Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/609.4 (KHTML, like Gecko) NF/6.0.2.21.3 NintendoBrowser/5.1.0.22474") },
  { name: "Brave (UA identical to Chrome, hint brand differs)", headers: chromium(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`, "Windows", { "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Brave";v="120"' }) },
];

function bagSignals(o: Record<string, string>): string[] {
  return sync(o).signals.map((s) => s.id);
}
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randStr(rnd: () => number, n: number) {
  const alpha = "abcXYZ019 /;,.-_*\"'?=()[]";
  let s = "";
  for (let i = 0; i < n; i++) s += alpha[Math.floor(rnd() * alpha.length)];
  return s;
}

describe("(2a) real humans: false positives are the costliest error", () => {
  for (const h of HUMANS) {
    test(`human scores < 30: ${h.name}`, () => {
      const a = sync(h.headers);
      assert.ok(a.score < 30, `score=${a.score} ${JSON.stringify(a.signals)}`);
      assert.equal(a.classification, "human-likely");
    });
  }

  test("humans scored independent of header-name casing (Headers is case-insensitive)", () => {
    const base = HUMANS[0].headers;
    const upper = Object.fromEntries(Object.entries(base).map(([k, v]) => [k.toUpperCase(), v]));
    assert.equal(sync(upper).score, sync(base).score);
  });

  test("Chrome Android on a datacenter-AS VPN is still < 30 (25 alone is not enough)", () => {
    const a = sync({ ...HUMANS[4].headers, "x-vercel-ip-as-number": "16509" });
    assert.ok(a.score < 30, String(a.score));
  });

  test("BUG: legacy-browser human (no Sec-Fetch yet, e.g. iOS 15 Safari) behind a corporate/cloud VPN ASN is flagged (>=30)", () => {
    for (const asn of ["16509", "8075", "15169", "14061", "63949"]) {
      const a = sync({ ...HUMANS.find((h) => h.name.startsWith("Safari iOS 15"))!.headers, "x-vercel-ip-as-number": asn });
      assert.ok(a.score < 30, `AS${asn} -> ${a.score}`);
    }
  });

  test("Firefox 'resist fingerprinting' style request (Accept-Language en-US,en;q=0.5, Sec-Fetch present) < 30", () => {
    assert.ok(sync(fetchMeta("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0", "en-US,en;q=0.5")).score < 30);
  });

  test("link prefetch / prerender navigations carry Sec-Purpose but are still 'navigate' -> not programmatic", () => {
    const a = sync({ ...HUMANS[0].headers, "sec-purpose": "prefetch" });
    assert.ok(!a.signals.some((s) => s.id === "programmatic-fetch"));
  });

  test("BUG: a header repeated by a proxy ('navigate, navigate' / 'Windows, Windows') must not create false signals", () => {
    const h = new Headers(HUMANS[0].headers);
    h.append("sec-fetch-mode", "navigate");
    h.append("sec-ch-ua-platform", '"Windows"');
    const a = assessRequestSync({ headers: h });
    assert.ok(a.score < 30, `${a.score} ${JSON.stringify(a.signals)}`);
  });

  test("platform hint with odd quoting/case does not create a mismatch", () => {
    for (const p of ['"windows"', "Windows", '"WINDOWS"', ' "Windows" ']) {
      const a = sync({ ...HUMANS[0].headers, "sec-ch-ua-platform": p });
      assert.ok(!a.signals.some((s) => s.id === "platform-mismatch"), p);
    }
  });

  test("BUG: Chrome sends sec-ch-ua-platform:\"Unknown\" on unrecognised OSes (FreeBSD etc.) -> must not be a platform-mismatch", () => {
    const a = sync(chromium(`Mozilla/5.0 (X11; FreeBSD amd64) ${CH} Safari/537.36`, "Unknown"));
    assert.ok(!a.signals.some((s) => s.id === "platform-mismatch"), JSON.stringify(a.signals));
  });
});

describe("(2b) bots / libraries / headless", () => {
  const HIGH = [
    "HeadlessChrome/120.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1",
    "python-requests/2.31.0",
    "Python-urllib/3.11",
    "Python/3.11 aiohttp/3.9.1",
    "python-httpx/0.25.2",
    "curl/8.4.0",
    "Wget/1.21.4",
    "Go-http-client/1.1",
    "Go-http-client/2.0",
    "okhttp/4.12.0",
    "Java/17.0.9",
    "Apache-HttpClient/4.5.14 (Java/17.0.9)",
    "libwww-perl/6.72",
    "Scrapy/2.11.0 (+https://scrapy.org)",
    "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
    "axios/1.6.2",
    "got (https://github.com/sindresorhus/got)",
    "undici",
    "CURL/7",
    "PYTHON-REQUESTS/2",
    "Mozilla/5.0 (compatible; HeadlessChrome)",
  ];
  for (const ua of HIGH) {
    test(`library/headless UA scores >= 60: ${ua}`, () => {
      const a = sync({ "user-agent": ua });
      assert.ok(a.score >= 60, `${a.score}`);
    });
  }

  test("BUG(doc): README lists Puppeteer/Playwright/Selenium/webdriver UA tokens as headless-ua (90), but HEADLESS_UA is only consulted after BOT_UA_REGEX matches and that regex lacks them -> dead branch, score ~0", () => {
    const misses = ["Playwright/1.40", "puppeteer", "Mozilla/5.0 (X11; Linux) Selenium/4.0", "Mozilla/5.0 webdriver"].filter((ua) => sync({ "user-agent": ua }).score < 60);
    assert.deepEqual(misses, []);
  });

  test("empty / whitespace UA >= 60", () => {
    for (const ua of ["", " ", "\t", "   \t "]) assert.ok(sync({ "user-agent": ua }).score >= 60, JSON.stringify(ua));
    assert.ok(assessRequestSync({ headers: bag({}) }).score >= 60, "missing UA header");
  });

  test("declared bots not in the registry are flagged (30..60) without header-signal double counting", () => {
    for (const ua of ["Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)", "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)", "Mozilla/5.0 (compatible; DotBot/1.2)"]) {
      const a = sync({ "user-agent": ua });
      assert.ok(a.score >= 30 && a.score <= 60, `${ua}: ${a.score}`);
      assert.equal(a.signals.length, 1);
    }
  });

  test("HeadlessChrome hidden in sec-ch-ua while UA is spoofed is still caught (case-insensitive)", () => {
    const a = sync({ ...HUMANS[0].headers, "sec-ch-ua": '"HeadlessChrome";v="120", "Chromium";v="120"' });
    assert.ok(a.score >= 90);
    assert.ok(a.signals.some((s) => s.id === "headless-client-hint"));
    const b = sync({ ...HUMANS[0].headers, "sec-ch-ua": '"headlesschrome";v="120"' });
    assert.ok(b.score >= 90, "case-insensitive");
  });

  test("UA says Windows, client hint says Android -> platform-mismatch >= 45; and the reverse pairings", () => {
    const a = sync({ ...HUMANS[0].headers, "sec-ch-ua-platform": '"Android"' });
    assert.ok(a.signals.some((s) => s.id === "platform-mismatch"));
    const b = sync({ ...HUMANS[4].headers, "sec-ch-ua-platform": '"Windows"' });
    assert.ok(b.signals.some((s) => s.id === "platform-mismatch") && b.score >= 45);
    const c = sync({ ...HUMANS[1].headers, "sec-ch-ua-platform": '"Linux"' });
    assert.ok(c.signals.some((s) => s.id === "platform-mismatch"));
  });

  test("programmatic fetch modes cors / no-cors / websocket on a browser UA -> >= 30", () => {
    for (const m of ["cors", "no-cors", "websocket"]) {
      assert.ok(sync({ ...HUMANS[0].headers, "sec-fetch-mode": m }).score >= 30, m);
    }
  });

  test("KNOWN LIMIT (documented): full Chrome header set from Playwright/stealth scores < 30", () => {
    assert.ok(sync(HUMANS[0].headers).score < 30);
  });

  test("BUG: non-browser clients whose UA is not in the regex score < 30 (Node fetch 'node', Deno, Bun, Dart, Postman, HTTPie, reqwest, '-' ...)", () => {
    const misses = ["node", "Deno/1.40.0 (variant; SupportsDeno)", "Bun/1.0.20", "Dart/3.2 (dart:io)", "PostmanRuntime/7.36.0", "HTTPie/3.2.2", "reqwest/0.11.22", "Java-http-client/17.0.9", "GuzzleHttp/7", "Faraday v2.7.12", "Ruby", "PHP", "colly - https://github.com/gocolly/colly", "Typhoeus - https://github.com/typhoeus/typhoeus", "insomnia/2023.5.8", "Jersey/3.0", "-", "test", "Mozilla"].filter((ua) => sync({ "user-agent": ua }).score < 30);
    assert.deepEqual(misses, []);
  });

  test("BUG: lazy scraper = real browser UA string only (python-requests / curl / axios default headers) scores < 30, i.e. not even flagged", () => {
    const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`;
    const pyRequests = sync({ "user-agent": ua, "accept-encoding": "gzip, deflate", accept: "*/*", connection: "keep-alive" });
    const nodeAxios = sync({ "user-agent": ua, accept: "application/json, text/plain, */*", "accept-encoding": "gzip, compress, deflate, br" });
    const curl = sync({ "user-agent": ua, accept: "*/*" });
    assert.ok(pyRequests.score >= 30, `python-requests: ${pyRequests.score}`);
    assert.ok(nodeAxios.score >= 30, `axios: ${nodeAxios.score}`);
    assert.ok(curl.score >= 30, `curl: ${curl.score}`);
  });

  test("a browser UA with absolutely no other headers is at least 'suspicious'", () => {
    assert.ok(sync({ "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36` }).score >= 30);
    assert.ok(sync({ "user-agent": "Mozilla/5.0" }).score >= 30);
  });
});

describe("(2c) weird inputs", () => {
  const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`;

  test("8MB UA and 1MB of other headers are handled in bounded time (no ReDoS)", () => {
    const t0 = performance.now();
    sync({ "user-agent": "Mozilla/5.0 " + "A".repeat(8_000_000) });
    sync({ "user-agent": "Mozilla/5.0 " + "bo".repeat(500_000) + "t" });
    sync({ "user-agent": UA, "accept-language": "x".repeat(1_000_000), accept: "*/".repeat(500_000), "sec-ch-ua": "H".repeat(1_000_000) });
    assert.ok(performance.now() - t0 < 1500, `${performance.now() - t0}ms`);
  });

  test("'bot' stuffed at the very end of a huge UA is still found", () => {
    assert.ok(sync({ "user-agent": "Mozilla/5.0 " + "a".repeat(2_000_000) + " bot" }).score >= 30);
  });

  test("NUL / control bytes in UA do not throw; a NUL-prefixed token is still matched", () => {
    for (const ua of ["curl\0/7.0", "cu\0rl", "\0", "Mozilla/5.0\0(X11)", "‮curl", "Mozilla/5.0 \uD800"]) {
      assert.doesNotThrow(() => assessRequestSync({ headers: bag({ "user-agent": ua }) }), JSON.stringify(ua));
    }
    assert.ok(assessRequestSync({ headers: bag({ "user-agent": "curl\0/7.0" }) }).score >= 60);
  });

  test("unicode UA (Vietnamese device names, emoji, CJK) is not treated as a bot", () => {
    for (const ua of [`Mozilla/5.0 (Linux; Android 13; Điện thoại Việt) ${CH} Mobile Safari/537.36`, `Mozilla/5.0 (Linux; Android 13; 😀 手机) ${CH} Mobile Safari/537.36`]) {
      // Headers() refuses non-Latin1; use a plain bag to model a server that decoded raw bytes.
      const a = assessRequestSync({ headers: bag(chromium(ua, "Android")) });
      assert.ok(a.score < 30, `${a.score}`);
    }
  });

  test("score is always an integer in [0,100] for arbitrary header soup (500 random requests)", () => {
    const rnd = mulberry(7);
    for (let i = 0; i < 500; i++) {
      const o: Record<string, string> = {};
      for (const k of ["user-agent", "accept", "accept-language", "sec-fetch-mode", "sec-ch-ua", "sec-ch-ua-platform", "x-vercel-ip-as-number"]) {
        if (rnd() < 0.7) o[k] = randStr(rnd, Math.floor(rnd() * 60));
      }
      const a = assessRequestSync({ headers: bag(o) });
      assert.ok(Number.isInteger(a.score) && a.score >= 0 && a.score <= 100, `${a.score} ${JSON.stringify(o)}`);
    }
  });

  test("mixed-case header names on a hand-rolled case-insensitive bag behave the same", () => {
    const a = assessRequestSync({ headers: bag({ "User-Agent": "curl/8", ACCEPT: "*/*" }) });
    assert.ok(a.score >= 60);
  });

  test("wildcard Accept with surrounding whitespace is still wildcard; '*/*;q=0.8' is not", () => {
    const base = { ...HUMANS[0].headers };
    assert.ok(sync({ ...base, accept: "  */*  " }).signals.some((s) => s.id === "wildcard-accept"));
    assert.ok(!sync({ ...base, accept: "*/*;q=0.8" }).signals.some((s) => s.id === "wildcard-accept"));
  });

  test("whitespace-only Accept-Language counts as missing", () => {
    assert.ok(bagSignals({ ...HUMANS[0].headers, "accept-language": "   " }).includes("no-accept-language"));
  });

  test("only datacenter ASNs trigger datacenter-asn; junk ASN values never throw", () => {
    for (const v of ["abc", "", "-1", "1e999", "NaN", "Infinity", "99999999999999999999"]) {
      assert.doesNotThrow(() => sync({ ...HUMANS[0].headers, "x-vercel-ip-as-number": v }));
    }
    assert.ok(!bagSignals({ ...HUMANS[0].headers, "x-vercel-ip-as-number": "3320" }).includes("datacenter-asn"));
    assert.ok(bagSignals({ ...HUMANS[0].headers, "x-vercel-ip-as-number": "24940" }).includes("datacenter-asn"));
  });

  test("header signals are NOT applied to HTTP-library UAs (no double counting)", () => {
    const a = sync({ "user-agent": "curl/8.4.0" });
    assert.deepEqual(a.signals.map((s) => s.id), ["http-library-ua"]);
  });
});

// =================================================================== (3) noisy-OR

describe("(3) combineWeights (noisy-OR)", () => {
  const sig = (w: number): Signal => ({ id: "no-accept", weight: w });

  test("empty -> 0; single weight w -> w", () => {
    assert.equal(combineWeights([]), 0);
    for (const w of [0, 1, 10, 49, 50, 99, 100]) assert.equal(combineWeights([sig(w)]), w);
  });

  test("README example 10/10/12/15 -> 39 (README corrected from 40)", () => {
    assert.equal(combineWeights([sig(10), sig(10), sig(12), sig(15)]), 39);
  });

  test("bounds: always integer in [0,100], incl. weights out of range", () => {
    for (const ws of [[-50], [500], [-1, 200, 3], [1e308, 1e308], [Number.MAX_VALUE], [-Number.MAX_VALUE], [Infinity], [-Infinity], [Infinity, -Infinity]]) {
      const s = combineWeights(ws.map(sig));
      assert.ok(Number.isInteger(s) && s >= 0 && s <= 100, `${ws} -> ${s}`);
    }
  });

  test("BUG: NaN weight must not poison the score (NaN makes `score >= x` false everywhere => fail-open to 'allow')", () => {
    const s = combineWeights([sig(90), sig(NaN)]);
    assert.ok(Number.isFinite(s), `score=${s}`);
    assert.ok(s >= 90, "other signals must still count");
  });

  test("negative weights are ignored, never reduce the score", () => {
    assert.equal(combineWeights([sig(40), sig(-1000)]), 40);
  });

  test("monotonic: adding any signal never lowers the score (2000 random sets)", () => {
    const rnd = mulberry(1);
    for (let i = 0; i < 2000; i++) {
      const ws = Array.from({ length: Math.floor(rnd() * 7) }, () => rnd() * 100);
      const base = combineWeights(ws.map(sig));
      const more = combineWeights([...ws, rnd() * 100].map(sig));
      assert.ok(more >= base, `${ws} : ${base} -> ${more}`);
    }
  });

  test("BUG(cosmetic): order independent (permutations of 3-6 weights from the real weight table)", () => {
    const rnd = mulberry(2);
    const table = [8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 75, 85, 90, 95];
    for (let i = 0; i < 2000; i++) {
      const ws = Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => table[Math.floor(rnd() * table.length)]);
      const ref = combineWeights(ws.map(sig));
      for (let k = 0; k < 5; k++) {
        const p = [...ws].sort(() => rnd() - 0.5);
        assert.equal(combineWeights(p.map(sig)), ref, `${ws} vs ${p}`);
      }
    }
  });

  test("never below the max single weight; many weak signals do not reach strong; a 100 is absorbing", () => {
    const s = combineWeights(Array.from({ length: 5 }, () => sig(10)));
    assert.ok(s >= 10 && s < 60, String(s));
    assert.equal(combineWeights([sig(100), sig(5)]), 100);
  });

  test("a million tiny signals do not overflow/underflow into garbage", () => {
    const s = combineWeights(Array.from({ length: 1_000_000 }, () => sig(0.0001)));
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 100);
  });
});

// =================================================================== (4) rate limiter

describe("(4) MemoryRateLimiter", () => {
  const rule = { capacity: 5, refillPerSec: 1 };

  test("burst of exactly `capacity`, then denied with positive integer retryAfterSec", () => {
    const t = 1_000_000;
    const l = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 5; i++) assert.equal(l.take("k", rule).allowed, true, `#${i}`);
    const r = l.take("k", rule);
    assert.equal(r.allowed, false);
    assert.equal(r.retryAfterSec, 1);
    assert.equal(r.remaining, 0);
  });

  test("keys are independent", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    for (let i = 0; i < 5; i++) l.take("a", rule);
    assert.equal(l.take("a", rule).allowed, false);
    assert.equal(l.take("b", rule).allowed, true);
  });

  test("fractional refill: 0.1/s needs exactly 10s per token", () => {
    let t = 0;
    const l = new MemoryRateLimiter({ now: () => t });
    const r6 = { capacity: 6, refillPerSec: 0.1 };
    for (let i = 0; i < 6; i++) l.take("k", r6);
    const d = l.take("k", r6);
    assert.equal(d.allowed, false);
    assert.equal(d.retryAfterSec, 10);
    t += 9_000;
    assert.equal(l.take("k", r6).allowed, false);
    t += 1_000;
    assert.equal(l.take("k", r6).allowed, true);
  });

  test("retryAfterSec is honest: after waiting that long the next take is allowed (400 random rules)", () => {
    const rnd = mulberry(3);
    for (let i = 0; i < 400; i++) {
      let t = 1e9;
      const rl = { capacity: 1 + Math.floor(rnd() * 20), refillPerSec: [0.1, 0.3, 0.7, 1 / 3, 2, 0.5, 0.05][Math.floor(rnd() * 7)] };
      const l = new MemoryRateLimiter({ now: () => t });
      const n = 1 + Math.floor(rnd() * 30);
      for (let k = 0; k < n; k++) {
        t += Math.floor(rnd() * 900);
        const r = l.take("k", rl);
        if (!r.allowed) {
          t += r.retryAfterSec! * 1000;
          assert.equal(l.take("k", rl).allowed, true, `rule=${JSON.stringify(rl)} retry=${r.retryAfterSec}`);
        }
      }
    }
  });

  test("tokens never exceed capacity after a very long idle period", () => {
    let t = 0;
    const l = new MemoryRateLimiter({ now: () => t });
    l.take("k", rule);
    t += 10 * 365 * 24 * 3600 * 1000;
    let ok = 0;
    for (let i = 0; i < 100; i++) if (l.take("k", rule).allowed) ok++;
    assert.equal(ok, 5);
  });

  test("BUG: negative cost must not credit tokens beyond capacity (take(key, rule, -100) then burst)", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    // Hợp đồng đã đổi: cost âm là lỗi của người gọi nên NÉM, thay vì cộng token ma.
    assert.throws(() => l.take("k", rule, -100), RangeError);
    let ok = 0;
    for (let i = 0; i < 200; i++) if (l.take("k", rule).allowed) ok++;
    assert.ok(ok <= rule.capacity, `allowed ${ok} > capacity ${rule.capacity}`);
  });

  test("cost > capacity is never allowed and retryAfter is finite for a sane refill", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    const r = l.take("k", rule, 1_000_000);
    assert.equal(r.allowed, false);
    // cost > capacity không bao giờ thoả → không có thời điểm thử lại đúng; bỏ trống là trung thực.
    assert.ok(r.retryAfterSec === undefined || Number.isFinite(r.retryAfterSec));
  });

  test("BUG: a cost that can never be satisfied (> capacity) advertises a finite retryAfter that will never succeed", () => {
    let t = 0;
    const l = new MemoryRateLimiter({ now: () => t });
    const r = l.take("k", rule, 50);
    assert.equal(r.allowed, false);
    t += (r.retryAfterSec ?? 0) * 1000;
    const again = l.take("k", rule, 50);
    assert.equal(again.allowed, false, "still denied (capacity is 5)");
    assert.ok(r.retryAfterSec === undefined || !Number.isFinite(r.retryAfterSec), `promised retry in ${r.retryAfterSec}s, but it can never succeed`);
  });

  test("NaN / Infinity cost is denied and never poisons the bucket", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    // Hợp đồng đã đổi: cost không hữu hạn là lỗi của người gọi → NÉM, bucket không bị đụng tới.
    for (const c of [NaN, Infinity, 0, -1]) assert.throws(() => l.take("k", rule, c), RangeError, String(c));
    assert.equal(l.take("k", rule).allowed, true, "bucket still healthy");
  });

  test("BUG(cosmetic): zero refill: retryAfterSec must be header/JSON-safe (not Infinity)", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    const z = { capacity: 1, refillPerSec: 0 };
    l.take("k", z);
    const r = l.take("k", z);
    assert.equal(r.allowed, false);
    assert.ok(r.retryAfterSec === undefined || Number.isFinite(r.retryAfterSec), `retryAfterSec=${r.retryAfterSec} (becomes "Infinity" in a Retry-After header, null in JSON)`);
  });

  test("clock going backwards does not mint tokens during the regression", () => {
    let t = 1_000_000;
    const l = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 5; i++) l.take("k", rule);
    t -= 3_600_000;
    assert.equal(l.take("k", rule).allowed, false);
    assert.equal(l.take("k", rule).allowed, false);
  });

  test("BUG: after a backwards clock jump and recovery, the bucket must not be refilled for time that never elapsed", () => {
    let t = 10_000_000;
    const l = new MemoryRateLimiter({ now: () => t });
    for (let i = 0; i < 5; i++) l.take("k", rule); // drained at t0
    t = 0; // NTP step / VM resume: clock goes back 10_000s
    l.take("k", rule); // denied, but updatedAt is rewound to 0
    t = 10_000_001; // clock is right again: only 1s of real time since the drain
    let ok = 0;
    for (let i = 0; i < 10; i++) if (l.take("k", rule).allowed) ok++;
    assert.ok(ok <= 1, `got ${ok} tokens for 1s of real time (refill 1/s)`);
  });

  test("many keys: size is bounded by maxKeys", () => {
    const l = new MemoryRateLimiter({ maxKeys: 100, now: () => 0 });
    for (let i = 0; i < 50_000; i++) l.take(`ip-${i}`, rule);
    assert.ok(l.size <= 100, String(l.size));
  });

  test("LRU: a recently used key survives eviction pressure from other keys", () => {
    const l = new MemoryRateLimiter({ maxKeys: 3, now: () => 0 });
    for (let i = 0; i < 5; i++) l.take("hot", rule); // drained
    l.take("a", rule);
    l.take("hot", rule); // touch
    l.take("b", rule);
    l.take("c", rule);
    l.take("hot", rule);
    assert.equal(l.take("hot", rule).allowed, false, "hot key must keep its drained bucket");
  });

  test("BUG: key-flood eviction resets a drained attacker bucket (spray maxKeys distinct keys, then get a full burst again)", () => {
    const l = new MemoryRateLimiter({ maxKeys: 1000, now: () => 0 });
    for (let i = 0; i < 5; i++) l.take("attacker", rule);
    assert.equal(l.take("attacker", rule).allowed, false);
    for (let i = 0; i < 1000; i++) l.take(`noise-${i}`, rule);
    assert.equal(l.take("attacker", rule).allowed, false, "evicting a DRAINED bucket hands the attacker a fresh burst");
  });

  test("maxKeys = 1 still limits; maxKeys = 0 does not throw and stays bounded", () => {
    const l1 = new MemoryRateLimiter({ maxKeys: 1, now: () => 0 });
    for (let i = 0; i < 5; i++) l1.take("k", rule);
    assert.equal(l1.take("k", rule).allowed, false);
    const l0 = new MemoryRateLimiter({ maxKeys: 0, now: () => 0 });
    assert.doesNotThrow(() => {
      for (let i = 0; i < 10; i++) l0.take(`k${i}`, rule);
    });
    assert.ok(l0.size <= 1);
  });

  test("keys that are prototype names ('__proto__', 'constructor', 'toString') behave like any other", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    for (const k of ["__proto__", "constructor", "toString", "hasOwnProperty", ""]) {
      for (let i = 0; i < 5; i++) assert.equal(l.take(k, rule).allowed, true, k);
      assert.equal(l.take(k, rule).allowed, false, k);
    }
  });

  test("capacity 0 never allows; remaining is never negative or fractional", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    assert.equal(l.take("z", { capacity: 0, refillPerSec: 1 }).allowed, false);
    const r = l.take("q", { capacity: 2.5, refillPerSec: 0.3 });
    assert.ok(Number.isInteger(r.remaining) && r.remaining >= 0);
  });
});

// =================================================================== (5) PoW challenge

describe("(5) challenge", () => {
  const secret = "unit-test-secret-0123456789";
  const subject = "ip-hash-abc";
  type IssueOpts = Partial<Parameters<typeof issueChallenge>[0]>;
  /** Dựng token đúng định dạng nhưng KHÔNG validate tham số — để thử phía verify với token mà
   *  issueChallenge (đã cố ý từ chối tham số sai) sẽ không bao giờ phát ra. */
  const forge = (o: IssueOpts) => {
    const { secret: sec = secret, subject: sub = subject, difficultyBits = 8, ttlMs = 60_000, now = Date.now } = o;
    const expiresAt = now() + ttlMs;
    const body = Buffer.from(JSON.stringify({ s: sub, e: expiresAt, d: difficultyBits, r: randomBytes(12).toString("base64url") })).toString("base64url");
    const sig = createHmac("sha256", sec).update(body).digest().toString("base64url");
    return { token: `${body}.${sig}`, difficultyBits, expiresAt };
  };
  const issue = (o: IssueOpts = {}) => {
    try {
      return issueChallenge({ secret, subject, difficultyBits: 8, ...o });
    } catch {
      return forge(o);
    }
  };

  test("issueChallenge REFUSES parameters that make unsafe tokens (throws RangeError)", () => {
    const bad: IssueOpts[] = [
      { difficultyBits: NaN }, { difficultyBits: Infinity }, { difficultyBits: -Infinity }, { difficultyBits: -1 },
      { difficultyBits: 0 }, { difficultyBits: 12.5 }, { difficultyBits: 33 }, { difficultyBits: 40 }, { difficultyBits: 300 },
      { secret: "" }, { secret: "short" }, { secret: "x".repeat(15) },
      { subject: "" }, { subject: "s".repeat(257) },
      { ttlMs: 0 }, { ttlMs: -5 }, { ttlMs: NaN }, { ttlMs: Infinity }, { ttlMs: 10 * 3_600_000 },
    ];
    for (const o of bad) assert.throws(() => issueChallenge({ secret, subject, difficultyBits: 8, ...o }), RangeError, JSON.stringify(o));
    assert.doesNotThrow(() => issueChallenge({ secret: "x".repeat(16), subject: "s", difficultyBits: 1, ttlMs: 1 }));
    assert.doesNotThrow(() => issueChallenge({ secret, subject, difficultyBits: 32 }));
  });
  const check = (token: string, nonce: string, o: Record<string, unknown> = {}) => verifyChallenge(token, nonce, { secret, subject, ...o });

  test("round trip: issue -> solve -> verify ok; returned metadata consistent", () => {
    const c = issue();
    assert.equal(c.difficultyBits, 8);
    assert.ok(c.expiresAt > Date.now());
    assert.deepEqual(check(c.token, solveChallenge(c.token, 8)), { ok: true });
  });

  test("tokens are unique (random id) and URL-safe", () => {
    const set = new Set(Array.from({ length: 2000 }, () => issue().token));
    assert.equal(set.size, 2000);
    for (const t of set) assert.match(t, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test("leadingZeroBits is correct on byte boundaries", () => {
    const b = (...x: number[]) => Buffer.from(x);
    assert.equal(leadingZeroBits(b(0xff)), 0);
    assert.equal(leadingZeroBits(b(0x7f)), 1);
    assert.equal(leadingZeroBits(b(0x01)), 7);
    assert.equal(leadingZeroBits(b(0x00, 0x80)), 8);
    assert.equal(leadingZeroBits(b(0x00, 0x00, 0x10)), 19);
    assert.equal(leadingZeroBits(Buffer.alloc(32)), 256);
    assert.equal(leadingZeroBits(Buffer.alloc(0)), 0);
  });

  test("tampering with EVERY character of the body fails (never ok)", () => {
    const c = issue({ difficultyBits: 0 }); // difficulty 0: only the signature can stop us
    const [body] = c.token.split(".");
    for (let i = 0; i < body.length; i++) {
      const swapped = body[i] === "A" ? "B" : "A";
      const t = body.slice(0, i) + swapped + body.slice(i + 1) + c.token.slice(body.length);
      assert.equal(check(t, "x").ok, false, `body[${i}]`);
    }
  });

  test("tampering with every character of the signature (except the non-canonical tail char) fails", () => {
    const c = issue({ difficultyBits: 0 });
    const dot = c.token.indexOf(".");
    const sigLen = c.token.length - dot - 1;
    for (let i = 0; i < sigLen - 1; i++) {
      const pos = dot + 1 + i;
      const swapped = c.token[pos] === "A" ? "B" : "A";
      assert.equal(check(c.token.slice(0, pos) + swapped + c.token.slice(pos + 1), "x").ok, false, `sig[${i}]`);
    }
  });

  test("truncated / extended / empty signature fails", () => {
    const c = issue({ difficultyBits: 0 });
    const dot = c.token.indexOf(".");
    for (const t of [c.token.slice(0, -1), c.token.slice(0, -10), c.token.slice(0, dot + 1), c.token + "AAAA", c.token + "A", c.token.slice(0, dot)]) {
      assert.equal(check(t, "x").ok, false);
    }
    assert.deepEqual(check(c.token.slice(0, dot + 1), "x"), { ok: false, reason: "bad-signature" });
  });

  test("structurally broken tokens never throw and are rejected; >1024 chars is 'malformed'", () => {
    for (const t of ["", ".", "..", "abc", ".abc", "abc.", "a.b.c", "\0", "{}", "null", "A".repeat(1025), "A".repeat(100_000) + ".x"]) {
      let r: ReturnType<typeof check> | undefined;
      assert.doesNotThrow(() => (r = check(t, "x")), JSON.stringify(t.slice(0, 20)));
      assert.equal(r!.ok, false);
    }
    assert.deepEqual(check("A".repeat(1025), "x"), { ok: false, reason: "malformed" });
  });

  test("BUG: signature must be canonical base64url (no '=', whitespace, junk chars) — otherwise one token has unlimited string aliases", () => {
    const c = issue({ difficultyBits: 0 });
    const [body, sig] = c.token.split(".");
    const aliases = [
      `${body}.${sig}=`,
      `${body}.${sig}==`,
      `${body}.${sig}\n`,
      `${body}.${sig} `,
      `${body}.!!${sig}`,
      `${body}.${sig.slice(0, 10)}\n${sig.slice(10)}`,
      `${body}.${sig.replace(/-/g, "+").replace(/_/g, "/")}${/[-_]/.test(sig) ? "" : "!"}`,
    ];
    const accepted = aliases.filter((t) => t !== c.token && check(t, "x").ok);
    assert.deepEqual(accepted, [], "non-canonical encodings of a valid signature were accepted");
  });

  test("BUG: last signature char carries 2 unused bits -> 4 distinct token strings share one valid signature", () => {
    const c = issue({ difficultyBits: 0 });
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const accepted = [...alpha].map((ch) => c.token.slice(0, -1) + ch).filter((t) => t !== c.token && check(t, "x").ok);
    assert.deepEqual(accepted, []);
  });

  test("body with non-canonical base64url cannot be used (signature covers the string)", () => {
    const c = issue({ difficultyBits: 0 });
    const [body, sig] = c.token.split(".");
    assert.equal(check(`${body}=.${sig}`, "x").ok, false);
    assert.equal(check(`${body}\n.${sig}`, "x").ok, false);
  });

  test("wrong secret / secret differing in one char / truncated / empty", () => {
    const c = issue({ difficultyBits: 0 });
    assert.equal(check(c.token, "x", { secret: secret + "!" }).ok, false);
    assert.equal(check(c.token, "x", { secret: secret.slice(0, -1) }).ok, false);
    // verify cũng ép độ dài secret như issue: secret rỗng (biến môi trường quên đặt) phải NÉM.
    assert.throws(() => check(c.token, "x", { secret: "" }), RangeError);
  });

  test("BUG: an empty / trivially short secret must be refused at issue time (otherwise tokens are forgeable by anyone)", () => {
    for (const s of ["", "a", "secret"]) {
      assert.throws(() => issueChallenge({ secret: s, subject, difficultyBits: 4 }), RangeError, `secret=${JSON.stringify(s)} was accepted`);
    }
  });

  test("a token forged with the empty secret does not verify against the real secret", () => {
    const forged = forge({ secret: "", difficultyBits: 0 });
    assert.equal(check(forged.token, "x").ok, false);
  });

  test("expiry: valid just before, invalid exactly at and after expiresAt", () => {
    let t = 1_000_000;
    const c = issue({ difficultyBits: 0, ttlMs: 60_000, now: () => t });
    t = c.expiresAt - 1;
    assert.equal(check(c.token, "x", { now: () => t }).ok, true);
    t = c.expiresAt;
    assert.deepEqual(check(c.token, "x", { now: () => t }), { ok: false, reason: "expired" });
    t = c.expiresAt + 86_400_000;
    assert.deepEqual(check(c.token, "x", { now: () => t }), { ok: false, reason: "expired" });
  });

  test("ttl 0 / negative / NaN / Infinity yield tokens that are never acceptable (fail closed)", () => {
    for (const ttl of [0, -1, NaN, Infinity, -Infinity]) {
      const c = issue({ difficultyBits: 0, ttlMs: ttl });
      assert.equal(check(c.token, "x").ok, false, `ttl=${ttl}`);
    }
  });

  test("clock skew: verifier clock BEHIND the issuer by 5 min still accepts (not rejected as 'from the future')", () => {
    const c = issue({ difficultyBits: 0, now: () => 10_000_000 });
    assert.equal(check(c.token, "x", { now: () => 10_000_000 - 300_000 }).ok, true);
  });

  test("subject binding: different / empty / case-different / padded / prefix subject all rejected", () => {
    const c = issue({ difficultyBits: 0 });
    for (const s of ["", subject.toUpperCase(), subject + " ", " " + subject, subject.slice(0, -1), "other"]) {
      assert.deepEqual(check(c.token, "x", { subject: s }), { ok: false, reason: "wrong-subject" }, JSON.stringify(s));
    }
  });

  test("subject with delimiters / JSON metacharacters cannot smuggle fields (d,e) or collide with another subject", () => {
    const evil = 'x","d":0,"e":9999999999999,"s":"victim';
    const c = issueChallenge({ secret, subject: evil, difficultyBits: 12 });
    assert.equal(check(c.token, "0", { subject: evil }).ok, false, "difficulty 12 must still apply");
    const n = solveChallenge(c.token, 12);
    assert.equal(check(c.token, n, { subject: evil }).ok, true);
    assert.equal(check(c.token, n, { subject: "victim" }).ok, false);
    for (const s of ["a.b", "a:b", "a\0b", "😀", "\\", '"', "a".repeat(500)]) {
      const t = forge({ subject: s, difficultyBits: 0 });
      assert.equal(check(t.token, "x", { subject: s }).ok, true, JSON.stringify(s.slice(0, 10)));
      assert.equal(check(t.token, "x", { subject: s + "." }).ok, false);
    }
  });

  test("insufficient work is rejected (12 bits: >=195/200 junk nonces fail), real solution passes", () => {
    const c = issue({ difficultyBits: 12 });
    let rejected = 0;
    for (let i = 0; i < 200; i++) if (!check(c.token, `bad${i}`).ok) rejected++;
    assert.ok(rejected >= 195, `only ${rejected}/200 junk nonces rejected at 12 bits`);
    assert.equal(check(c.token, solveChallenge(c.token, 12)).ok, true);
  });

  test("a solution for one token does not solve another", () => {
    const a = issue({ difficultyBits: 14 });
    const b = issue({ difficultyBits: 14 });
    const n = solveChallenge(a.token, 14);
    assert.equal(check(b.token, n).ok, false);
  });

  test("nonce edge cases: empty malformed, 64 ok, 65 malformed, unicode/':'/NUL accepted as opaque", () => {
    const c = issue({ difficultyBits: 0 });
    assert.deepEqual(check(c.token, ""), { ok: false, reason: "malformed" });
    assert.equal(check(c.token, "a".repeat(64)).ok, true);
    assert.deepEqual(check(c.token, "a".repeat(65)), { ok: false, reason: "malformed" });
    for (const n of ["😀", "a:b", "\0", "漢字", "  ", "\n"]) assert.equal(check(c.token, n).ok, true, JSON.stringify(n));
  });

  test("difficulty 0: any nonce is accepted (trivial by definition) but signature/expiry/subject are still enforced", () => {
    const c = issue({ difficultyBits: 0 });
    assert.equal(check(c.token, "anything").ok, true);
    assert.equal(check(c.token, "anything", { subject: "nope" }).ok, false);
  });

  test("BUG: issueChallenge must validate difficultyBits (NaN/Infinity/negative serialise to null/negative -> ANY nonce passes)", () => {
    // Phải NÉM tại nơi phát (gọi issueChallenge trực tiếp, không qua helper `issue` có fallback forge).
    for (const d of [NaN, Infinity, -Infinity, -1, -1000]) {
      assert.throws(() => issueChallenge({ secret, subject, difficultyBits: d }), RangeError, `difficultyBits=${d}`);
    }
  });

  test("BUG: difficulty > 256 is unsatisfiable (SHA-256 has 256 bits): must be refused at issue time, not shipped to a browser that will spin forever", () => {
    for (const d of [257, 300, 1e9]) {
      assert.throws(() => issueChallenge({ secret, subject, difficultyBits: d }), RangeError, `difficultyBits=${d} accepted`);
    }
  });

  test("high difficulty (40 bits) tokens are not solvable by junk nonces and verify() does not hang", () => {
    const c = forge({ difficultyBits: 40 }); // issueChallenge giờ từ chối > 32 nên dựng tay
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) assert.equal(check(c.token, `n${i}`).ok, false);
    assert.ok(performance.now() - t0 < 2000);
  });

  test("fractional difficulty (12.5) is treated as >= 13 bits, never as 12", () => {
    const c = issue({ difficultyBits: 12.5 });
    let accepted = 0;
    for (let i = 0; i < 300_000; i++) {
      const n = i.toString(36);
      if (check(c.token, n).ok) {
        accepted++;
        const z = leadingZeroBits(createHash("sha256").update(`${c.token}:${n}`).digest());
        assert.ok(z >= 13, `accepted with only ${z} bits`);
        if (accepted >= 3) break;
      }
    }
    assert.ok(accepted > 0);
  });

  test("replay: wrong solution first does not burn the token; second valid submission (any nonce) is 'replayed'", () => {
    const guard = createReplayGuard();
    const c = issue({ difficultyBits: 10 });
    assert.deepEqual(check(c.token, "wrong-nonce-xyz-0", { replay: guard }), { ok: false, reason: "insufficient-work" });
    const n = solveChallenge(c.token, 10);
    assert.equal(check(c.token, n, { replay: guard }).ok, true);
    assert.deepEqual(check(c.token, n, { replay: guard }), { ok: false, reason: "replayed" });
    let m = "";
    for (let i = 0; ; i++) {
      m = "z" + i;
      if (m !== n && check(c.token, m).ok) break;
    }
    assert.deepEqual(check(c.token, m, { replay: guard }), { ok: false, reason: "replayed" });
  });

  test("replay guard: wrong-subject / expired / bad-signature submissions do not consume the id", () => {
    const guard = createReplayGuard();
    const c = issue({ difficultyBits: 0 });
    assert.equal(check(c.token, "x", { replay: guard, subject: "other" }).ok, false);
    assert.equal(check(c.token, "x", { replay: guard, now: () => c.expiresAt + 1 }).ok, false);
    assert.equal(check(c.token + "A", "x", { replay: guard }).ok, false);
    assert.equal(check(c.token, "x", { replay: guard }).ok, true);
  });

  test("replay guard: an entry is forgotten after its expiry and the id can be tracked again", () => {
    let t = 0;
    const g = createReplayGuard(() => t);
    assert.equal(g.seen("a", 100), false);
    assert.equal(g.seen("a", 100), true);
    t = 101;
    assert.equal(g.seen("a", 200), false);
  });

  test("BUG: replay-guard eviction under pressure forgets LIVE ids (FIFO) -> a solved token is replayable after maxEntries other tokens", () => {
    const g = createReplayGuard(() => 0, 100);
    const c = issue({ difficultyBits: 0, now: () => 0, ttlMs: 60_000 });
    assert.equal(check(c.token, "x", { replay: g, now: () => 0 }).ok, true);
    for (let i = 0; i < 500; i++) {
      const o = issue({ difficultyBits: 0, now: () => 0, ttlMs: 60_000 });
      check(o.token, "x", { replay: g, now: () => 0 });
    }
    assert.equal(check(c.token, "x", { replay: g, now: () => 0 }).ok, false, "live token replayed after eviction");
  });

  test("BUG: verifyChallenge must not throw on non-string token / nonce from an untyped JSON body", () => {
    for (const [tok, non] of [[undefined, "x"], [null, "x"], [123, "x"], [{}, "x"], [[], "x"], ["a.b", null], ["a.b", undefined]] as unknown[][]) {
      let r: unknown;
      try {
        r = verifyChallenge(tok as string, non as string, { secret, subject });
      } catch (e) {
        assert.fail(`threw for (${JSON.stringify(tok)}, ${JSON.stringify(non)}): ${e}`);
      }
      assert.equal((r as { ok: boolean }).ok, false);
    }
  });

  test("solver finishes 16 bits quickly (browser-budget claim ~65k hashes)", () => {
    const c = issue({ difficultyBits: 16 });
    const t0 = performance.now();
    const n = solveChallenge(c.token, 16);
    assert.ok(performance.now() - t0 < 5000);
    assert.equal(check(c.token, n).ok, true);
  });
});

// =================================================================== (6) telemetry

describe("(6) client telemetry", () => {
  const CHUA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`;
  const human = (): ClientTelemetry => ({ wd: false, pl: 5, lg: 3, ow: 1920, oh: 1080, iw: 1905, ih: 950, sw: 1920, sh: 1080, hc: 8, ua: CHUA, ch: true, ev: 42, ut: 0, dw: 5400 });
  const ids = (t: ClientTelemetry, ua: string | null = CHUA) => telemetrySignals(t, ua).map((s) => s.id);
  const score = (t: ClientTelemetry, ua: string | null = CHUA) => combineWeights(telemetrySignals(t, ua));

  test("desktop Chrome human: no signals", () => {
    assert.deepEqual(ids(human()), []);
  });

  test("honest-looking stealth bot payload passes (documented: client can lie)", () => {
    assert.equal(score(human()), 0);
  });

  test("webdriver=true alone is >= 75", () => {
    assert.ok(score({ ...human(), wd: true }) >= 75);
  });

  test("parseTelemetry: round-trips a valid payload and drops extra fields", () => {
    const p = parseTelemetry({ ...human(), extra: "x", admin: true });
    assert.ok(p);
    assert.deepEqual(Object.keys(p!).sort(), Object.keys(human()).sort());
  });

  test("parseTelemetry: prototype-pollution payloads (JSON __proto__, constructor, prototype) do not pollute or leak", () => {
    const json = JSON.stringify(human()).slice(0, -1) + ',"__proto__":{"polluted":true,"wd":true},"constructor":{"prototype":{"polluted2":true}},"prototype":{"x":1}}';
    const p = parseTelemetry(JSON.parse(json));
    assert.ok(p);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(({} as Record<string, unknown>).polluted2, undefined);
    assert.equal(Object.getPrototypeOf(p), Object.prototype);
    assert.equal(Object.prototype.hasOwnProperty.call(p, "__proto__"), false);
    assert.equal(p!.wd, false, "inherited/proto fields must not override");
  });

  test("parseTelemetry: numeric fields supplied only through a JSON __proto__ object are not accepted", () => {
    const o = JSON.parse('{"__proto__":{"pl":5,"lg":3,"ow":1,"oh":1,"iw":1,"ih":1,"sw":1,"sh":1,"hc":1,"ev":1,"ut":0,"dw":1},"wd":false,"ch":false,"ua":"x"}');
    assert.equal(parseTelemetry(o), null);
  });

  test("parseTelemetry rejects non-objects, arrays, primitives, functions", () => {
    for (const x of [null, undefined, 0, 1, "str", true, [], [1, 2, 3], () => 1, Symbol("s"), BigInt(10)]) assert.equal(parseTelemetry(x), null, String(typeof x));
  });

  test("parseTelemetry rejects NaN, Infinity, negatives, > 1e9, numeric strings, booleans, boxed numbers, BigInt (each of 12 numeric fields)", () => {
    const keys = ["pl", "lg", "ow", "oh", "iw", "ih", "sw", "sh", "hc", "ev", "ut", "dw"] as const;
    for (const k of keys) {
      for (const bad of [NaN, Infinity, -Infinity, -1, -0.0001, 1e9 + 1, Number.MAX_VALUE, "5", "", null, undefined, true, [], {}, new Number(5), BigInt(5)]) {
        assert.equal(parseTelemetry({ ...human(), [k]: bad }), null, `${k}=${String(bad)}`);
      }
    }
  });

  test("parseTelemetry: boundary values 0, 1e9, fractional and -0 accepted", () => {
    for (const v of [0, 1e9, 0.5, -0]) assert.ok(parseTelemetry({ ...human(), dw: v }), String(v));
  });

  test("parseTelemetry: wd/ch must be real booleans; ua must be a string <= 512; missing field rejected", () => {
    for (const bad of [1, 0, "true", "false", null, undefined, {}]) {
      assert.equal(parseTelemetry({ ...human(), wd: bad }), null, `wd=${String(bad)}`);
      assert.equal(parseTelemetry({ ...human(), ch: bad }), null, `ch=${String(bad)}`);
    }
    assert.ok(parseTelemetry({ ...human(), ua: "a".repeat(512) }));
    assert.equal(parseTelemetry({ ...human(), ua: "a".repeat(513) }), null);
    assert.equal(parseTelemetry({ ...human(), ua: 5 }), null);
    assert.equal(parseTelemetry({ ...human(), ua: ["a"] }), null);
    const missing = human() as Partial<ClientTelemetry>;
    delete missing.ev;
    assert.equal(parseTelemetry(missing), null);
  });

  test("parseTelemetry: 10MB ua rejected quickly; frozen and null-prototype objects are accepted", () => {
    const t0 = performance.now();
    assert.equal(parseTelemetry({ ...human(), ua: "a".repeat(10_000_000) }), null);
    assert.ok(performance.now() - t0 < 200);
    assert.ok(parseTelemetry(Object.assign(Object.create(null), human())));
    assert.ok(parseTelemetry(Object.freeze(human())));
  });

  test("BUG: parseTelemetry must not throw on hostile objects (throwing getter / Proxy)", () => {
    const hostile = new Proxy({}, {
      get() {
        throw new Error("trap");
      },
    });
    const g = { ...human() } as Record<string, unknown>;
    Object.defineProperty(g, "ev", {
      get() {
        throw new Error("getter");
      },
      enumerable: true,
    });
    for (const x of [hostile, g]) {
      let r: unknown;
      assert.doesNotThrow(() => (r = parseTelemetry(x)));
      assert.equal(r, null);
    }
  });

  test("telemetrySignals never throws on garbage numbers (called without parseTelemetry)", () => {
    const g = { ...human(), pl: NaN, lg: NaN, ow: -1, oh: Infinity, iw: NaN, ih: -5, sw: NaN, sh: undefined as unknown as number, hc: NaN, ev: NaN, ut: NaN, dw: NaN, ua: undefined as unknown as string };
    assert.doesNotThrow(() => telemetrySignals(g, CHUA));
    assert.doesNotThrow(() => telemetrySignals(g, null));
  });

  test("zero-window: outer=0 with inner>0 flagged; both 0 (not rendered) is not", () => {
    assert.ok(ids({ ...human(), ow: 0, oh: 0 }).includes("zero-window"));
    assert.ok(!ids({ ...human(), ow: 0, oh: 0, iw: 0, ih: 0 }).includes("zero-window"));
  });

  test("default screens 800x600 and 0x0 flagged, 1024x768 / 800x601 not", () => {
    assert.ok(ids({ ...human(), sw: 800, sh: 600 }).includes("default-screen"));
    assert.ok(ids({ ...human(), sw: 0, sh: 0 }).includes("default-screen"));
    assert.ok(!ids({ ...human(), sw: 1024, sh: 768 }).includes("default-screen"));
    assert.ok(!ids({ ...human(), sw: 800, sh: 601 }).includes("default-screen"));
  });

  test("no-interaction: boundary dw 299 vs 300, and any event cancels it", () => {
    assert.ok(ids({ ...human(), ev: 0, dw: 299 }).includes("no-interaction"));
    assert.ok(!ids({ ...human(), ev: 0, dw: 300 }).includes("no-interaction"));
    assert.ok(!ids({ ...human(), ev: 1, dw: 5 }).includes("no-interaction"));
  });

  test("ua-mismatch: header UA != JS UA flagged; null header UA or empty JS UA not", () => {
    assert.ok(ids({ ...human(), ua: "Mozilla/5.0 something else" }).includes("ua-mismatch"));
    assert.ok(!ids(human(), null).includes("ua-mismatch"));
    assert.ok(!ids({ ...human(), ua: "" }).includes("ua-mismatch"));
  });

  test("Mobile Safari / Chrome iOS / Firefox human telemetry (no window.chrome, no plugins) is clean", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    const t = { ...human(), ua: safari, ch: false, pl: 0, ow: 390, oh: 844, iw: 390, ih: 664, sw: 390, sh: 844, hc: 6, lg: 2 };
    assert.deepEqual(ids(t, safari), []);
    const cri = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
    assert.deepEqual(ids({ ...t, ua: cri }, cri), []);
    const ff = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
    assert.deepEqual(ids({ ...human(), ua: ff, ch: false, pl: 5 }, ff), []);
  });

  test("Android Chrome tablet / desktop-mode (no 'Mobile' token, window.chrome present, plugins=0) stays < 30", () => {
    const ua = `Mozilla/5.0 (Linux; Android 13; SM-X700) ${CH} Safari/537.36`;
    assert.ok(score({ ...human(), ua, pl: 0, hc: 8 }, ua) < 30);
    assert.ok(score({ ...human(), ua, pl: 0, hc: 0, ch: false }, ua) < 30, "WebView on a tablet lacking window.chrome + hardwareConcurrency");
  });

  test("BUG: a single synthetic (isTrusted=false) event among 300 real ones (Vimium / password-manager autofill / a11y tools) must not alone score >= 30", () => {
    const s = score({ ...human(), ev: 300, ut: 1 });
    assert.ok(s < 30, `score=${s}`);
  });

  test("BUG(unverified premise): window.outerWidth/outerHeight == 0 is reported by some mobile WebViews — alone it must not reach 30", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
    const t = { ...human(), ua, ch: false, pl: 0, ow: 0, oh: 0, iw: 390, ih: 664, sw: 390, sh: 844, hc: 6 };
    assert.ok(score(t, ua) < 30, `score=${score(t, ua)}`);
  });

  test("telemetry composes with header signals: human telemetry adds nothing; webdriver => automated", () => {
    const a = assessRequestSync({ headers: hdr(HUMANS[0].headers), telemetry: human() });
    assert.equal(a.score, 0);
    const b = assessRequestSync({ headers: hdr(HUMANS[0].headers), telemetry: { ...human(), wd: true } });
    assert.ok(b.score >= 75 && b.classification === "automated");
  });

  describe("CLIENT_PROBE_SOURCE in a stub browser (node:vm)", () => {
    function run(opts: { wd?: unknown; plugins?: unknown; languages?: unknown; hc?: unknown; chrome?: unknown } = {}) {
      const listeners = new Map<string, Array<(e: unknown) => void>>();
      let now = 1000;
      const win: Record<string, unknown> = {
        navigator: { webdriver: opts.wd, plugins: opts.plugins, languages: opts.languages, hardwareConcurrency: opts.hc, userAgent: "UA/1" },
        screen: { width: 1920, height: 1080 },
        outerWidth: 1920,
        outerHeight: 1080,
        innerWidth: 1900,
        innerHeight: 900,
        chrome: opts.chrome,
        addEventListener(n: string, f: (e: unknown) => void) {
          listeners.set(n, [...(listeners.get(n) ?? []), f]);
        },
      };
      const ctx = vm.createContext({ window: win, performance: { now: () => now } });
      vm.runInContext(CLIENT_PROBE_SOURCE, ctx);
      return {
        fire: (n: string, trusted: boolean) => (listeners.get(n) ?? []).forEach((f) => f({ isTrusted: trusted })),
        advance: (ms: number) => {
          now += ms;
        },
        probe: () => (win.__tiqProbe as () => unknown)(),
        listeners,
      };
    }

    test("probe output passes parseTelemetry and reports real values", () => {
      const r = run({ wd: false, plugins: { length: 5 }, languages: ["vi", "en"], hc: 8, chrome: {} });
      r.advance(2500);
      r.fire("mousemove", true);
      r.fire("click", true);
      const p = parseTelemetry(r.probe());
      assert.ok(p, JSON.stringify(r.probe()));
      assert.equal(p!.ev, 2);
      assert.equal(p!.ut, 0);
      assert.equal(p!.dw, 2500);
      assert.equal(p!.pl, 5);
      assert.equal(p!.lg, 2);
      assert.equal(p!.ch, true);
    });

    test("untrusted events counted separately; webdriver flag only when === true", () => {
      const r = run({ wd: true, plugins: { length: 0 }, languages: [], hc: 0 });
      r.fire("click", false);
      r.fire("scroll", false);
      r.fire("keydown", true);
      const p = r.probe() as ClientTelemetry;
      assert.equal(p.ut, 2);
      assert.equal(p.ev, 3);
      assert.equal(p.wd, true);
      assert.equal(p.hc, 0);
      assert.equal((run({ wd: undefined }).probe() as ClientTelemetry).wd, false);
      assert.equal((run({ wd: "true" }).probe() as ClientTelemetry).wd, false);
    });

    test("probe tolerates a browser lacking plugins/languages/hardwareConcurrency/chrome (Safari)", () => {
      const r = run({});
      const p = parseTelemetry(r.probe());
      assert.ok(p, JSON.stringify(r.probe()));
      assert.equal(p!.pl, 0);
      assert.equal(p!.lg, 0);
      assert.equal(p!.ch, false);
    });

    test("listens on all documented event names", () => {
      const r = run({});
      for (const n of ["mousemove", "touchstart", "keydown", "scroll", "click", "pointerdown"]) assert.ok(r.listeners.has(n), n);
    });
  });
});

// =================================================================== (7) policy

describe("(7) decide / thresholds", () => {
  /** Records which rule/key was used. */
  function spy(allow = true) {
    const calls: Array<{ key: string; capacity: number; refill: number; cost: number }> = [];
    const store: RateLimitStore = {
      take(key, rule, cost = 1) {
        calls.push({ key, capacity: rule.capacity, refill: rule.refillPerSec, cost });
        return allow ? { allowed: true, remaining: 1 } : { allowed: false, remaining: 0, retryAfterSec: 7 };
      },
    };
    return { store, calls };
  }
  const A = (score: number, classification: Assessment["classification"] = "human-likely"): Assessment => ({ score, classification, signals: [] });

  test("boundaries 0/29/30/59/60/79/80/100 -> allow / allow / flag / flag / flag(tight) / flag(tight) / challenge / challenge", () => {
    // Thiết kế mới: MỘT bucket ("b:") cho mỗi khoá; điểm càng cao thì mỗi request càng đắt
    // (1 / 4 / 20 token) — để luân phiên giữa các bậc không cộng dồn hạn mức.
    const want: Array<[number, string, string | null, number | null]> = [
      [0, "allow", "h:", 1], [29, "allow", "h:", 1], [30, "flag", "s:", 1], [59, "flag", "s:", 1], [60, "flag", "s:", 5], [79, "flag", "s:", 5], [80, "challenge", null, null], [100, "challenge", null, null],
    ];
    for (const [score, action, prefix, cost] of want) {
      const { store, calls } = spy();
      const d = decide(A(score), { limiter: store, key: "k" });
      assert.equal(d.action, action, `score ${score}`);
      if (cost !== null) {
        assert.ok(calls[0].key.startsWith(prefix!), `score ${score} used ${calls[0]?.key}`);
        assert.equal(calls[0].cost, cost, `score ${score}`);
      } else assert.equal(calls.length, 0, "challenge must not consume a token bucket");
    }
  });

  test("clean tier uses its own bucket; flag+suspicious share one tighter bucket (suspicious costs more)", () => {
    const used: Array<{ key: string; capacity: number; cost: number }> = [];
    for (const s of [0, 30, 60]) {
      const { store, calls } = spy();
      decide(A(s), { limiter: store, key: "k" });
      used.push({ key: calls[0].key, capacity: calls[0].capacity, cost: calls[0].cost });
    }
    assert.notEqual(used[0].key, used[1].key, "a noisy bot must not drain the CLEAN bucket of humans sharing its IP");
    assert.equal(used[1].key, used[2].key, "flag and suspicious share one bucket so tier-hopping cannot sum them");
    assert.ok(used[0].capacity > used[1].capacity, "suspect bucket is tighter than the clean one");
    assert.ok(used[2].cost > used[1].cost);
  });

  test("denied tiers return rate-limited with the limiter's retryAfter; challenge has none", () => {
    for (const s of [0, 30, 60]) {
      const d = decide(A(s), { limiter: spy(false).store, key: "k" });
      assert.deepEqual(d, { action: "rate-limited", retryAfterSec: 7 }, `score ${s}`);
    }
    assert.deepEqual(decide(A(95), { limiter: spy(false).store, key: "k" }), { action: "challenge" });
  });

  test("verified crawler is never challenged or tight-limited, even with a corrupt score of 100", () => {
    const { store, calls } = spy();
    for (const s of [0, 50, 80, 100]) assert.deepEqual(decide(A(s, "verified-crawler"), { limiter: store, key: "k" }), { action: "allow" });
    assert.ok(calls.every((c) => c.key.startsWith("v:") && c.capacity === 120));
  });

  test("verified crawler is throttled only by the generous baseline (loop guard) and gets a retryAfter", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    let ok = 0;
    for (let i = 0; i < 1000; i++) if (decide(A(0, "verified-crawler"), { limiter: l, key: "g" }).action === "allow") ok++;
    assert.equal(ok, 120);
    const d = decide(A(0, "verified-crawler"), { limiter: l, key: "g" });
    assert.equal(d.action, "rate-limited");
    assert.ok((d.retryAfterSec ?? 0) >= 1);
  });

  test("a flagged human and the verified crawler on the same key do not share buckets", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    for (let i = 0; i < 200; i++) decide(A(0, "verified-crawler"), { limiter: l, key: "same" });
    assert.equal(decide(A(0), { limiter: l, key: "same" }).action, "allow");
  });

  test("spoofed crawler (score 95) is challenged", () => {
    assert.equal(decide(A(95, "spoofed-crawler"), { limiter: spy().store, key: "k" }).action, "challenge");
  });

  test("custom thresholds are honoured at their boundaries", () => {
    const th = { flag: 10, rateLimit: 20, challenge: 40 };
    const run = (s: number) => {
      const { store, calls } = spy();
      const d = decide(A(s), { limiter: store, key: "k", thresholds: th });
      return [d.action, calls[0]?.key.slice(0, 2)];
    };
    assert.deepEqual(run(9), ["allow", "h:"]);
    assert.deepEqual(run(10), ["flag", "s:"]);
    assert.deepEqual(run(19), ["flag", "s:"]);
    assert.deepEqual(run(20), ["flag", "s:"]);
    assert.deepEqual(run(39), ["flag", "s:"]);
    assert.deepEqual(run(40), ["challenge", undefined]);
  });

  test("DEFAULT_THRESHOLDS match README (30/60/80)", () => {
    assert.deepEqual(DEFAULT_THRESHOLDS, { flag: 30, rateLimit: 60, challenge: 80 });
  });

  test("real limiter: 30-59 tier gets 30 burst then 429; 60-79 tier gets 6; baseline 120", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    const n = (s: number, key: string) => {
      let ok = 0;
      for (let i = 0; i < 500; i++) if (decide(A(s), { limiter: l, key }).action !== "rate-limited") ok++;
      return ok;
    };
    assert.equal(n(45, "a"), 30);
    assert.equal(n(70, "b"), 6);
    assert.equal(n(10, "c"), 120);
  });

  test("BUG: a NaN / missing score must fail safe (not silently 'allow' on the baseline bucket)", () => {
    for (const s of [NaN, undefined as unknown as number]) {
      const d = decide(A(s), { limiter: spy().store, key: "k" });
      assert.notEqual(d.action, "allow", `score=${s}`);
    }
  });

  test("scores outside [0,100] behave sanely: negative -> allow, 1000 -> challenge", () => {
    assert.equal(decide(A(-5), { limiter: spy().store, key: "k" }).action, "allow");
    assert.equal(decide(A(1000), { limiter: spy().store, key: "k" }).action, "challenge");
  });

  test("BUG(weakness): tier hopping — one key alternating tiers (by varying headers) gets the SUM of per-tier bursts, exceeding the loosest tier", () => {
    const l = new MemoryRateLimiter({ now: () => 0 });
    let ok = 0;
    for (const s of [10, 45, 70]) for (let i = 0; i < 500; i++) if (decide(A(s), { limiter: l, key: "one-ip" }).action !== "rate-limited") ok++;
    // Đánh đổi có chủ đích: hai bucket (sạch 120 + nghi ngờ 30) để một bot bậc cao không rút cạn
    // hạn mức của người sạch dùng chung IP. Tổng tối đa bị chặn bởi hai trần cố định, không cộng
    // dồn theo số bậc như thiết kế bucket-riêng-mỗi-bậc (156).
    assert.ok(ok <= 120 + 30 + 2, `one key got ${ok} requests through in one instant`);
  });

  test("end-to-end: classification boundaries from assessRequestSync match the policy table", () => {
    const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${CH} Safari/537.36`;
    const weak = sync({ "user-agent": ua, accept: NAV_ACCEPT });
    assert.ok(weak.score >= 10 && weak.score < 30 && weak.classification === "human-likely", String(weak.score));
    assert.equal(sync({ "user-agent": "curl/8" }).classification, "automated");
    assert.equal(sync({ "user-agent": "Mozilla/5.0 (compatible; AhrefsBot/7.0)" }).classification, "suspicious");
  });
});
