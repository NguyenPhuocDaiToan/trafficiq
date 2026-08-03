import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/site";
import { SITE } from "@/lib/site";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Tiết lộ liên kết affiliate",
  description:
    "Cách site này kiếm tiền, liên kết nào được trả hoa hồng, và điều đó ảnh hưởng thế nào tới nội dung bạn đọc.",
  alternates: { canonical: "/tiet-lo-lien-ket" },
  openGraph: { title: `Tiết lộ liên kết affiliate · ${SITE.name}`, url: "/tiet-lo-lien-ket" },
};

/**
 * Trang này là YÊU CẦU, không phải tùy chọn: FTC (Mỹ) và phần lớn ad network yêu
 * cầu tiết lộ quan hệ được trả tiền. Google cũng yêu cầu link được trả tiền phải
 * có rel="sponsored". Đừng bỏ trang này để site "gọn hơn".
 */
export default function DisclosurePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Tiết lộ liên kết affiliate"
        intro={`Cập nhật ${formatDate(SITE.policyUpdatedAt)}`}
      />

      <div className="mt-10">
        <Prose>
          <h2>Nói ngắn</h2>
          <p>
            {SITE.name} kiếm tiền bằng hoa hồng affiliate. Một số liên kết trên site
            này, khi bạn bấm vào và sau đó phát sinh giao dịch với bên bán, sẽ mang
            lại hoa hồng cho chúng tôi. <strong>Bạn không trả thêm đồng nào</strong> —
            hoa hồng do bên bán chi từ phần của họ.
          </p>

          <h2>Làm sao biết liên kết nào là liên kết tài trợ</h2>
          <p>Chúng tôi đánh dấu bằng ba cách cùng lúc:</p>
          <ul>
            <li>
              Có nhãn <strong>&ldquo;Liên kết tài trợ&rdquo;</strong> hiện ngay cạnh
              liên kết, không nằm ở cuối trang.
            </li>
            <li>
              Có thuộc tính <code>rel=&quot;nofollow sponsored&quot;</code> trong mã
              nguồn — bạn kiểm được bằng cách xem nguồn trang.
            </li>
            <li>Có một dòng tiết lộ ở chân mọi trang, kể cả trang không có liên kết nào.</li>
          </ul>
          <p>
            Mọi liên kết <em>không</em> có nhãn đó là liên kết chúng tôi tự đặt vì nó
            hữu ích, và không đem lại tiền cho chúng tôi.
          </p>

          <h2>Điều này ảnh hưởng tới nội dung như thế nào</h2>
          <p>
            Có ảnh hưởng, và giả vờ không có mới là không trung thực. Việc có chương
            trình affiliate ảnh hưởng tới <em>sản phẩm nào được nhắc tới</em> — chúng
            tôi khó viết về một dịch vụ không có chương trình liên kết nào.
          </p>
          <p>Ba giới hạn chúng tôi tự đặt cho mình:</p>
          <ul>
            <li>
              <strong>Không đổi nhận xét theo tiền.</strong> Không nhận thanh toán để
              viết tích cực, không xóa nhược điểm khỏi bài.
            </li>
            <li>
              <strong>Không đăng bài do bên khác viết như bài của mình.</strong> Không
              nhận bài PR trả tiền dưới dạng bài viết thường.
            </li>
            <li>
              <strong>Nội dung kỹ thuật không phụ thuộc hoa hồng.</strong> Nếu cách
              làm miễn phí là cách tốt hơn, bài sẽ nói đúng như vậy — dù nói vậy có
              nghĩa là không ai bấm liên kết nào.
            </li>
          </ul>

          <h2>Cookie và tham số theo dõi</h2>
          <p>
            Khi bạn bấm một liên kết tài trợ, chúng tôi chuyển bạn qua một địa chỉ
            trung gian trên tên miền của mình để ghi lại lượt bấm, rồi chuyển tiếp
            sang trang của bên bán. Trong quá trình đó có một mã lượt bấm ngẫu nhiên
            được truyền sang để đối chiếu giao dịch — mã đó{" "}
            <strong>không chứa thông tin cá nhân của bạn</strong>.
          </p>
          <p>
            Bên bán có thể đặt cookie của riêng họ. Chúng tôi không kiểm soát cookie
            đó; hãy xem chính sách của họ. Phần dữ liệu do chúng tôi thu thập được mô
            tả đầy đủ trong{" "}
            <Link href="/chinh-sach-bao-mat">chính sách quyền riêng tư</Link>.
          </p>

          <h2>Nội dung không phải tư vấn</h2>
          <p>
            Bài viết trên site này mang tính tham khảo kỹ thuật. Không phải tư vấn
            đầu tư, tài chính, thuế hay pháp lý. Quyết định của bạn là của bạn.
          </p>

          <h2>Có thắc mắc</h2>
          <p>
            Nếu bạn muốn biết một liên kết cụ thể có phải liên kết tài trợ hay không,{" "}
            <Link href="/lien-he">hỏi chúng tôi</Link> — chúng tôi sẽ trả lời thẳng.
          </p>
        </Prose>
      </div>
    </div>
  );
}
