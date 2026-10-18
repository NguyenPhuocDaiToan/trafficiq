import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AUTO_REDIRECT_SECONDS,
  DEFAULT_CTA_LABEL,
  DEFAULT_SHARE_DESCRIPTION,
  MAX_DESTINATIONS_PER_CAMPAIGN,
  applyCreateDefaults,
  hostLabel,
  parseDestinationUrls,
  withSlugSuffix,
} from "./campaign-defaults";
import { campaignSchema, destinationSchema } from "./schemas";

const NOW = new Date("2026-10-18T10:00:00Z"); // 17:00 giờ Việt Nam, 18/10
const ADV = "a".repeat(24);

describe("parseDestinationUrls", () => {
  it("tách theo dòng/khoảng trắng, bỏ dòng trống và trùng, giữ thứ tự", () => {
    const r = parseDestinationUrls("  https://a.com/x \n\n https://b.com/y\r\nhttps://a.com/x\t https://c.com ");
    assert.deepEqual(r, { ok: true, urls: ["https://a.com/x", "https://b.com/y", "https://c.com"] });
  });

  it("rỗng / chỉ khoảng trắng / undefined → lỗi", () => {
    for (const v of ["", "   \n\n ", undefined]) assert.equal(parseDestinationUrls(v).ok, false);
  });

  it(`quá ${MAX_DESTINATIONS_PER_CAMPAIGN} URL → lỗi`, () => {
    const urls = Array.from({ length: MAX_DESTINATIONS_PER_CAMPAIGN + 1 }, (_, i) => `https://s${i}.com`).join("\n");
    assert.equal(parseDestinationUrls(urls).ok, false);
    const exact = Array.from({ length: MAX_DESTINATIONS_PER_CAMPAIGN }, (_, i) => `https://s${i}.com`).join("\n");
    assert.equal(parseDestinationUrls(exact).ok, true);
  });

  it("KHÔNG tự kiểm giao thức ở đây — luật http(s) chỉ nằm ở destinationSchema (một nguồn duy nhất)", () => {
    // Hàm này cho qua; destinationSchema mới là nơi chặn. Test cả hai để chứng minh chuỗi nguy hiểm không lọt.
    const r = parseDestinationUrls("javascript:alert(1)\ndata:text/html,x\nhttps://ok.com");
    assert.equal(r.ok, true);
    const verdicts = (r as { urls: string[] }).urls.map((u) => destinationSchema.shape.url.safeParse(u).success);
    assert.deepEqual(verdicts, [false, false, true]);
  });
});

describe("hostLabel", () => {
  it("bỏ www, bỏ đường dẫn/query; URL hỏng → rỗng", () => {
    assert.equal(hostLabel("https://www.offer.example.com/a?b=1"), "offer.example.com");
    assert.equal(hostLabel("http://shop.vn"), "shop.vn");
    assert.equal(hostLabel("không phải url"), "");
  });
});

describe("applyCreateDefaults", () => {
  it("chỉ có ảnh + URL → mọi field còn lại được điền và qua được campaignSchema", () => {
    const { raw, slugAuto } = applyCreateDefaults({ heroImageUrl: "https://img.example.com/a.jpg" }, "https://www.offer.example.com/lp", NOW);
    assert.equal(slugAuto, true);
    assert.equal(raw.name, "offer.example.com · 18/10");
    assert.equal(raw.slug, "offer-example-com-18-10");
    assert.equal(raw.headline, raw.name);
    assert.equal(raw.ctaLabel, DEFAULT_CTA_LABEL);
    assert.equal(raw.ogTitle, raw.headline);
    assert.equal(raw.ogDescription, DEFAULT_SHARE_DESCRIPTION);
    assert.equal(raw.ogImageUrl, "https://img.example.com/a.jpg", "ảnh chia sẻ mặc định = ảnh trang");
    assert.equal(raw.autoRedirectSeconds, String(DEFAULT_AUTO_REDIRECT_SECONDS));
    const parsed = campaignSchema.safeParse({ ...raw, advertiserId: ADV });
    assert.equal(parsed.success, true, JSON.stringify(parsed.success ? "" : parsed.error.issues));
    assert.equal(parsed.success && parsed.data.autoRedirectSeconds, 2);
  });

  it("mặc định tự chuyển hướng là 2 giây, kể cả khi field không gửi lên; người dùng đặt 0 thì giữ 0", () => {
    assert.equal(applyCreateDefaults({}, "https://a.com", NOW).raw.autoRedirectSeconds, "2");
    assert.equal(applyCreateDefaults({ autoRedirectSeconds: "" }, "https://a.com", NOW).raw.autoRedirectSeconds, "2");
    assert.equal(applyCreateDefaults({ autoRedirectSeconds: "0" }, "https://a.com", NOW).raw.autoRedirectSeconds, "0");
    assert.equal(applyCreateDefaults({ autoRedirectSeconds: "5" }, "https://a.com", NOW).raw.autoRedirectSeconds, "5");
  });

  it("giá trị người dùng ĐÃ nhập không bao giờ bị ghi đè", () => {
    const given = {
      name: "Tài chính Q3",
      slug: "tai-chinh-q3",
      headline: "Mở thẻ trong 5 phút",
      ctaLabel: "Mở thẻ",
      ogTitle: "Tiêu đề chia sẻ",
      ogDescription: "Mô tả chia sẻ",
      heroImageUrl: "https://i.example.com/h.jpg",
      ogImageUrl: "https://i.example.com/og.jpg",
    };
    const { raw, slugAuto } = applyCreateDefaults(given, "https://a.com", NOW);
    assert.equal(slugAuto, false);
    for (const [k, v] of Object.entries(given)) assert.equal(raw[k], v, k);
  });

  it("có tiêu đề mà không có tên → tên chiến dịch là tiêu đề (danh sách đọc được ngay)", () => {
    const { raw } = applyCreateDefaults({ headline: "Ưu đãi tháng 10" }, "https://shop.vn", NOW);
    assert.equal(raw.name, "Ưu đãi tháng 10");
    assert.equal(raw.headline, "Ưu đãi tháng 10");
    assert.equal(raw.ogTitle, "Ưu đãi tháng 10");
    assert.equal(raw.slug, "uu-dai-thang-10");
  });

  it("ogDescription lấy tiêu đề phụ nếu có; ảnh chia sẻ riêng không bị đè bởi ảnh trang", () => {
    const { raw } = applyCreateDefaults({ subheadline: "Phụ đề", heroImageUrl: "https://i.example.com/h.jpg", ogImageUrl: "https://i.example.com/o.jpg" }, "https://a.com", NOW);
    assert.equal(raw.ogDescription, "Phụ đề");
    assert.equal(raw.ogImageUrl, "https://i.example.com/o.jpg");
  });

  it("không có ảnh thì ogImageUrl vẫn trống (không bịa ảnh)", () => {
    const { raw } = applyCreateDefaults({}, "https://a.com", NOW);
    assert.ok(!raw.ogImageUrl);
  });

  it("host dài / ký tự lạ không làm tên vượt 120 ký tự hay tạo slug sai", () => {
    const longHost = `https://${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.com/x`;
    const { raw } = applyCreateDefaults({}, longHost, NOW);
    assert.ok(raw.name.length <= 120);
    assert.match(raw.slug, /^[a-z0-9-]{3,60}$|^[a-z0-9-]{3,}$/);
    assert.equal(campaignSchema.safeParse({ ...raw, advertiserId: ADV }).success, true);
  });

  it("URL không đọc được host → vẫn ra tên/slug hợp lệ", () => {
    const { raw } = applyCreateDefaults({}, "not a url", NOW);
    assert.ok(raw.name.length >= 2);
    assert.match(raw.slug, /^[a-z0-9-]{3,60}$/);
  });
});

describe("withSlugSuffix", () => {
  it("thêm đuôi 4 ký tự, vẫn hợp lệ với schema, và không vượt 60 ký tự", () => {
    const s = withSlugSuffix("a".repeat(60));
    assert.match(s, /^[a-z0-9-]{3,60}$/);
    assert.notEqual(withSlugSuffix("abc"), withSlugSuffix("abc"));
  });
});
