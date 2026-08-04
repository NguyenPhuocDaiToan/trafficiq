import type { CategorySlug, Post } from "@/content/types";
import { post as diCho } from "@/content/posts/di-cho-mot-lan-cho-ca-tuan";
import { post as chonOCung } from "@/content/posts/chon-o-cung-di-dong";
import { post as chonNoiComDien } from "@/content/posts/chon-noi-com-dien";
import { post as doiDienThoai } from "@/content/posts/khi-nao-nen-doi-dien-thoai";
import { post as dungLaiThuMuc } from "@/content/posts/dung-lai-thu-muc-may-tinh";
import { post as giuGiayTo } from "@/content/posts/giu-giay-to-quan-trong-trong-nha";
import { post as mayHutBui } from "@/content/posts/may-hut-bui-cam-tay-co-dang-mua";
import { post as muaDoCu } from "@/content/posts/mua-do-cu-hay-do-moi";
import { post as phiAmTham } from "@/content/posts/phi-am-tham-trong-hoa-don-hang-thang";
import { post as saoLuu } from "@/content/posts/sao-luu-du-lieu-quy-tac-3-2-1";
import { post as tuKiemXe } from "@/content/posts/tu-kiem-xe-truoc-chuyen-di-xa";
import { post as xuLyAmMoc } from "@/content/posts/xu-ly-am-moc-trong-nha";

/**
 * Sổ đăng ký bài viết.
 *
 * Import tường minh, KHÔNG quét thư mục động: `generateStaticParams` phải biết
 * danh sách bài lúc build, và import động theo biến thì bundler không lần được
 * nên bài sẽ không vào build. Thêm bài = thêm một dòng import ở đây.
 */
const REGISTRY: Post[] = [
  doiDienThoai,
  saoLuu,
  phiAmTham,
  diCho,
  chonOCung,
  mayHutBui,
  chonNoiComDien,
  muaDoCu,
  tuKiemXe,
  dungLaiThuMuc,
  xuLyAmMoc,
  giuGiayTo,
];

/** Mới nhất trước. So sánh chuỗi ISO là đủ vì định dạng YYYY-MM-DD. */
const SORTED: Post[] = [...REGISTRY].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

/*
 * Kiểm tính hợp lệ ngay khi module được nạp — tức là lúc build, không phải lúc
 * người đọc mở trang. Slug trùng nhau sẽ làm một bài âm thầm che bài kia.
 */
const seen = new Set<string>();
for (const item of REGISTRY) {
  if (seen.has(item.slug)) {
    throw new Error(
      `[content] slug bài viết bị trùng: "${item.slug}". Mỗi bài phải có slug riêng.`,
    );
  }
  seen.add(item.slug);
}

const featuredCount = REGISTRY.filter((item) => item.featured).length;
if (featuredCount > 1) {
  throw new Error(
    `[content] có ${featuredCount} bài đặt featured: true. Trang chủ chỉ có một ô lớn — chọn đúng một bài.`,
  );
}

export function allPosts(): Post[] {
  return SORTED;
}

export function getPost(slug: string): Post | undefined {
  return REGISTRY.find((item) => item.slug === slug);
}

export function postsByCategory(category: CategorySlug): Post[] {
  return SORTED.filter((item) => item.category === category);
}

/** Bài chiếm ô lớn trên trang chủ. Không đặt featured thì lấy bài mới nhất. */
export function featuredPost(): Post {
  return SORTED.find((item) => item.featured) ?? SORTED[0];
}

/**
 * Bài liên quan: ưu tiên cùng chuyên mục, thiếu thì lấy bù bằng bài mới nhất.
 * Luôn loại chính bài đang đọc.
 */
export function relatedPosts(current: Post, limit = 3): Post[] {
  const sameCategory = SORTED.filter(
    (item) => item.slug !== current.slug && item.category === current.category,
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const filler = SORTED.filter(
    (item) => item.slug !== current.slug && item.category !== current.category,
  );
  return [...sameCategory, ...filler].slice(0, limit);
}
