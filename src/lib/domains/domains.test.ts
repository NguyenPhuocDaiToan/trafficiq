import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeHost } from "./host";
import { campaignShareUrl, resolveShareBase } from "./links";
import { isPrivateAddress, verifyDomainReachable, type VerifyDeps } from "./verify";
import { ogVersion } from "../landing/share-link";

describe("normalizeHost", () => {
  it("chuẩn hoá: chữ thường, bỏ scheme/đường dẫn/dấu chấm cuối, nhận dán nguyên URL", () => {
    for (const [input, host] of [
      ["go.Example.COM", "go.example.com"],
      ["  https://go.example.com/duong/dan?x=1#y ", "go.example.com"],
      ["http://go.example.com", "go.example.com"],
      ["go.example.com.", "go.example.com"],
      ["a-b.example.co.uk", "a-b.example.co.uk"],
      ["xn--bcher-kva.com", "xn--bcher-kva.com"],
    ] as const) {
      assert.deepEqual(normalizeHost(input), { ok: true, host }, input);
    }
  });

  it("tên miền có dấu (IDN) → punycode", () => {
    assert.deepEqual(normalizeHost("bücher.com"), { ok: true, host: "xn--bcher-kva.com" });
  });

  it("từ chối: cổng, user@, IPv6, IP trần (kể cả dạng số), đuôi nội bộ, không có dấu chấm, nhãn sai", () => {
    for (const bad of [
      "",
      "   ",
      "example.com:8080",
      "user@example.com",
      "[::1]",
      "::1",
      "127.0.0.1",
      "10.0.0.5",
      "2130706433",
      "1.2.3.4.5",
      "localhost",
      "intranet",
      "app.localhost",
      "printer.local",
      "svc.internal",
      "a.test",
      "-bad.example.com",
      "bad-.example.com",
      "bad_name.example.com",
      "a..example.com",
      "exa mple.com",
      "a".repeat(64) + ".com",
      Array(60).fill("abcd").join(".") + ".com",
      "x.c", // đuôi 1 ký tự
    ]) {
      const r = normalizeHost(bad);
      assert.equal(r.ok, false, `phải từ chối: ${JSON.stringify(bad)} → ${JSON.stringify(r)}`);
    }
  });
});

describe("resolveShareBase / campaignShareUrl", () => {
  const PRIMARY = "https://trafficiq-six.vercel.app";
  const og = { title: "T", description: "D", imageUrl: "/uploads/x.webp" };
  const verified = new Set(["go.example.com"]);

  it("không chọn → tên miền chính; chọn tên miền verified → https://<host>", () => {
    assert.deepEqual(resolveShareBase(undefined, verified, PRIMARY), { baseUrl: PRIMARY, fellBack: false });
    assert.deepEqual(resolveShareBase("go.example.com", verified, PRIMARY), { baseUrl: "https://go.example.com", fellBack: false });
  });

  it("tên miền đã tắt/chưa kiểm tra → rơi về tên miền chính VÀ báo fellBack (không im lặng đưa link chết)", () => {
    assert.deepEqual(resolveShareBase("old.example.com", verified, PRIMARY), { baseUrl: PRIMARY, fellBack: true });
    assert.deepEqual(resolveShareBase("go.example.com", new Set(), PRIMARY), { baseUrl: PRIMARY, fellBack: true });
  });

  it("link giữ nguyên token và mã ?v= — chỉ phần host đổi; đổi tên miền KHÔNG đổi ?v= (thẻ không đổi)", () => {
    const a = campaignShareUrl({ token: "TOK", og }, verified, PRIMARY);
    const b = campaignShareUrl({ token: "TOK", og, shareDomain: "go.example.com" }, verified, PRIMARY);
    const v = ogVersion(og);
    assert.equal(a.url, `${PRIMARY}/go/TOK?v=${v}`);
    assert.equal(b.url, `https://go.example.com/go/TOK?v=${v}`);
  });
});

describe("isPrivateAddress (chống SSRF khi kiểm tên miền)", () => {
  it("địa chỉ riêng/nội bộ → true", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // metadata cloud
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "không-phải-ip",
    ]) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });

  it("địa chỉ công khai → false", () => {
    for (const ip of ["8.8.8.8", "76.76.21.21", "172.15.0.1", "172.32.0.1", "100.63.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });
});

describe("verifyDomainReachable", () => {
  const deps = (over: Partial<VerifyDeps>): VerifyDeps => ({
    resolve: async () => ["76.76.21.21"],
    fetchJson: async () => ({ status: 200, body: JSON.stringify({ app: "trafficiq", ok: true }) }),
    ...over,
  });

  it("đạt khi phân giải ra IP công khai và /api/health trả đúng dấu app", async () => {
    assert.deepEqual(await verifyDomainReachable("go.example.com", deps({})), { ok: true });
  });

  it("đạt cả khi health trả 503 (DB sập) miễn có dấu app — tên miền VẪN dẫn đúng ứng dụng", async () => {
    const r = await verifyDomainReachable("go.example.com", deps({ fetchJson: async () => ({ status: 503, body: '{"app":"trafficiq","ok":false}' }) }));
    assert.deepEqual(r, { ok: true });
  });

  it("DNS không phân giải → lỗi, không gọi fetch", async () => {
    let called = false;
    const r = await verifyDomainReachable(
      "x.example.com",
      deps({
        resolve: async () => {
          throw new Error("ENOTFOUND");
        },
        fetchJson: async () => {
          called = true;
          return { status: 200, body: "" };
        },
      }),
    );
    assert.equal(r.ok, false);
    assert.equal(called, false);
  });

  it("phân giải ra địa chỉ nội bộ (kể cả lẫn với IP công khai) → từ chối TRƯỚC khi gọi fetch", async () => {
    for (const addrs of [["127.0.0.1"], ["8.8.8.8", "10.0.0.1"], ["169.254.169.254"], ["::1"]]) {
      let called = false;
      const r = await verifyDomainReachable(
        "evil.example.com",
        deps({
          resolve: async () => addrs,
          fetchJson: async () => {
            called = true;
            return { status: 200, body: '{"app":"trafficiq"}' };
          },
        }),
      );
      assert.equal(r.ok, false, addrs.join());
      assert.equal(called, false, `không được gọi ra ${addrs.join()}`);
    }
  });

  it("chuyển hướng, thiếu dấu app, JSON hỏng, trang HTML, lỗi mạng → đều không đạt", async () => {
    for (const res of [
      { status: 301, body: "" },
      { status: 200, body: '{"ok":true}' },
      { status: 200, body: "<html>Welcome to nginx</html>" },
      { status: 200, body: '{"app":"khac"}' },
      { status: 404, body: "" },
    ]) {
      assert.equal((await verifyDomainReachable("x.example.com", deps({ fetchJson: async () => res }))).ok, false, JSON.stringify(res));
    }
    const net = await verifyDomainReachable(
      "x.example.com",
      deps({
        fetchJson: async () => {
          throw new Error("timeout");
        },
      }),
    );
    assert.equal(net.ok, false);
  });
});
