import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsShrink, scaledSize, SHRINK_ATTEMPTS, shrinkImage } from "./client-shrink";
import { CLIENT_MAX_SIDE, CLIENT_SHRINK_ABOVE_BYTES, formatBytes, MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD } from "./limits";

describe("formatBytes — số liệu hiện cho admin", () => {
  it("B / KB / MB với dấu phẩy thập phân tiếng Việt", () => {
    assert.equal(formatBytes(0), "0B");
    assert.equal(formatBytes(512), "512B");
    assert.equal(formatBytes(1024), "1KB");
    assert.equal(formatBytes(840 * 1024), "840KB");
    assert.equal(formatBytes(4 * 1024 * 1024), "4,0MB");
    assert.equal(formatBytes(Math.round(6.24 * 1024 * 1024)), "6,2MB");
  });
});

describe("giới hạn upload", () => {
  it("trần + overhead nằm dưới giới hạn 4,5MB body của Vercel", () => {
    assert.ok(MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD < 4.5 * 1024 * 1024);
  });

  it("ngưỡng tự thu nhỏ thấp hơn trần, và cạnh thu nhỏ gấp đôi ảnh lớn nhất server xuất (1400px)", () => {
    assert.ok(CLIENT_SHRINK_ABOVE_BYTES < MAX_UPLOAD_BYTES);
    assert.ok(CLIENT_MAX_SIDE >= 2 * 1400, "phải còn dư độ phân giải để Lanczos của server thu nhỏ tiếp");
  });
});

describe("thu nhỏ phía client — phần thuần", () => {
  it("needsShrink: chỉ ảnh trên ngưỡng", () => {
    assert.equal(needsShrink(CLIENT_SHRINK_ABOVE_BYTES), false);
    assert.equal(needsShrink(CLIENT_SHRINK_ABOVE_BYTES + 1), true);
  });

  it("scaledSize: giữ tỉ lệ, chỉ thu nhỏ, không phóng to", () => {
    assert.deepEqual(scaledSize(6000, 4000, 2800), { width: 2800, height: 1867 });
    assert.deepEqual(scaledSize(3000, 4000, 2800), { width: 2100, height: 2800 }); // ảnh dọc: cạnh dài là chiều cao
    assert.deepEqual(scaledSize(1200, 800, 2800), { width: 1200, height: 800 });
    assert.deepEqual(scaledSize(1, 5000, 2800), { width: 1, height: 2800 }); // không về 0
  });

  it("các lần thử giảm dần, và lần đầu giữ cạnh 2800 với chất lượng cao", () => {
    assert.equal(SHRINK_ATTEMPTS[0].maxSide, CLIENT_MAX_SIDE);
    assert.ok(SHRINK_ATTEMPTS[0].quality >= 0.9);
    for (let i = 1; i < SHRINK_ATTEMPTS.length; i++) {
      const a = SHRINK_ATTEMPTS[i - 1];
      const b = SHRINK_ATTEMPTS[i];
      assert.ok(b.maxSide <= a.maxSide && b.quality <= a.quality, `bước ${i} phải nhỏ hơn bước trước`);
    }
  });

  it("thiếu API trình duyệt (Node) → trả null thay vì ném, để nơi gọi gửi file gốc", async () => {
    assert.equal(await shrinkImage(new File([new Uint8Array(10)], "x.jpg", { type: "image/jpeg" })), null);
  });
});
