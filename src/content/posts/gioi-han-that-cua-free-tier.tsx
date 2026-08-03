import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "gioi-han-that-cua-free-tier",
  title: "Năm giới hạn của free tier mà bạn chỉ gặp khi đã chạy thật",
  description:
    "Bảng giá nói về dung lượng và băng thông. Những thứ thật sự làm bạn phải viết lại code lại không nằm trong bảng giá nào.",
  category: "van-hanh",
  publishedAt: "2026-07-04",
  authorId: "bien-tap",
  readingMinutes: 8,
  tags: ["serverless", "chi phí", "giới hạn hạ tầng"],
  body: () => (
    <>
      <p>
        Dựng một hệ thống tracking trên hạ tầng miễn phí là chuyện làm được. Nhưng
        những thứ chặn bạn không phải là các con số in trên trang giá. Chúng là các
        giới hạn về <em>mô hình thực thi</em> — và mỗi cái đều buộc phải sửa kiến
        trúc, không phải sửa cấu hình.
      </p>

      <p>
        Đây là năm cái đắt nhất, theo thứ tự thời điểm bạn sẽ gặp.
      </p>

      <h2>1. Tiến trình bị đóng băng ngay sau khi trả response</h2>

      <p>
        Trên nền tảng serverless, khi handler trả response xong là tiến trình có thể
        bị đóng băng ngay lập tức. Mọi thứ bạn xếp hàng để làm sau đó — theo phản xạ
        của người viết server truyền thống — sẽ đơn giản là không chạy:
      </p>

      <pre>
        <code>{`// Sai trên serverless: không có gì bảo đảm dòng ghi này chạy
res.redirect(302, target);
void logClick(event);        // tiến trình có thể đã đóng băng ở đây`}</code>
      </pre>

      <p>
        Không có lỗi nào được báo. Redirect vẫn hoạt động, người dùng vẫn sang trang
        đích, chỉ có bản ghi là không xuất hiện — và tỷ lệ mất thay đổi theo tải,
        nên lúc test nhẹ thì trông như chạy tốt.
      </p>

      <p>
        Cách xử lý: dùng đúng cơ chế mà nền tảng cung cấp để khai báo công việc chạy
        sau response, để nó giữ tiến trình sống cho tới khi việc xong. Trong Next thì
        đó là <code>after()</code>. Điều kiện là việc đó phải ngắn — vài trăm
        milli giây, không phải vài giây.
      </p>

      <Callout title="Cách kiểm cho ra sự thật">
        Bắn 400 request đồng thời vào endpoint, rồi đếm số bản ghi trong DB. Phải
        đúng 400. Test một request một lần sẽ luôn pass dù code sai, vì tiến trình
        chưa bị tái sử dụng cho việc gì khác.
      </Callout>

      <h2>2. Mỗi lần gọi hàm là một kết nối DB mới</h2>

      <p>
        Gói cơ sở dữ liệu miễn phí thường giới hạn khoảng 500 kết nối đồng thời. Nghe
        rất nhiều. Nhưng serverless mở rộng theo <em>số lần gọi hàm</em>, và nếu bạn
        tạo client mới trong mỗi lần gọi, 500 kết nối cạn ở mức tải thấp đến mức bất
        ngờ — vài chục request mỗi giây là đủ.
      </p>

      <p>
        Lỗi trả về lúc đó là timeout khi chọn server, không phải &ldquo;hết kết
        nối&rdquo;, nên rất dễ chẩn đoán sai thành DB chậm.
      </p>

      <p>
        Cách xử lý: cache client ở phạm vi module (hoặc trên đối tượng toàn cục để
        sống qua hot-reload lúc dev) và <strong>không bao giờ</strong> đóng nó trong
        handler. Nền tảng tái dùng tiến trình giữa các lần gọi, nên client sống theo
        tiến trình đó và pool được chia sẻ.
      </p>

      <p>
        Một chi tiết dễ bỏ: nếu bạn cache <em>promise</em> kết nối, phải xóa cache
        khi nó reject. Không xóa thì một lần DB chập lúc khởi động sẽ làm mọi request
        sau đó nhận lại đúng promise đã lỗi, cho tới khi tiến trình bị thay.
      </p>

      <pre>
        <code>{`globalThis.__clientPromise ??= client.connect().catch((err) => {
  globalThis.__clientPromise = undefined;   // thiếu dòng này là lỗi vĩnh viễn
  throw err;
});`}</code>
      </pre>

      <h2>3. Gói DB chia sẻ không cho dùng phần lớn công cụ tổng hợp</h2>

      <p>
        Đây là cái làm mất nhiều thời gian nhất, vì tài liệu chính thức mô tả các
        tính năng đó bình thường và không nói rõ chúng bị tắt ở gói chia sẻ:
      </p>

      <ul>
        <li>
          <strong>Không cho tràn ra đĩa.</strong> Mỗi bước tổng hợp bị giới hạn
          100MB bộ nhớ và không được phép dùng đĩa để vượt qua. Truy vấn của bạn chạy
          tốt trên dữ liệu test rồi chết khi dữ liệu thật lớn lên.
        </li>
        <li>
          <strong>Không ghi kết quả tổng hợp trực tiếp sang collection khác.</strong>{" "}
          Cách thông thường để làm bảng tổng hợp không dùng được. Phải tự đọc kết quả
          rồi ghi lại bằng thao tác cập nhật hàng loạt.
        </li>
      </ul>

      <p>
        Giới hạn 100MB đặc biệt hay cắn ở chỗ đếm giá trị duy nhất. Cách viết trực
        tiếp là gom tất cả giá trị vào một tập hợp rồi lấy kích thước — và tập hợp
        đó nằm trong một bản ghi duy nhất, nên nó đụng trần 100MB:
      </p>

      <pre>
        <code>{`// Chết khi số lượng lớn: cả tập hợp nằm trong MỘT bản ghi
{ $group: { _id: null, ids: { $addToSet: "$ipHash" } } }

// Chạy được: mỗi giá trị là một bản ghi, rồi đếm số bản ghi
{ $group: { _id: "$ipHash" } },
{ $count: "unique" }`}</code>
      </pre>

      <p>
        Hai cách cho cùng kết quả. Cách thứ hai không bao giờ đụng trần vì không có
        bản ghi nào phình ra.
      </p>

      <h2>4. Cron không chạy mỗi phút</h2>

      <p>
        Gói miễn phí thường chỉ cho cron mỗi ngày một lần. Nghĩa là mô hình
        &ldquo;job tổng hợp số liệu mỗi phút, dashboard đọc bảng đã tổng hợp&rdquo;
        không dùng được.
      </p>

      <p>
        Hai lựa chọn, và lựa chọn thứ nhất tốt hơn lúc đầu:
      </p>

      <ul>
        <li>
          <strong>Tính trực tiếp mỗi lần mở dashboard.</strong> Chỉ cần có index
          đúng và giới hạn khoảng thời gian mặc định (7 ngày chứ không phải toàn bộ),
          cách này chạy tốt tới quy mô xa hơn nhiều so với dự đoán. Ưu điểm lớn: số
          liệu luôn là realtime, không có độ trễ tổng hợp.
        </li>
        <li>
          <strong>Gọi endpoint tổng hợp bằng bộ hẹn giờ bên ngoài.</strong> Một
          workflow CI miễn phí chạy theo giờ là đủ. Chỉ làm khi cách trên đã thật sự
          chậm — đừng dựng sẵn.
        </li>
      </ul>

      <h2>5. Cache trong bộ nhớ chỉ tồn tại trên một máy</h2>

      <p>
        Cái này là bẫy tinh vi nhất trong cả năm cái. Bạn cache bảng định tuyến
        trong bộ nhớ để redirect nhanh. Chạy đúng. Rồi bạn tạm dừng một chiến dịch,
        cache được xóa, và link vẫn tiếp tục sống thêm khoảng một phút.
      </p>

      <p>
        Lý do: có nhiều tiến trình đang chạy song song. Lệnh xóa cache của bạn chỉ
        chạy trên đúng tiến trình đã nhận request đó. Những tiến trình khác vẫn đang
        giữ bảng cũ tới khi hết thời gian sống của cache.
      </p>

      <p>
        Đây <em>không</em> phải bug cần sửa — nó là hệ quả tất yếu của việc cache
        trong bộ nhớ ở môi trường nhiều tiến trình. Cách xử lý đúng là biết nó và ghi
        lại thành hành vi đã biết: &ldquo;sau khi tạm dừng chiến dịch, tính là link
        còn sống thêm tối đa 60 giây&rdquo;. Ai cần tắt tức thì thì phải bỏ cache và
        chấp nhận truy vấn DB mỗi lượt redirect.
      </p>

      <Callout title="Cách kiểm điều này bằng thực nghiệm">
        Bắn liên tục vào link redirect. Trong lúc đó tạm dừng chiến dịch. Đếm sau bao
        nhiêu giây thì lượt redirect cuối cùng còn thành công. Con số đó chính là
        khoảng thời gian bạn phải ghi vào tài liệu — đừng ghi theo lý thuyết.
      </Callout>

      <h2>Giới hạn không phải kỹ thuật, và là giới hạn quan trọng nhất</h2>

      <p>
        Gói miễn phí của phần lớn nền tảng hosting là gói <strong>phi thương
        mại</strong>. Không phải giới hạn kỹ thuật — là điều khoản sử dụng. Prototype
        thì hoàn toàn được. Nhưng ngay khi có traffic trả tiền thật chạy qua nó, bạn
        đã ở ngoài điều khoản, dù chưa vượt hạn mức nào.
      </p>

      <p>
        Mức trả tiền đầu tiên thường khoảng 20 $/tháng. Điểm đáng nói: bạn lên gói đó
        không phải vì hết hạn mức, mà vì bắt đầu kiếm tiền. Với một hệ thống
        affiliate, ngưỡng đó thường đến <em>trước</em> mọi giới hạn kỹ thuật ở trên
        rất lâu — nên hãy tính nó vào chi phí từ đầu thay vì coi là chuyện của sau
        này.
      </p>
    </>
  ),
};
