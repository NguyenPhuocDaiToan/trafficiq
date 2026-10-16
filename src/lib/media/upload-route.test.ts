import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { POST } from "../../app/admin/upload-image/route";
import { SESSION_COOKIE, sessionValueFor } from "../auth/session";
import { acquireUploadSlot, resetUploadGuard } from "./upload-guard";

const PASSWORD = "test-password";
const dir = mkdtempSync(path.join(tmpdir(), "tiq-route-"));
const prev = { dir: process.env.UPLOAD_DIR, pw: process.env.ADMIN_PASSWORD, vercel: process.env.VERCEL };
process.env.UPLOAD_DIR = dir;
process.env.ADMIN_PASSWORD = PASSWORD;
delete process.env.VERCEL;
// Mặc định của dự án là vercel; các test đĩa phải chọn disk tường minh.
process.env.STORAGE_DRIVER = "disk";

after(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const [k, v] of [
    ["UPLOAD_DIR", prev.dir],
    ["ADMIN_PASSWORD", prev.pw],
    ["VERCEL", prev.vercel],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(() => resetUploadGuard());

const png = () =>
  sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 20, g: 120, b: 60 } } })
    .png()
    .toBuffer();

type Opts = {
  cookie?: string | null;
  headers?: Record<string, string | null>;
  file?: Blob | null;
  kind?: string;
  contentLength?: number | null;
};

/**
 * Dựng request giống trình duyệt: multipart thật + `content-length` đúng. Mặc định hợp lệ;
 * mỗi test chỉ bóp méo MỘT thứ để chứng minh đúng lớp bảo vệ đó chặn.
 */
async function request(opts: Opts = {}) {
  const fd = new FormData();
  const file = opts.file === undefined ? new Blob([new Uint8Array(await png())]) : opts.file;
  if (file) fd.set("file", file, "x.png");
  fd.set("kind", opts.kind ?? "hero");

  const probe = new Request("http://localhost:3000/admin/upload-image", { method: "POST", body: fd });
  const body = Buffer.from(await probe.arrayBuffer());

  const cookie = opts.cookie === undefined ? await sessionValueFor(PASSWORD) : opts.cookie;
  const headers: Record<string, string> = {
    "content-type": probe.headers.get("content-type")!,
    "sec-fetch-site": "same-origin",
  };
  if (opts.contentLength !== null) headers["content-length"] = String(opts.contentLength ?? body.length);
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (v === null) delete headers[k];
    else headers[k] = v;
  }
  return new NextRequest("http://localhost:3000/admin/upload-image", { method: "POST", headers, body });
}

const call = async (opts?: Opts) => {
  const res = await POST(await request(opts));
  return { status: res.status, body: (await res.json()) as { ok: boolean; error?: string; url?: string }, res };
};

describe("upload-image — xác thực", () => {
  it("hợp lệ → 200 và file nằm trên đĩa", async () => {
    const r = await call();
    assert.equal(r.status, 200);
    assert.match(r.body.url!, /^\/uploads\/[a-f0-9]{64}\.webp$/);
    assert.ok(existsSync(path.join(dir, r.body.url!.replace("/uploads/", ""))));
    assert.equal(r.res.headers.get("cache-control"), "no-store");
  });

  it("không cookie / cookie sai → 401, và KHÔNG ghi gì xuống đĩa", async () => {
    const before = readdirSync(dir).length;
    assert.equal((await call({ cookie: null })).status, 401);
    assert.equal((await call({ cookie: "0".repeat(64) })).status, 401);
    assert.equal((await call({ cookie: await sessionValueFor("mật-khẩu-khác") })).status, 401);
    assert.equal(readdirSync(dir).length, before);
  });

  it("chưa cấu hình ADMIN_PASSWORD → 503 (khoá hẳn, không mở toang)", async () => {
    delete process.env.ADMIN_PASSWORD;
    try {
      assert.equal((await call()).status, 503);
    } finally {
      process.env.ADMIN_PASSWORD = PASSWORD;
    }
  });
});

describe("upload-image — chống CSRF", () => {
  it("Sec-Fetch-Site khác same-origin → 403", async () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      assert.equal((await call({ headers: { "sec-fetch-site": site } })).status, 403, site);
    }
  });

  it("thiếu Fetch Metadata: so Origin với Host", async () => {
    const noMeta = { "sec-fetch-site": null };
    assert.equal((await call({ headers: { ...noMeta, origin: "http://localhost:3000", host: "localhost:3000" } })).status, 200);
    assert.equal((await call({ headers: { ...noMeta, origin: "http://evil.example", host: "localhost:3000" } })).status, 403);
    assert.equal((await call({ headers: { ...noMeta, host: "localhost:3000" } })).status, 403, "thiếu Origin");
    assert.equal((await call({ headers: { ...noMeta, origin: "not a url", host: "localhost:3000" } })).status, 403);
  });

  it("sau nginx: Host là upstream nhưng X-Forwarded-Host là domain thật → vẫn hợp lệ", async () => {
    const r = await call({
      headers: {
        "sec-fetch-site": null,
        origin: "https://site.example",
        host: "127.0.0.1:3000",
        "x-forwarded-host": "site.example",
      },
    });
    assert.equal(r.status, 200);
  });

  it("Origin chỉ trùng phần đầu của host không được qua", async () => {
    const r = await call({
      headers: { "sec-fetch-site": null, origin: "https://site.example.evil.com", host: "site.example" },
    });
    assert.equal(r.status, 403);
  });
});

describe("upload-image — kích thước và đầu vào", () => {
  it("thiếu / sai content-length → 411; quá lớn → 413 TRƯỚC khi đọc body", async () => {
    assert.equal((await call({ contentLength: null })).status, 411);
    assert.equal((await call({ headers: { "content-length": "abc" } })).status, 411);
    assert.equal((await call({ headers: { "content-length": "0" } })).status, 411);
    const big = await call({ contentLength: 50 * 1024 * 1024 });
    assert.equal(big.status, 413);
    assert.match(big.body.error!, /quá lớn/);
  });

  it("thiếu file / sai kind → 400", async () => {
    assert.equal((await call({ file: null })).status, 400);
    assert.equal((await call({ kind: "avatar" })).status, 400);
    assert.equal((await call({ kind: "../../etc" })).status, 400);
  });

  it("nội dung không phải ảnh → 422, dù khai là image/png", async () => {
    for (const bytes of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      Buffer.from("<?php system($_GET['c']); ?>"),
      Buffer.from("MZ\x90\x00 not an image"),
    ]) {
      const r = await call({ file: new Blob([new Uint8Array(bytes)], { type: "image/png" }) });
      assert.equal(r.status, 422);
    }
  });

  it("tên file client khai không ảnh hưởng tên trên đĩa", async () => {
    const fd = new FormData();
    fd.set("file", new Blob([new Uint8Array(await png())]), "../../../etc/passwd.png");
    fd.set("kind", "hero");
    const probe = new Request("http://l/", { method: "POST", body: fd });
    const body = Buffer.from(await probe.arrayBuffer());
    const req = new NextRequest("http://localhost:3000/admin/upload-image", {
      method: "POST",
      body,
      headers: {
        "content-type": probe.headers.get("content-type")!,
        "content-length": String(body.length),
        "sec-fetch-site": "same-origin",
        cookie: `${SESSION_COOKIE}=${await sessionValueFor(PASSWORD)}`,
      },
    });
    const res = await POST(req);
    const j = (await res.json()) as { url: string };
    assert.match(j.url, /^\/uploads\/[a-f0-9]{64}\.webp$/);
  });
});

describe("upload-image — giới hạn tần suất", () => {
  it("quá 20 lượt/phút → 429 kèm Retry-After; lượt bị từ chối không ghi gì", async () => {
    for (let i = 0; i < 20; i++) assert.equal((await call()).status, 200, `lượt ${i + 1}`);
    const before = readdirSync(dir).length;
    const r = await call();
    assert.equal(r.status, 429);
    assert.ok(Number(r.res.headers.get("retry-after")) >= 1);
    assert.equal(readdirSync(dir).length, before);
  });

  it("tối đa 3 lượt xử lý đồng thời; release idempotent", () => {
    const slots = [acquireUploadSlot(), acquireUploadSlot(), acquireUploadSlot()];
    assert.ok(slots.every((s) => s.ok));
    const fourth = acquireUploadSlot();
    assert.equal(fourth.ok, false);

    if (slots[0].ok) {
      slots[0].release();
      slots[0].release(); // gọi hai lần không được mở thêm chỗ
    }
    assert.equal(acquireUploadSlot().ok, true);
    assert.equal(acquireUploadSlot().ok, false, "chỉ mở ra đúng 1 chỗ");
  });

  it("cửa sổ trượt: sau 60 giây được tải tiếp", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i++) {
      const s = acquireUploadSlot(t0 + i);
      if (s.ok) s.release();
    }
    assert.equal(acquireUploadSlot(t0 + 1000).ok, false);
    assert.equal(acquireUploadSlot(t0 + 61_000).ok, true);
  });

  it("slot được trả lại cả khi xử lý lỗi (không rò rỉ chỗ)", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await call({ file: new Blob([new Uint8Array(Buffer.from("x"))]) })).status, 422);
    // Nếu mỗi lần lỗi làm rò một chỗ thì 3 lượt đầu đã chiếm hết và các lượt sau là 429.
    assert.equal((await call()).status, 200);
  });
});

describe("upload-image — lỗi hạ tầng không lộ thông tin", () => {
  it("không ghi được đĩa → 500 chung chung, không lộ đường dẫn, không để lại file tạm", async () => {
    // UPLOAD_DIR trỏ vào một FILE thường → mkdir/ghi đều lỗi.
    const blocker = path.join(dir, "not-a-dir");
    writeFileSync(blocker, "x");
    process.env.UPLOAD_DIR = path.join(blocker, "sub");
    const silence = console.error;
    console.error = () => {};
    try {
      const r = await call();
      assert.equal(r.status, 500);
      assert.ok(!JSON.stringify(r.body).includes(blocker), "không được lộ đường dẫn đĩa");
      assert.ok(!/ENOTDIR|EEXIST|ENOENT|at\s/.test(JSON.stringify(r.body)), "không được lộ mã lỗi/stack");
    } finally {
      console.error = silence;
      process.env.UPLOAD_DIR = dir;
    }
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith(".tmp")), []);
  });
});

describe("upload-image — cấu hình nơi lưu", () => {
  it("STORAGE_DRIVER sai/thiếu biến → 503 nêu rõ biến thiếu, không ghi gì xuống đĩa", async () => {
    const before = readdirSync(dir).length;
    process.env.STORAGE_DRIVER = "s3"; // thiếu S3_BUCKET, S3_PUBLIC_URL, S3_REGION
    try {
      const r = await call();
      assert.equal(r.status, 503);
      assert.match(r.body.error!, /S3_BUCKET/);
      process.env.STORAGE_DRIVER = "gcs";
      assert.equal((await call()).status, 503);
    } finally {
      process.env.STORAGE_DRIVER = "disk";
    }
    assert.equal(readdirSync(dir).length, before);
  });

  it("không đặt STORAGE_DRIVER và thiếu token → 503: mặc định là Vercel Blob", async () => {
    delete process.env.STORAGE_DRIVER;
    try {
      const r = await call();
      assert.equal(r.status, 503);
      assert.match(r.body.error!, /mặc định là Vercel Blob/);
      assert.match(r.body.error!, /BLOB_READ_WRITE_TOKEN/);
    } finally {
      process.env.STORAGE_DRIVER = "disk";
    }
  });

  it("disk trên Vercel → 503 (đĩa không bền), không ghi gì", async () => {
    process.env.VERCEL = "1";
    const before = readdirSync(dir).length;
    try {
      const r = await call();
      assert.equal(r.status, 503);
      assert.match(r.body.error!, /không dùng được trên Vercel/);
    } finally {
      delete process.env.VERCEL;
    }
    assert.equal(readdirSync(dir).length, before);
  });
});
