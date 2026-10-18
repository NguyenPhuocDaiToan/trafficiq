import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ObjectId } from "mongodb";
import { LOCK_MS, MAX_FAILURES, authenticate, type UserStore } from "./login";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password";
import { newSessionClaims, sessionSecret, signSession, verifySession } from "./session";
import type { AdminUser } from "../types";

const SECRET = "s|" + "k".repeat(40);
const UID = "a".repeat(24);

describe("password (scrypt)", () => {
  it("băm rồi kiểm đúng; sai mật khẩu bị từ chối; hai lần băm cho hai chuỗi khác nhau (salt)", async () => {
    const h1 = await hashPassword("đúng-mật-khẩu-1");
    const h2 = await hashPassword("đúng-mật-khẩu-1");
    assert.notEqual(h1, h2);
    assert.match(h1, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword("đúng-mật-khẩu-1", h1), true);
    assert.equal(await verifyPassword("sai-mật-khẩu-1", h1), false);
    assert.equal(needsRehash(h1), false);
  });

  it("chuỗi hash hỏng / tham số phi lý → false, không ném lỗi, không cấp phát khổng lồ", async () => {
    for (const bad of ["", "abc", "scrypt$1$2$3$4", "bcrypt$a$b$c$d$e", `scrypt$${2 ** 30}$8$1$AAAA$AAAA`, "scrypt$32768$999$1$AAAA$AAAA", "scrypt$32768$8$1$AAAA$"]) {
      assert.equal(await verifyPassword("x", bad), false, bad);
    }
  });

  it("Unicode được chuẩn hoá (NFKC): cùng một chữ có dấu gõ hai kiểu vẫn khớp", async () => {
    const composed = "mật-khẩu-éééé";
    const decomposed = "mật-khẩu-éééé";
    assert.equal(await verifyPassword(decomposed, await hashPassword(composed)), true);
  });

  it("chính sách mật khẩu mới", () => {
    assert.match(passwordProblem("ngắn")!, /tối thiểu/);
    assert.match(passwordProblem("a".repeat(201))!, /tối đa/);
    assert.match(passwordProblem("aaaaaaaaaaaa")!, /dễ đoán/);
    assert.match(passwordProblem("Ab@Example.com", "ab@example.com")!, /trùng email/);
    assert.equal(passwordProblem("một-mật-khẩu-ổn"), null);
  });
});

describe("session cookie đã ký", () => {
  const now = 1_800_000_000_000;

  it("ký rồi kiểm đúng", async () => {
    const c = await signSession(newSessionClaims(UID, 3, now), SECRET);
    assert.deepEqual(await verifySession(c, SECRET, now + 1000), newSessionClaims(UID, 3, now));
  });

  it("hết hạn → từ chối", async () => {
    const c = await signSession(newSessionClaims(UID, 1, now), SECRET);
    assert.equal(await verifySession(c, SECRET, now + 7 * 86400 * 1000 + 1000), null);
  });

  it("sửa bất kỳ trường nào (uid, ver, exp, chữ ký) → từ chối", async () => {
    const c = await signSession(newSessionClaims(UID, 1, now), SECRET);
    const [v, uid, ver, exp, sig] = c.split(".");
    const other = "b".repeat(24);
    for (const forged of [
      [v, other, ver, exp, sig],
      [v, uid, "2", exp, sig],
      [v, uid, ver, String(Number(exp) + 99999), sig],
      [v, uid, ver, exp, sig.slice(0, -2) + "AA"],
      [v, uid, ver, exp, ""],
    ]) {
      assert.equal(await verifySession(forged.join("."), SECRET, now), null, forged.join("."));
    }
  });

  it("ký bằng khoá khác → từ chối; cookie cũ (sha256 hex) và rác → từ chối", async () => {
    const c = await signSession(newSessionClaims(UID, 1, now), "s|" + "z".repeat(40));
    assert.equal(await verifySession(c, SECRET, now), null);
    for (const junk of ["", "0".repeat(64), "v2.a.b.c.d", "v2." + "a".repeat(300), undefined]) {
      assert.equal(await verifySession(junk, SECRET, now), null);
    }
  });

  it("sessionSecret: SESSION_SECRET phải ≥ 32 ký tự; không có thì dẫn xuất từ IP_HASH_SALT + ADMIN_PASSWORD, KHÔNG từ mật khẩu một mình", () => {
    assert.equal(sessionSecret({ SESSION_SECRET: "ngắn" }), null);
    assert.ok(sessionSecret({ SESSION_SECRET: "x".repeat(32) }));
    assert.equal(sessionSecret({ ADMIN_PASSWORD: "admin123" }), null);
    assert.equal(sessionSecret({ IP_HASH_SALT: "ngắn", ADMIN_PASSWORD: "admin123" }), null);
    assert.ok(sessionSecret({ IP_HASH_SALT: "s".repeat(32), ADMIN_PASSWORD: "admin123" }));
    assert.equal(sessionSecret({}), null);
    // Hai nguồn khác nhau không được ra cùng khoá.
    assert.notEqual(sessionSecret({ SESSION_SECRET: "s".repeat(32) }), sessionSecret({ IP_HASH_SALT: "s".repeat(32), ADMIN_PASSWORD: "x" }));
  });
});

/** Store trong bộ nhớ — cùng ngữ nghĩa với bản Mongo. */
function memoryStore(initial: AdminUser[] = []) {
  const users = new Map<string, AdminUser>(initial.map((u) => [u._id!.toString(), u]));
  const store: UserStore = {
    async findByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null;
    },
    async countUsers() {
      return users.size;
    },
    async insertOwner(u) {
      if ([...users.values()].some((x) => x.email === u.email)) return null;
      const doc = { ...u, _id: new ObjectId() };
      users.set(doc._id.toString(), doc);
      return doc;
    },
    async incrementFailures(id) {
      const u = users.get(id.toString())!;
      u.failedLogins += 1;
      return u.failedLogins;
    },
    async lock(id, until) {
      const u = users.get(id.toString())!;
      u.lockedUntil = until;
      u.failedLogins = 0;
    },
    async markLogin(id, now, hash) {
      const u = users.get(id.toString())!;
      u.failedLogins = 0;
      delete u.lockedUntil;
      u.lastLoginAt = now;
      if (hash) u.passwordHash = hash;
    },
  };
  return { store, users };
}

async function member(email: string, password: string, extra: Partial<AdminUser> = {}): Promise<AdminUser> {
  const now = new Date();
  return {
    _id: new ObjectId(),
    email,
    name: "T",
    role: "member",
    passwordHash: await hashPassword(password),
    active: true,
    tokenVersion: 1,
    failedLogins: 0,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

describe("authenticate — chính sách đăng nhập", () => {
  it("đúng email + mật khẩu → vào; email không phân biệt hoa/thường, có khoảng trắng thừa", async () => {
    const { store } = memoryStore([await member("an@example.com", "mật-khẩu-của-an")]);
    const r = await authenticate({ email: "  AN@Example.com ", password: "mật-khẩu-của-an" }, store);
    assert.equal(r.ok, true);
  });

  it("sai mật khẩu, sai email, tài khoản tắt → cùng một kết quả { ok: false }", async () => {
    const { store } = memoryStore([
      await member("an@example.com", "mật-khẩu-của-an"),
      await member("off@example.com", "mật-khẩu-của-off", { active: false }),
    ]);
    assert.deepEqual(await authenticate({ email: "an@example.com", password: "sai-sai-sai-sai" }, store), { ok: false });
    assert.deepEqual(await authenticate({ email: "khong@example.com", password: "mật-khẩu-của-an" }, store), { ok: false });
    assert.deepEqual(await authenticate({ email: "off@example.com", password: "mật-khẩu-của-off" }, store), { ok: false });
    assert.deepEqual(await authenticate({ email: "không-phải-email", password: "x" }, store), { ok: false });
  });

  it(`sai ${MAX_FAILURES} lần liên tiếp → khoá ${LOCK_MS / 60000} phút, kể cả khi lần sau nhập ĐÚNG; hết hạn khoá thì vào được`, async () => {
    const u = await member("an@example.com", "mật-khẩu-của-an");
    const { store, users } = memoryStore([u]);
    const t0 = new Date("2026-10-18T00:00:00Z");
    for (let i = 0; i < MAX_FAILURES; i++) {
      assert.equal((await authenticate({ email: "an@example.com", password: "sai-sai-sai-sai" }, store, { now: t0 })).ok, false);
    }
    assert.ok(users.get(u._id!.toString())!.lockedUntil);
    const during = new Date(t0.getTime() + LOCK_MS - 1000);
    assert.equal((await authenticate({ email: "an@example.com", password: "mật-khẩu-của-an" }, store, { now: during })).ok, false);
    const after = new Date(t0.getTime() + LOCK_MS + 1000);
    assert.equal((await authenticate({ email: "an@example.com", password: "mật-khẩu-của-an" }, store, { now: after })).ok, true);
    assert.equal(users.get(u._id!.toString())!.failedLogins, 0);
  });

  it("đăng nhập đúng xoá bộ đếm sai: 4 lần sai + 1 đúng + 4 lần sai nữa không khoá", async () => {
    const u = await member("an@example.com", "mật-khẩu-của-an");
    const { store, users } = memoryStore([u]);
    const bad = () => authenticate({ email: "an@example.com", password: "sai-sai-sai-sai" }, store);
    for (let i = 0; i < MAX_FAILURES - 1; i++) await bad();
    assert.equal((await authenticate({ email: "an@example.com", password: "mật-khẩu-của-an" }, store)).ok, true);
    for (let i = 0; i < MAX_FAILURES - 1; i++) await bad();
    assert.equal(users.get(u._id!.toString())!.lockedUntil, undefined);
  });

  it("tài khoản đầu tiên: ADMIN_PASSWORD tạo owner khi CHƯA có ai; email bất kỳ", async () => {
    const { store, users } = memoryStore();
    const r = await authenticate({ email: "Chu@Example.com", password: "mật-khẩu-cũ-từ-env" }, store, { bootstrapPassword: "mật-khẩu-cũ-từ-env" });
    assert.equal(r.ok, true);
    const created = [...users.values()][0];
    assert.equal(created.role, "owner");
    assert.equal(created.email, "chu@example.com");
    assert.equal(await verifyPassword("mật-khẩu-cũ-từ-env", created.passwordHash), true);
  });

  it("bootstrap sai mật khẩu → không tạo gì; CÓ tài khoản rồi thì ADMIN_PASSWORD không mở cửa nữa", async () => {
    const empty = memoryStore();
    assert.equal((await authenticate({ email: "x@example.com", password: "sai-sai-sai-sai" }, empty.store, { bootstrapPassword: "mật-khẩu-cũ-từ-env" })).ok, false);
    assert.equal(empty.users.size, 0);

    const { store, users } = memoryStore([await member("an@example.com", "mật-khẩu-của-an")]);
    const r = await authenticate({ email: "ke-la@example.com", password: "mật-khẩu-cũ-từ-env" }, store, { bootstrapPassword: "mật-khẩu-cũ-từ-env" });
    assert.equal(r.ok, false);
    assert.equal(users.size, 1);
  });

  it("hash tham số cũ được băm lại khi đăng nhập thành công", async () => {
    // Tham số yếu hơn hiện tại (N=2^14) nhưng hợp lệ.
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16);
    const key = scryptSync("mật-khẩu-của-an", salt, 32, { N: 2 ** 14, r: 8, p: 1 });
    const legacy = ["scrypt", 2 ** 14, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
    assert.equal(needsRehash(legacy), true);
    const u = await member("an@example.com", "x", { passwordHash: legacy });
    const { store, users } = memoryStore([u]);
    assert.equal((await authenticate({ email: "an@example.com", password: "mật-khẩu-của-an" }, store)).ok, true);
    const stored = users.get(u._id!.toString())!.passwordHash;
    assert.equal(needsRehash(stored), false);
    assert.equal(await verifyPassword("mật-khẩu-của-an", stored), true);
  });
});
