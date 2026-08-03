import type { Metadata } from "next";
import Link from "next/link";
import { LegalGapNotice, PageHeader, Prose } from "@/components/site";
import { formatDate } from "@/lib/labels";
import { SITE } from "@/lib/site";
import { clickTtlDays } from "@/lib/env";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description:
    "Dữ liệu chúng tôi thu thập khi bạn đọc bài, khi bạn bấm liên kết theo dõi, và khi bạn gửi form liên hệ — kèm thời gian lưu trữ cụ thể.",
  alternates: { canonical: "/chinh-sach-bao-mat" },
  openGraph: { title: `Chính sách quyền riêng tư · ${SITE.name}`, url: "/chinh-sach-bao-mat" },
};

/**
 * Nội dung trang này PHẢI khớp với những gì code thật sự làm. Cụ thể:
 *   - thời gian lưu click đọc trực tiếp từ CLICK_TTL_DAYS (`clickTtlDays()`),
 *     không viết cứng "30 ngày" — đổi env mà quên sửa trang là tuyên bố sai sự thật;
 *   - danh sách trường thu thập khớp với interface `ClickEvent` trong lib/types.ts;
 *   - `contactMessages` không có TTL nên ở đây phải nói là lưu tới khi xử lý xong.
 * Sửa hành vi thu thập ở đâu thì sửa cả trang này.
 */
export default function PrivacyPage() {
  const operator = SITE.legal.entityName ?? SITE.name;
  const ttlDays = clickTtlDays();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Chính sách quyền riêng tư"
        intro={`Cập nhật ${formatDate(SITE.policyUpdatedAt)}`}
      />

      <div className="mt-8 max-w-2xl">
        <LegalGapNotice />
      </div>

      <div className="mt-10">
        <Prose>
          <h2>Nói ngắn trước</h2>
          <ul>
            <li>Đọc bài trên site này: chúng tôi không thu thập gì về bạn.</li>
            <li>
              Bấm một liên kết theo dõi: chúng tôi ghi lượt bấm đó, có kèm{" "}
              <strong>bản băm</strong> của địa chỉ IP — không phải IP thật.
            </li>
            <li>
              Gửi form liên hệ: chúng tôi lưu tên, email và nội dung để trả lời bạn.
            </li>
            <li>Chúng tôi không dùng cookie theo dõi, không chạy Google Analytics.</li>
            <li>Chúng tôi không bán dữ liệu của bạn cho bất kỳ ai.</li>
          </ul>

          <h2>1. Ai chịu trách nhiệm dữ liệu</h2>
          <p>
            <strong>{operator}</strong>
            {SITE.legal.address ? `, ${SITE.legal.address}` : ""}. Mọi yêu cầu liên
            quan tới dữ liệu gửi về{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>

          <h2>2. Khi bạn chỉ đọc bài</h2>
          <p>
            Các trang nội dung được tạo sẵn dạng tĩnh và{" "}
            <strong>không đặt cookie nào</strong>. Không có mã theo dõi của bên thứ ba,
            không Google Analytics, không pixel mạng xã hội, không nhúng font từ máy
            chủ bên ngoài (font được đóng gói cùng website).
          </p>
          <p>
            Nhà cung cấp hạ tầng của chúng tôi có log máy chủ ở mức kỹ thuật để chống
            lạm dụng. Chúng tôi không truy cập log đó để phân tích hành vi người đọc.
          </p>

          <h2>3. Khi bạn bấm một liên kết theo dõi</h2>
          <p>
            Liên kết tài trợ đi qua một địa chỉ trung gian trên tên miền của chúng tôi
            trước khi chuyển bạn tới trang của bên bán. Tại bước đó chúng tôi ghi lại:
          </p>
          <ul>
            <li>Thời điểm bấm.</li>
            <li>Chiến dịch và liên kết đích tương ứng.</li>
            <li>Nguồn traffic (nếu có trong đường dẫn).</li>
            <li>
              Quốc gia, khu vực và thành phố — lấy từ hạ tầng mạng, ở mức thành phố,{" "}
              <strong>không phải toạ độ</strong>.
            </li>
            <li>Loại thiết bị, trình duyệt, hệ điều hành.</li>
            <li>Trang giới thiệu (referrer), nếu trình duyệt của bạn gửi.</li>
            <li>
              Một <strong>bản băm một chiều của địa chỉ IP</strong> — xem mục dưới.
            </li>
          </ul>

          <h3>Về địa chỉ IP</h3>
          <p>
            Chúng tôi <strong>không lưu địa chỉ IP dạng thô</strong>. IP được băm bằng
            SHA-256 cùng một khoá bí mật rồi mới lưu; giá trị lưu lại không thể quy về
            IP gốc.
          </p>
          <p>
            Mục đích duy nhất: đếm số khách truy cập duy nhất và phát hiện lượt bấm
            gian lận. Chúng tôi không dùng nó để nhận diện bạn giữa các lần truy cập
            khác nhau ngoài mục đích thống kê đó.
          </p>

          <h3>Mã lượt bấm gửi sang bên bán</h3>
          <p>
            Khi chuyển bạn sang trang của bên bán, chúng tôi truyền kèm một mã ngẫu
            nhiên để sau này đối chiếu giao dịch. Mã này{" "}
            <strong>không chứa và không suy ra được</strong> thông tin cá nhân của
            bạn — nó chỉ là một chuỗi ngẫu nhiên.
          </p>

          <h2>4. Khi bạn gửi form liên hệ</h2>
          <p>Chúng tôi lưu tên, email, tiêu đề và nội dung bạn nhập, cùng với:</p>
          <ul>
            <li>Bản băm địa chỉ IP — dùng để hạn chế spam, cùng cách như trên.</li>
            <li>Chuỗi nhận dạng trình duyệt (user agent).</li>
          </ul>
          <p>
            Email của bạn <strong>chỉ</strong> dùng để trả lời tin nhắn đó. Chúng tôi
            không thêm bạn vào danh sách gửi thư, và hiện tại chúng tôi không có hệ
            thống gửi thư tự động nào.
          </p>

          <h2>5. Thời gian lưu trữ</h2>
          <table>
            <thead>
              <tr>
                <th>Loại dữ liệu</th>
                <th>Thời gian lưu</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Dữ liệu lượt bấm chi tiết</td>
                <td>
                  Tự động xóa sau <strong>{ttlDays} ngày</strong>
                </td>
              </tr>
              <tr>
                <td>Số liệu tổng hợp (theo giờ, theo chiến dịch)</td>
                <td>Lưu dài hạn — không gắn với từng lượt truy cập</td>
              </tr>
              <tr>
                <td>Bản ghi giao dịch phát sinh hoa hồng</td>
                <td>Lưu theo yêu cầu đối chiếu và kế toán</td>
              </tr>
              <tr>
                <td>Tin nhắn từ form liên hệ</td>
                <td>Lưu tới khi xử lý xong; xóa khi bạn yêu cầu</td>
              </tr>
            </tbody>
          </table>
          <p>
            Việc xóa dữ liệu lượt bấm là <em>tự động ở tầng cơ sở dữ liệu</em>, không
            phụ thuộc việc có ai chạy tác vụ dọn dẹp hay không.
          </p>

          <h2>6. Chia sẻ với bên thứ ba</h2>
          <p>Chúng tôi chia sẻ dữ liệu trong đúng ba trường hợp:</p>
          <ul>
            <li>
              <strong>Bên bán / mạng affiliate</strong> — nhận mã lượt bấm ngẫu nhiên
              để đối chiếu giao dịch. Họ không nhận email, tên hay IP của bạn từ chúng
              tôi.
            </li>
            <li>
              <strong>Nhà cung cấp hạ tầng</strong> — nơi đặt website và cơ sở dữ liệu.
              Họ xử lý dữ liệu theo hợp đồng, không dùng cho mục đích riêng.
            </li>
            <li>
              <strong>Cơ quan có thẩm quyền</strong> — khi có yêu cầu hợp pháp.
            </li>
          </ul>
          <p>
            Chúng tôi <strong>không bán</strong> và không cho thuê dữ liệu cá nhân.
          </p>
          <p>
            Lưu ý: sau khi bạn sang trang của bên bán, chính sách của họ áp dụng, không
            phải chính sách này. Họ có thể đặt cookie riêng mà chúng tôi không kiểm soát.
          </p>

          <h2>7. Quyền của bạn</h2>
          <p>Bạn có quyền yêu cầu chúng tôi:</p>
          <ul>
            <li>Cho biết chúng tôi đang giữ dữ liệu gì về bạn.</li>
            <li>Sửa dữ liệu sai.</li>
            <li>Xóa dữ liệu.</li>
          </ul>
          <p>
            Gửi yêu cầu tới{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Chúng tôi
            phản hồi trong vòng 30 ngày.
          </p>
          <p>
            Một giới hạn cần nói thẳng: với dữ liệu lượt bấm, chúng tôi{" "}
            <strong>không có cách nào tìm ra bản ghi nào là của bạn</strong> — vì chúng
            tôi chỉ lưu bản băm IP, không lưu IP. Đó chính là điều làm dữ liệu đó an
            toàn hơn, nhưng cũng có nghĩa là không thể tra cứu theo yêu cầu cá nhân.
            Dữ liệu đó tự xóa sau {ttlDays} ngày. Với tin nhắn liên hệ thì hoàn toàn
            tra và xóa được.
          </p>

          <h2>8. Trẻ em</h2>
          <p>
            Website không hướng tới người dưới 16 tuổi và chúng tôi không cố ý thu thập
            dữ liệu của họ.
          </p>

          <h2>9. Thay đổi chính sách</h2>
          <p>
            Ngày cập nhật gần nhất hiện ở đầu trang. Nếu cách thu thập dữ liệu thay
            đổi, chúng tôi sẽ ghi rõ thay đổi đó, không chỉ đổi ngày.
          </p>

          <h2>10. Liên hệ</h2>
          <p>
            <Link href="/lien-he">Gửi tin nhắn</Link> hoặc email{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Xem thêm{" "}
            <Link href="/tiet-lo-lien-ket">cách chúng tôi kiếm tiền</Link> và{" "}
            <Link href="/dieu-khoan">điều khoản sử dụng</Link>.
          </p>
        </Prose>
      </div>
    </div>
  );
}
