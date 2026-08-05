import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/site";
import { formatDate } from "@/lib/labels";
import { SITE } from "@/lib/site";
import { publicAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description: `Điều kiện sử dụng ${SITE.name}: quyền nội dung, giới hạn trách nhiệm, và các hành vi không được phép.`,
  alternates: publicAlternates("/dieu-khoan"),
  openGraph: { title: `Điều khoản sử dụng · ${SITE.name}`, url: "/dieu-khoan" },
};

export default function TermsPage() {
  const operator = SITE.legal.entityName ?? SITE.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Pháp lý"
        title="Điều khoản sử dụng"
        intro={`Cập nhật ${formatDate(SITE.policyUpdatedAt)}`}
      />

      <div className="mt-10">
        <Prose>
          <h2>1. Về bên vận hành</h2>
          <p>
            Website {SITE.name} do <strong>{operator}</strong> vận hành
            {SITE.legal.address ? ` (địa chỉ: ${SITE.legal.address})` : ""}
            {SITE.legal.taxId ? `, mã số thuế ${SITE.legal.taxId}` : ""}. Liên hệ:{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
          <p>
            Bằng việc truy cập và sử dụng website, bạn đồng ý với các điều khoản dưới
            đây. Nếu không đồng ý, vui lòng không sử dụng website.
          </p>

          <h2>2. Nội dung mang tính tham khảo</h2>
          <p>
            Toàn bộ nội dung trên website là hướng dẫn thực hành mang tính tham khảo.{" "}
            <strong>
              Đây không phải tư vấn đầu tư, tư vấn tài chính, tư vấn thuế, tư vấn y tế
              hay tư vấn pháp lý.
            </strong>
          </p>
          <p>
            Tôi cố gắng bảo đảm nội dung chính xác tại thời điểm viết, nhưng
            phần mềm được cập nhật, tên mục trong máy được đổi, và điều khoản của các
            nhà cung cấp thay đổi liên tục. Bạn chịu trách nhiệm tự kiểm chứng trước
            khi áp dụng, đặc biệt với những việc không hoàn tác được — xoá dữ liệu,
            khôi phục cài đặt gốc, đóng thẻ hay huỷ hợp đồng.
          </p>

          <h2>3. Liên kết affiliate</h2>
          <p>
            Một số liên kết trên website là liên kết affiliate và có thể mang lại hoa
            hồng cho tôi. Cách nhận biết và phạm vi ảnh hưởng được mô tả tại{" "}
            <Link href="/tiet-lo-lien-ket">trang tiết lộ liên kết affiliate</Link>.
          </p>

          <h2>4. Liên kết tới website của bên thứ ba</h2>
          <p>
            Website có liên kết tới trang của bên thứ ba. Tôi{" "}
            <strong>không kiểm soát và không chịu trách nhiệm</strong> về nội dung,
            sản phẩm, chính sách bảo mật hay hành vi của các trang đó. Việc tôi
            liên kết tới một trang không đồng nghĩa với việc bảo đảm cho trang đó.
          </p>
          <p>
            Mọi giao dịch bạn thực hiện với bên thứ ba là giữa bạn và họ. Khiếu nại
            về sản phẩm, thanh toán hay giao hàng cần gửi trực tiếp cho bên bán.
          </p>

          <h2>5. Quyền sở hữu nội dung</h2>
          <p>
            Bài viết, danh sách kiểm và bảng biểu trên website thuộc quyền của{" "}
            {operator}, trừ khi ghi rõ nguồn khác.
          </p>
          <p>Bạn được phép, không cần xin phép trước:</p>
          <ul>
            <li>Đọc, lưu và in cho mục đích cá nhân.</li>
            <li>
              Trích dẫn một phần ngắn kèm ghi nguồn và liên kết trở lại bài gốc.
            </li>
            <li>
              Áp dụng các bước hướng dẫn trong bài vào việc của bạn hoặc của gia đình.
            </li>
          </ul>
          <p>Bạn không được phép:</p>
          <ul>
            <li>Sao chép toàn bộ bài viết sang website khác, kể cả khi có ghi nguồn.</li>
            <li>Dùng nội dung để huấn luyện mô hình thương mại mà không có thỏa thuận.</li>
            <li>Bán lại nội dung dưới bất kỳ hình thức nào.</li>
          </ul>

          <h2>6. Hành vi không được phép</h2>
          <p>Khi sử dụng website, bạn không được:</p>
          <ul>
            <li>
              Gửi tự động lượng lớn request nhằm làm gián đoạn dịch vụ, hoặc thu thập
              dữ liệu ở quy mô gây ảnh hưởng tới hoạt động bình thường.
            </li>
            <li>
              Cố gắng truy cập các khu vực quản trị, hoặc dò tìm lỗ hổng mà không có
              sự đồng ý bằng văn bản của tôi.
            </li>
            <li>
              Gửi qua form liên hệ nội dung spam, quảng cáo không mời, hoặc nội dung
              vi phạm pháp luật Việt Nam.
            </li>
            <li>
              Tạo lượt bấm giả vào các liên kết affiliate nhằm gian lận hệ thống đo
              lường.
            </li>
          </ul>
          <p>
            Tôi có thể chặn truy cập từ nguồn có hành vi như trên mà không cần
            báo trước.
          </p>

          <h2>7. Giới hạn trách nhiệm</h2>
          <p>
            Website được cung cấp &ldquo;như hiện có&rdquo;. Trong phạm vi pháp luật
            cho phép, {operator} không chịu trách nhiệm về thiệt hại phát sinh từ việc
            bạn sử dụng hoặc không thể sử dụng website, bao gồm cả thiệt hại do bạn áp
            dụng hướng dẫn trên website vào thiết bị, dữ liệu hoặc hợp đồng của mình.
          </p>
          <p>
            Tôi không bảo đảm website hoạt động liên tục, không lỗi hay không bị
            gián đoạn.
          </p>

          <h2>8. Dữ liệu cá nhân</h2>
          <p>
            Cách tôi thu thập và xử lý dữ liệu được mô tả tại{" "}
            <Link href="/chinh-sach-bao-mat">chính sách quyền riêng tư</Link>, là phần
            không tách rời của các điều khoản này.
          </p>

          <h2>9. Thay đổi điều khoản</h2>
          <p>
            Tôi có thể cập nhật điều khoản này. Ngày cập nhật gần nhất luôn hiện
            ở đầu trang. Nếu có thay đổi đáng kể, tôi sẽ ghi rõ nội dung thay
            đổi thay vì chỉ đổi ngày.
          </p>

          <h2>10. Luật áp dụng</h2>
          <p>
            Các điều khoản này được điều chỉnh theo pháp luật Việt Nam. Tranh chấp
            phát sinh sẽ được giải quyết trước hết bằng thương lượng; nếu không đạt kết
            quả thì tại cơ quan có thẩm quyền theo pháp luật Việt Nam.
          </p>

          <h2>11. Liên hệ</h2>
          <p>
            Thắc mắc về điều khoản: <Link href="/lien-he">gửi tin nhắn cho tôi</Link>{" "}
            hoặc email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </Prose>
      </div>
    </div>
  );
}
