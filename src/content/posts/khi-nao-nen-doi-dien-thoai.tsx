import Link from "next/link";
import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "khi-nao-nen-doi-dien-thoai",
  title: "Khi nào nên đổi điện thoại, và khi nào chỉ cần thay pin",
  description:
    "Ba dấu hiệu thật cho biết máy hết đời, ba dấu hiệu giả khiến người ta đổi máy sớm hơn cần thiết, và cách tự kiểm trong mười phút.",
  category: "cong-nghe",
  publishedAt: "2026-07-30",
  updatedAt: "2026-08-05",
  authorId: "toan",
  readingMinutes: 8,
  featured: true,
  cover: {
    src: "/images/blog/khi-nao-nen-doi-dien-thoai.webp",
    alt: "Điện thoại thông minh hiện đại trên mặt bàn tối giản với ánh sáng tinh tế",
  },
  tags: ["điện thoại", "pin", "cập nhật bảo mật", "mua sắm"],
  body: () => (
    <>
      <p>
        Cảm giác &ldquo;máy này chậm rồi&rdquo; hầu như không bao giờ đến từ phần
        cứng. Nó đến từ một mớ thứ tích lại: pin chai nên hệ điều hành tự giảm hiệu
        năng, bộ nhớ gần đầy nên máy không còn chỗ ghi tạm, và vài chục ứng dụng đang
        chạy nền mà bạn không mở tới. Ba thứ đó đều sửa được, và đều rẻ hơn một chiếc
        máy mới rất nhiều.
      </p>

      <p>
        Bài này chia làm hai phần rõ ràng: dấu hiệu nào <strong>thật sự</strong> nghĩa
        là nên đổi máy, và dấu hiệu nào chỉ là cảm giác. Mỗi mục đều kèm cách tự kiểm
        trên máy của bạn, không cần đem ra tiệm.
      </p>

      <h2>Ba dấu hiệu thật</h2>

      <h3>1. Máy không còn nhận bản cập nhật bảo mật</h3>

      <p>
        Đây là dấu hiệu duy nhất mang tính &ldquo;hết hạn&rdquo; theo nghĩa cứng. Khi
        nhà sản xuất dừng phát hành bản vá, mọi lỗ hổng được công bố sau đó sẽ ở lại
        trên máy bạn vĩnh viễn. Với chiếc thiết bị đang giữ ứng dụng ngân hàng, email
        và ảnh gia đình, đó không phải bất tiện — đó là rủi ro.
      </p>

      <p>Cách kiểm:</p>

      <ul>
        <li>
          <strong>iPhone:</strong> Cài đặt → Cài đặt chung → Cập nhật phần mềm. Nếu
          máy báo đã ở bản mới nhất nhưng số phiên bản thấp hơn hẳn bản iOS đang phát
          hành, tức là máy đã ra khỏi vòng hỗ trợ.
        </li>
        <li>
          <strong>Android:</strong> Cài đặt → Bảo mật → Bản cập nhật bảo mật. Ở đây có
          một ngày cụ thể. Nếu ngày đó cách hôm nay hơn một năm, máy đã bị bỏ lại.
        </li>
      </ul>

      <p>
        Hãy phân biệt hai thứ: <em>không lên được phiên bản hệ điều hành mới</em> là
        chuyện bình thường và chấp nhận được;{" "}
        <em>không còn nhận bản vá bảo mật</em> mới là lúc nên tính chuyện đổi.
      </p>

      <h3>2. Pin đã tụt sâu và bạn đã thay một lần</h3>

      <p>
        Pin lithium mất dần dung lượng theo số chu kỳ sạc — đó là hoá học, không phải
        lỗi. Điểm quan trọng: pin là <strong>bộ phận thay được</strong>, và thay pin
        rẻ hơn đổi máy nhiều lần. Một chiếc máy ba năm tuổi mà pin còn dưới 80% thường
        chỉ cần một viên pin mới là dùng tiếp được hai năm.
      </p>

      <p>Cách kiểm dung lượng còn lại:</p>

      <ul>
        <li>
          <strong>iPhone:</strong> Cài đặt → Pin → Tình trạng pin &amp; sạc → &ldquo;Dung
          lượng tối đa&rdquo;.
        </li>
        <li>
          <strong>Android:</strong> tuỳ hãng, thường ở Cài đặt → Pin → Thông tin pin,
          hoặc trong ứng dụng chẩn đoán của hãng. Nếu máy không hiện số, cứ lấy mốc
          thực dụng: máy không trụ nổi một ngày làm việc bình thường nữa.
        </li>
      </ul>

      <p>
        Nếu pin đã thay một lần rồi mà máy vẫn tụt nhanh, lúc này khả năng vấn đề nằm
        ở chỗ khác (bảng mạch quản lý sạc, hoặc phần mềm đã quá nặng cho chip cũ) — và
        đó mới là lúc tiền bỏ vào máy mới đáng hơn tiền sửa.
      </p>

      <h3>3. Bộ nhớ đầy và không giải phóng được nữa</h3>

      <p>
        Khi dung lượng trống còn dưới khoảng một phần mười, hệ điều hành hết chỗ ghi
        tạm và mọi thao tác đều chậm lại — kể cả mở bàn phím. Nhưng &ldquo;đầy&rdquo;
        có hai loại rất khác nhau:
      </p>

      <ul>
        <li>
          <strong>Đầy vì rác:</strong> cache ứng dụng, video đã tải trong app nhắn tin,
          ảnh trùng. Loại này dọn là xong, không cần đổi máy.
        </li>
        <li>
          <strong>Đầy vì dữ liệu bạn thật sự cần:</strong> đã chuyển ảnh sang chỗ khác,
          đã xoá app không dùng, mà vẫn không còn chỗ. Đây là giới hạn phần cứng, và
          bộ nhớ trên điện thoại thì không nâng được.
        </li>
      </ul>

      <p>
        Chỉ trường hợp thứ hai là lý do đổi máy. Và nó cũng cho bạn thông tin để chọn
        máy tiếp theo: đừng lấy đúng mức dung lượng bạn đang dùng, lấy gấp đôi.
      </p>

      <Callout title="Thứ tự làm trước khi quyết định">
        Dọn bộ nhớ → khởi động lại → cập nhật hệ điều hành → xem lại tình trạng pin.
        Bốn bước này mất khoảng nửa giờ và giải quyết được phần lớn trường hợp
        &ldquo;máy chậm&rdquo;. Chỉ khi làm hết mà vẫn chậm thì mới đi xem máy mới.
      </Callout>

      <h2>Ba dấu hiệu giả</h2>

      <h3>&ldquo;Máy chậm hơn hồi mới mua&rdquo;</h3>

      <p>
        Đúng là chậm hơn, nhưng thường không phải vì chip yếu đi — chip không yếu đi.
        Ba nguyên nhân phổ biến hơn: pin chai làm hệ thống chủ động giảm xung để máy
        không sập, bộ nhớ gần đầy, và các ứng dụng đã nặng lên qua nhiều bản cập nhật
        trong khi máy vẫn thế.
      </p>

      <p>
        Cách phân biệt rẻ nhất: khởi động lại máy rồi dùng thử một ngày mà không mở
        các ứng dụng nặng nhất. Nếu máy mượt lại, vấn đề là phần mềm chứ không phải
        phần cứng.
      </p>

      <h3>&ldquo;Model mới vừa ra&rdquo;</h3>

      <p>
        Chu kỳ ra máy mới là kế hoạch kinh doanh của nhà sản xuất, không phải mốc hỏng
        của máy bạn. Khác biệt giữa hai đời liền nhau hầu như luôn nhỏ hơn khác biệt
        giữa cách một chiếc máy tụt pin và một chiếc máy pin còn tốt.
      </p>

      <p>
        Một phép thử thẳng thắn: viết ra <em>một</em> việc bạn đang không làm được với
        máy hiện tại. Nếu không viết ra được việc nào cụ thể, thứ bạn muốn là cảm giác
        máy mới — hoàn toàn hợp lý, nhưng nên gọi đúng tên để tự cân xem có đáng số
        tiền đó hay không.
      </p>

      <h3>&ldquo;Camera đã cũ&rdquo;</h3>

      <p>
        Phần lớn tiến bộ về ảnh trên điện thoại những năm qua nằm ở xử lý phần mềm, và
        phần mềm đó đi kèm bản cập nhật — nghĩa là máy còn được cập nhật thì còn được
        hưởng. Nếu ảnh của bạn không đẹp, hãy kiểm ba thứ trước khi kết luận do máy:
        ống kính có bị mờ mồ hôi tay và bụi túi hay không, có đang chụp ngược sáng
        không, và có bật lưới canh khung chưa.
      </p>

      <h2>Nếu đã quyết đổi: bốn việc làm trước khi bán máy cũ</h2>

      <ol>
        <li>
          <strong>Sao lưu, rồi kiểm tra bản sao lưu.</strong> Mở thử vài ảnh và một
          ghi chú từ bản sao lưu. Chưa mở được nghĩa là chưa có bản sao lưu — và nếu
          toàn bộ ảnh của bạn đang chỉ nằm trong một tài khoản đám mây thì đó vẫn chưa
          phải bản sao lưu, xem{" "}
          <Link href="/blog/sao-luu-du-lieu-quy-tac-3-2-1">quy tắc 3-2-1</Link>.
        </li>
        <li>
          <strong>Đăng xuất tài khoản khoá máy</strong> (tài khoản của hãng). Đây là
          bước bị quên nhiều nhất; bỏ qua nó thì người mua không dùng được máy và bạn
          sẽ phải liên lạc lại.
        </li>
        <li>
          <strong>Rút thẻ SIM và thẻ nhớ</strong> — kể cả khi bạn nhớ là đã rút.
        </li>
        <li>
          <strong>Xoá toàn bộ cài đặt và nội dung</strong> bằng chức năng khôi phục cài
          đặt gốc của máy, không phải xoá tay từng ứng dụng.
        </li>
      </ol>

      <p>
        Nếu bạn định mua lại một máy đã qua sử dụng thay vì máy mới, hai mục kiểm ở đầu
        bài này (cập nhật bảo mật và dung lượng pin) chính là hai câu quyết định — cách
        cân cả phép tính tiền thì ở bài{" "}
        <Link href="/blog/mua-do-cu-hay-do-moi">mua đồ cũ hay đồ mới</Link>.
      </p>

      <p>
        Máy cũ còn cập nhật bảo mật thì đừng bỏ ngăn kéo: nó là máy dự phòng tốt, là
        máy phát nhạc trong bếp, hoặc là chiếc máy đầu tiên cho một người trong nhà —
        nhưng chỉ khi nó còn được vá lỗi. Máy đã ra khỏi vòng hỗ trợ thì đừng đưa cho
        ai dùng làm máy chính.
      </p>
    </>
  ),
};
