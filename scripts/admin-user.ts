/**
 * Tạo hoặc khôi phục MỘT tài khoản owner — đường cứu hộ khi mất quyền vào /admin (quên mật khẩu owner duy
 * nhất, owner bị tắt…). Cần quyền truy cập DB (MONGODB_URI), nên ai chạy được script này vốn đã có thể làm mọi
 * thứ với DB; nó không mở thêm cửa nào.
 *
 * Chạy:
 *   NEW_ADMIN_PASSWORD='mật-khẩu-mới-ít-nhất-10-ký-tự' npm run admin:user -- owner@example.com "Tên hiển thị"
 *
 * Mật khẩu đi qua biến môi trường chứ không phải đối số dòng lệnh: đối số nằm trong lịch sử shell và `ps`.
 *
 * Nếu email đã có: đặt lại mật khẩu, bật lại tài khoản, nâng lên owner, mở khoá, và tăng `tokenVersion` (mọi
 * phiên cũ của tài khoản đó hết hiệu lực). Nếu chưa có: tạo mới là owner.
 */
import { getClientPromise } from "../src/lib/db/client";
import { adminUsers } from "../src/lib/db/collections";
import { isPlausibleEmail, normalizeEmail } from "../src/lib/auth/login";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";

async function main() {
  const email = normalizeEmail(process.argv[2] ?? "");
  const name = (process.argv[3] ?? "").trim() || email.split("@")[0];
  const password = process.env.NEW_ADMIN_PASSWORD ?? "";

  if (!isPlausibleEmail(email)) throw new Error("Cú pháp: npm run admin:user -- <email> [tên hiển thị]");
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(`Đặt mật khẩu qua biến NEW_ADMIN_PASSWORD. ${problem}`);

  const col = await adminUsers();
  const now = new Date();
  const passwordHash = await hashPassword(password);

  const existing = await col.findOne({ email });
  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: { passwordHash, role: "owner", active: true, failedLogins: 0, updatedAt: now },
        $inc: { tokenVersion: 1 },
        $unset: { lockedUntil: "" },
      },
    );
    console.log(`Đã khôi phục ${email}: owner, đang hoạt động, mật khẩu mới, mọi phiên cũ bị thu hồi.`);
  } else {
    await col.insertOne({
      email,
      name,
      role: "owner",
      passwordHash,
      active: true,
      tokenVersion: 1,
      failedLogins: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Đã tạo owner ${email}.`);
  }

  await (await getClientPromise()).close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
