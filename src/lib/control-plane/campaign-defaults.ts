import { slugify } from "@/lib/slug";

/**
 * Giá trị mặc định khi TẠO chiến dịch. Thuần hàm, không DB — để test được và để form (hiện placeholder) với
 * action (điền thật) dùng chung một nguồn.
 *
 * Mục tiêu: người tạo chỉ cần đưa ẢNH và URL ĐÍCH; mọi thứ còn lại hệ thống tự điền. Nên văn bản mặc định phải
 * TRUNG TÍNH — nó hiện công khai trên trang giới thiệu và thẻ chia sẻ nếu người tạo không sửa. Đừng viết kiểu "Ưu
 * đãi giới hạn", "Giảm 50%": đó là một lời hứa về nội dung đối tác mà hệ thống không biết có đúng không.
 */

/** Tự chuyển hướng sau 2 giây. Chỉ áp dụng cho chiến dịch MỚI; chiến dịch cũ giữ giá trị đã lưu. */
export const DEFAULT_AUTO_REDIRECT_SECONDS = 2;
export const MAX_DESTINATIONS_PER_CAMPAIGN = 5;
export const DEFAULT_CTA_LABEL = "Xem chi tiết";
export const DEFAULT_SHARE_DESCRIPTION = "Bấm để xem chi tiết.";
export const DEFAULT_DESTINATION_CATEGORY = "chung";

export type UrlListResult = { ok: true; urls: string[] } | { ok: false; error: string };

/**
 * Tách ô "URL đích" (mỗi dòng một URL) thành danh sách. CHỈ tách, bỏ dòng trống, bỏ trùng, giới hạn số lượng.
 * Việc kiểm "có phải URL http(s) hợp lệ không" KHÔNG làm ở đây mà ở `destinationSchema` (xem actions): đó là luật
 * duy nhất giữ `javascript:`/`data:` ra khỏi whitelist, đừng nhân bản nó thành bản thứ hai có thể lệch.
 */
export function parseDestinationUrls(raw: string | undefined): UrlListResult {
  const urls = [
    ...new Set(
      (raw ?? "")
        .split(/\s+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  ];
  if (urls.length === 0) return { ok: false, error: "Nhập ít nhất một URL đích (mỗi dòng một URL)." };
  if (urls.length > MAX_DESTINATIONS_PER_CAMPAIGN) {
    return { ok: false, error: `Tối đa ${MAX_DESTINATIONS_PER_CAMPAIGN} URL đích cho một chiến dịch.` };
  }
  return { ok: true, urls };
}

/** `https://www.offer.example.com/x?y=1` → `offer.example.com`. Trả chuỗi rỗng nếu không đọc được. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function dayMonth(now: Date): string {
  // Giờ Việt Nam, không theo múi giờ của máy chủ: nhãn "18/10" lệch một ngày quanh nửa đêm thì gây nhầm.
  // Ghép từ các phần (`formatToParts`) chứ không dùng chuỗi định dạng của locale: dấu phân cách ngày/tháng của
  // `vi-VN` khác nhau theo bản ICU ("18/10" ở nơi này, "18-10" ở nơi khác), mà tên chiến dịch không nên đổi theo máy.
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, "0");
}

/** Thêm đuôi ngắn để tránh trùng đường dẫn tự sinh. */
export function withSlugSuffix(slug: string): string {
  return `${slug.slice(0, 55)}-${randomSuffix()}`;
}

const blank = (value: string | undefined): boolean => value === undefined || value.trim().length === 0;

/**
 * Điền các field còn trống của form tạo. Field người dùng ĐÃ nhập thì giữ nguyên tuyệt đối.
 *
 * `slugAuto` cho biết đường dẫn do ta sinh (nên khi trùng thì được phép thêm đuôi và thử lại) hay do người dùng
 * gõ (trùng thì phải báo lỗi — tự đổi đường dẫn người ta chọn là sai).
 */
export function applyCreateDefaults(
  input: Record<string, string>,
  firstUrl: string,
  now: Date = new Date(),
): { raw: Record<string, string>; slugAuto: boolean } {
  const raw = { ...input };

  if (blank(raw.name)) {
    // Có tiêu đề thì tên chiến dịch là tiêu đề đó — danh sách đọc được ngay; không thì theo tên miền + ngày.
    const host = hostLabel(firstUrl) || "Chiến dịch";
    raw.name = (blank(raw.headline) ? `${host} · ${dayMonth(now)}` : (raw.headline as string).trim()).slice(0, 120);
  }

  let slugAuto = false;
  if (blank(raw.slug)) {
    slugAuto = true;
    const derived = slugify(raw.name);
    raw.slug = derived.length >= 3 ? derived : `chien-dich-${randomSuffix()}`;
  }

  if (blank(raw.headline)) raw.headline = raw.name;
  if (blank(raw.ctaLabel)) raw.ctaLabel = DEFAULT_CTA_LABEL;
  if (blank(raw.ogTitle)) raw.ogTitle = raw.headline;
  if (blank(raw.ogDescription)) {
    raw.ogDescription = blank(raw.subheadline) ? DEFAULT_SHARE_DESCRIPTION : (raw.subheadline as string);
  }
  // Một ảnh dùng cho cả trang giới thiệu và thẻ chia sẻ, trừ khi người dùng đặt ảnh chia sẻ riêng.
  if (blank(raw.ogImageUrl) && !blank(raw.heroImageUrl)) raw.ogImageUrl = raw.heroImageUrl;
  if (blank(raw.autoRedirectSeconds)) raw.autoRedirectSeconds = String(DEFAULT_AUTO_REDIRECT_SECONDS);

  return { raw, slugAuto };
}
