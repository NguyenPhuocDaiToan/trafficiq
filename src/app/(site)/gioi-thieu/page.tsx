import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/site";
import { AUTHORS, CATEGORIES } from "@/content/taxonomy";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description: `${SITE.name} là gì, viết cho ai, và kiếm tiền bằng cách nào.`,
  alternates: { canonical: "/gioi-thieu" },
  openGraph: { title: `Giới thiệu · ${SITE.name}`, url: "/gioi-thieu" },
};

export default function AboutPage() {
  const author = AUTHORS[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        title={`Về ${SITE.name}`}
        intro="Site này viết về đo lường và tối ưu traffic affiliate, từ góc nhìn của người tự dựng hệ thống chứ không phải người bán công cụ."
      />

      <div className="mt-10">
        <Prose>
          <h2>Vì sao có site này</h2>
          <p>
            Phần lớn nội dung tiếng Việt về affiliate marketing dừng ở mức
            &ldquo;chọn nguồn traffic nào&rdquo; và &ldquo;chạy quảng cáo ra
            sao&rdquo;. Rất ít nội dung nói về phần bên dưới: dữ liệu click được ghi
            như thế nào, vì sao số của bạn và số của đối tác không bao giờ khớp, và
            những giới hạn hạ tầng nào sẽ làm bạn phải viết lại code khi lượng traffic
            tăng.
          </p>
          <p>
            Đó là khoảng trống site này viết vào. Mỗi bài đi ra từ một vấn đề gặp
            thật khi dựng và chạy hệ thống, kèm cách kiểm để bạn tự xác minh trên hệ
            thống của mình — không phải tổng hợp lại từ blog nước ngoài.
          </p>

          <h2>Viết cho ai</h2>
          <ul>
            <li>
              Người chạy affiliate và muốn hiểu số liệu của mình thay vì chỉ đọc
              dashboard của bên khác.
            </li>
            <li>
              Người tự dựng hệ thống tracking, hoặc đang cân nhắc giữa tự dựng và
              dùng nền tảng có sẵn.
            </li>
            <li>
              Người làm performance marketing cần đối chiếu số với đối tác và cần lý
              lẽ kỹ thuật để làm việc đó.
            </li>
          </ul>
          <p>
            Bài viết giả định bạn đọc được đoạn code ngắn, nhưng không giả định bạn
            là lập trình viên.
          </p>

          <h2>Chúng tôi kiếm tiền bằng cách nào</h2>
          <p>
            Bằng liên kết affiliate. Một số bài có liên kết tới sản phẩm hoặc dịch
            vụ; nếu bạn dùng liên kết đó và phát sinh giao dịch, chúng tôi nhận hoa
            hồng từ bên bán mà bạn không phải trả thêm gì.
          </p>
          <p>
            Điều này ảnh hưởng tới việc <em>sản phẩm nào được nhắc tới</em>, nên nói
            thẳng ra là công bằng với bạn. Ba nguyên tắc chúng tôi tự đặt:
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
              Nội dung kỹ thuật không đổi theo việc có hoa hồng hay không. Nếu một
              cách làm miễn phí là cách tốt hơn, bài viết sẽ nói vậy.
            </li>
          </ul>
          <p>
            Chi tiết ở trang{" "}
            <Link href="/tiet-lo-lien-ket">tiết lộ liên kết affiliate</Link>.
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

          <h2>Ai viết</h2>
          <p>
            <strong>{author.name}</strong> — {author.role}. {author.bio}
          </p>
          <p>
            Chúng tôi không dựng thêm tên tác giả giả để site trông lớn hơn. Nếu về
            sau có người khác viết, tên họ sẽ xuất hiện ở đây và trên bài của họ.
          </p>

          <h2>Sai thì sửa</h2>
          <p>
            Nội dung kỹ thuật cũ đi và có chỗ sai. Nếu bạn thấy một chi tiết không
            đúng, <Link href="/lien-he">nhắn cho chúng tôi</Link> — bài sẽ được sửa
            và ghi rõ ngày cập nhật, không sửa lặng lẽ.
          </p>
        </Prose>
      </div>
    </div>
  );
}
