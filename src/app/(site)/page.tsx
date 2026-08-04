import type { Metadata } from "next";
import {
  CategoryColumn,
  Dateline,
  LatestList,
  LeadStory,
  PostCard,
  SectionHeading,
  SidePost,
} from "@/components/site";
import { allPosts, featuredPost, postsByCategory } from "@/content";
import { CATEGORIES } from "@/content/taxonomy";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  /*
   * `absolute` để KHÔNG đi qua `title.template` của root layout
   * (`"%s · ${SITE.name}"`). Không có nó thì tiêu đề trang chủ ra
   * "InsightDaily — <tagline> · InsightDaily" — tên site hai lần trong một dòng
   * title, tức thứ hiện trên tab browser và trên kết quả Google.
   * Các trang khác vẫn dùng title tương đối ("Giới thiệu") để template thêm hậu tố.
   */
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: "/",
  },
};

/** Số bài tối đa mỗi cột chuyên mục ở dải cuối. Xem ghi chú ở chỗ dùng. */
const PER_CATEGORY = 3;

/** Số bài phụ ở cột hẹp cạnh bài dẫn. Xem ghi chú ở chỗ dùng. */
const SIDE_COUNT = 2;

/** Số bài trong dải "Chọn mua" và trong danh sách "Mới nhất". */
const REVIEW_COUNT = 3;
const LATEST_COUNT = 4;

/**
 * Trang chủ — pattern "Front Page" (xem pages/blog.md).
 *
 * Thứ tự khối:
 *   1. Dateline — dải tagline + số liệu, kẹp giữa hai đường kẻ
 *   2. Trang nhất — bài dẫn 7/12 (có bìa lớn) | vạch dọc | 2 bài phụ 5/12
 *   3. Chọn mua — dải bài `kind: "review"`, có bìa, dạng lưới ba cột
 *   4. Mới nhất — danh sách theo thời gian, có ngày làm rail
 *   5. Theo chuyên mục — 7 cột, mỗi cột là danh sách bài của một chuyên mục
 *
 * KHÔNG có hero cỡ display và KHÔNG có form đăng ký email:
 *   - Hero: một trang mục lục thì thứ phải to nhất là tiêu đề bài, không phải khẩu
 *     hiệu. `<h1>` của trang này là tiêu đề bài dẫn — lý do đầy đủ ở `LeadStory`.
 *   - Form email: dự án không có hạ tầng gửi mail, dựng form không xử lý được là
 *     lừa người đọc.
 *
 * Tĩnh hoàn toàn: nội dung đến từ `src/content`, không truy vấn DB → render lúc
 * build, 0 compute mỗi lượt xem.
 */
export default function HomePage() {
  const posts = allPosts();
  const lead = featuredPost();
  const rest = posts.filter((post) => post.slug !== lead.slug);

  /*
   * Hai bài kế tiếp lên cột hẹp. Vì sao đúng hai: cột 5/12 cao xấp xỉ bằng khối
   * bài dẫn ở 1024px+ khi chứa hai bài có mô tả — bài thứ ba làm cột phải dài hơn
   * cột trái và dải bên dưới bắt đầu bằng một khoảng trắng lệch.
   * Bài nào không lên đây cũng không mất: dải "Mới nhất" và dải chuyên mục bên
   * dưới liệt kê tất cả.
   */
  const side = rest.slice(0, SIDE_COUNT);

  /*
   * Dải "Chọn mua": chỉ bài `kind: "review"`. Loại bài dẫn ra khỏi danh sách này
   * để không lặp — bài dẫn đã có ô riêng lớn hơn ở trên.
   */
  const reviews = rest
    .filter((post) => post.kind === "review")
    .slice(0, REVIEW_COUNT);

  /** Danh sách mới nhất, loại các bài đã lên trang nhất để không lặp ba lần. */
  const featuredSlugs = new Set([lead.slug, ...side.map((post) => post.slug)]);
  const latest = posts
    .filter((post) => !featuredSlugs.has(post.slug))
    .slice(0, LATEST_COUNT);

  /** Ngày của bài mới nhất — cho dải Dateline biết site còn được cập nhật. */
  const newestDate = posts[0]?.updatedAt ?? posts[0]?.publishedAt;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* 1. Dateline */}
      <div className="pt-6">
        <Dateline
          postCount={posts.length}
          categoryCount={CATEGORIES.length}
          updatedAt={newestDate}
        />
      </div>

      {/*
        2. Trang nhất.

        Gạch 3px phía trên (đậm hơn gạch 2px của thẻ bài thường) là dấu mở đầu trang
        nhất — cùng vai trò với gạch dưới măng-sét của một tờ báo in.

        Vạch dọc giữa hai cột chỉ xuất hiện từ `lg`: ở mobile hai khối xếp dọc nên
        vạch dọc không còn nghĩa gì, và `divide-y` của danh sách bài phụ đã đủ để
        tách chúng khỏi bài dẫn.
      */}
      <section
        aria-label="Trang nhất"
        className="mt-8 grid gap-y-8 border-t-[3px] border-rule pt-7 lg:grid-cols-12 lg:gap-y-0"
      >
        <div className="lg:col-span-7 lg:pr-10">
          <LeadStory post={lead} />
        </div>

        {side.length > 0 ? (
          <div className="divide-y divide-border lg:col-span-5 lg:border-l lg:border-border lg:pl-10">
            {side.map((post) => (
              <SidePost key={post.slug} post={post} />
            ))}
          </div>
        ) : null}
      </section>

      {/*
        3. Chọn mua — dải bài `kind: "review"`, có bìa (khác dải chuyên mục bên
        dưới, vốn là danh sách chữ). Bìa ở đây giúp một trang toàn chữ có chỗ cho
        mắt nghỉ, và dải này là nơi trang chủ nói rõ nhất về loại nội dung "giúp
        chọn mua" — ràng buộc viết bài loại này nằm ở `Post.kind` trong
        `content/types.ts`, không lặp lại ở đây.
      */}
      {reviews.length > 0 ? (
        <section aria-labelledby="chon-mua" className="mt-14 sm:mt-16">
          <SectionHeading
            id="chon-mua"
            title="Chọn mua"
            action={{ href: "/blog", label: "Xem tất cả" }}
          />

          <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 4. Mới nhất — bổ sung cho dải trang nhất, xem ghi chú ở `LatestList`. */}
      {latest.length > 0 ? (
        <section aria-labelledby="moi-nhat" className="mt-14 sm:mt-16">
          <SectionHeading
            id="moi-nhat"
            title="Mới nhất"
            action={{ href: "/blog", label: `Tất cả ${posts.length} bài` }}
          />

          <div className="mt-4">
            <LatestList posts={latest} />
          </div>
        </section>
      ) : null}

      {/*
        5. Theo chuyên mục.

        `gap-x-10` là bắt buộc, không phải chọn cho thoáng: nhan đề mỗi cột có gạch
        dưới chạy hết chiều rộng cột, khe hẹp sẽ làm gạch của hai cột cạnh nhau đọc
        thành một đường liền.
      */}
      <section aria-labelledby="theo-chuyen-muc" className="mt-14 sm:mt-16">
        <SectionHeading id="theo-chuyen-muc" title="Theo chuyên mục" />

        <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => {
            const inCategory = postsByCategory(category.slug);
            return (
              <CategoryColumn
                key={category.slug}
                slug={category.slug}
                name={category.name}
                description={category.description}
                /* Cắt ở PER_CATEGORY để trang chủ không dài thêm mỗi lần có bài
                   mới — "Cả chuyên mục" trong mỗi cột dẫn tới danh sách đầy đủ. */
                posts={inCategory.slice(0, PER_CATEGORY)}
                totalCount={inCategory.length}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
