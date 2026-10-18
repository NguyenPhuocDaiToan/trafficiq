"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { actorOf, requireOwner } from "@/lib/auth/current-user";
import { campaigns, shareDomains } from "@/lib/db/collections";
import { normalizeHost } from "@/lib/domains/host";
import { verifyDomainReachable } from "@/lib/domains/verify";
import { publicBaseUrl } from "@/lib/env";
import type { ActionResult } from "@/lib/control-plane/schemas";
import { isDuplicateKeyError } from "@/lib/tracking/emit";

/**
 * Quản lý tên miền chia sẻ — chỉ owner (kiểm bằng DB ở dòng đầu mỗi action).
 *
 * Thêm một tên miền ở đây KHÔNG làm nó tới được ứng dụng: việc đó là của DNS và của nền tảng deploy (thêm tên
 * miền vào dự án Vercel, hoặc cấu hình nginx trên VM). Ở đây chỉ khai báo, rồi `verifyDomain` gọi thử để chắc
 * chắn nó dẫn về đúng ứng dụng trước khi cho chọn ở form chiến dịch.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function idOf(formData: FormData): ObjectId | null {
  const id = text(formData, "id");
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function addDomain(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = normalizeHost(text(formData, "host"));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  let primaryHost = "";
  try {
    primaryHost = new URL(publicBaseUrl()).hostname;
  } catch {
    // publicBaseUrl luôn là URL hợp lệ; nếu không thì không có gì để so.
  }
  if (parsed.host === primaryHost) {
    return { ok: false, error: "Đây đã là tên miền chính của hệ thống — không cần thêm." };
  }

  const label = text(formData, "label").trim().slice(0, 80);
  const now = new Date();
  const col = await shareDomains();
  // Kiểm trước, không chỉ dựa vào chỉ mục unique (xem `createMember`).
  if (await col.findOne({ host: parsed.host }, { projection: { _id: 1 } })) {
    return { ok: false, error: `Tên miền ${parsed.host} đã được khai báo.` };
  }
  try {
    await col.insertOne({
      host: parsed.host,
      label: label || undefined,
      status: "pending",
      createdBy: actorOf(owner),
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return { ok: false, error: `Tên miền ${parsed.host} đã được khai báo.` };
    throw err;
  }

  revalidatePath("/admin/ten-mien");
  return {
    ok: true,
    message: `Đã thêm ${parsed.host} (chờ kiểm tra). Trỏ DNS và thêm vào nơi deploy, rồi bấm "Kiểm tra".`,
  };
}

export async function verifyDomain(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = idOf(formData);
  if (!id) return { ok: false, error: "Tên miền không hợp lệ." };

  const col = await shareDomains();
  const domain = await col.findOne({ _id: id });
  if (!domain) return { ok: false, error: "Không tìm thấy tên miền." };

  const result = await verifyDomainReachable(domain.host);
  if (!result.ok) {
    // Đang `verified` mà giờ kiểm hỏng (DNS đổi, hết chứng chỉ): hạ về pending để form chiến dịch không
    // đưa ra thêm link tới một tên miền đang chết. Link đã gắn vào campaign tự rơi về tên miền chính.
    if (domain.status === "verified") {
      await col.updateOne({ _id: id }, { $set: { status: "pending", updatedAt: new Date() }, $unset: { verifiedAt: "" } });
      revalidatePath("/admin/ten-mien");
      revalidatePath("/admin/campaigns");
    }
    return { ok: false, error: result.reason };
  }

  const now = new Date();
  await col.updateOne({ _id: id }, { $set: { status: "verified", verifiedAt: now, updatedAt: now } });
  revalidatePath("/admin/ten-mien");
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `${domain.host} đã dẫn tới ứng dụng — chọn được ở form chiến dịch.` };
}

export async function disableDomain(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = idOf(formData);
  if (!id) return { ok: false, error: "Tên miền không hợp lệ." };

  const col = await shareDomains();
  const domain = await col.findOneAndUpdate(
    { _id: id },
    { $set: { status: "disabled", updatedAt: new Date() }, $unset: { verifiedAt: "" } },
    { returnDocument: "after" },
  );
  if (!domain) return { ok: false, error: "Không tìm thấy tên miền." };

  const used = await (await campaigns()).countDocuments({ shareDomain: domain.host });
  revalidatePath("/admin/ten-mien");
  revalidatePath("/admin/campaigns");
  return {
    ok: true,
    message:
      used > 0
        ? `Đã tắt ${domain.host}. ${used} chiến dịch đang chọn nó sẽ hiện link theo tên miền chính cho tới khi bạn chọn tên miền khác. Link đã đăng trước đây trên tên miền này vẫn chạy chừng nào DNS còn trỏ về.`
        : `Đã tắt ${domain.host}.`,
  };
}

export async function deleteDomain(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();
  const id = idOf(formData);
  if (!id) return { ok: false, error: "Tên miền không hợp lệ." };

  const col = await shareDomains();
  const domain = await col.findOne({ _id: id });
  if (!domain) return { ok: false, error: "Không tìm thấy tên miền." };

  const used = await (await campaigns()).countDocuments({ shareDomain: domain.host });
  if (used > 0) {
    return { ok: false, error: `Còn ${used} chiến dịch đang dùng ${domain.host}. Đổi tên miền của chúng trước, hoặc chỉ tắt tên miền này.` };
  }

  await col.deleteOne({ _id: id });
  revalidatePath("/admin/ten-mien");
  return { ok: true, message: `Đã xoá ${domain.host}.` };
}
