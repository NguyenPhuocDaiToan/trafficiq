import Link from "next/link";
import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "sao-luu-du-lieu-quy-tac-3-2-1",
  title: "Sao lưu dữ liệu theo quy tắc 3-2-1, bản dành cho người không làm IT",
  description:
    "Vì sao ảnh đang ở trên mây vẫn có thể mất sạch, cách dựng ba bản sao lưu bằng những thứ đã có trong nhà, và bài kiểm năm phút xem bản sao lưu của bạn có thật không.",
  category: "cong-nghe",
  publishedAt: "2026-07-22",
  updatedAt: "2026-08-05",
  authorId: "toan",
  readingMinutes: 7,
  cover: {
    src: "/images/blog/sao-luu-du-lieu-quy-tac-3-2-1.webp",
    alt: "Mô phỏng sao lưu dữ liệu quy tắc 3-2-1 với máy tính, ổ cứng di động và lưu trữ đám mây",
  },
  tags: ["sao lưu", "dữ liệu cá nhân", "ảnh", "3-2-1"],
  body: () => (
    <>
      <p>
        Gần như ai cũng mất dữ liệu một lần trong đời, và gần như lần nào cũng vì cùng
        một lý do: người ta tưởng mình đã có bản sao lưu. Ảnh đang đồng bộ lên mây, ghi
        chú đang ở trong tài khoản, tài liệu đang nằm trong thư mục có biểu tượng đám
        mây — nghe như đã an toàn. Thực tế thì chưa.
      </p>

      <h2>Đồng bộ không phải sao lưu</h2>

      <p>
        Đây là chỗ hiểu sai gây thiệt hại nhiều nhất, nên nói thẳng: <strong>đồng bộ
        là giữ hai chỗ giống nhau, sao lưu là giữ một bản không đổi theo</strong>. Khác
        biệt đó chỉ lộ ra khi có chuyện.
      </p>

      <ul>
        <li>
          Bạn xoá một album trên điện thoại. Đồng bộ làm đúng việc của nó: xoá luôn
          trên mây. Bản &ldquo;sao lưu&rdquo; của bạn vừa biến mất cùng lúc.
        </li>
        <li>
          Một tệp bị hỏng hoặc bị mã hoá bởi phần mềm độc hại. Bản trên mây được cập
          nhật thành đúng phiên bản đã hỏng đó.
        </li>
        <li>
          Tài khoản bị khoá hoặc bị chiếm. Mọi thứ &ldquo;đang ở trên mây&rdquo; nằm
          sau đúng một cánh cửa mà bạn vừa mất chìa.
        </li>
      </ul>

      <p>
        Nhiều dịch vụ đám mây có thùng rác giữ bản đã xoá trong một khoảng thời gian,
        và tính năng đó cứu được kha khá trường hợp. Nhưng nó có hạn, thường vài chục
        ngày, và bạn chỉ phát hiện mất ảnh cưới sau hai năm. Đừng để cả gia tài ảnh của
        mình phụ thuộc vào một cái thùng rác có hẹn giờ.
      </p>

      <h2>Quy tắc 3-2-1 là gì</h2>

      <p>
        Đây là quy tắc cũ trong ngành lưu trữ, và nó tồn tại lâu vì đơn giản đến mức
        không cần hiểu kỹ thuật cũng làm được:
      </p>

      <ul>
        <li>
          <strong>3 bản</strong> của dữ liệu quan trọng — bản đang dùng tính là một.
        </li>
        <li>
          <strong>2 loại phương tiện khác nhau</strong> — ví dụ{" "}
          <Link href="/blog/chon-o-cung-di-dong">một ổ rời</Link> và dịch vụ đám mây,
          không phải hai ổ cứng cùng loại mua cùng ngày.
        </li>
        <li>
          <strong>1 bản ở nơi khác</strong> — không cùng địa chỉ với máy của bạn. Cháy,
          ngập, mất trộm đều lấy đi mọi thứ trong cùng một căn nhà.
        </li>
      </ul>

      <p>
        Logic của nó là làm cho <em>một</em> sự cố không thể xoá được cả ba bản. Đó là
        toàn bộ ý tưởng.
      </p>

      <h2>Dựng ba bản bằng đồ có sẵn</h2>

      <p>
        Không cần mua thiết bị chuyên dụng. Với dữ liệu của một gia đình bình thường —
        ảnh, giấy tờ đã chụp, tài liệu công việc — cách này là đủ:
      </p>

      <table>
        <thead>
          <tr>
            <th>Bản</th>
            <th>Ở đâu</th>
            <th>Cập nhật thế nào</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bản 1 (đang dùng)</td>
            <td>Điện thoại / máy tính</td>
            <td>Tự nhiên, bạn dùng hằng ngày</td>
          </tr>
          <tr>
            <td>Bản 2</td>
            <td>Ổ cứng rời hoặc thẻ nhớ</td>
            <td>Chép tay mỗi tháng một lần</td>
          </tr>
          <tr>
            <td>Bản 3</td>
            <td>Dịch vụ đám mây</td>
            <td>Tự động</td>
          </tr>
        </tbody>
      </table>

      <p>
        Ba mẹo làm bản số 2 không bị bỏ dở giữa đường, vì đây là bản người ta hay quên
        nhất:
      </p>

      <ul>
        <li>
          <strong>Đặt lịch cố định</strong> — ví dụ ngày đầu tháng, cùng lúc với việc{" "}
          <Link href="/blog/phi-am-tham-trong-hoa-don-hang-thang">
            rà lại hoá đơn hằng tháng
          </Link>
          . Việc gắn vào một việc đã có thói quen thì dễ giữ hơn việc đứng riêng.
        </li>
        <li>
          <strong>Chép cả thư mục, đừng chọn tệp.</strong> Chọn tệp là chỗ sinh ra sai
          sót. Cứ chép cả thư mục ảnh và cả thư mục tài liệu — và nếu chỗ chứa hiện tại
          là một đống không có tên rõ ràng thì{" "}
          <Link href="/blog/dung-lai-thu-muc-may-tinh">dựng lại cây thư mục</Link> trước
          sẽ tiết kiệm cho bạn cả việc chép lẫn việc tìm lại sau này.
        </li>
        <li>
          <strong>Rút ổ ra khỏi máy sau khi chép.</strong> Ổ cắm thường trực vào máy
          thì gặp đúng số phận với máy, kể cả khi máy bị mã hoá dữ liệu.
        </li>
      </ul>

      <Callout title="Nếu chỉ làm được một việc hôm nay">
        Mua một ổ cứng rời hoặc thẻ nhớ, chép toàn bộ thư mục ảnh vào đó, rồi để nó ở
        nhà người thân hoặc trong tủ ở cơ quan. Chỉ một việc đó thôi đã đưa bạn từ
        &ldquo;một bản&rdquo; lên &ldquo;hai bản ở hai nơi&rdquo; — bước nhảy lớn nhất
        trong cả quy tắc.
      </Callout>

      <h2>Bước không ai làm: thử phục hồi</h2>

      <p>
        Một bản sao lưu chưa từng được mở ra thì không phải bản sao lưu, mà là một niềm
        tin. Rất nhiều người phát hiện thư mục sao lưu của mình rỗng, hoặc chỉ chứa các
        tệp xem trước thay vì ảnh gốc, đúng vào ngày cần đến nó.
      </p>

      <p>Bài kiểm tra mất năm phút, làm mỗi năm một lần:</p>

      <ol>
        <li>Mở bản sao lưu như một người lạ: cắm ổ vào, tìm thư mục ảnh.</li>
        <li>
          Mở <strong>ba tệp bất kỳ</strong> ở ba thời điểm khác nhau — một ảnh cũ, một
          ảnh gần đây, một tài liệu.
        </li>
        <li>
          Xem kích thước tệp. Ảnh chụp bằng điện thoại mà chỉ nặng vài chục kilobyte
          thì bạn đang giữ bản xem trước, không phải bản gốc.
        </li>
      </ol>

      <h2>Ưu tiên cái gì trước</h2>

      <p>
        Không phải mọi thứ đều cần ba bản. Sắp theo mức độ &ldquo;mất là không lấy lại
        được&rdquo;:
      </p>

      <ul>
        <li>
          <strong>Không thể tạo lại:</strong> ảnh và video gia đình,{" "}
          <Link href="/blog/giu-giay-to-quan-trong-trong-nha">giấy tờ đã chụp</Link>, bản
          ghi âm. Nhóm này cần đủ 3-2-1.
        </li>
        <li>
          <strong>Tạo lại được nhưng rất mất công:</strong> tài liệu công việc, thư từ
          quan trọng. Hai bản là ổn.
        </li>
        <li>
          <strong>Tải lại được:</strong> phim, nhạc, phần mềm. Không cần sao lưu, đừng
          để chúng chiếm chỗ của nhóm trên.
        </li>
      </ul>

      <p>
        Phân loại theo cách đó thường làm khối dữ liệu &ldquo;thật sự quan trọng&rdquo;
        nhỏ đi nhiều lần so với dung lượng máy — và khi nó nhỏ thì việc sao lưu đủ ba
        bản trở thành chuyện làm được trong một buổi tối, chứ không phải một dự án.
      </p>
    </>
  ),
};
