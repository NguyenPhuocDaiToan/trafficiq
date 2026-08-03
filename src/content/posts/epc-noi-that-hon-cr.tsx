import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "epc-noi-that-hon-cr",
  title: "EPC nói thật hơn CR",
  description:
    "Tỷ lệ chuyển đổi cao không có nghĩa là kiếm được nhiều hơn. Vì sao thu nhập trên mỗi click là chỉ số nên đặt ở cột đầu tiên.",
  category: "toi-uu",
  publishedAt: "2026-07-12",
  authorId: "bien-tap",
  readingMinutes: 6,
  tags: ["EPC", "CR", "đọc số liệu"],
  body: () => (
    <>
      <p>
        Hai chiến dịch, cùng một ngân sách. Chiến dịch A có tỷ lệ chuyển đổi 4,2%.
        Chiến dịch B có 1,1%. Gần như phản xạ tự nhiên là tắt B và dồn tiền vào A.
      </p>

      <p>Nhưng thêm một cột nữa:</p>

      <table>
        <thead>
          <tr>
            <th>Chiến dịch</th>
            <th>Click</th>
            <th>Chuyển đổi</th>
            <th>CR</th>
            <th>Hoa hồng/đơn</th>
            <th>EPC</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A</td>
            <td>2.000</td>
            <td>84</td>
            <td>4,20%</td>
            <td>1,50 $</td>
            <td>0,063 $</td>
          </tr>
          <tr>
            <td>B</td>
            <td>2.000</td>
            <td>22</td>
            <td>1,10%</td>
            <td>18,00 $</td>
            <td>0,198 $</td>
          </tr>
        </tbody>
      </table>

      <p>
        B kiếm được <strong>gấp hơn ba lần</strong> trên mỗi click, dù tỷ lệ chuyển
        đổi thấp hơn gần bốn lần. Nếu bạn tắt B theo CR, bạn vừa tắt chiến dịch tốt
        hơn.
      </p>

      <h2>Vì sao CR dễ gây nhầm</h2>

      <p>
        CR là một tỷ lệ, và tỷ lệ luôn giấu đi hai thứ: mẫu số và giá trị đơn vị.
      </p>

      <p>
        <strong>Giá trị đơn vị.</strong> CR coi mọi chuyển đổi bằng nhau. Một lượt
        điền form nhận hoa hồng 0,3 $ và một hợp đồng vay nhận 40 $ đều là
        &ldquo;một chuyển đổi&rdquo;. Chiến dịch nào có ngưỡng chuyển đổi thấp thì
        đương nhiên CR cao — và cũng đương nhiên đáng ít tiền hơn.
      </p>

      <p>
        <strong>Mẫu số.</strong> CR 100% trên 3 click không nói được gì. Nhưng nó
        vẫn xếp đầu bảng nếu bạn sắp theo CR. Đây là lý do bảng số liệu nào cũng nên
        hiện số click tuyệt đối ngay cạnh mọi tỷ lệ, không phải giấu trong tooltip.
      </p>

      <h2>EPC là thứ so sánh được giữa các chiến dịch khác nhau</h2>

      <p>
        EPC (earning per click — thu nhập trên mỗi click) chỉ là doanh thu chia số
        click. Cái làm nó hữu ích là nó cùng đơn vị với thứ bạn đang mua: bạn mua
        click, EPC nói mỗi click đó đem lại bao nhiêu.
      </p>

      <p>
        Nhờ vậy nó so sánh trực tiếp được với CPC, và cho ra một quy tắc quyết định
        gọn:
      </p>

      <pre>
        <code>{`lãi mỗi click = EPC − CPC

EPC 0,198 $ với CPC 0,12 $  ->  +0,078 $ mỗi click   (tăng ngân sách)
EPC 0,063 $ với CPC 0,12 $  ->  −0,057 $ mỗi click   (đang lỗ)`}</code>
      </pre>

      <p>
        Chiến dịch A với CR 4,2% đang <strong>lỗ</strong> ở mức CPC 0,12 $. Không
        cột nào trong báo cáo CR cho bạn biết điều đó.
      </p>

      <h2>Khi nào EPC cũng nói dối</h2>

      <p>Không có chỉ số nào miễn nhiễm. EPC sai trong ba trường hợp:</p>

      <h3>Mẫu quá nhỏ</h3>

      <p>
        EPC của một chiến dịch có 40 click là nhiễu, không phải tín hiệu. Với hoa
        hồng cao và CR thấp, một chuyển đổi lẻ có thể đẩy EPC lên gấp mười. Đặt
        ngưỡng tối thiểu trước khi tin: thường là đủ click để kỳ vọng có ít nhất
        10–15 chuyển đổi, không phải một con số click cố định.
      </p>

      <h3>Cửa sổ thời gian chưa đóng</h3>

      <p>
        Chuyển đổi tới sau click, có khi vài tuần sau. EPC của hôm nay tính trên
        click hôm nay và chuyển đổi <em>đã về tính đến giờ</em> — luôn thấp hơn EPC
        thật. So EPC của hôm nay với EPC của tháng trước là so một số chưa chín với
        một số đã chín.
      </p>

      <p>
        Cách làm đúng: so các khoảng có cùng độ &ldquo;chín&rdquo;. Nếu cửa sổ là 30
        ngày thì chỉ so những khoảng đã trôi qua ít nhất 30 ngày, hoặc chấp nhận
        rằng số gần đây sẽ còn tăng.
      </p>

      <h3>Chuyển đổi bị hủy sau đó</h3>

      <p>
        EPC tính trên chuyển đổi đã được báo, kể cả những cái sau này bị từ chối.
        Nếu tỷ lệ hủy khác nhau giữa các đối tác — thường là khác nhau nhiều —
        thì EPC gộp đang so sai. Tính EPC trên số đã duyệt nếu dữ liệu cho phép.
      </p>

      <Callout title="Sắp xếp lại bảng số liệu của bạn">
        Đặt EPC ở cột ngay sau tên chiến dịch, không phải cột cuối. Con người đọc
        bảng theo cột đầu tiên có số; cột nào đứng trước sẽ quyết định hành động của
        bạn dù bạn có ý thức về nó hay không.
      </Callout>

      <h2>Nhóm chỉ số nên đọc cùng nhau</h2>

      <p>Không có chỉ số nào đứng một mình. Bộ nhỏ nhất dùng được là bốn cái:</p>

      <ul>
        <li>
          <strong>Click</strong> — mẫu số. Không có nó thì mọi tỷ lệ đều vô nghĩa.
        </li>
        <li>
          <strong>EPC</strong> — thu nhập trên mỗi đơn vị bạn mua. Đây là chỉ số ra
          quyết định.
        </li>
        <li>
          <strong>CR</strong> — <em>chẩn đoán</em>, không phải để ra quyết định. CR
          tụt trong khi EPC giữ nguyên nghĩa là trang đích hoặc nguồn traffic có
          vấn đề, dù tiền vẫn chưa đổi.
        </li>
        <li>
          <strong>Khách duy nhất</strong> — so với số click. Chênh lệch lớn giữa hai
          cái này là dấu hiệu của bot hoặc người dùng bấm nhiều lần.
        </li>
      </ul>

      <p>
        CR vẫn đáng có trên bảng. Nó chỉ không nên là thứ bạn nhìn đầu tiên, và
        tuyệt đối không nên là thứ bạn sắp xếp theo.
      </p>
    </>
  ),
};
