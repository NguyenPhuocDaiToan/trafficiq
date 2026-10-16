import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOgCard, ogCardHeadHtml } from "./og-card";
import { ogVersion, parseShareVersion, shareUrl } from "./share-link";

const og = { title: "Ưu đãi demo", description: "Mô tả ngắn", imageUrl: "https://cdn.example.com/a.jpg" };

describe("ogVersion — mã gắn vào link chia sẻ", () => {
  it("ổn định: cùng nội dung → cùng mã, đúng dạng 7 ký tự base36", () => {
    assert.equal(ogVersion(og), ogVersion({ ...og }));
    assert.match(ogVersion(og), /^[0-9a-z]{7}$/);
  });

  it("ĐỔI khi đổi tiêu đề, mô tả hoặc ảnh — đúng thứ làm thẻ chia sẻ khác đi", () => {
    const base = ogVersion(og);
    assert.notEqual(ogVersion({ ...og, title: "Ưu đãi demo 2" }), base);
    assert.notEqual(ogVersion({ ...og, description: "Mô tả khác" }), base);
    assert.notEqual(ogVersion({ ...og, imageUrl: "https://cdn.example.com/b.jpg" }), base);
    assert.notEqual(ogVersion({ ...og, imageUrl: undefined }), base);
  });

  it("đổi ảnh bằng ảnh tải lên (đường dẫn /uploads) cũng đổi mã", () => {
    const up = `/uploads/${"a".repeat(64)}.webp`;
    assert.notEqual(ogVersion({ ...og, imageUrl: up }), ogVersion(og));
    assert.notEqual(ogVersion({ ...og, imageUrl: `/uploads/${"b".repeat(64)}.webp` }), ogVersion({ ...og, imageUrl: up }));
  });

  it("không nhầm ranh giới giữa các trường: (ab|c) khác (a|bc)", () => {
    const a = ogVersion({ title: "ab", description: "c", imageUrl: undefined });
    const b = ogVersion({ title: "a", description: "bc", imageUrl: undefined });
    assert.notEqual(a, b);
  });

  it("chỉ phụ thuộc nội dung thẻ: đổi trường khác không làm link chia sẻ đổi", () => {
    // `ogVersion` chỉ nhận 3 trường thẻ; thêm field lạ vào object không thay đổi gì.
    const noisy = { ...og, status: "paused", updatedAt: new Date(), headline: "khác" } as typeof og;
    assert.equal(ogVersion(noisy), ogVersion(og));
  });

  it("ít va chạm: 5000 nội dung khác nhau cho 5000 mã khác nhau", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(ogVersion({ ...og, title: `Tiêu đề ${i}` }));
    assert.equal(seen.size, 5000);
  });
});

describe("shareUrl", () => {
  it("giữ nguyên /go/<token> và thêm ?v=<mã>", () => {
    assert.equal(shareUrl("https://site.example", "HGPe6u9ssigC", og), `https://site.example/go/HGPe6u9ssigC?v=${ogVersion(og)}`);
  });

  it("đổi ảnh thì link chia sẻ đổi, token thì không", () => {
    const before = shareUrl("https://s.example", "tok", og);
    const after = shareUrl("https://s.example", "tok", { ...og, imageUrl: "https://cdn.example.com/new.jpg" });
    assert.notEqual(before, after);
    assert.ok(before.startsWith("https://s.example/go/tok?v=") && after.startsWith("https://s.example/go/tok?v="));
  });
});

describe("parseShareVersion — đầu vào từ người ngoài", () => {
  it("nhận đúng dạng mã, bỏ mọi thứ khác", () => {
    assert.equal(parseShareVersion("abc123x"), "abc123x");
    assert.equal(parseShareVersion(ogVersion(og)), ogVersion(og));
    for (const bad of [null, undefined, "", " ", "a b", 'x"><script>alert(1)</script>', "a".repeat(13), "../x", "a&b=c", "v1\n"]) {
      assert.equal(parseShareVersion(bad as string | null), undefined, JSON.stringify(bad));
    }
  });
});

describe("thẻ OG ở /go phản chiếu ?v= vào og:url", () => {
  const card = (version?: string) =>
    ogCardHeadHtml(buildOgCard({ og: { title: "T", description: "D", imageUrl: "https://c.example/i.jpg" }, slug: "demo", baseUrl: "https://s.example", index: true, version }));

  it("có version: og:url mang ?v=, nhưng canonical và refresh vẫn là /c/<slug> sạch", () => {
    const html = card("k3j9x2a");
    assert.match(html, /<meta property="og:url" content="https:\/\/s\.example\/c\/demo\?v=k3j9x2a">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/s\.example\/c\/demo">/);
    assert.match(html, /http-equiv="refresh" content="0;url=https:\/\/s\.example\/c\/demo"/);
  });

  it("không version: og:url sạch như trước", () => {
    const html = card();
    assert.match(html, /<meta property="og:url" content="https:\/\/s\.example\/c\/demo">/);
    assert.ok(!html.includes("?v="));
  });

  it("ảnh OG tuyệt đối vẫn đúng, không bị ảnh hưởng bởi version", () => {
    assert.match(card("abc"), /<meta property="og:image" content="https:\/\/c\.example\/i\.jpg">/);
  });
});
