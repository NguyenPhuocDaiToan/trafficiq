import type { Author, Category, CategorySlug } from "@/content/types";
import { SITE } from "@/lib/site";

/**
 * Chuyên mục. Thứ tự ở đây là thứ tự hiển thị.
 * Slug phải khớp với `MAIN_NAV`/`FOOTER_NAV` trong `src/lib/site.ts`.
 */
export const CATEGORIES: Category[] = [
  {
    slug: "cong-nghe",
    name: "Công nghệ & thiết bị",
    description:
      "Điện thoại, máy tính, ứng dụng và dữ liệu cá nhân — mua gì, giữ gì, khi nào chưa cần đổi.",
  },
  {
    slug: "tai-chinh",
    name: "Tiền bạc & chi tiêu",
    description:
      "Rà lại những khoản đang trả hằng tháng, đọc kỹ phí, và tiêu ít hơn mà không phải sống khổ hơn.",
  },
  {
    slug: "doi-song",
    name: "Đời sống & kỹ năng",
    description:
      "Thói quen, sắp xếp thời gian và những việc nhỏ trong nhà làm được ngay trong tuần này.",
  },
  {
    slug: "nha-cua",
    name: "Nhà cửa & gia dụng",
    description:
      "Đồ gia dụng nào đáng mua, đồ nào nằm góc sau một tháng, và cách xử những vấn đề quen của nhà ở thành phố.",
  },
  {
    slug: "bep",
    name: "Bếp & thực phẩm",
    description:
      "Đi chợ, bảo quản, và chọn đồ bếp theo cái nó nấu ra chứ theo tờ thông số dán trên hộp.",
  },
  {
    slug: "di-chuyen",
    name: "Đi lại & xe cộ",
    description:
      "Tự kiểm xe định kỳ, biết việc nào làm được ở nhà và việc nào phải đưa ra tiệm.",
  },
  {
    slug: "lam-viec",
    name: "Làm việc & học tập",
    description:
      "Chỗ ngồi, tệp tin, thói quen làm việc — những thứ ảnh hưởng tới cả ngày mà ít ai dựng lại một lần cho xong.",
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
 *
 * Trước đây mục này là "Ban biên tập <tên site>". Đã đổi sang một NGƯỜI vì site
 * chạy dưới thương hiệu cá nhân (`SITE.owner`): byline của một người có tên chịu
 * trách nhiệm được cho nội dung tư vấn mua sắm, còn "ban biên tập" của một site
 * một người là cách nói cho to hơn thực tế.
 */
export const AUTHORS: Author[] = [
  {
    id: "toan",
    name: SITE.owner,
    role: "Người viết",
    bio:
      "Tôi viết những hướng dẫn mà chính tôi cần khi phải tự quyết: có nên đổi " +
      "máy, khoản phí này bỏ được không, việc này làm thế nào cho gọn. Mỗi bài đều " +
      "kèm cách tự kiểm để bạn không phải tin suông.",
  },
];

export function getAuthor(id: string): Author | undefined {
  return AUTHORS.find((author) => author.id === id);
}
