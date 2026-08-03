"use server";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { contactMessages } from "@/lib/db/collections";
import { HONEYPOT_FIELD, contactSchema } from "@/lib/contact/schema";
import type { ActionResult } from "@/lib/control-plane/schemas";
import { hashIp } from "@/lib/tracking/request-context";

/** Tối đa 3 tin nhắn / 1 giờ / một IP đã hash. */
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const MAX_UA_LEN = 200;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

/**
 * Lấy IP từ header proxy. Không dùng `NextRequest` được vì đây là server action,
 * không phải route handler — nhưng `headers()` cho cùng thông tin.
 */
async function currentIpHash(): Promise<{ ipHash?: string; userAgent?: string }> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]?.trim()
    : (store.get("x-real-ip") ?? undefined);

  return {
    // Cùng luật PII với clickEvents: chỉ lưu hash, không bao giờ lưu IP thô.
    ipHash: hashIp(ip),
    userAgent: store.get("user-agent")?.slice(0, MAX_UA_LEN) ?? undefined,
  };
}

/**
 * Nhận tin nhắn từ /lien-he.
 *
 * Signature `(prevState, formData)` là BẮT BUỘC: nó được truyền TRỰC TIẾP vào
 * `useActionState` ở client. Nếu bọc qua closure `(prev, fd) => action(fd)` thì
 * React đăng ký một hàm client, form mất field action và **form chỉ chạy khi có
 * JS** — đúng lỗi đã gặp ở control plane. Xem comment trong
 * `src/components/action-form.tsx`.
 */
export async function submitContactMessage(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  /*
   * Bẫy bot: trả về THÀNH CÔNG giả, không phải lỗi.
   * Nếu trả lỗi, bot biết mình bị phát hiện và sẽ thử lại kiểu khác. Trả thành
   * công thì nó bỏ đi và ta không ghi gì vào DB.
   */
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? "");
  if (honeypot.length > 0) {
    return { ok: true, message: "Đã gửi. Cảm ơn bạn đã liên hệ." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { ipHash, userAgent } = await currentIpHash();
  const col = await contactMessages();

  /*
   * Giới hạn tần suất. Chỉ chạy được khi có ipHash — sau proxy thì luôn có.
   * Đây là bảo vệ TỐI THIỂU: nó chặn spam ngây thơ từ một nguồn, không chặn được
   * spam phân tán qua nhiều IP. Nếu bị nhắm thật thì phải thêm captcha.
   */
  if (ipHash) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await col.countDocuments({ ipHash, createdAt: { $gte: since } });
    if (recent >= RATE_LIMIT_COUNT) {
      return {
        ok: false,
        error:
          "Bạn đã gửi nhiều tin nhắn trong thời gian ngắn. Vui lòng thử lại sau một giờ.",
      };
    }
  }

  await col.insertOne({
    ...parsed.data,
    createdAt: new Date(),
    handled: false,
    ipHash,
    userAgent,
  });

  return {
    ok: true,
    message: "Đã gửi. Chúng tôi thường phản hồi trong 1–2 ngày làm việc.",
  };
}

/** Đánh dấu đã xử lý trong hộp thư admin. */
export async function setContactHandled(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.string().regex(/^[a-f0-9]{24}$/i, "ID không hợp lệ"),
      handled: z.enum(["true", "false"]),
    })
    .safeParse({ id: formData.get("id"), handled: formData.get("handled") });

  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const col = await contactMessages();
  await col.updateOne(
    { _id: new ObjectId(parsed.data.id) },
    { $set: { handled: parsed.data.handled === "true" } },
  );

  revalidatePath("/admin/lien-he");
  return {
    ok: true,
    message: parsed.data.handled === "true" ? "Đã đánh dấu xử lý" : "Đã mở lại",
  };
}
