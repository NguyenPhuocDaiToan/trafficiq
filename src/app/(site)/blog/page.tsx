import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { Breadcrumb, PageHeader, PostCard } from "@/components/site";
import { allPosts, postsByCategory } from "@/content";
import { CATEGORIES } from "@/content/taxonomy";
import {
  breadcrumbNode,
  collectionPageNode,
  graph,
  personNode,
  publicAlternates,
  webSiteNode,
  type Crumb,
} from "@/lib/seo";
import { SITE } from "@/lib/site";

const DESCRIPTION = `Toàn bộ bài viết trên ${SITE.name} về công nghệ & thiết bị, tiền bạc & chi tiêu, đời sống & kỹ năng.`;

export const metadata: Metadata = {
  title: "Tất cả bài viết",
  description: DESCRIPTION,
  alternates: publicAlternates("/blog"),
  openGraph: { title: `Tất cả bài viết · ${SITE.name}`, url: "/blog" },
};

const TRAIL: Crumb[] = [
  { name: "Trang chủ", path: "/" },
  { name: "Bài viết", path: "/blog" },
];

export default function BlogIndexPage() {
  const posts = allPosts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/*
        `CollectionPage` + `ItemList` nói rõ đây là trang danh sách và nó liệt kê
        những bài nào, theo thứ tự nào. Không có nó thì trang này với crawler chỉ là
        một trang chữ có nhiều link — cùng hình dạng với một trang tag rỗng.

        `webSiteNode()`/`personNode()` phải đi kèm dù trang chủ đã khai: `isPartOf`
        của `CollectionPage` trỏ tới `#website` bằng `@id`, và tham chiếu `@id` chỉ
        phân giải được TRONG graph của cùng một trang. Thiếu chúng là tham chiếu treo.
      */}
      <JsonLd
        data={graph(
          webSiteNode(),
          personNode(),
          collectionPageNode({
            path: "/blog",
            name: "Tất cả bài viết",
            description: DESCRIPTION,
            posts,
          }),
          breadcrumbNode(TRAIL),
        )}
      />

      <div className="mb-8">
        <Breadcrumb trail={TRAIL} />
      </div>

      <PageHeader
        eyebrow="Nội dung"
        title="Tất cả bài viết"
        intro={`${posts.length} bài, mới nhất trước. Mỗi bài đi ra từ một việc phải tự quyết trong đời sống thường ngày, kèm cách tự kiểm chứ không chỉ kèm kết luận.`}
      />

      {/*
        Dải chuyên mục ngay dưới tiêu đề: người tới từ Google thường chỉ quan tâm
        một mảng, và ở đây họ lọc được ngay mà không phải quay lên header.
      */}
      <nav aria-label="Lọc theo chuyên mục" className="mt-8">
        <ul className="flex flex-wrap gap-2 text-sm">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/chuyen-muc/${category.slug}`}
                /* Không `rounded-*`: bo góc = 0 trên toàn surface công khai, xem
                   ghi chú ở `.prose code` trong globals.css. */
                className="inline-flex cursor-pointer items-center gap-2 border border-border bg-card px-3 py-1.5 text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {category.name}
                <span className="font-mono text-xs tabular-nums">
                  {postsByCategory(category.slug).length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* gap-x rộng: `PostCard` giờ phân cách bằng gạch trên chứ không bằng viền
          hộp, khe hẹp sẽ làm gạch của hai cột đọc thành một đường liền. */}
      <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
