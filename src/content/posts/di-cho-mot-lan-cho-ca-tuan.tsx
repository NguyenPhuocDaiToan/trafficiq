import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "di-cho-mot-lan-cho-ca-tuan",
  title: "Đi chợ một lần cho cả tuần mà không phải bỏ đồ ăn",
  description:
    "Đồ ăn bị bỏ hầu như luôn vì mua theo món chứ không theo bữa. Cách lên khung bữa trước khi viết danh sách, và thứ tự dùng theo độ bền.",
  category: "bep",
  publishedAt: "2026-07-09",
  authorId: "toan",
  readingMinutes: 6,
  cover: {
    src: "/images/blog/di-cho-mot-lan-cho-ca-tuan.webp",
    alt: "Rau củ tươi và các hộp thủy tinh sơ chế thực phẩm gọn gàng trong gian bếp",
  },
  tags: ["đi chợ", "bếp", "tiết kiệm", "bảo quản thực phẩm"],
  body: () => (
    <>
      <p>
        Đi chợ một lần cho cả tuần tiết kiệm được rất nhiều thời gian, nhưng nó chỉ thật
        sự tiết kiệm tiền nếu bạn dùng hết những gì đã mua. Bằng không thì nó chỉ chuyển
        tiền từ ví sang thùng rác, gọn hơn và nhanh hơn cách cũ.
      </p>

      <p>
        Nguyên nhân gần như luôn giống nhau: người ta mua <strong>theo món</strong>{" "}
        (một bó rau, một hộp thịt, ít trái cây) trong khi bữa ăn được nấu{" "}
        <strong>theo tổ hợp</strong>. Kết quả là có nguyên liệu nhưng không có bữa nào
        hoàn chỉnh, thế là gọi đồ ăn ngoài, và bó rau ở lại trong tủ tới khi phải bỏ.
      </p>

      <h2>Lên khung bữa trước khi viết danh sách</h2>

      <p>
        Đảo đúng một bước: <strong>quyết định các bữa trước, rồi mới liệt kê nguyên
        liệu</strong>. Bước này mất mười phút và là toàn bộ khác biệt.
      </p>

      <p>
        Đừng lên kế hoạch cho bảy ngày. Thực tế trong tuần luôn có bữa ăn ngoài, bữa ăn
        ở nhà người thân, bữa về muộn không nấu nổi. Lên <strong>năm bữa</strong> là
        con số dùng được: đủ để không phải nghĩ mỗi tối, còn thừa chỗ cho thay đổi.
      </p>

      <p>Với mỗi bữa, viết đúng ba thành phần:</p>

      <ul>
        <li>Một món chính (đạm: thịt, cá, trứng, đậu).</li>
        <li>Một loại rau.</li>
        <li>Một món tinh bột.</li>
      </ul>

      <p>
        Viết xong năm bữa mới bắt đầu gom nguyên liệu thành danh sách mua. Lúc gom bạn
        sẽ tự thấy chỗ trùng — cùng một bó rau dùng cho hai bữa, cùng một hộp thịt chia
        hai lần — và đó chính là chỗ danh sách ngắn lại.
      </p>

      <Callout title="Quy tắc gối đầu nguyên liệu">
        Cố ý cho mỗi nguyên liệu xuất hiện trong <strong>ít nhất hai bữa</strong>. Mua
        một thứ chỉ để dùng một lần là cách chắc chắn nhất để còn lại một nửa. Nếu một
        nguyên liệu chỉ vào được một bữa duy nhất, hãy đổi bữa hoặc bỏ nguyên liệu đó
        ra khỏi tuần này.
      </Callout>

      <h2>Xếp thứ tự bữa theo độ bền của nguyên liệu</h2>

      <p>
        Sau khi có năm bữa, xếp lại thứ tự nấu theo nguyên liệu nào hỏng trước. Đây là
        bước không mất thêm đồng nào mà cứu được nhiều nhất.
      </p>

      <table>
        <thead>
          <tr>
            <th>Nhóm</th>
            <th>Nấu vào</th>
            <th>Ví dụ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hỏng nhanh nhất</td>
            <td>1–2 ngày đầu</td>
            <td>Cá, hải sản, rau lá mềm, giá đỗ, nấm</td>
          </tr>
          <tr>
            <td>Trung bình</td>
            <td>Giữa tuần</td>
            <td>Thịt để mát, rau cải, đậu phụ, trái cây chín</td>
          </tr>
          <tr>
            <td>Bền</td>
            <td>Cuối tuần</td>
            <td>Củ quả, bí, cà rốt, trứng, đồ khô, đồ đông lạnh</td>
          </tr>
        </tbody>
      </table>

      <p>
        Nếu bữa cuối tuần của bạn chỉ toàn củ quả và trứng thì bạn đã xếp đúng. Bữa
        &ldquo;kém hấp dẫn nhất&rdquo; nên nằm ở cuối, vì đến lúc đó bạn còn ít lựa chọn
        nhất — và củ quả thì vẫn còn tốt.
      </p>

      <h2>Ba việc làm ngay khi vừa về tới nhà</h2>

      <p>
        Nửa giờ ngay sau khi đi chợ quyết định phần lớn chuyện tuần này có phải bỏ đồ
        hay không.
      </p>

      <ol>
        <li>
          <strong>Chia phần trước khi cất.</strong> Hộp thịt lớn chia thành đúng số phần
          cho từng bữa rồi mới cho vào tủ. Rã đông cả khối rồi dùng một phần là cách
          nhanh nhất để phần còn lại hỏng.
        </li>
        <li>
          <strong>Sơ chế rau ngay.</strong> Bỏ lá dập, để thật khô rồi mới cất — nước
          đọng trên lá là nguyên nhân số một làm rau nhũn sau hai ngày.
        </li>
        <li>
          <strong>Ghi ngày lên đồ đông lạnh.</strong> Một dòng bút lông trên bao bì. Đồ
          trong tủ đông không hỏng theo cách dễ thấy, nên không ghi ngày thì mọi túi đều
          trông như mới cho tới khi ăn.
        </li>
      </ol>

      <h2>Một ngăn &ldquo;phải dùng trước&rdquo;</h2>

      <p>
        Dành một ngăn hoặc một khay ở tầm mắt trong tủ lạnh cho những thứ cần dùng trong
        một hai ngày tới. Mọi thứ trong ngăn đó có quyền ưu tiên hơn kế hoạch: nếu tối
        nay định nấu món A nhưng trong ngăn đó có thứ sắp hết hạn, nấu cái đó trước.
      </p>

      <p>
        Cách này giải quyết vấn đề cốt lõi của tủ lạnh: đồ ở phía sau thì không ai nhìn
        thấy, và cái gì không nhìn thấy thì không được nấu. Đưa món cần gấp ra trước
        hiệu quả hơn mọi cố gắng ghi nhớ.
      </p>

      <h2>Một dòng cuối tuần cho lần sau</h2>

      <p>
        Trước khi đi chợ tuần kế tiếp, dành hai phút xem lại tuần vừa rồi và trả lời hai
        câu:
      </p>

      <ul>
        <li>
          <strong>Thứ gì phải bỏ?</strong> Ghi lại. Cùng một món xuất hiện hai tuần liền
          nghĩa là bạn không thật sự ăn nó, dù mỗi lần đi chợ vẫn muốn mua.
        </li>
        <li>
          <strong>Bữa nào nấu ra mà không ai muốn ăn lại?</strong> Bỏ nó khỏi danh sách
          các món quay vòng, đừng cố lặp lại vì nó &ldquo;lành mạnh&rdquo;.
        </li>
      </ul>

      <p>
        Sau khoảng một tháng, hai câu hỏi đó tự hình thành một danh sách chừng mười lăm
        món mà nhà bạn thật sự ăn hết. Từ lúc có danh sách đó, việc lên khung năm bữa
        không còn là việc nghĩ, chỉ còn là việc chọn.
      </p>
    </>
  ),
};
