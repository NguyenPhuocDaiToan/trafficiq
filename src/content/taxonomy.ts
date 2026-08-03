import type { Author, Category, CategorySlug } from "@/content/types";

/**
 * Chuyên mục. Thứ tự ở đây là thứ tự hiển thị.
 * Slug phải khớp với `MAIN_NAV`/`FOOTER_NAV` trong `src/lib/site.ts`.
 */
export const CATEGORIES: Category[] = [
  {
    slug: "do-luong",
    name: "Đo lường & tracking",
    description:
      "Click ID, postback, cửa sổ attribution và những chỗ số liệu hai bên lệch nhau.",
  },
  {
    slug: "toi-uu",
    name: "Tối ưu chiến dịch",
    description:
      "Đọc số để ra quyết định: chỉ số nào đáng tin, chỉ số nào chỉ làm bạn thấy dễ chịu.",
  },
  {
    slug: "van-hanh",
    name: "Vận hành & chi phí",
    description:
      "Dựng và giữ hệ thống chạy được ở mức chi phí thấp — kèm cả những giới hạn ít ai nói.",
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function categoryName(slug: CategorySlug): string {
  return getCategory(slug)?.name ?? slug;
}

/**
 * Tác giả. Hiện chỉ có một — đừng bịa thêm người không tồn tại để site trông
 * "lớn" hơn; ad network kiểm mục tác giả và bịa ra là mất tín nhiệm.
 */
export const AUTHORS: Author[] = [
  {
    id: "bien-tap",
    name: "Ban biên tập TrafficIQ",
    role: "Người dựng và vận hành hệ thống",
    bio:
      "Ghi lại những gì học được khi tự viết hệ thống tracking cho affiliate: " +
      "chỗ nào số liệu sai, chỗ nào tài liệu của nhà cung cấp không khớp thực tế.",
  },
];

export function getAuthor(id: string): Author | undefined {
  return AUTHORS.find((author) => author.id === id);
}
