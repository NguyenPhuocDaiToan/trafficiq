import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "so-chuyen-doi-lech-nhau",
  title: "Vì sao số chuyển đổi của bạn luôn thấp hơn số của đối tác",
  description:
    "Lệch 5–15% giữa hai hệ thống là bình thường và có nguyên nhân kỹ thuật cụ thể. Bài này chỉ ra bốn nguyên nhân và cách phân biệt chúng.",
  category: "do-luong",
  publishedAt: "2026-07-28",
  authorId: "bien-tap",
  readingMinutes: 7,
  featured: true,
  tags: ["postback", "attribution", "đối chiếu số liệu"],
  body: () => (
    <>
      <p>
        Cuối tháng bạn mở báo cáo của mình: 412 chuyển đổi. Đối tác gửi bảng đối
        chiếu: 447. Chênh 35, tức 8,5%. Câu hỏi đầu tiên gần như ai cũng hỏi là
        &ldquo;ai sai?&rdquo; — nhưng đó là câu hỏi sai. Trong gần như mọi trường
        hợp, <strong>không bên nào sai</strong>; hai hệ thống đang đếm hai thứ khác
        nhau ở hai thời điểm khác nhau.
      </p>

      <p>
        Việc cần làm không phải là bắt hai con số bằng nhau, mà là{" "}
        <strong>giải thích được toàn bộ khoảng lệch</strong>. Một khoảng lệch 8,5%
        mà bạn chỉ ra được nó từ đâu là bình thường. Một khoảng lệch 3% mà bạn
        không biết vì sao mới là vấn đề — vì lần sau nó có thể là 30% và bạn cũng
        sẽ không biết.
      </p>

      <h2>1. Postback bị mất trên đường truyền</h2>

      <p>
        Chuyển đổi được đối tác báo về bằng một request HTTP tới endpoint của bạn.
        Request đó đi qua Internet, nên nó có tỷ lệ thất bại khác 0: timeout, DNS
        chập, hệ thống bạn đang deploy, hoặc cold start làm request quá 10 giây và
        phía họ bỏ.
      </p>

      <p>
        Đối tác tử tế sẽ retry. Và ở đây có một cái bẫy: nếu endpoint của bạn không{" "}
        <em>idempotent</em>, retry sẽ tạo bản ghi trùng và số của bạn thành{" "}
        <strong>cao hơn</strong>. Nếu nó idempotent nhưng lần retry nào cũng fail
        thì số của bạn thấp hơn. Cả hai đều là cùng một lỗ hổng thiết kế.
      </p>

      <p>
        Cách xử lý đúng chỉ có một: đặt <em>unique index</em> trên khóa nhận diện
        chuyển đổi, rồi coi lỗi trùng khóa là <strong>thành công</strong>.
      </p>

      <pre>
        <code>{`// Nhận postback: insert, nếu trùng khóa thì trả 200 chứ không phải lỗi
try {
  await conversions.insertOne({ clickId, payout, ts: new Date() });
  return { ok: true };
} catch (err) {
  if (err.code === 11000) return { ok: true, duplicate: true };  // 11000 = duplicate key
  throw err;
}`}</code>
      </pre>

      <p>
        Trả 200 cho bản trùng là chủ ý, không phải che lỗi. Đối tác cần biết
        &ldquo;chuyển đổi này đã được ghi nhận&rdquo;. Nếu bạn trả 409 hay 500, hệ
        thống của họ sẽ hiểu là chưa nhận được và tiếp tục retry — có bên retry
        theo cấp số nhân trong 24 giờ.
      </p>

      <Callout title="Kiểm nhanh xem endpoint có idempotent thật không">
        Gửi cùng một postback hai lần, lần thứ hai đổi số tiền thành một giá trị
        khác hẳn. Đúng thì: cả hai lần đều trả 200, trong DB có đúng một bản ghi,
        và số tiền vẫn là <strong>của lần đầu</strong>. Nếu số tiền bị ghi đè thì
        bạn đang có một lỗ để đối tác sửa doanh thu sau khi đã chốt.
      </Callout>

      <h2>2. Hai bên chốt theo hai múi giờ</h2>

      <p>
        Đây là nguyên nhân bị bỏ qua nhiều nhất và cũng dễ sửa nhất. Hệ thống của
        bạn có thể chốt ngày theo UTC, còn đối tác chốt theo giờ địa phương của họ.
        Với Việt Nam (UTC+7), <strong>7 giờ đầu mỗi ngày</strong> nằm ở hai ngày
        khác nhau trong hai báo cáo.
      </p>

      <p>
        Hệ quả: báo cáo ngày lệch rõ, nhưng báo cáo tháng lại gần khớp — chỉ lệch ở
        đúng phần rìa của tháng. Nếu bạn thấy dấu hiệu đó thì gần như chắc chắn là
        múi giờ, không phải mất dữ liệu.
      </p>

      <p>
        Cách xử lý: lưu mọi mốc thời gian bằng UTC, và ghi rõ trong tài liệu đối
        chiếu rằng báo cáo của bạn theo UTC. Đừng đổi hệ thống sang giờ Việt Nam để
        cho khớp — bạn sẽ vỡ ngay khi có đối tác thứ hai ở múi giờ khác.
      </p>

      <h2>3. Cửa sổ attribution không bằng nhau</h2>

      <p>
        Đối tác có thể ghi nhận chuyển đổi trong 30 ngày sau click. Nếu bạn chỉ giữ
        dữ liệu click 7 ngày, thì mọi chuyển đổi về sau ngày thứ 7 sẽ tới với một
        click ID mà bạn <strong>không còn</strong> trong DB. Bạn không nối được nó
        vào chiến dịch nào, và tùy cách viết code, hoặc là bạn bỏ nó, hoặc bạn ghi
        nó vào nhóm &ldquo;không rõ&rdquo;.
      </p>

      <p>
        Đây là chỗ ràng buộc chi phí đâm vào tính đúng đắn. Giữ click 30 ngày tốn
        dung lượng gấp bốn lần giữ 7 ngày. Nếu bạn đang ở gói lưu trữ giới hạn thì
        đó là một quyết định thật sự phải cân, không phải chuyện cấu hình.
      </p>

      <p>Có ba lựa chọn, và cả ba đều chấp nhận được nếu bạn biết mình chọn gì:</p>

      <ul>
        <li>
          Giữ click đủ dài để phủ cửa sổ dài nhất của đối tác. Đúng nhất, tốn nhất.
        </li>
        <li>
          Giữ ngắn, nhưng khi chuyển đổi tới mà không tìm thấy click thì{" "}
          <strong>vẫn ghi lại</strong> vào nhóm không xác định được nguồn. Bạn mất
          phần phân bổ theo chiến dịch nhưng không mất doanh thu.
        </li>
        <li>
          Giữ ngắn cho dữ liệu chi tiết, nhưng lưu thêm một bảng tổng hợp nhẹ chỉ
          gồm <code>clickId → campaignId</code>. Bảng đó nhỏ hơn bản ghi click đầy
          đủ vài chục lần nên giữ được lâu hơn nhiều.
        </li>
      </ul>

      <h2>4. Chuyển đổi bị hủy sau khi đã báo</h2>

      <p>
        Đối tác báo chuyển đổi lúc người dùng bấm xong. Vài ngày sau đơn bị hủy,
        thẻ bị từ chối, hoặc bộ phận chống gian lận của họ loại nó ra. Bảng đối
        chiếu cuối tháng của họ là số <em>đã trừ</em>; báo cáo realtime của bạn là
        số <em>trước khi trừ</em>.
      </p>

      <p>
        Trường hợp này số của <strong>bạn cao hơn</strong> — ngược với ba nguyên
        nhân trên. Nếu bạn thấy mình cao hơn thì đừng đi tìm lỗi mất dữ liệu, hãy
        hỏi đối tác về tỷ lệ hủy.
      </p>

      <p>
        Về mặt hệ thống, cách chuẩn bị là ngay từ đầu cho bản ghi chuyển đổi một
        trường trạng thái (chờ / đã duyệt / bị từ chối) thay vì coi mọi chuyển đổi
        là chắc chắn. Thêm trường đó lúc đang có 400 bản ghi thì dễ; thêm lúc đã có
        400 nghìn thì phải viết migration.
      </p>

      <h2>Quy trình đối chiếu dùng được</h2>

      <p>
        Khi số lệch, đi theo thứ tự này — từ nguyên nhân dễ loại trừ nhất tới khó
        nhất:
      </p>

      <ol>
        <li>
          <strong>So tổng tháng trước khi so ngày.</strong> Tháng khớp mà ngày lệch
          thì đó là múi giờ, dừng tại đây.
        </li>
        <li>
          <strong>Xem hướng lệch.</strong> Bạn thấp hơn → mất postback hoặc quá cửa
          sổ. Bạn cao hơn → chuyển đổi bị hủy hoặc bạn đang đếm trùng.
        </li>
        <li>
          <strong>Lấy 20 click ID mà họ có và bạn không.</strong> Tra từng cái trong
          log click. Không tìm thấy click nào cả → vấn đề ở cửa sổ lưu trữ. Có
          click nhưng không có chuyển đổi → postback không tới được.
        </li>
        <li>
          <strong>Xem log của endpoint postback trong đúng khoảng đó.</strong> Có
          request mà trả 5xx không? Đây là lý do đáng để log cả những postback bị
          từ chối, không chỉ những cái thành công.
        </li>
      </ol>

      <p>
        Mục tiêu không phải số 0. Mục tiêu là một câu nói được thành lời:
        &ldquo;lệch 8,5%, trong đó 5% là chuyển đổi bị hủy phía đối tác, 3% là
        chuyển đổi ngoài cửa sổ 7 ngày của tôi, còn 0,5% chưa rõ.&rdquo; Câu đó
        cho bạn biết cái gì đáng sửa và cái gì phải chấp nhận.
      </p>
    </>
  ),
};
