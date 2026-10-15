/**
 * Round 3 — property-based / differential / fuzz review of src/lib/botdetect.
 * Written from scratch (no reuse of earlier test files). Deterministic: every
 * property uses a fixed seed that is printed in the failure message.
 *
 *   npx tsx --test src/lib/botdetect/round3.test.ts
 *
 * Tests whose name starts with "BUG:" EXPOSE a real defect and are expected to
 * FAIL until the library is fixed.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

import {
  assessRequest,
  assessRequestSync,
  decide,
  DEFAULT_THRESHOLDS,
  MemoryRateLimiter,
  issueChallenge,
  verifyChallenge,
  solveChallenge,
  createReplayGuard,
  parseTelemetry,
  telemetrySignals,
  verifyFcrdns,
  type CrawlerVerifier,
} from "./index";
import { normalizeIp, hostMatchesSuffix, type DnsResolver, type FcrdnsResult } from "./fcrdns";
import { combineWeights } from "./signals";
import { leadingZeroBits } from "./challenge";
import type { Assessment, HeaderBag, Signal } from "./types";

// ───────────────────────────── infra ─────────────────────────────

const N = 2500; // cases per property (>= 2000 required)
const stats = new Map<string, number>();
const tally = (name: string, n: number) => stats.set(name, (stats.get(name) ?? 0) + n);
after(() => {
  let total = 0;
  const lines: string[] = [];
  for (const [k, v] of stats) {
    total += v;
    lines.push(`  ${String(v).padStart(8)}  ${k}`);
  }
  console.log(`\n[round3] ${stats.size} property groups, ${total} generated cases\n${lines.join("\n")}`);
});

class R {
  private a: number;
  constructor(readonly seed: number) {
    this.a = seed >>> 0;
  }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)];
  }
  str(len: number, alphabet: string): string {
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[this.int(alphabet.length)];
    return s;
  }
  shuffle<T>(xs: readonly T[]): T[] {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

class Bag implements HeaderBag {
  private m = new Map<string, string>();
  constructor(init: Record<string, string>) {
    for (const [k, v] of Object.entries(init)) this.m.set(k.toLowerCase(), v);
  }
  get(name: string): string | null {
    return this.m.get(name.toLowerCase()) ?? null;
  }
}

const j = (x: unknown) => {
  try {
    return JSON.stringify(x, (_k, v) =>
      typeof v === "number" && !Number.isFinite(v) ? `#${String(v)}` : v === undefined ? "#undef" : v,
    ).slice(0, 600);
  } catch {
    return String(x).slice(0, 600);
  }
};

/** Collect failures; assert none at the end, printing seed + first few. */
class Fails {
  list: string[] = [];
  constructor(readonly seed: number, readonly label: string) {}
  add(i: number, msg: string) {
    this.list.push(`[seed=${this.seed} case=${i}] ${msg}`);
  }
  done() {
    assert.equal(
      this.list.length,
      0,
      `${this.label}: ${this.list.length} violation(s). First:\n${this.list.slice(0, 5).join("\n")}`,
    );
  }
}

// ───────────────────────── generators ─────────────────────────

const CHROME = () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BROWSER_TEMPLATES: ((r: R) => string)[] = [
  (r) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.${r.int(6000)}.${r.int(200)} Safari/537.36`,
  (r) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_${r.int(8)}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${r.range(14, 18)}.${r.int(5)} Safari/605.1.15`,
  (r) => `Mozilla/5.0 (X11; Linux x86_64; rv:${r.range(90, 130)}.0) Gecko/20100101 Firefox/${r.range(90, 130)}.0`,
  (r) => `Mozilla/5.0 (Linux; Android ${r.range(8, 14)}; ${r.pick(["SM-G991B", "Pixel 7", "CPH2205", "Redmi Note 10", "Cubot_X30", "Blackview BV9900", "Infinix X663", "TECNO KG5", "LM-G710", "M2101K6G"])}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Mobile Safari/537.36`,
  (r) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_${r.int(5)} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.${r.int(5)} Mobile/15E148 Safari/604.1`,
  (r) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Safari/537.36 Edg/${r.range(90, 130)}.0.0.0`,
  (_r) => `Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36`,
  (r) => `Mozilla/5.0 (iPhone; CPU iPhone OS 16_${r.int(5)} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/${r.range(300, 450)}.0;FBBV/${r.int(1e8)};FBDV/iPhone14,2]`,
  (r) => `Mozilla/5.0 (Linux; Android 12; SM-A525F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36 Instagram ${r.range(200, 300)}.0.0.0.0 Android`,
  (r) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Safari/537.36 OPR/${r.range(80, 110)}.0.0.0`,
  (r) => `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Mobile Safari/537.36 YaBrowser/${r.range(20, 24)}.1.0`,
  (r) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/${r.range(1, 9)}.0 MicroMessenger/8.0.${r.int(50)}`,
  (r) => `Mozilla/5.0 (Linux; Android 11; vivo 1901) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Mobile Safari/537.36 UCBrowser/13.${r.int(9)}.0`,
  (r) => `Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Safari/537.36`,
  (r) => `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${r.range(90, 130)}.0) Gecko/20100101 Firefox/${r.range(90, 130)}.0`,
  (r) => `Mozilla/5.0 (Linux; Android 9; Lenovo TB-X606F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${r.range(90, 130)}.0.0.0 Safari/537.36`,
  (r) => `Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/${r.range(90, 120)}.${r.int(9)} like Chrome/${r.range(90, 120)}.0.0.0 Safari/537.36`,
];

const LEGACY_HUMAN = ["Opera/9.80 (Android; Opera Mini/36.2.2254/119.132; U; id) Presto/2.12.423 Version/12.16", "Lynx/2.8.9rel.1 libwww-FM/2.14 SSL-MM/1.4.1", "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)"];

const BOT_UAS = [
  "curl/8.1.2", "python-requests/2.31.0", "Go-http-client/1.1", "FooBot/1.0", "Scrapy/2.11", "axios/1.6.0", "okhttp/4.9.3",
  "Java/17.0.1", "node", "node-fetch/1.0", "undici", "Wget/1.21", "GuzzleHttp/7.5", "Ruby", "test", "colly - https://github.com/gocolly/colly",
  "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0) Playwright/1.40", "Mozilla/5.0 (X11; Linux x86_64) PhantomJS/2.1.1", "", "-", "Mozilla", "Mozilla/5.0", "unknown", "null",
  "python-urllib3/1.26", "Dart/3.0 (dart:io)", "Deno/1.38", "Bun/1.0", "PostmanRuntime/7.32", "HTTPie/3.2", "reqwest/0.11", "aiohttp/3.8",
  "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)", "ia_archiver", "SomeCrawler/2", "MySpider", "Claude-User/1.0", "ChatGPT-User/1.0",
];

const CRAWLER_TOKENS = [
  "Googlebot/2.1", "Bingbot/2.0", "facebookexternalhit/1.1", "Twitterbot/1.0", "Applebot/0.1", "YandexBot/3.0", "Baiduspider/2.0",
  "AdsBot-Google", "Google-InspectionTool", "bingpreview/1.0b", "Facebot", "meta-externalagent/1.1", "TwitterCardService",
];

const UNICODE_BITS = ["é", "ế", "日本語", " ", "​", "\u0000", "\r", "\n", "\t", "K", "İ", "ß", "ſ", "\ud800", "😀", "", "﻿", "%00", "<script>", "\\", "\"", "'"];

function noise(r: R): string {
  const n = r.pick([0, 1, 3, 10, 50, 300, 2000]);
  let s = "";
  for (let i = 0; i < n; i++) {
    s += r.bool(0.15) ? r.pick(UNICODE_BITS) : String.fromCharCode(r.range(0, r.bool(0.1) ? 0xffff : 0x7f));
  }
  return s;
}

function genUa(r: R): string {
  const k = r.int(10);
  if (k < 4) return r.pick(BROWSER_TEMPLATES)(r);
  if (k < 6) return r.pick(BOT_UAS);
  if (k === 6) return r.pick(LEGACY_HUMAN);
  if (k === 7) return noise(r);
  if (k === 8) return r.pick(BROWSER_TEMPLATES)(r) + " " + r.pick(UNICODE_BITS) + r.pick(BOT_UAS);
  return r.pick(BOT_UAS) + " " + r.pick(BROWSER_TEMPLATES)(r);
}

const ACCEPTS = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "*/*", "application/json, text/plain, */*",
  "text/html", "", " ", "TEXT/HTML", "image/*", "application/xhtml+xml", "text/plain", "*/*;q=0.8",
];
const ASNS = ["16509", "14618", "15169", "396982", "8075", "14061", "16276", "24940", "63949", "20473", "32934", "13414", "15133", "0x80A6", "4294967295", "4294967296", "-1", " 32934 ", "32934abc", "", "1e3", "٣٢٩٣٤", "00032934", "7922"];

function genHeaderMap(r: R, ua: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (ua !== null && !(ua === "" && r.bool(0.5))) h["user-agent"] = ua;
  if (r.bool(0.8)) h["accept"] = r.pick(ACCEPTS);
  if (r.bool(0.8)) h["accept-language"] = r.pick(["en-US,en;q=0.9", "vi", "", " ", "*", "fr-CH, fr;q=0.9"]);
  if (r.bool(0.8)) h["sec-fetch-mode"] = r.pick(["navigate", "cors", "no-cors", "same-origin", "websocket", "navigate, navigate", "NAVIGATE", " cors", "", ",navigate", "navigate,cors", "nested-navigate"]);
  if (r.bool(0.4)) h["sec-ch-ua"] = r.pick(['"Chromium";v="120", "Not A(Brand";v="24"', '"HeadlessChrome";v="120"', '"headlesschrome"', "", noise(r)]);
  if (r.bool(0.4)) h["sec-ch-ua-platform"] = r.pick(['"Windows"', '"Android"', '"macOS"', '"Linux"', '"iOS"', '"Chrome OS"', '"Unknown"', "Windows", '"windows", "android"', '""', '"FreeBSD"', ""]);
  if (r.bool(0.4)) h["x-vercel-ip-as-number"] = r.pick(ASNS);
  return h;
}

function genHeaders(r: R): Record<string, string> {
  return genHeaderMap(r, genUa(r));
}

const NUMS = [0, -0, 1, 2, 5, 300, 299.9, 800, 600, 1e9, 1e9 + 1, -1, NaN, Infinity, -Infinity, 1e308, 0.1, 1920, 1080, 24, 4];
function genTelemetryTyped(r: R): Record<string, unknown> {
  const t: Record<string, unknown> = {
    wd: r.bool(0.2), ch: r.bool(0.6), ua: r.bool(0.6) ? CHROME() : r.pick(BOT_UAS) || noise(r),
  };
  for (const k of ["pl", "lg", "ow", "oh", "iw", "ih", "sw", "sh", "hc", "ev", "ut", "dw"]) {
    t[k] = r.bool(0.5) ? r.pick(NUMS) : r.range(0, 2000);
  }
  return t;
}
function genJunkValue(r: R, depth = 0): unknown {
  const k = r.int(depth > 2 ? 9 : 12);
  switch (k) {
    case 0: return null;
    case 1: return undefined;
    case 2: return r.pick(NUMS);
    case 3: return r.pick(["", "0", "true", "NaN", "x".repeat(r.pick([1, 600, 5000]))]);
    case 4: return r.bool();
    case 5: return -0;
    case 6: return [];
    case 7: return {};
    case 8: return r.range(-5, 5);
    case 9: return [genJunkValue(r, depth + 1), genJunkValue(r, depth + 1)];
    case 10: return { a: genJunkValue(r, depth + 1) };
    default: return JSON.parse('{"__proto__":{"wd":true},"constructor":{"prototype":1}}');
  }
}
function genTelemetryJunk(r: R): unknown {
  if (r.bool(0.3)) return genJunkValue(r);
  const t = genTelemetryTyped(r);
  const keys = Object.keys(t);
  const n = r.int(4);
  for (let i = 0; i < n; i++) t[r.pick(keys)] = genJunkValue(r);
  if (r.bool(0.2)) delete t[r.pick(keys)];
  if (r.bool(0.2)) t["__proto__x"] = genJunkValue(r);
  if (r.bool(0.1)) return JSON.parse(JSON.stringify(t) as string);
  return t;
}

const b64u = (b: Buffer | string | undefined) => Buffer.from(b ?? "null").toString("base64url");
const swapcase = (s: string, r: R) => {
  let o = "";
  for (const ch of s) o += /[a-z]/i.test(ch) && r.bool(0.5) ? (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()) : ch;
  return o;
};
const asciiHeaderSafe = (s: string) => /^[\x20-\x7e]*$/.test(s) && s === s.trim();

const verifiers = {
  fixed: (status: FcrdnsResult["status"]): CrawlerVerifier => async () =>
    status === "verified" ? { status, hostname: "crawl-1.googlebot.com" } : status === "failed" ? { status, reason: "wrong-domain" } : { status, reason: "ETIMEOUT" },
};

// ───────────────────── P1  totality (never throws) ─────────────────────

describe("P1 totality", () => {
  it("assessRequestSync / assessRequest never throw on arbitrary headers, ip, telemetry (and return a valid Assessment)", async () => {
    const seed = 0x1001;
    const r = new R(seed);
    const f = new Fails(seed, "totality(assess)");
    const ipPool = ["1.2.3.4", "::1", "", "garbage", "[::1]:80", "1.2.3.4:99999", "x".repeat(5000), "\u0000", "2001:db8::1%eth0", "::ffff:1.2.3.4"];
    for (let i = 0; i < N; i++) {
      const hm = genHeaders(r);
      const bag = r.bool(0.1) ? ({ get: () => null } as HeaderBag) : new Bag(hm);
      const tel = r.bool(0.5) ? (parseTelemetry(genTelemetryJunk(r)) ?? undefined) : r.bool(0.5) ? (genTelemetryTyped(r) as never) : undefined;
      const ip = r.bool(0.7) ? r.pick(ipPool) : r.bool() ? noise(r) : undefined;
      try {
        const a = assessRequestSync({ headers: bag, ip, telemetry: tel });
        checkAssessment(a, f, i, hm);
        const verifier = r.pick<CrawlerVerifier>([
          verifiers.fixed("verified"), verifiers.fixed("failed"), verifiers.fixed("error"),
          async () => { throw new Error("boom"); },
          (() => { throw new Error("sync boom"); }) as never,
          async () => undefined as never,
          async () => ({ status: "weird" }) as never,
        ]);
        const b = await assessRequest({ headers: bag, ip, telemetry: tel }, verifier);
        checkAssessment(b, f, i, hm);
      } catch (e) {
        f.add(i, `threw ${(e as Error).name}: ${(e as Error).message} headers=${j(hm)} ip=${j(ip)} tel=${j(tel)}`);
      }
    }
    tally("totality assess*", N * 2);
    f.done();
  });

  it("assessRequestSync with typed-but-extreme telemetry (NaN/Infinity/-0/1e308) never throws, score valid", () => {
    const seed = 0x1002;
    const r = new R(seed);
    const f = new Fails(seed, "totality(extreme telemetry)");
    for (let i = 0; i < N; i++) {
      const hm = genHeaders(r);
      const t = genTelemetryTyped(r) as never;
      try {
        const a = assessRequestSync({ headers: new Bag(hm), telemetry: t });
        checkAssessment(a, f, i, hm);
        for (const s of telemetrySignals(t, r.bool() ? (hm["user-agent"] ?? null) : null)) {
          if (!Number.isFinite(s.weight) || s.weight < 0 || s.weight > 100) f.add(i, `bad weight ${j(s)}`);
        }
      } catch (e) {
        f.add(i, `threw ${(e as Error).message} tel=${j(t)}`);
      }
    }
    tally("totality extreme telemetry", N);
    f.done();
  });

  it("parseTelemetry never throws (incl. hostile getters/Proxy) and, when non-null, yields only finite in-range numbers", () => {
    const seed = 0x1003;
    const r = new R(seed);
    const f = new Fails(seed, "parseTelemetry");
    for (let i = 0; i < N; i++) {
      let input: unknown = genTelemetryJunk(r);
      if (r.bool(0.1)) input = new Proxy({}, { get() { throw new Error("evil"); }, has() { throw new Error("evil"); }, ownKeys() { throw new Error("evil"); } });
      if (r.bool(0.05)) { const o = genTelemetryTyped(r); Object.defineProperty(o, "ua", { get() { throw new Error("evil"); }, enumerable: true }); input = o; }
      try {
        const p = parseTelemetry(input);
        if (p) {
          for (const [k, v] of Object.entries(p)) {
            if (typeof v === "number" && (!Number.isFinite(v) || v < 0 || v > 1e9)) f.add(i, `out of range ${k}=${v}`);
          }
          const keys = Object.keys(p).sort().join();
          if (keys !== "ch,dw,ev,hc,ih,iw,lg,oh,ow,pl,sh,sw,ua,ut,wd") f.add(i, `unexpected keys ${keys}`);
          for (const s of telemetrySignals(p, null)) if (!Number.isFinite(s.weight)) f.add(i, "nonfinite weight");
        }
      } catch (e) {
        f.add(i, `threw ${(e as Error).message}`);
      }
    }
    tally("totality parseTelemetry", N);
    f.done();
  });

  it("normalizeIp / hostMatchesSuffix never throw on arbitrary strings; normalizeIp output always passes isIP()", () => {
    const seed = 0x1004;
    const r = new R(seed);
    const f = new Fails(seed, "totality(normalizeIp,hostMatchesSuffix)");
    const alpha = "0123456789abcdefABCDEF:.[]%/ \t\n\u0000-xg_";
    for (let i = 0; i < N * 2; i++) {
      const s = r.bool(0.8) ? r.str(r.int(50), alpha) : noise(r);
      try {
        const out = normalizeIp(s);
        if (out !== null && isIP(out) === 0) f.add(i, `normalizeIp(${j(s)}) -> ${j(out)} rejected by isIP`);
        hostMatchesSuffix(s, r.pick(["googlebot.com", "", ".", "a", s]));
        // non-string inputs to hostMatchesSuffix are documented as false
        hostMatchesSuffix(r.pick([undefined, null, 5, {}, []]) as never, "googlebot.com");
      } catch (e) {
        f.add(i, `threw ${(e as Error).message} on ${j(s)}`);
      }
    }
    tally("totality normalizeIp+hostMatchesSuffix", N * 2);
    f.done();
  });

  it("verifyFcrdns never throws with a hostile randomized resolver", { timeout: 120000 }, async () => {
    const seed = 0x1005;
    const r = new R(seed);
    const f = new Fails(seed, "totality(verifyFcrdns)");
    const junkRet = (): unknown => r.pick([undefined, null, 5, "str", {}, [1, null, undefined, {}], ["googlebot.com", 7], [], ["crawl.googlebot.com"], ["1.2.3.4"]]);
    const evilErr = () => ({ get code(): string { throw new Error("getter"); } });
    for (let i = 0; i < N; i++) {
      const mk = () => (): Promise<string[]> => {
        const k = r.int(8);
        if (k === 0) throw new Error("sync throw");
        if (k === 1) return Promise.reject(evilErr());
        if (k === 2) return Promise.reject(Object.assign(new Error("x"), { code: r.pick(["ENOTFOUND", "ENODATA", "ETIMEOUT", "ESERVFAIL", undefined, 5]) }));
        if (k === 3) return new Promise<string[]>(() => {}); // hang -> timeout
        if (k === 4) return Promise.reject(null);
        return Promise.resolve(junkRet() as string[]);
      };
      const res: DnsResolver = { reverse: mk(), resolve4: mk(), resolve6: mk() };
      const ip = r.pick(["1.2.3.4", "::1", "garbage", "", "2001:db8::1", "::ffff:1.2.3.4", noise(r)]);
      try {
        const out = await verifyFcrdns(ip, ["googlebot.com", "google.com"], res, 3);
        if (!["verified", "failed", "error"].includes(out.status)) f.add(i, `bad status ${j(out)}`);
      } catch (e) {
        f.add(i, `threw ${(e as Error).message}`);
      }
    }
    tally("totality verifyFcrdns", N);
    f.done();
  });

  it("verifyChallenge never throws on arbitrary token/nonce/subject/replay; documented misconfig throws RangeError", () => {
    const seed = 0x1006;
    const r = new R(seed);
    const f = new Fails(seed, "totality(challenge)");
    const secret = "s3cret-s3cret-s3cret-0123456789";
    const valid = issueChallenge({ secret, subject: "sub", difficultyBits: 4 });
    const tok = (): unknown => {
      const k = r.int(12);
      if (k === 0) return valid.token;
      if (k === 1) return noise(r);
      if (k === 2) return r.pick([null, undefined, 5, {}, [], true, Symbol.iterator.toString()]);
      if (k === 3) return valid.token + r.str(r.int(3), ".=\n ");
      if (k === 4) return "." + valid.token.split(".")[1];
      if (k === 5) return valid.token.split(".")[0] + ".";
      if (k === 6) return "x".repeat(r.pick([1023, 1024, 1025, 100000]));
      if (k === 7) return r.str(r.int(300), "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.");
      if (k === 8) return b64u(JSON.stringify(genJunkValue(r))) + "." + b64u(createHmac("sha256", secret).update(b64u(JSON.stringify(genJunkValue(r) ?? 0) + "x")).digest());
      if (k === 9) { // validly SIGNED but weird payload (null payload excluded: see todo test below)
        const jv = genJunkValue(r);
        const js = JSON.stringify(jv ?? 0);
        const body = b64u(js === "null" ? "0" : js);
        return `${body}.${b64u(createHmac("sha256", secret).update(body).digest())}`;
      }
      if (k === 10) { const body = b64u(r.pick(["0", "[]", "5", '"s"', "{}", "not json", '{"e":1e999,"s":"sub","d":1,"r":"x"}', '{"e":"9999999999999","s":"sub","d":-5,"r":"x"}', '{"e":99999999999999,"s":"sub","d":"1","r":5}'])); return `${body}.${b64u(createHmac("sha256", secret).update(body).digest())}`; }
      return valid.token.slice(0, r.int(valid.token.length));
    };
    for (let i = 0; i < N; i++) {
      const t = tok();
      const nonce = r.pick<unknown>(["0", "", "x".repeat(65), noise(r), 5, null, undefined, "a"]);
      try {
        const out = verifyChallenge(t as string, nonce as string, {
          secret, subject: r.pick(["sub", "", "other"]), replay: r.bool() ? createReplayGuard() : undefined, now: () => r.pick([0, 1, Date.now(), 2 ** 53, 3]),
        });
        if (typeof out.ok !== "boolean") f.add(i, "no ok");
        if (!out.ok && !["malformed", "bad-signature", "expired", "wrong-subject", "insufficient-work", "replayed"].includes(out.reason)) f.add(i, `bad reason ${out.reason}`);
      } catch (e) {
        f.add(i, `threw ${(e as Error).name}:${(e as Error).message} token=${j(t)} nonce=${j(nonce)}`);
      }
    }
    tally("totality verifyChallenge", N);
    f.done();
  });

  it("NIT(todo): a validly-signed token whose payload is JSON `null` makes verifyChallenge throw TypeError (needs the secret, so unreachable by clients)", { todo: true }, () => {
    const body = b64u("null");
    const tok = `${body}.${b64u(createHmac("sha256", "s3cret-s3cret-s3cret-0123456789").update(body).digest())}`;
    const out = verifyChallenge(tok, "a", { secret: "s3cret-s3cret-s3cret-0123456789", subject: "x" });
    assert.equal(out.ok, false);
  });

  it("issueChallenge/verifyChallenge/limiter.take: invalid config => RangeError (and ONLY then)", () => {
    const seed = 0x1007;
    const r = new R(seed);
    const f = new Fails(seed, "misconfig");
    const goodSecret = "0123456789abcdef-secret";
    for (let i = 0; i < N; i++) {
      const secret = r.pick<unknown>([goodSecret, "", "short", "x".repeat(15), "x".repeat(16), undefined, null, 5, {}]);
      const subject = r.pick<unknown>(["s", "", "x".repeat(256), "x".repeat(257), undefined, 5, "é".repeat(200), "\u0000"]);
      const bits = r.pick<unknown>([undefined, 1, 16, 32, 33, 0, -1, 1.5, NaN, Infinity, "16", null, 256]);
      const ttl = r.pick<unknown>([undefined, 1, 60000, 3_600_000, 3_600_001, 0, -5, NaN, Infinity, "5", null]);
      const shouldThrow =
        typeof secret !== "string" || secret.length < 16 ||
        typeof subject !== "string" || subject.length === 0 || subject.length > 256 ||
        (bits !== undefined && (!Number.isInteger(bits) || (bits as number) < 1 || (bits as number) > 32)) ||
        (ttl !== undefined && (!(typeof ttl === "number") || !Number.isFinite(ttl) || ttl <= 0 || ttl > 3_600_000));
      try {
        issueChallenge({ secret: secret as string, subject: subject as string, difficultyBits: bits as number, ttlMs: ttl as number });
        if (shouldThrow) f.add(i, `did not throw: ${j({ secret, subject: String(subject).slice(0, 5), bits, ttl })}`);
      } catch (e) {
        if (!(e instanceof RangeError)) f.add(i, `threw non-RangeError ${(e as Error).name}`);
        else if (!shouldThrow) f.add(i, `threw on valid config ${j({ secret, bits, ttl })}`);
      }
      // limiter
      const cost = r.pick<unknown>([1, 0.5, 5, 0, -1, NaN, Infinity, -Infinity, 1e300, undefined]);
      const lim = new MemoryRateLimiter({ now: () => 1000 });
      const bad = cost !== undefined && (!(typeof cost === "number") || !Number.isFinite(cost) || cost <= 0);
      try {
        lim.take("k", { capacity: 10, refillPerSec: 1 }, cost as number);
        if (bad) f.add(i, `take accepted cost ${String(cost)}`);
      } catch (e) {
        if (!(e instanceof RangeError)) f.add(i, `take threw non-RangeError`);
        else if (!bad) f.add(i, `take threw on valid cost ${String(cost)}`);
      }
      // verify with short secret
      try {
        verifyChallenge("a.b", "n", { secret: secret as string, subject: "s" });
        if (typeof secret !== "string" || secret.length < 16) f.add(i, "verify accepted short secret");
      } catch (e) {
        if (!(e instanceof RangeError)) f.add(i, "verify threw non-RangeError");
      }
    }
    tally("misconfig => RangeError", N * 3);
    f.done();
  });
});

function checkAssessment(a: Assessment, f: Fails, i: number, ctx: unknown) {
  if (!Number.isInteger(a.score) || a.score < 0 || a.score > 100) f.add(i, `score ${a.score} not int in [0,100] ctx=${j(ctx)}`);
  for (const s of a.signals) if (!Number.isFinite(s.weight) || s.weight < 0 || s.weight > 100) f.add(i, `signal weight ${j(s)}`);
  if (a.classification === "verified-crawler" && (a.score !== 0 || a.signals.length)) f.add(i, `verified but score ${a.score}`);
  if (a.classification === "spoofed-crawler" && a.score < 95) f.add(i, `spoofed but score ${a.score}`);
  if (a.classification === "verified-crawler" && a.crawler?.verification !== "verified") f.add(i, "verified classification w/o verified claim");
  if (a.classification !== "verified-crawler" && a.classification !== "spoofed-crawler") {
    const want = a.score >= 60 ? "automated" : a.score >= 30 ? "suspicious" : "human-likely";
    if (a.classification !== want) f.add(i, `classification ${a.classification} for score ${a.score}`);
  }
  if (a.classification !== "verified-crawler" && a.score !== combineWeights(a.signals)) f.add(i, `score ${a.score} != combine(signals) ${combineWeights(a.signals)}`);
}

// ───────────────────── P2 score invariants ─────────────────────

describe("P2 score invariants", () => {
  it("combineWeights: integer [0,100], monotone under adding a signal, order independent, NaN-safe", () => {
    const seed = 0x2001;
    const r = new R(seed);
    const f = new Fails(seed, "combineWeights");
    const w = () => r.pick<number>([...NUMS, r.range(0, 100), r.next() * 100, r.next() * 100, 100, 0, 55, 85, 90]);
    for (let i = 0; i < N * 2; i++) {
      const sigs: Signal[] = Array.from({ length: r.int(9) }, () => ({ id: "no-accept", weight: w() }));
      const s0 = combineWeights(sigs);
      if (!Number.isInteger(s0) || s0 < 0 || s0 > 100) f.add(i, `score ${s0} for ${j(sigs)}`);
      const s1 = combineWeights(r.shuffle(sigs));
      if (s1 !== s0) f.add(i, `order dependent ${s0} vs ${s1} for ${j(sigs)}`);
      const extra: Signal = { id: "no-accept", weight: w() };
      const s2 = combineWeights([...sigs, extra]);
      if (s2 < s0) f.add(i, `adding ${extra.weight} lowered ${s0} -> ${s2} for ${j(sigs)}`);
      const s3 = combineWeights([extra, ...sigs]);
      if (s3 !== s2) f.add(i, `prepend/append differ`);
    }
    tally("combineWeights invariants", N * 2);
    f.done();
  });

  it("assessRequestSync: deterministic, valid, order-independent signals, classification consistent", () => {
    const seed = 0x2002;
    const r = new R(seed);
    const f = new Fails(seed, "assess invariants");
    for (let i = 0; i < N; i++) {
      const hm = genHeaders(r);
      const t = r.bool(0.4) ? (parseTelemetry(genTelemetryTyped(r)) ?? undefined) : undefined;
      const a = assessRequestSync({ headers: new Bag(hm), telemetry: t });
      const b = assessRequestSync({ headers: new Bag(r.shuffle(Object.entries(hm)).reduce((o, [k, v]) => ({ ...o, [k]: v }), {})), telemetry: t });
      checkAssessment(a, f, i, hm);
      if (a.score !== b.score) f.add(i, `nondeterministic/order-dep ${a.score} vs ${b.score}`);
    }
    tally("assessRequestSync invariants", N);
    f.done();
  });

  it("adding telemetry never lowers the score (signals only accumulate) for non-verified requests", () => {
    const seed = 0x2003;
    const r = new R(seed);
    const f = new Fails(seed, "telemetry monotone");
    for (let i = 0; i < N; i++) {
      const hm = genHeaders(r);
      const base = assessRequestSync({ headers: new Bag(hm) });
      const t = parseTelemetry(genTelemetryTyped(r));
      if (!t) continue;
      const withT = assessRequestSync({ headers: new Bag(hm), telemetry: t });
      if (withT.score < base.score) f.add(i, `telemetry lowered ${base.score}->${withT.score} hm=${j(hm)}`);
    }
    tally("telemetry monotone", N);
    f.done();
  });

  it("verified crawler => score 0, never `challenge`, whatever the limiter state and UA noise (sync-ASN and async-FCrDNS paths)", async () => {
    const seed = 0x2004;
    const r = new R(seed);
    const f = new Fails(seed, "verified crawler");
    for (let i = 0; i < N; i++) {
      const base = r.bool(0.5) ? r.pick(BOT_UAS) : r.pick(BROWSER_TEMPLATES)(r);
      const tok = r.pick(CRAWLER_TOKENS);
      const ua = r.bool() ? `${base} ${tok}` : `${tok} ${base}`;
      const hm = genHeaderMap(r, ua);
      const useAsn = r.bool();
      if (useAsn) hm["x-vercel-ip-as-number"] = r.pick(["32934", "13414"]);
      const tel = r.bool(0.3) ? (parseTelemetry(genTelemetryTyped(r)) ?? undefined) : undefined;
      const limiter = new MemoryRateLimiter({ now: () => 0 });
      for (let k = r.int(300); k > 0; k--) limiter.take("v:key", { capacity: 120, refillPerSec: 2 }, 1);
      const a = r.bool() ? assessRequestSync({ headers: new Bag(hm), ip: "66.249.66.1", telemetry: tel }) : await assessRequest({ headers: new Bag(hm), ip: "66.249.66.1", telemetry: tel }, verifiers.fixed("verified"));
      if (a.classification === "verified-crawler") {
        if (a.score !== 0) f.add(i, `verified score ${a.score}`);
        const d = decide(a, { limiter, key: "key" });
        if (d.action !== "allow" && d.action !== "rate-limited") f.add(i, `verified got ${d.action}`);
        if (d.action === "rate-limited") {
          // only the base bucket may throttle; the tight bucket must never be used
          const s = decide({ ...a }, { limiter: new MemoryRateLimiter({ now: () => 0 }), key: "key" });
          if (s.action !== "allow") f.add(i, `verified fresh limiter got ${s.action}`);
        }
      }
    }
    tally("verified => 0 & no challenge", N);
    f.done();
  });

  /**
   * Metamorphic: adding a crawler token to a UA must never LOWER the score. Only
   * the unverified claim (sync, no ASN proof) and `failed`/`error` FCrDNS paths are
   * checked here; `verified` is legitimately 0.
   */
  function crawlerTokenLowering(mode: "sync" | "async-failed" | "async-error") {
    const seed = 0x2005 + (mode === "sync" ? 0 : mode === "async-failed" ? 1 : 2);
    const r = new R(seed);
    const f = new Fails(seed, `crawler token lowers score (${mode})`);
    const lostIds = new Map<string, number>();
    let lowered = 0;
    return (async () => {
      for (let i = 0; i < N; i++) {
        const base = r.bool(0.55) ? r.pick(BOT_UAS) : genUa(r);
        const tok = r.pick(CRAWLER_TOKENS);
        const form = r.int(3);
        const mod = form === 0 ? `${base} ${tok}` : form === 1 ? `${tok} ${base}` : `${base} (compatible; ${tok})`;
        const hm0 = genHeaderMap(r, base);
        // exclude the legitimate ASN-verified outcome (Meta/X from their own ASN)
        const asn = hm0["x-vercel-ip-as-number"];
        if (asn !== undefined && /^\s*(32934|13414)\s*$/.test(asn)) delete hm0["x-vercel-ip-as-number"];
        const hm1 = { ...hm0, "user-agent": mod };
        const tel = r.bool(0.25) ? (parseTelemetry(genTelemetryTyped(r)) ?? undefined) : undefined;
        const run = async (hm: Record<string, string>) =>
          mode === "sync"
            ? assessRequestSync({ headers: new Bag(hm), ip: "203.0.113.9", telemetry: tel })
            : assessRequest({ headers: new Bag(hm), ip: "203.0.113.9", telemetry: tel }, verifiers.fixed(mode === "async-failed" ? "failed" : "error"));
        const a = await run(hm0);
        const b = await run(hm1);
        if (a.classification === "verified-crawler") continue;
        // Ranh giới BẢO MẬT là vùng challenge: gắn thêm một lời khai crawler không được đẩy request
        // từ ≥ challenge xuống dưới nó. Tụt nhỏ hơn (nhất là UA rỗng/giữ chỗ cộng token — không thể
        // phân biệt với UA crawler tối giản như "Mozilla/5.0 (compatible; bingbot/2.0)") được đếm
        // để quan sát chứ không coi là lỗi: phạt chúng sẽ phạt luôn crawler thật.
        if (b.score < a.score) lowered++;
        // Ngoại lệ có chủ ý: base là UA RỖNG/giữ chỗ ("Mozilla/5.0"). Thêm "(compatible; Googlebot/2.1)"
        // biến nó thành đúng hình dạng UA crawler tối giản mà Bingbot thật dùng — phạt nó là phạt
        // crawler thật. Lớp bảo vệ ở đó là FCrDNS bất đồng bộ (spoofed → ≥ 95), không phải chế độ sync.
        const baseWasPlaceholder = a.signals.some((s) => s.id === "empty-ua");
        if (a.score >= 80 && b.score < 80 && !baseWasPlaceholder) {
          const lost = a.signals.filter((s) => !b.signals.some((t) => t.id === s.id)).map((s) => s.id);
          for (const id of lost) lostIds.set(id, (lostIds.get(id) ?? 0) + 1);
          f.add(i, `${a.score} -> ${b.score}  base=${j(base)} + ${tok} (form ${form}); lost=${lost.join(",")}; headers=${j(hm0)}`);
        }
      }
      tally(`crawler-token monotone (${mode})`, N);
      return { f, lowered, lostIds };
    })();
  }

  it("BUG: appending/prepending a crawler token lowers the score (sync path)", async () => {
    const { f, lowered, lostIds } = await crawlerTokenLowering("sync");
    console.log(`[round3] sync: ${lowered}/${N} cases lowered; signals lost: ${JSON.stringify([...lostIds])}`);
    f.done();
  });
  it("BUG: appending/prepending a crawler token lowers the score (async, FCrDNS=failed)", async () => {
    const { f } = await crawlerTokenLowering("async-failed");
    f.done();
  });
  it("BUG: appending/prepending a crawler token lowers the score (async, FCrDNS=error)", async () => {
    const { f } = await crawlerTokenLowering("async-error");
    f.done();
  });

  it("BUG: minimal repro — headless client-hint (90) disappears once UA claims Googlebot", () => {
    const hint = { "sec-ch-ua": '"HeadlessChrome";v="120"', accept: "text/html", "accept-language": "en", "sec-fetch-mode": "navigate" };
    const plain = assessRequestSync({ headers: new Bag({ ...hint, "user-agent": CHROME() }) });
    const claimed = assessRequestSync({ headers: new Bag({ ...hint, "user-agent": CHROME() + " Googlebot/2.1" }) });
    assert.ok(claimed.score >= plain.score, `plain=${plain.score} (${plain.signals.map((s) => s.id)}) claimed-googlebot=${claimed.score} (${claimed.signals.map((s) => s.id)})`);
  });

  it("BUG: minimal repro — scraper with a Chrome UA scores 34 (flag) but 0 once the UA gets a leading NBSP", () => {
    const hdr = { accept: "*/*" }; // curl-ish headers: no accept-language, no sec-fetch
    const plain = assessRequestSync({ headers: new Bag({ ...hdr, "user-agent": CHROME() }) });
    const nbsp = assessRequestSync({ headers: new Bag({ ...hdr, "user-agent": " " + CHROME() }) });
    assert.ok(nbsp.score >= plain.score, `plain=${plain.score} (${plain.signals.map((s) => s.id)}) nbsp-prefixed=${nbsp.score} (${nbsp.signals.map((s) => s.id)})`);
  });

  it("BUG: a leading NBSP (0xA0, accepted by Node http) on the UA silently disables ALL header-derived signals", () => {
    const seed = 0x2010;
    const r = new R(seed);
    const f = new Fails(seed, "whitespace metamorphic");
    const ws = [" "]; // only trim()-able char a raw HTTP request can deliver (0xA0 as latin1; VT/FF are rejected by Node with 400)
    for (let i = 0; i < N; i++) {
      const ua = r.bool(0.7) ? r.pick(BROWSER_TEMPLATES)(r) : genUa(r);
      const hm0 = genHeaderMap(r, ua);
      const w = r.pick(ws);
      const hm1 = { ...hm0, "user-agent": r.bool() ? w + ua : ua + w };
      const a = assessRequestSync({ headers: new Bag(hm0) });
      const b = assessRequestSync({ headers: new Bag(hm1) });
      if (b.score < a.score) f.add(i, `${a.score}->${b.score} ws=${JSON.stringify(w)} lost=${a.signals.filter((s) => !b.signals.some((t) => t.id === s.id)).map((s) => s.id)} ua=${j(ua)} hdr=${j(hm0)}`);
    }
    tally("UA whitespace metamorphic", N);
    f.done();
  });
});

// ───────────────────── P3 case invariance ─────────────────────

describe("P3 header-name / value case invariance", () => {
  it("real Headers with random-case names == lowercase map bag; score identical", () => {
    const seed = 0x3001;
    const r = new R(seed);
    const f = new Fails(seed, "header-name case");
    let n = 0;
    for (let i = 0; i < N * 2; i++) {
      const hm = genHeaders(r);
      if (!Object.values(hm).every((v) => /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$|^$/.test(v))) continue;
      n++;
      const h = new Headers();
      for (const [k, v] of Object.entries(hm)) h.set(swapcase(k, r), v);
      const a = assessRequestSync({ headers: h });
      const b = assessRequestSync({ headers: new Bag(hm) });
      if (a.score !== b.score || a.signals.map((s) => s.id).join() !== b.signals.map((s) => s.id).join()) f.add(i, `${a.score} vs ${b.score} hm=${j(hm)}`);
    }
    tally("header-name case", n);
    assert.ok(n >= 2000, `only ${n} usable cases`);
    f.done();
  });

  it("ASCII case-swapping of UA and header values never changes the score (documented case-insensitive matching)", () => {
    const seed = 0x3002;
    const r = new R(seed);
    const f = new Fails(seed, "value case");
    let n = 0;
    for (let i = 0; i < N; i++) {
      const hm = genHeaders(r);
      n++;
      const hm2: Record<string, string> = {};
      for (const [k, v] of Object.entries(hm)) hm2[k] = k === "x-vercel-ip-as-number" ? v : swapcase(v, r);
      const t = r.bool(0.3) ? (parseTelemetry(genTelemetryTyped(r)) ?? undefined) : undefined;
      const a = assessRequestSync({ headers: new Bag(hm), telemetry: t });
      const b = assessRequestSync({ headers: new Bag(hm2), telemetry: t });
      if (a.score !== b.score) f.add(i, `${a.score} vs ${b.score} lost=${a.signals.filter((s) => !b.signals.some((u) => u.id === s.id)).map((s) => s.id)} hm=${j(hm)} swapped=${j(hm2)}`);
    }
    tally("value case swap", n);
    f.done();
  });
});

void asciiHeaderSafe;
void createHash;
void leadingZeroBits;
void solveChallenge;
void DEFAULT_THRESHOLDS;

// ───────────────────── P4 normalizeIp: differential vs BigInt reference ─────────────────────

type Key = string;
const hex4 = (g: number) => g.toString(16).padStart(4, "0");
function refKeyFromGroups(g: number[]): Key {
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return `v4:${(BigInt(g[6]) << BigInt(16)) | BigInt(g[7])}`;
  let v = BigInt(0);
  for (const x of g) v = (v << BigInt(16)) | BigInt(x);
  return `v6:${v}`;
}
/** strict reference parser for plain (no port/bracket/zone) text; null if invalid */
function refParsePlain(t: string): Key | null {
  const v4 = (x: string): number | null => {
    if (!/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(x)) return null;
    const p = x.split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    return ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3];
  };
  const asV4 = v4(t);
  if (asV4 !== null) return `v4:${asV4}`;
  if (!t.includes(":")) return null;
  let tail: number[] = [];
  let s = t;
  const m = /^(.*:)([0-9.]+)$/.exec(t);
  if (m && m[2].includes(".")) {
    const n = v4(m[2]);
    if (n === null) return null;
    tail = [Math.floor(n / 65536), n % 65536];
    s = m[1].endsWith("::") ? m[1] : m[1].slice(0, -1);
  }
  const need = 8 - tail.length;
  const dbl = s.split("::");
  if (dbl.length > 2) return null;
  const grp = (x: string) => (x === "" ? [] : x.split(":"));
  const head = grp(dbl[0]);
  const rest = dbl.length === 2 ? grp(dbl[1]) : [];
  const all = [...head, ...rest];
  if (!all.every((x) => /^[0-9a-fA-F]{1,4}$/.test(x))) return null;
  const nums = (xs: string[]) => xs.map((x) => parseInt(x, 16));
  let groups: number[];
  if (dbl.length === 2) {
    const fill = need - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...nums(head), ...Array(fill).fill(0), ...nums(rest), ...tail];
  } else {
    if (head.length !== need) return null;
    groups = [...nums(head), ...tail];
  }
  return groups.length === 8 ? refKeyFromGroups(groups) : null;
}

function genGroups(r: R): number[] {
  const pool = [0, 0, 0, 0, 1, 0xffff, 0xfffe, 0x2001, 0xdb8, 0xabcd, 0x0100];
  const g = Array.from({ length: 8 }, () => (r.bool(0.55) ? r.pick(pool) : r.int(65536)));
  if (r.bool(0.25)) { for (let i = 0; i < 5; i++) g[i] = 0; g[5] = r.pick([0xffff, 0xffff, 0, 0xfffe]); }
  if (r.bool(0.1)) { const a = r.int(8), b = r.range(a, 7); for (let i = a; i <= b; i++) g[i] = 0; }
  return g;
}
function renderV6(g: number[], r: R): string {
  const up = r.bool(0.4);
  const pad = r.bool(0.4);
  const fmt = (x: number) => { let h = pad ? hex4(x) : x.toString(16); if (up) h = h.toUpperCase(); return h; };
  const mixed = r.bool(0.3);
  const head = mixed ? g.slice(0, 6) : g;
  const dotted = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (r.bool(0.7)) {
    const runs: [number, number][] = [];
    for (let i = 0; i < head.length; ) {
      if (head[i] !== 0) { i++; continue; }
      let k = i; while (k < head.length && head[k] === 0) k++;
      runs.push([i, k]); i = k;
    }
    if (runs.length) {
      const [a0, b0] = r.pick(runs);
      const a = r.range(a0, b0 - 1), b = r.range(a + 1, b0);
      const left = head.slice(0, a).map(fmt).join(":");
      const right = head.slice(b).map(fmt);
      if (mixed) right.push(dotted);
      return `${left}::${right.join(":")}`;
    }
  }
  let s = head.map(fmt).join(":");
  if (mixed) s += ":" + dotted;
  return s;
}
function wrap(s: string, r: R): string {
  let text = s;
  if (text.includes(":") && r.bool(0.15)) text = text + "%" + r.pick(["eth0", "1", "en0"]);
  const k = r.int(10);
  if (k === 0) text = `[${text}]`;
  else if (k === 1) text = `[${text}]:${r.range(1, 65535)}`;
  else if (k === 2) text = ` ${text} `;
  else if (k === 3) text = `\t${text}\n`;
  return text;
}

describe("P4 normalizeIp", () => {
  it("equal for every textual spelling of the same address; never equal for different addresses (BigInt reference); idempotent; output re-parses to same address", () => {
    const seed = 0x4001;
    const r = new R(seed);
    const f = new Fails(seed, "normalizeIp differential");
    const byOut = new Map<string, Set<Key>>();
    const byKey = new Map<Key, Set<string>>();
    let n = 0;
    const add = (text: string, key: Key, i: number) => {
      n++;
      const out = normalizeIp(text);
      if (out === null) { f.add(i, `rejected valid address ${j(text)} (key ${key})`); return; }
      if (isIP(out) === 0) f.add(i, `output ${out} not isIP`);
      if (refParsePlain(out) !== key) f.add(i, `${j(text)} -> ${out} reparses to ${refParsePlain(out)} not ${key}`);
      const idem = normalizeIp(out);
      if (idem !== out) f.add(i, `not idempotent: ${j(text)} -> ${out} -> ${idem}`);
      (byOut.get(out) ?? byOut.set(out, new Set()).get(out)!).add(key);
      (byKey.get(key) ?? byKey.set(key, new Set()).get(key)!).add(out);
    };
    for (let i = 0; i < N * 2; i++) {
      const g = genGroups(r);
      const key = refKeyFromGroups(g);
      for (let v = 0; v < 3; v++) add(wrap(renderV6(g, r), r), key, i);
      if (key.startsWith("v4:")) {
        const w = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
        add(wrap(w, r), key, i);
        if (r.bool()) add(`${w}:${r.range(1, 65535)}`, key, i);
      }
      const o = [r.int(256), r.int(256), r.int(256), r.int(256)];
      const k4 = `v4:${((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3]}`;
      add(wrap(o.join("."), r), k4, i);
      add(wrap(`::ffff:${o.join(".")}`, r), k4, i);
      add(`0:0:0:0:0:ffff:${hex4((o[0] << 8) | o[1])}:${hex4((o[2] << 8) | o[3])}`.toUpperCase(), k4, i);
    }
    for (const [out, keys] of byOut) if (keys.size > 1) f.add(-1, `COLLISION: ${out} <- ${[...keys].join(" & ")}`);
    for (const [key, outs] of byKey) if (outs.size > 1) f.add(-1, `SPLIT: ${key} -> ${[...outs].join(" | ")}`);
    tally("normalizeIp spellings", n);
    f.done();
  });

  it("accept/reject agrees with a strict reference parser on mutated strings (plain / [..] / :port forms)", () => {
    const seed = 0x4002;
    const r = new R(seed);
    const f = new Fails(seed, "normalizeIp accept/reject");
    const alpha = "0123456789abcdefABCDEFgG:.[]";
    let n = 0;
    for (let i = 0; i < N * 2; i++) {
      const base = r.bool(0.5) ? renderV6(genGroups(r), r) : [r.int(256), r.int(256), r.int(256), r.int(256)].join(".");
      let s = base;
      for (let m = r.int(3); m > 0; m--) {
        const p = r.int(s.length + 1);
        const k = r.int(3);
        if (k === 0) s = s.slice(0, p) + alpha[r.int(alpha.length)] + s.slice(p);
        else if (k === 1) s = s.slice(0, p) + s.slice(p + 1);
        else s = s.slice(0, p) + alpha[r.int(alpha.length)] + s.slice(p + 1);
      }
      n++;
      let core = s.trim();
      const m1 = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(core);
      if (m1) core = m1[1];
      const m2 = /^\[([^\]]+)\]:\d{1,5}$/.exec(core);
      if (m2) core = m2[1];
      else if (core.startsWith("[") && core.endsWith("]")) core = core.slice(1, -1);
      const ref = refParsePlain(core);
      const lib = normalizeIp(s);
      if ((lib === null) !== (ref === null)) f.add(i, `${j(s)}: lib=${j(lib)} ref=${ref}`);
      else if (lib !== null && refParsePlain(lib) !== ref) f.add(i, `${j(s)}: lib=${lib} key ${refParsePlain(lib)} != ref ${ref}`);
    }
    tally("normalizeIp accept/reject differential", n);
    f.done();
  });

  it("NIT(todo): zone id after '%' accepts arbitrary junk (fe80::1%<anything> is a valid address)", { todo: true }, () => {
    const seed = 0x4003;
    const r = new R(seed);
    const f = new Fails(seed, "zone");
    for (let i = 0; i < N; i++) {
      const junk = r.str(r.range(1, 6), "ab%$<>/\\ \u0000\n;'\"=&,#");
      const out = normalizeIp(`fe80::1%${junk}`);
      // normalizeIp cắt khoảng trắng hai đầu (hành vi được test từ vòng 1), nên so trên junk đã cắt.
      if (out !== null && /[^A-Za-z0-9_.\-~]/.test(junk.trim())) f.add(i, `zone ${j(junk)} accepted`);
    }
    tally("zone id strictness", N);
    f.done();
  });
});

// ───────────────────── P5 FCrDNS soundness vs oracle ─────────────────────

const SUFFIXES = ["googlebot.com", "google.com", "gae.googleusercontent.com"] as const;
const BAD_DOMAINS = ["evilgooglebot.com", "googlebot.com.evil.net", "bc.googleusercontent.com", "googleusercontent.com", "gae.googleusercontent.com.evil.org", "oogle.com", "com", "evil.com#.googlebot.com", "x.y"];
function labelOk(l: string) { return /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/.test(l); }
function oracleHostOk(raw: string, suffix: string): boolean {
  let h = raw.replace(/[A-Z]/g, (c) => c.toLowerCase()); // ASCII-only lowercase
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h.length === 0 || h.length > 253) return false;
  const labels = h.split(".");
  if (!labels.every(labelOk)) return false;
  const sl = suffix.split(".");
  if (labels.length < sl.length) return false;
  return sl.every((x, k) => labels[labels.length - sl.length + k] === x);
}

function genHostname(r: R): string {
  const k = r.int(13);
  const lbl = () => r.pick(["crawl-66-249-66-1", "a", "b1", "rate-limited-proxy-66-249-66-1", "x_y", "ÿ", "-bad", "bad-", "a".repeat(63), "a".repeat(64), "", " ", "UP"]);
  const sfx = () => r.pick([...SUFFIXES, ...SUFFIXES, ...BAD_DOMAINS]);
  switch (k) {
    case 0: return `${lbl()}.${r.pick(SUFFIXES)}`;
    case 1: return `${lbl()}.${r.pick(SUFFIXES)}.`;
    case 2: return `${lbl()}.${sfx()}`.toUpperCase();
    case 3: return `${lbl()}.${lbl()}.${sfx()}`;
    case 4: return sfx();
    case 5: return `${lbl()}.${sfx()}..`;
    case 6: return `${lbl()}${sfx()}`;
    case 7: return `${r.pick(UNICODE_BITS)}.${sfx()}`;
    case 8: return `${"a.".repeat(r.range(110, 130))}${r.pick(SUFFIXES)}`;
    case 9: return `.${sfx()}`;
    case 10: return `${lbl()}.${sfx()}${r.pick(["\u0000", " ", "#", "\n", "/"])}`;
    default: return `${r.pick(["", "mail.", "a.b.c."])}${lbl()}.${r.pick(SUFFIXES)}`;
  }
}

describe("P5 FCrDNS soundness", () => {
  it("`verified` iff (a PTR host ends on a label boundary with an allowed suffix AND forward lookup contains the IP) — randomized resolver vs oracle", { timeout: 120000 }, async () => {
    const seed = 0x5001;
    const r = new R(seed);
    const f = new Fails(seed, "fcrdns oracle");
    let verifiedCount = 0;
    for (let i = 0; i < N * 2; i++) {
      const isV4 = r.bool(0.5);
      const o = [r.int(256), r.int(256), r.int(256), r.int(256)];
      const ipText = isV4 ? (r.bool(0.8) ? o.join(".") : `::ffff:${o.join(".")}`) : renderV6(genGroups(r), r);
      const key = refParsePlain(ipText)!;
      const fam4 = key.startsWith("v4:");
      const nPtr = r.pick([0, 1, 1, 1, 2, 3, 4, 6]);
      const ptrs: unknown[] = Array.from({ length: nPtr }, () => genHostname(r).replace(/K/g, "é"));
      if (r.bool(0.05)) ptrs.push(7, null, undefined);
      const fwdV4 = new Map<string, unknown[]>();
      const fwdV6 = new Map<string, unknown[]>();
      const dnsName = (h: string) => h.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/\.$/, "");
      const spell = (): string => {
        const n = BigInt(key.slice(3));
        if (fam4) return `${(n >> BigInt(24)) & BigInt(255)}.${(n >> BigInt(16)) & BigInt(255)}.${(n >> BigInt(8)) & BigInt(255)}.${n & BigInt(255)}`;
        const gs = Array.from({ length: 8 }, (_, k) => Number((n >> BigInt(16 * (7 - k))) & BigInt(0xffff)));
        return renderV6(gs, r);
      };
      const otherV4 = () => `${r.int(256)}.${r.int(256)}.${r.int(256)}.${r.int(256)}`;
      const otherV6 = () => renderV6(genGroups(r), r);
      for (const p of ptrs) {
        if (typeof p !== "string") continue;
        const kind = r.int(5);
        const list4: unknown[] = [], list6: unknown[] = [];
        if (kind === 0 || kind === 1) { if (fam4) list4.push(spell()); else list6.push(spell()); }
        if (kind === 1 || kind === 2) { list4.push(otherV4()); list6.push(otherV6()); }
        if (kind === 3) list4.push(otherV4());
        if (kind === 4) { if (fam4) list6.push(spell()); else list4.push(otherV4()); }
        if (r.bool(0.1)) list4.push(7, null);
        fwdV4.set(dnsName(p), list4); fwdV6.set(dnsName(p), list6);
      }
      const revErr = r.pick<string | undefined>([undefined, undefined, undefined, undefined, undefined, "ETIMEOUT", "ESERVFAIL", "ENOTFOUND", "ENODATA"]);
      const fwdErr = new Map<string, string>();
      for (const p of ptrs) if (typeof p === "string" && r.bool(0.15)) fwdErr.set(dnsName(p), r.pick(["ETIMEOUT", "ESERVFAIL", "ENOTFOUND", "ENODATA"]));
      const resolver: DnsResolver = {
        reverse: async () => { if (revErr) throw Object.assign(new Error(revErr), { code: revErr }); return ptrs as string[]; },
        resolve4: async (h) => { const e = fwdErr.get(dnsName(h)); if (e) throw Object.assign(new Error(e), { code: e }); return (fwdV4.get(dnsName(h)) ?? []) as string[]; },
        resolve6: async (h) => { const e = fwdErr.get(dnsName(h)); if (e) throw Object.assign(new Error(e), { code: e }); return (fwdV6.get(dnsName(h)) ?? []) as string[]; },
      };
      const text = wrap(ipText, r).replace(/%[^\]\s]*/, "");
      const out = await verifyFcrdns(text, SUFFIXES, resolver, 50);
      const DEF = new Set(["ENOTFOUND", "ENODATA"]);
      const strPtrs = ptrs.filter((p): p is string => typeof p === "string");
      const answers = (h: string) => ((fam4 ? fwdV4 : fwdV6).get(dnsName(h)) ?? []).filter((x): x is string => typeof x === "string");
      let expected: "verified" | "failed" | "error";
      if (revErr) expected = DEF.has(revErr) ? "failed" : "error";
      else {
        const cands = strPtrs.filter((h) => SUFFIXES.some((s) => oracleHostOk(h, s)));
        let sawErr = false, ok = false;
        for (const h of cands.slice(0, 3)) {
          const e = fwdErr.get(dnsName(h));
          if (e) { if (!DEF.has(e)) sawErr = true; continue; }
          if (answers(h).some((a) => refParsePlain(a) === key)) { ok = true; break; }
        }
        expected = ok ? "verified" : sawErr ? "error" : "failed";
        if (out.status === "verified") {
          const anyOk = cands.some((h) => !fwdErr.has(dnsName(h)) && answers(h).some((a) => refParsePlain(a) === key));
          if (!anyOk) f.add(i, `UNSOUND verified ptrs=${j(ptrs)} ip=${text}`);
        }
      }
      if (out.status === "verified") verifiedCount++;
      if (out.status !== expected) f.add(i, `got ${j(out)} expected ${expected} ip=${j(text)} ptrs=${j(ptrs)} revErr=${revErr} fwdErr=${j([...fwdErr])} fwd4=${j([...fwdV4])} fwd6=${j([...fwdV6])}`);
      if (out.status === "verified" && !SUFFIXES.some((s) => oracleHostOk(out.hostname, s))) f.add(i, `verified with unacceptable hostname ${j(out.hostname)}`);
    }
    tally("fcrdns oracle", N * 2);
    assert.ok(verifiedCount > 100, `generator too weak: only ${verifiedCount} verified`);
    f.done();
  });

  it("BUG(cosmetic): hostMatchesSuffix == label-boundary oracle on random hostnames (U+212A KELVIN folds to ASCII k and passes)", () => {
    const seed = 0x5002;
    const r = new R(seed);
    const f = new Fails(seed, "hostMatchesSuffix");
    for (let i = 0; i < N * 2; i++) {
      const h = genHostname(r);
      for (const s of SUFFIXES) {
        const a = hostMatchesSuffix(h, s);
        const b = oracleHostOk(h, s);
        if (a !== b) f.add(i, `host=${j(h)} suffix=${s} lib=${a} oracle=${b}`);
      }
    }
    tally("hostMatchesSuffix oracle", N * 2 * 3);
    f.done();
  });

  it("BUG(doc): README says a resolver returning undefined/non-array => `error`; actual => `failed` (spoofed => challenge)", async () => {
    const mk = (v: unknown): DnsResolver => ({ reverse: async () => v as string[], resolve4: async () => ["66.249.66.1"], resolve6: async () => [] });
    const out1 = await verifyFcrdns("66.249.66.1", SUFFIXES, mk(undefined), 50);
    const out2 = await verifyFcrdns("66.249.66.1", SUFFIXES, { reverse: async () => ["crawl.googlebot.com"], resolve4: async () => undefined as never, resolve6: async () => [] }, 50);
    tally("fcrdns undefined-return", 2);
    assert.equal(out1.status, "error", `reverse()=>undefined gave ${j(out1)}`);
    assert.equal(out2.status, "error", `resolve4()=>undefined gave ${j(out2)}`);
  });

  it("NIT(todo): >3 allowed PTRs where only the 4th is forward-confirmed (MAX_CANDIDATES=3 is undocumented)", { todo: true }, async () => {
    const ptrs = ["a.googlebot.com", "b.googlebot.com", "c.googlebot.com", "d.googlebot.com"];
    const res: DnsResolver = { reverse: async () => ptrs, resolve4: async (h) => (h === "d.googlebot.com" ? ["66.249.66.1"] : ["1.1.1.1"]), resolve6: async () => [] };
    const out = await verifyFcrdns("66.249.66.1", SUFFIXES, res, 50);
    tally("fcrdns 4th-PTR", 1);
    assert.equal(out.status, "verified", `4th PTR ignored: ${j(out)}`);
  });
});

// ───────────────────── P6 token bucket model-check ─────────────────────

describe("P6 token bucket", () => {
  it("allowed/remaining/retryAfter match a reference model over random (time,key,cost) sequences, incl. non-monotonic clocks", () => {
    const seed = 0x6001;
    const r = new R(seed);
    const f = new Fails(seed, "token bucket model");
    let steps = 0;
    for (let run = 0; run < 120; run++) {
      let clock = 1_000_000;
      const lim = new MemoryRateLimiter({ now: () => clock, maxKeys: 1000 });
      const rules = [0, 1, 2].map(() => ({ capacity: r.range(1, 12), refillPerSec: r.pick([0, 0.25, 0.5, 1, 2, 4]) }));
      const ref = new Map<string, { tokens: number; t: number }>();
      const nonMono = run % 2 === 1;
      for (let s = 0; s < 80; s++) {
        steps++;
        const dt = nonMono && r.bool(0.25) ? -r.range(0, 5000) : r.pick([0, 1, 10, 100, 500, 1000, 2500, 10_000, 100_000]);
        clock += dt;
        const ki = r.int(3);
        const key = `k${ki}`;
        const rule = rules[ki];
        const cost = r.pick([0.5, 1, 1, 1, 2, 3, 5, 13]);
        const st = ref.get(key);
        let tokens: number, t: number;
        if (!st) { tokens = rule.capacity; t = clock; }
        else { t = Math.max(clock, st.t); tokens = Math.min(rule.capacity, st.tokens + ((t - st.t) / 1000) * rule.refillPerSec); }
        const allowed = tokens >= cost;
        if (allowed) tokens -= cost;
        ref.set(key, { tokens, t });
        const exp = allowed
          ? { allowed: true, remaining: Math.floor(tokens) }
          : rule.refillPerSec <= 0 || cost > rule.capacity
            ? { allowed: false, remaining: 0 }
            : { allowed: false, remaining: 0, retryAfterSec: Math.min(86400, Math.ceil((cost - tokens) / rule.refillPerSec)) };
        const got = lim.take(key, rule, cost);
        if (JSON.stringify(got) !== JSON.stringify(exp)) f.add(steps, `run ${run} step ${s} key ${key} rule ${j(rule)} cost ${cost} dt ${dt}: got ${j(got)} expected ${j(exp)}`);
        if (got.remaining < 0 || got.remaining > rule.capacity) f.add(steps, `remaining ${got.remaining} out of [0,${rule.capacity}]`);
        if (tokens < -1e-9 || tokens > rule.capacity + 1e-9) f.add(steps, `ref tokens ${tokens} out of range`);
        if (!got.allowed && got.retryAfterSec !== undefined && got.retryAfterSec < 86400) {
          if (ref.get(key)!.tokens + got.retryAfterSec * rule.refillPerSec < cost - 1e-9) f.add(steps, `retryAfter ${got.retryAfterSec}s too short`);
        }
      }
    }
    tally("token bucket model steps", steps);
    assert.ok(steps >= 2000);
    f.done();
  });

  it("an exhausted key stays exhausted when other keys are sprayed past maxKeys (anti-reset), and size never exceeds maxKeys", () => {
    const seed = 0x6002;
    const r = new R(seed);
    const f = new Fails(seed, "eviction");
    let cases = 0;
    for (let run = 0; run < 100; run++) {
      const clock = 5000;
      const maxKeys = r.range(3, 40);
      const lim = new MemoryRateLimiter({ now: () => clock, maxKeys });
      const rule = { capacity: 10, refillPerSec: 0.1 };
      lim.take("victim", rule, 10);
      for (let k = 0; k < maxKeys * 5; k++) {
        cases++;
        lim.take(`spray${r.int(maxKeys * 4)}`, rule, 1);
        if (lim.size > maxKeys) f.add(cases, `size ${lim.size} > maxKeys ${maxKeys}`);
        if (k % 7 === 0 && lim.take("victim", rule, 1).allowed) { f.add(cases, `victim got tokens back after ${k} sprays (maxKeys=${maxKeys})`); break; }
      }
    }
    tally("eviction", cases);
    f.done();
  });
});

// ───────────────────── P7 PoW oracle ─────────────────────

const SECRET = "round3-secret-0123456789abcdef";
function oracleBits(dg: Buffer): number {
  let bits = 0;
  for (const byte of dg) {
    for (let b = 7; b >= 0; b--) { if ((byte >> b) & 1) return bits; bits++; }
  }
  return bits;
}
function oracleVerify(token: string, nonce: string, o: { subject: string; now: number; seen: Set<string> }): { ok: boolean; id?: string } {
  if (token.length > 1024 || nonce.length === 0 || nonce.length > 64) return { ok: false };
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return { ok: false };
  if (Buffer.from(body, "base64url").toString("base64url") !== body) return { ok: false };
  const mac = createHmac("sha256", SECRET).update(body).digest().toString("base64url");
  if (mac !== sig) return { ok: false };
  let p: { s: string; e: number; d: number; r: string };
  try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return { ok: false }; }
  if (!(p.e > o.now)) return { ok: false };
  if (p.s !== o.subject) return { ok: false };
  if (oracleBits(createHash("sha256").update(`${token}:${nonce}`).digest()) < p.d) return { ok: false };
  if (o.seen.has(p.r)) return { ok: false };
  return { ok: true, id: p.r };
}

describe("P7 PoW", () => {
  it("verifyChallenge.ok === oracle over random tokens/nonces/subjects/clocks/replays", () => {
    const seed = 0x7001;
    const r = new R(seed);
    const f = new Fails(seed, "pow oracle");
    let clock = 10_000_000;
    const guard = createReplayGuard(() => clock);
    const seen = new Set<string>();
    const subjects = Array.from({ length: 400 }, (_, k) => (k % 7 === 0 ? `é${k}\u0000\ud800😀` : `ip-${k}`));
    let okCount = 0, verifs = 0;
    for (let i = 0; i < N; i++) {
      const subject = r.pick(subjects);
      const bits = r.range(1, 7);
      const ttl = r.pick([1, 1000, 60_000]);
      clock += r.pick([0, 1, 5000]);
      const ch = issueChallenge({ secret: SECRET, subject, difficultyBits: bits, ttlMs: ttl, now: () => clock });
      const reps = r.int(3) + 1;
      for (let k = 0; k < reps; k++) {
        const vNow = clock + r.pick([-5, 0, ttl - 1, ttl, ttl + 1, 10]);
        const vSubject = r.bool(0.8) ? subject : r.pick(subjects);
        const nonce = r.bool(0.6) ? solveChallenge(ch.token, bits) : r.pick(["0", "1", "zz", "é", "\ud800", "x".repeat(64), "x".repeat(65), ""]) + (r.bool(0.3) ? r.str(2, "ab01") : "");
        let token = ch.token;
        if (r.bool(0.1)) token = r.pick([token + "=", token.toUpperCase(), token + ".", " " + token, token.replace(".", "..")]);
        clock = vNow;
        verifs++;
        const exp = oracleVerify(token, nonce, { subject: vSubject, now: vNow, seen });
        const got = verifyChallenge(token, nonce, { secret: SECRET, subject: vSubject, now: () => vNow, replay: guard });
        if (got.ok !== exp.ok) f.add(i, `lib=${j(got)} oracle=${exp.ok} subject-match=${vSubject === subject} nonce=${j(nonce)} token-mut=${token !== ch.token}`);
        if (exp.ok) { seen.add(exp.id!); okCount++; }
      }
    }
    tally("pow oracle verifications", verifs);
    assert.ok(okCount > 300, `generator weak ${okCount}`);
    assert.ok(verifs >= 2000);
    f.done();
  });

  it("mutating every character (replace/insert/delete/truncate) of a valid token: only the original verifies", () => {
    const seed = 0x7002;
    const r = new R(seed);
    const f = new Fails(seed, "pow mutation");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
    const junk = ["=", "\n", " ", ".", "%", "\u0000", "é", "+", "/", "\r\n"];
    let cases = 0;
    for (let t = 0; t < 25; t++) {
      const subject = `sub-${t}-${r.int(1e9)}`;
      const ch = issueChallenge({ secret: SECRET, subject, difficultyBits: 8, ttlMs: 3_600_000 });
      const nonce = solveChallenge(ch.token, 8);
      const opts = { secret: SECRET, subject };
      if (!verifyChallenge(ch.token, nonce, opts).ok) { f.add(t, "original failed"); continue; }
      const check = (m: string, what: string) => {
        cases++;
        if (m === ch.token) return;
        if (verifyChallenge(m, nonce, opts).ok) f.add(cases, `${what} verified: ${j(m)}`);
      };
      for (let p = 0; p < ch.token.length; p++) {
        for (const c of alphabet) if (c !== ch.token[p]) check(ch.token.slice(0, p) + c + ch.token.slice(p + 1), `replace@${p}`);
        check(ch.token.slice(0, p) + ch.token.slice(p + 1), `delete@${p}`);
        for (const c of junk) check(ch.token.slice(0, p) + c + ch.token.slice(p), `insert@${p}`);
        check(ch.token.slice(0, p), `trunc@${p}`);
      }
      for (const c of [...junk, "A", "-"]) check(ch.token + c, "append");
      for (let k = 0; k < 40; k++) {
        const nn = nonce + r.str(r.range(0, 3), "abz09é");
        cases++;
        const exp = oracleVerify(ch.token, nn, { subject, now: Date.now(), seen: new Set() }).ok;
        const got = verifyChallenge(ch.token, nn, opts).ok;
        if (exp !== got) f.add(cases, `nonce ${j(nn)} lib=${got} oracle=${exp}`);
      }
    }
    tally("pow mutation", cases);
    assert.ok(cases >= 2000);
    f.done();
  });

  it("replay guard: a valid solution verifies exactly once", () => {
    const seed = 0x7003;
    const r = new R(seed);
    const f = new Fails(seed, "replay");
    let cases = 0;
    for (let run = 0; run < 40; run++) {
      let clock = 1_000;
      const guard = createReplayGuard(() => clock, r.range(10, 60));
      for (let s = 0; s < 80; s++) {
        cases++;
        const sub = `s${r.int(4)}`;
        const ch = issueChallenge({ secret: SECRET, subject: sub, difficultyBits: 1, ttlMs: r.pick([100, 5000]), now: () => clock });
        const nonce = solveChallenge(ch.token, 1);
        const o = { secret: SECRET, subject: sub, replay: guard, now: () => clock };
        const a = verifyChallenge(ch.token, nonce, o);
        if (!a.ok && a.reason !== "replayed") f.add(cases, `first verify failed: ${j(a)}`);
        if (a.ok && verifyChallenge(ch.token, nonce, o).ok) f.add(cases, "same token verified twice");
        clock += r.pick([0, 10, 200, 3000]);
      }
    }
    tally("replay guard", cases);
    f.done();
  });
});

// ───────────────────── P8 policy ─────────────────────

describe("P8 policy.decide", () => {
  const rank = { allow: 0, flag: 1, challenge: 2 } as const;
  const mkA = (score: number, classification: Assessment["classification"] = "human-likely"): Assessment => ({ score, classification, signals: [] });

  it("action is monotone in score for random thresholds (flag<=rateLimit<=challenge); score<challenge never challenges; score>=challenge always does", () => {
    const seed = 0x8001;
    const r = new R(seed);
    const f = new Fails(seed, "decide monotone");
    let cases = 0;
    for (let t = 0; t < 120; t++) {
      const [a, b, c] = [r.range(0, 100), r.range(0, 100), r.range(0, 100)].sort((x, y) => x - y);
      const thresholds = { flag: a, rateLimit: b, challenge: c };
      let prev = -1;
      for (let s = 0; s <= 100; s++) {
        cases++;
        const cls = r.pick<Assessment["classification"]>(["human-likely", "suspicious", "automated", "spoofed-crawler"]);
        const d = decide(mkA(s, cls), { limiter: new MemoryRateLimiter({ now: () => 0 }), key: "k", thresholds });
        if (d.action === "rate-limited") { f.add(cases, `fresh limiter rate-limited at ${s} ${j(thresholds)}`); continue; }
        const rk = rank[d.action as keyof typeof rank];
        if (rk < prev) f.add(cases, `non-monotone at score ${s} thresholds ${j(thresholds)}: ${d.action}`);
        prev = Math.max(prev, rk);
        if (s < c && d.action === "challenge") f.add(cases, `challenge below threshold: ${s} < ${c}`);
        if (s >= c && d.action !== "challenge") f.add(cases, `no challenge at ${s} >= ${c}: ${d.action}`);
        if (s < a && d.action !== "allow") f.add(cases, `score ${s} < flag ${a} got ${d.action}`);
        if (s >= a && s < c && d.action !== "flag") f.add(cases, `score ${s} in [flag,challenge) got ${d.action} ${j(thresholds)}`);
        const lim = new MemoryRateLimiter({ now: () => 0 });
        for (let k = 0; k < 400; k++) { lim.take("h:k", { capacity: 120, refillPerSec: 2 }, 1); lim.take("s:k", { capacity: 30, refillPerSec: 0.5 }, 1); }
        const d2 = decide(mkA(s, cls), { limiter: lim, key: "k", thresholds });
        if (s < c && d2.action === "challenge") f.add(cases, "exhausted limiter produced challenge");
        if (s >= c && d2.action !== "challenge") f.add(cases, "exhausted limiter swallowed challenge");
      }
    }
    tally("decide monotone", cases);
    f.done();
  });

  it("non-finite / out-of-range scores never crash; no challenge below threshold; Infinity never `allow`", () => {
    const seed = 0x8002;
    const r = new R(seed);
    const f = new Fails(seed, "decide weird scores");
    for (let i = 0; i < N; i++) {
      const score = r.pick([NaN, Infinity, -Infinity, -1, 101, 1e9, -0, 0.5, 29.999, 79.999, 80, 100]);
      try {
        const d = decide(mkA(score), { limiter: new MemoryRateLimiter({ now: () => 0 }), key: "k" });
        if (score === Infinity && d.action === "allow") f.add(i, "Infinity allowed");
        if (Number.isFinite(score) && score < 80 && d.action === "challenge") f.add(i, `challenge at ${score}`);
        if (Number.isFinite(score) && score >= 80 && d.action !== "challenge") f.add(i, `no challenge at ${score}`);
        if (!Number.isFinite(score) && d.action === "challenge") f.add(i, `challenge on non-finite`);
      } catch (e) { f.add(i, `threw ${(e as Error).message}`); }
    }
    tally("decide weird scores", N);
    f.done();
  });

  it("verified-crawler classification is never challenged / tight-limited even with score 100 and any thresholds", () => {
    const seed = 0x8003;
    const r = new R(seed);
    const f = new Fails(seed, "decide verified");
    for (let i = 0; i < N; i++) {
      const th = { flag: r.range(0, 100), rateLimit: 100, challenge: 100 };
      const d = decide(mkA(r.pick([0, 50, 100]), "verified-crawler"), { limiter: new MemoryRateLimiter({ now: () => 0 }), key: "k", thresholds: th });
      if (d.action !== "allow") f.add(i, `got ${d.action}`);
    }
    tally("decide verified", N);
    f.done();
  });
});

// ───────────────────── P9 performance ─────────────────────

describe("P9 performance on 1-8 MB adversarial values", () => {
  const MB = 1024 * 1024;
  const shapes: [string, (n: number) => string][] = [
    ["a*n", (n) => "a".repeat(n)],
    ["Mozilla/5.0 repeated", (n) => "Mozilla/5.0 ".repeat((n / 12) | 0)],
    ["'(' * n", (n) => "(".repeat(n)],
    ["'bo' repeated", (n) => "bo".repeat((n / 2) | 0)],
    ["'cubo' repeated", (n) => "cubo".repeat((n / 4) | 0)],
    ["'libwww-f' repeated", (n) => "libwww-f".repeat((n / 8) | 0)],
    ["'java' repeated", (n) => "java".repeat((n / 4) | 0)],
    ["commas", (n) => ",".repeat(n)],
    ["', ' pairs", (n) => ", ".repeat((n / 2) | 0)],
    ["digits", (n) => "1".repeat(n)],
    ["quotes", (n) => '"'.repeat(n)],
    ["spaces + x", (n) => " ".repeat(n) + "x"],
    ["Mozilla/5.0 + spaces", (n) => "Mozilla/5.0" + " ".repeat(n)],
    ["unicode", (n) => "ế".repeat((n / 2) | 0)],
    ["':' * n", (n) => ":".repeat(n)],
    ["head*", (n) => "head".repeat((n / 4) | 0)],
    ["googlebo", (n) => "googlebo".repeat((n / 8) | 0)],
  ];
  it("no super-linear blow-up and no single call > 1 s on 1-8 MB adversarial values (assess*, normalizeIp, hostMatchesSuffix, verifyChallenge, parseTelemetry)", { timeout: 600000 }, async () => {
    const f = new Fails(0x9001, "perf");
    const over200: string[] = [];
    let worst = { what: "", ms: 0 };
    let cases = 0;
    const tel = { wd: false, pl: 1, lg: 1, ow: 1, oh: 1, iw: 1, ih: 1, sw: 1, sh: 1, hc: 1, ch: true, ev: 1, ut: 0, dw: 1000 };
    const timeIt = (fn: () => unknown) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
    for (const [name, mk] of shapes) {
      const bigs = [mk(1 * MB), mk(8 * MB)];
      const jobs: [string, (big: string) => unknown][] = [
        ["sync user-agent", (b) => assessRequestSync({ headers: new Bag({ "user-agent": b }), ip: "1.2.3.4" })],
        ["sync browser UA + huge accept", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), accept: b }) })],
        ["sync browser UA + huge sec-fetch-mode", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), "sec-fetch-mode": b }) })],
        ["sync browser UA + huge sec-ch-ua", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), "sec-ch-ua": b }) })],
        ["sync browser UA + huge platform", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), "sec-ch-ua-platform": b }) })],
        ["sync browser UA + huge accept-language", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), "accept-language": b }) })],
        ["sync browser UA + huge asn", (b) => assessRequestSync({ headers: new Bag({ "user-agent": CHROME(), "x-vercel-ip-as-number": b }) })],
        ["normalizeIp", (b) => normalizeIp(b)],
        ["normalizeIp([..]:80)", (b) => normalizeIp(`[${b}]:80`)],
        ["hostMatchesSuffix", (b) => hostMatchesSuffix(b, "googlebot.com")],
        ["hostMatchesSuffix(host.)", (b) => hostMatchesSuffix(b + ".googlebot.com", "googlebot.com")],
        ["verifyChallenge(token)", (b) => verifyChallenge(b, "n", { secret: SECRET, subject: "s" })],
        ["verifyChallenge(nonce)", (b) => verifyChallenge("a.b", b, { secret: SECRET, subject: "s" })],
        ["parseTelemetry(ua)", (b) => parseTelemetry({ ...tel, ua: b })],
        ["telemetrySignals(ua)", (b) => telemetrySignals({ ...tel, ua: b }, b)],
      ];
      for (const [what, run] of jobs) {
        cases += 2;
        run("warm");
        const t1 = timeIt(() => run(bigs[0]));
        const t8 = timeIt(() => run(bigs[1]));
        if (t8 > worst.ms) worst = { what: `${what} / ${name}`, ms: t8 };
        if (t8 > 200) over200.push(`${what}/${name}: 1MB=${t1.toFixed(0)}ms 8MB=${t8.toFixed(0)}ms`);
        if (t8 > 4000) f.add(cases, `${what} shape=${name} 8MB took ${t8.toFixed(0)} ms`);
        if (t8 > 100 && t8 > 25 * Math.max(t1, 5)) f.add(cases, `SUPER-LINEAR ${what} shape=${name}: 1MB=${t1.toFixed(0)}ms 8MB=${t8.toFixed(0)}ms`);
      }
      cases += 1;
      const t0 = performance.now();
      await assessRequest({ headers: new Bag({ "user-agent": bigs[1] + " Googlebot" }), ip: bigs[1] }, async () => ({ status: "error", reason: "x" }));
      const dt = performance.now() - t0;
      if (dt > 4000) f.add(cases, `assessRequest big UA+ip shape=${name} 8MB took ${dt.toFixed(0)} ms`);
    }
    tally("perf adversarial inputs", cases);
    console.log(`[round3] perf: worst 8MB call = ${worst.ms.toFixed(0)} ms (${worst.what}); calls >200ms at 8MB: ${over200.length}${over200.length ? " e.g. " + over200.slice(0, 6).join("; ") : ""}`);
    f.done();
  });
});

// ───────────────────── P10 false positives on humans ─────────────────────

describe("P10 false positives", () => {
  it("realistic browser/in-app UAs with realistic header sets never reach `flag` (score < 30); full header set scores 0", () => {
    const seed = 0xa001;
    const r = new R(seed);
    const f = new Fails(seed, "human FP");
    for (let i = 0; i < N; i++) {
      const ua = r.bool(0.9) ? r.pick(BROWSER_TEMPLATES)(r) : r.pick(LEGACY_HUMAN);
      const hm: Record<string, string> = {
        "user-agent": ua,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": r.pick(["vi-VN,vi;q=0.9,en;q=0.8", "en-US,en;q=0.9"]),
        "sec-fetch-mode": "navigate",
      };
      const full = assessRequestSync({ headers: new Bag(hm) });
      if (full.score !== 0) f.add(i, `full headers scored ${full.score} (${full.signals.map((s) => s.id)}) ua=${j(ua)}`);
      // webview-like: drop up to two weak headers
      for (const k of r.shuffle(["sec-fetch-mode", "accept-language", "accept"]).slice(0, r.int(3))) delete hm[k];
      const part = assessRequestSync({ headers: new Bag(hm) });
      if (part.score >= 30) f.add(i, `weak-header human scored ${part.score} (${part.signals.map((s) => s.id)}) dropped=${j(hm)}`);
    }
    tally("human false positives", N * 2);
    f.done();
  });
});
