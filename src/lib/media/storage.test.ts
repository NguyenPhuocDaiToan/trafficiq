import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import sharp from "sharp";
import { GET } from "../../app/uploads/[file]/route";
import { isUploadPath } from "./path";
import { processImage, type ProcessedImage } from "./process";
import { readStorageConfig, StorageNotConfiguredError, type StorageConfig } from "./storage-config";
import { saveImage } from "./store";

const ENV_KEYS = [
  "STORAGE_DRIVER",
  "UPLOAD_DIR",
  "VERCEL",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL_BLOB_API_URL",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_URL",
  "S3_KEY_PREFIX",
  "S3_FORCE_PATH_STYLE",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
for (const k of ENV_KEYS) delete process.env[k];

after(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

async function image(): Promise<ProcessedImage> {
  const png = await sharp({ create: { width: 240, height: 120, channels: 3, background: { r: 10, g: 90, b: 200 } } })
    .png()
    .toBuffer();
  return processImage(png, "hero");
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Bắt lỗi cấu hình và trả về thông báo (kiểm cả loại lỗi). */
function configError(env: Record<string, string>): string {
  try {
    readStorageConfig(env);
  } catch (err) {
    assert.ok(err instanceof StorageNotConfiguredError, String(err));
    return err.message;
  }
  assert.fail("lẽ ra phải ném StorageNotConfiguredError");
}

describe("STORAGE_DRIVER — đọc cấu hình", () => {
  it("không đặt → mặc định vercel (deploy CI/CD lên Vercel), cả local lẫn trên Vercel", () => {
    assert.deepEqual(readStorageConfig({ BLOB_READ_WRITE_TOKEN: "tok" }), { driver: "vercel", token: "tok" });
    assert.deepEqual(readStorageConfig({ BLOB_READ_WRITE_TOKEN: "tok", VERCEL: "1" }), { driver: "vercel", token: "tok" });
    // UPLOAD_DIR không tự bật disk: chỉ cờ tường minh mới chọn disk.
    assert.equal(readStorageConfig({ BLOB_READ_WRITE_TOKEN: "tok", UPLOAD_DIR: "/x" }).driver, "vercel");
  });

  it("không đặt mà thiếu token → lỗi nói rõ đang dùng mặc định và cách thoát (disk|s3)", () => {
    for (const env of [{}, { VERCEL: "1" }] as Record<string, string>[]) {
      const msg = configError(env);
      assert.match(msg, /mặc định là Vercel Blob/);
      assert.match(msg, /BLOB_READ_WRITE_TOKEN/);
      assert.match(msg, /STORAGE_DRIVER=disk\|s3/);
    }
  });

  it("disk phải chọn tường minh; thư mục mặc định tương đối, UPLOAD_DIR được tôn trọng", () => {
    assert.deepEqual(readStorageConfig({ STORAGE_DRIVER: "disk" }), { driver: "disk", dir: "uploads" });
    assert.deepEqual(readStorageConfig({ STORAGE_DRIVER: "disk", UPLOAD_DIR: "  /var/lib/tiq/up  " }), {
      driver: "disk",
      dir: "/var/lib/tiq/up",
    });
  });

  it("disk tường minh trên Vercel là cấu hình sai (đĩa không bền)", () => {
    assert.match(configError({ STORAGE_DRIVER: "disk", VERCEL: "1", UPLOAD_DIR: "/x" }), /không dùng được trên Vercel/);
  });

  it("không phân biệt hoa thường và khoảng trắng", () => {
    assert.equal(readStorageConfig({ STORAGE_DRIVER: " DISK " }).driver, "disk");
    assert.equal(readStorageConfig({ STORAGE_DRIVER: "Vercel", BLOB_READ_WRITE_TOKEN: "t" }).driver, "vercel");
  });

  it("giá trị lạ → liệt kê giá trị hợp lệ", () => {
    const msg = configError({ STORAGE_DRIVER: "gcs" });
    assert.match(msg, /"gcs"/);
    for (const d of ["disk", "vercel", "s3"]) assert.ok(msg.includes(d), d);
  });

  it("vercel: thiếu token → lỗi nêu đúng tên biến", () => {
    assert.match(configError({ STORAGE_DRIVER: "vercel" }), /BLOB_READ_WRITE_TOKEN/);
    assert.match(configError({ STORAGE_DRIVER: "vercel", BLOB_READ_WRITE_TOKEN: "   " }), /BLOB_READ_WRITE_TOKEN/);
    assert.deepEqual(readStorageConfig({ STORAGE_DRIVER: "vercel", BLOB_READ_WRITE_TOKEN: "tok" }), { driver: "vercel", token: "tok" });
  });

  it("s3: liệt kê MỌI biến còn thiếu một lần", () => {
    const msg = configError({ STORAGE_DRIVER: "s3" });
    for (const v of ["S3_BUCKET", "S3_PUBLIC_URL", "S3_REGION"]) assert.ok(msg.includes(v), `${v} trong: ${msg}`);
  });

  it("s3: có endpoint (R2/MinIO) thì region mặc định là auto; không endpoint thì bắt buộc region", () => {
    const base = { STORAGE_DRIVER: "s3", S3_BUCKET: "b", S3_PUBLIC_URL: "https://cdn.example.com" };
    const withEndpoint = readStorageConfig({ ...base, S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com" });
    assert.equal(withEndpoint.driver === "s3" && withEndpoint.region, "auto");
    assert.match(configError(base), /S3_REGION/);
  });

  it("s3: chuẩn hoá URL công khai và tiền tố khoá", () => {
    const c = readStorageConfig({
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "b",
      S3_REGION: "ap-southeast-1",
      S3_PUBLIC_URL: "https://cdn.example.com///",
      S3_KEY_PREFIX: "/imgs/tiq",
      S3_FORCE_PATH_STYLE: "TRUE",
    });
    assert.ok(c.driver === "s3");
    assert.equal(c.publicUrl, "https://cdn.example.com");
    assert.equal(c.keyPrefix, "imgs/tiq/");
    assert.equal(c.forcePathStyle, true);
    assert.equal(c.credentials, undefined, "không khoá → dùng chuỗi xác thực mặc định (IAM role)");
  });

  it("s3: chỉ một nửa cặp khoá → lỗi; đủ cặp → dùng; URL không có http(s) → lỗi", () => {
    const base = { STORAGE_DRIVER: "s3", S3_BUCKET: "b", S3_REGION: "r", S3_PUBLIC_URL: "https://c.example" };
    assert.match(configError({ ...base, S3_ACCESS_KEY_ID: "k" }), /phải đi cùng nhau/);
    assert.match(configError({ ...base, S3_SECRET_ACCESS_KEY: "s" }), /phải đi cùng nhau/);
    assert.match(configError({ ...base, S3_PUBLIC_URL: "cdn.example.com" }), /http/);
    assert.match(configError({ ...base, S3_ENDPOINT: "minio:9000" }), /S3_ENDPOINT/);
    const ok = readStorageConfig({ ...base, S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" });
    assert.ok(ok.driver === "s3");
    assert.deepEqual(ok.credentials, { accessKeyId: "k", secretAccessKey: "s" });
  });

  it("s3: không đặt tiền tố → mặc định campaign-images/; đặt rỗng thì giữ rỗng được", () => {
    const base = { STORAGE_DRIVER: "s3", S3_BUCKET: "b", S3_REGION: "r", S3_PUBLIC_URL: "https://c.example" };
    const d = readStorageConfig(base);
    assert.ok(d.driver === "s3");
    assert.equal(d.keyPrefix, "campaign-images/");
  });
});

/** Server HTTP giả, ghi lại mọi request để kiểm chính xác SDK đã gửi gì. */
type Recorded = { method: string; url: string; headers: IncomingMessage["headers"]; body: Buffer };
async function fakeServer(respond: (req: Recorded) => { status: number; headers?: Record<string, string>; body?: string }) {
  const seen: Recorded[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const rec: Recorded = { method: req.method!, url: req.url!, headers: req.headers, body: Buffer.concat(chunks) };
      seen.push(rec);
      const r = respond(rec);
      res.writeHead(r.status, r.headers);
      res.end(r.body ?? "");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { seen, base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

describe("driver s3 (server S3 giả, SDK và chữ ký chạy thật)", () => {
  const baseCfg = (endpoint: string): StorageConfig => ({
    driver: "s3",
    bucket: "my-bucket",
    region: "auto",
    endpoint,
    credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
    forcePathStyle: true,
    publicUrl: "https://cdn.example.com",
    keyPrefix: "campaign-images/",
  });

  it("PUT đúng khoá, đúng header, body = byte ảnh; trả URL công khai tuyệt đối", async () => {
    const srv = await fakeServer(() => ({ status: 200, headers: { etag: '"abc"' } }));
    try {
      const img = await image();
      const out = await saveImage(img, baseCfg(srv.base));
      const file = `${sha(img.data)}.webp`;

      assert.equal(out.url, `https://cdn.example.com/campaign-images/${file}`);
      assert.equal(srv.seen.length, 1);
      const req = srv.seen[0];
      assert.equal(req.method, "PUT");
      assert.equal(new URL(req.url, "http://x").pathname, `/my-bucket/campaign-images/${file}`);
      assert.match(String(req.headers.authorization), /^AWS4-HMAC-SHA256 Credential=AKIATEST\//);
      assert.equal(req.headers["content-type"], "image/webp");
      assert.equal(req.headers["cache-control"], "public, max-age=31536000, immutable");
      // Không dùng aws-chunked/checksum trailer — R2/B2/MinIO cũ từ chối chúng.
      assert.ok(!String(req.headers["content-encoding"] ?? "").includes("aws-chunked"));
      assert.ok(req.body.equals(img.data), "body phải đúng từng byte");
      assert.equal(out.bytes, img.data.length);
    } finally {
      await srv.close();
    }
  });

  it("khoá object chỉ chứa sha256 + đuôi — không có gì do client khai", async () => {
    const srv = await fakeServer(() => ({ status: 200 }));
    try {
      await saveImage(await image(), baseCfg(srv.base));
      assert.match(new URL(srv.seen[0].url, "http://x").pathname, /^\/my-bucket\/campaign-images\/[a-f0-9]{64}\.webp$/);
    } finally {
      await srv.close();
    }
  });

  it("dịch vụ trả 403 → ném lỗi (không nuốt), để route trả 500 chung", async () => {
    const srv = await fakeServer(() => ({
      status: 403,
      headers: { "content-type": "application/xml" },
      body: "<Error><Code>AccessDenied</Code><Message>nope</Message></Error>",
    }));
    try {
      await assert.rejects(saveImage(await image(), baseCfg(srv.base)));
    } finally {
      await srv.close();
    }
  });
});

describe("driver vercel (API Vercel Blob giả qua VERCEL_BLOB_API_URL)", () => {
  const TOKEN = "vercel_blob_rw_STORE123_secretpart";

  it("PUT /?pathname=… với token, truy cập public, cho ghi đè; trả URL blob", async () => {
    const srv = await fakeServer((req) => {
      const pathname = new URL(req.url, "http://x").searchParams.get("pathname");
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: `https://store123.public.blob.vercel-storage.com/${pathname}`,
          downloadUrl: `https://store123.public.blob.vercel-storage.com/${pathname}?download=1`,
          pathname,
          contentType: "image/webp",
          contentDisposition: "inline",
          etag: "e",
        }),
      };
    });
    process.env.VERCEL_BLOB_API_URL = srv.base;
    try {
      const img = await image();
      const out = await saveImage(img, { driver: "vercel", token: TOKEN });
      const file = `${sha(img.data)}.webp`;

      assert.equal(out.url, `https://store123.public.blob.vercel-storage.com/campaign-images/${file}`);
      const req = srv.seen[0];
      assert.equal(req.method, "PUT");
      assert.equal(new URL(req.url, "http://x").searchParams.get("pathname"), `campaign-images/${file}`);
      assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
      assert.equal(req.headers["x-vercel-blob-access"], "public");
      assert.equal(req.headers["x-allow-overwrite"], "1");
      assert.equal(req.headers["x-add-random-suffix"], "0");
      assert.equal(req.headers["x-content-type"], "image/webp");
      assert.ok(req.body.equals(img.data), "body phải đúng từng byte");
    } finally {
      await srv.close();
    }
  });

  it("store Private (chọn nhầm lúc tạo) → StorageNotConfiguredError nói rõ cần Public", async () => {
    // Lỗi thật do Vercel trả khi gọi `put` public vào store private: mã `bad_request`, câu chữ được giữ
    // nguyên (đã bắt bằng một request thật tới store private).
    const srv = await fakeServer(() => ({
      status: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: { code: "bad_request", message: "Cannot use public access on a private store. The store is configured with private access." },
      }),
    }));
    process.env.VERCEL_BLOB_API_URL = srv.base;
    try {
      await assert.rejects(
        saveImage(await image(), { driver: "vercel", token: TOKEN }),
        (err: unknown) => err instanceof StorageNotConfiguredError && /Public/.test(err.message) && /Private/.test(err.message),
      );
    } finally {
      await srv.close();
    }
  });

  it("API trả 403 → ném lỗi", async () => {
    const srv = await fakeServer(() => ({
      status: 403,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: { code: "forbidden", message: "no" } }),
    }));
    process.env.VERCEL_BLOB_API_URL = srv.base;
    try {
      await assert.rejects(saveImage(await image(), { driver: "vercel", token: TOKEN }));
    } finally {
      await srv.close();
    }
  });
});

describe("driver disk qua cờ STORAGE_DRIVER", () => {
  it("STORAGE_DRIVER=disk: saveImage đọc cấu hình từ env và trả đường dẫn /uploads tương đối", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tiq-drv-"));
    process.env.STORAGE_DRIVER = "disk";
    process.env.UPLOAD_DIR = dir;
    try {
      const out = await saveImage(await image());
      assert.ok(isUploadPath(out.url), out.url);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cấu hình sai thì ném StorageNotConfiguredError, không ghi gì", async () => {
    process.env.STORAGE_DRIVER = "s3"; // thiếu mọi biến S3_*
    await assert.rejects(saveImage(await image()), StorageNotConfiguredError);
  });
});

describe("route /uploads khi đổi driver", () => {
  const call = (file: string) => GET(new Request("http://l/uploads/" + file), { params: Promise.resolve({ file }) });

  it("driver ngoài (vercel/s3) và không có UPLOAD_DIR: 404, không ném lỗi cấu hình", async () => {
    process.env.STORAGE_DRIVER = "vercel";
    process.env.BLOB_READ_WRITE_TOKEN = "t";
    assert.equal((await call(`${"a".repeat(64)}.webp`)).status, 404);
    process.env.STORAGE_DRIVER = "s3"; // cấu hình hỏng cũng không được làm route công khai nổ 500
    assert.equal((await call(`${"a".repeat(64)}.webp`)).status, 404);
  });

  it("driver ngoài nhưng còn UPLOAD_DIR: vẫn phục vụ ảnh cũ trên đĩa (campaign cũ không hỏng)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tiq-legacy-"));
    try {
      const img = await image();
      const file = `${sha(img.data)}.webp`;
      writeFileSync(path.join(dir, file), img.data);
      process.env.STORAGE_DRIVER = "vercel";
      process.env.BLOB_READ_WRITE_TOKEN = "t";
      process.env.UPLOAD_DIR = dir;
      const res = await call(file);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "image/webp");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
