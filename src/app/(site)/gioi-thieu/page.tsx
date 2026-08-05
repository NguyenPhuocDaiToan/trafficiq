import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageHeader, Prose } from "@/components/site";
import { AUTHORS, CATEGORIES } from "@/content/taxonomy";
import {
  graph,
  personNode,
  profilePageNode,
  publicAlternates,
  webSiteNode,
} from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: `${SITE.name} là gì, viết cho ai, và kiếm tiền bằng cách nào.`,
  alternates: publicAlternates("/gioi-thieu"),
  openGraph: { title: `Giới thiệu · ${SITE.name}`, url: "/gioi-thieu" },
};

export default function AboutPage() {
  const author = AUTHORS[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/*
        `ProfilePage` bọc quanh `#person`: trang này là hồ sơ của người viết, và nó
        là đích của `author.url` trong metadata mọi bài. Đó là cách một site cá nhân
        chứng minh tác giả là một người thật có thể tra được, thay vì một cái tên
        đứng ở byline. Bio/role lấy từ `AUTHORS` nên trang và JSON-LD không lệch.
      */}
      <JsonLd data={graph(webSiteNode(), personNode(), profilePageNode())} />

      <PageHeader
        eyebrow="Về site"
        title={`Về ${SITE.name}`}
        intro="Một site nội dung tổng hợp bằng tiếng Việt: công nghệ, tiền bạc, đời sống. Không dạy làm giàu, không bán khoá học — chỉ là những hướng dẫn cụ thể cho việc phải tự quyết."
      />

      <div className="mt-10">
        <Prose>
          <h2>Vì sao có site này</h2>
          <p>
            Phần lớn nội dung hướng dẫn tiếng Việt trên mạng dừng ở mức nêu lại điều
            hiển nhiên: &ldquo;nên tiết kiệm&rdquo;, &ldquo;nên sao lưu dữ liệu&rdquo;,
            &ldquo;nên ăn ở nhà&rdquo;. Phần khó thì không ai viết: <em>sao lưu như thế
            nào cho đúng</em>, <em>rà khoản phí định kỳ ở những chỗ nào</em>,{" "}
            <em>làm sao biết máy hết đời thật hay chỉ chậm</em>.
          </p>
          <p>
            Đó là khoảng trống site này viết vào. Nguyên tắc chung của mọi bài: nói rõ
            việc cần làm, theo thứ tự làm được, và kèm cách tự kiểm để bạn xác minh
            trên chính máy hay chính hoá đơn của mình — không phải tin vì tôi
            nói vậy.
          </p>

          <h2>Viết cho ai</h2>
          <ul>
            <li>
              Người phải tự quyết những việc kỹ thuật nho nhỏ trong nhà mà không có ai
              để hỏi.
            </li>
            <li>
              Người muốn rà lại chi tiêu hằng tháng nhưng không biết bắt đầu từ đâu.
            </li>
            <li>
              Người thích hướng dẫn có bước cụ thể hơn là bài truyền cảm hứng.
            </li>
          </ul>
          <p>
            Bài viết không giả định bạn biết kỹ thuật. Chỗ nào phải mở phần cài đặt
            trong máy, tôi ghi đường dẫn từng bước.
          </p>

          <h2>Chuyên mục</h2>
          <ul>
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link href={`/chuyen-muc/${category.slug}`}>{category.name}</Link> —{" "}
                {category.description}
              </li>
            ))}
          </ul>

          <h2>Tôi kiếm tiền bằng cách nào</h2>
          <p>
            Bằng liên kết affiliate. Một số bài có liên kết tới nơi bán sản phẩm hoặc
            dịch vụ được nhắc tới; nếu bạn dùng liên kết đó và phát sinh giao dịch,
            tôi nhận hoa hồng từ bên bán mà bạn không phải trả thêm gì.
          </p>
          <p>
            Điều này ảnh hưởng tới việc <em>sản phẩm nào được nhắc tới</em>, nên nói
            thẳng ra là công bằng với bạn. Ba nguyên tắc tôi tự đặt:
          </p>
          <ul>
            <li>
              Mọi liên kết được trả tiền đều mang nhãn <strong>liên kết tài trợ</strong>{" "}
              hiện ngay tại chỗ, và có thuộc tính <code>rel=&quot;nofollow sponsored&quot;</code>.
            </li>
            <li>
              Không nhận tiền để đổi lấy một nhận xét tích cực, và không nhận bài do
              bên khác viết rồi đăng như bài của mình.
            </li>
            <li>
              Kết luận của bài không đổi theo việc có hoa hồng hay không. Nếu câu trả
              lời đúng là &ldquo;chưa cần mua gì cả&rdquo; thì bài viết nói vậy — như
              bài về{" "}
              <Link href="/blog/khi-nao-nen-doi-dien-thoai">
                khi nào nên đổi điện thoại
              </Link>
              , phần lớn nội dung là lý do <em>chưa</em> nên đổi.
            </li>
          </ul>
          <p>
            Chi tiết ở trang{" "}
            <Link href="/tiet-lo-lien-ket">tiết lộ liên kết affiliate</Link>.
          </p>

          <h2>Điều site này không làm</h2>
          <ul>
            <li>
              <strong>Không tư vấn đầu tư, tài chính, y tế hay pháp lý.</strong> Bài về
              chi tiêu là cách rà soát hoá đơn, không phải khuyến nghị nên mua sản phẩm
              tài chính nào.
            </li>
            <li>
              <strong>Không có thư quảng cáo.</strong> Site không có form đăng ký nhận
              tin vì tôi không có hệ thống gửi thư — dựng một cái form không xử
              lý được thì chỉ là thu địa chỉ email của bạn để đó.
            </li>
            <li>
              <strong>Không theo dõi bạn khi bạn chỉ đọc bài.</strong> Không Google
              Analytics, không pixel mạng xã hội, không cookie theo dõi. Chi tiết trong{" "}
              <Link href="/chinh-sach-bao-mat">chính sách quyền riêng tư</Link>.
            </li>
          </ul>

          <h2>Ai viết</h2>
          <p>
            <strong>{author.name}</strong> — {author.role}. {author.bio}
          </p>
          <p>
            Tôi không dựng thêm tên tác giả giả để site trông lớn hơn. Nếu về
            sau có người khác viết, tên họ sẽ xuất hiện ở đây và trên bài của họ.
          </p>

          <h2>Sai thì sửa</h2>
          <p>
            Hướng dẫn cũ đi: menu trong máy được đổi tên, dịch vụ thay đổi cách tính
            phí. Nếu bạn thấy một chi tiết không còn đúng,{" "}
            <Link href="/lien-he">nhắn cho tôi</Link> — bài sẽ được sửa và ghi rõ
            ngày cập nhật, không sửa lặng lẽ.
          </p>
        </Prose>
      </div>
    </div>
  );
}
