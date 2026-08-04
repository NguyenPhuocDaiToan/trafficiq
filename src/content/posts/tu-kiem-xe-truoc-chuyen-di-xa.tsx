import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "tu-kiem-xe-truoc-chuyen-di-xa",
  title: "Tự kiểm xe máy trước chuyến đi xa, không cần mang ra tiệm",
  description:
    "Năm điểm gây hỏng giữa đường nhiều nhất đều tự kiểm được trong mười lăm phút bằng mắt và tay. Cách kiểm từng điểm, và khi nào bắt buộc phải ra tiệm.",
  category: "di-chuyen",
  publishedAt: "2026-07-13",
  authorId: "toan",
  readingMinutes: 7,
  cover: {
    src: "/images/blog/tu-kiem-xe-truoc-chuyen-di-xa.webp",
    alt: "Kiểm tra áp suất lốp xe ô tô bằng đồng hồ đo trước chuyến đi xa",
  },
  tags: ["xe máy", "bảo dưỡng", "an toàn", "tự kiểm"],
  body: () => (
    <>
      <p>
        Phần lớn sự cố xe máy giữa đường không phải lỗi hiếm — chúng là những dấu hiệu
        đã có từ trước mà không ai để ý, vì để ý cần nhìn đúng chỗ chứ không cần đồ
        nghề. Năm điểm dưới đây kiểm hết trong khoảng mười lăm phút, ngay trước sân nhà.
      </p>

      <h2>1. Lốp: áp suất và độ mòn</h2>

      <p>
        Nhìn lốp căng hay non không đáng tin — mắt rất dễ đoán sai vài PSI, mà vài PSI
        đó ảnh hưởng thật tới độ bám và độ mòn. Cách kiểm đúng là dùng đồng hồ đo áp
        suất (bán rẻ ở tiệm phụ tùng) và so với số ghi trên khung xe, thường dán gần
        chân chống hoặc trong sách hướng dẫn.
      </p>

      <p>
        Độ mòn kiểm bằng mắt được: lốp có các rãnh gai, và ở đáy rãnh thường có một
        gờ nhỏ gọi là chỉ báo mòn. Gai mòn tới sát gờ đó là lúc phải đổi, không phải
        đợi lốp trơn hẳn — lốp mòn gần hết bám đường kém hẳn ngay cả khi nhìn còn gai.
      </p>

      <h2>2. Phanh: hành trình tay/chân phanh</h2>

      <p>
        Bóp phanh tay từ từ và cảm nhận điểm bắt đầu ăn. Nếu phải bóp gần hết cả tay
        mới thấy xe hãm lại, má phanh đã mòn nhiều hoặc dầu phanh (với phanh đĩa) đã
        thiếu. Với phanh chân cũng kiểm tương tự bằng cách đạp nhẹ và cảm nhận độ
        &ldquo;hụt&rdquo; trước khi ăn.
      </p>

      <Callout title="Dấu hiệu không được bỏ qua">
        Tiếng rít kim loại khi phanh, hoặc cảm giác phanh &ldquo;nhũn&rdquo; đột ngột so
        với hôm trước, là dấu hiệu phải ra tiệm ngay — không phải để dành tự kiểm tiếp.
        Đây là bộ phận duy nhất trong bài này mà đoán sai có thể nguy hiểm.
      </Callout>

      <h2>3. Đèn và xi-nhan</h2>

      <p>
        Bật từng đèn — pha, cốt, xi-nhan hai bên, đèn hậu, đèn phanh — và đi vòng quanh
        xe để nhìn thực tế, đừng chỉ nhìn từ chỗ ngồi. Đèn phanh là chỗ hay bị bỏ quên
        nhất vì người lái không tự nhìn thấy nó sáng; nhờ người khác nhìn hộ hoặc lùi
        xe gần tường có phản chiếu.
      </p>

      <h2>4. Nhiên liệu và dầu</h2>

      <p>
        Với xe số hoặc xe tay ga, kiểm mức dầu nhớt qua vạch báo trên que đo hoặc mặt
        kính nhỏ cạnh máy — nằm giữa hai vạch min/max là ổn. Dầu đen hẳn không nhất
        thiết là dầu hỏng (dầu đổi màu do làm việc là bình thường), nhưng dầu có mùi
        khét hoặc lẫn cặn kim loại nhìn thấy được thì nên thay trước khi đi xa, không
        đợi tới lịch định kỳ.
      </p>

      <h2>5. Gương và ốc siết</h2>

      <p>
        Kiểm gương bằng cách lắc nhẹ — gương lung lay sẽ rung mờ ở tốc độ cao đúng lúc
        cần nhìn rõ nhất. Với ốc, không cần siết lại toàn xe; chỉ cần dùng tay lắc thử
        các điểm chịu lực và dễ quan sát: chân chống, giá đèo hàng, ốc yên. Lung lay
        rõ bằng tay thì cần siết lại hoặc mang ra tiệm, không nên tự siết nếu không có
        cờ lê đúng cỡ — siết ẩu dễ làm chờn ren hơn là để lỏng thêm một chút.
      </p>

      <h2>Khi nào phải ra tiệm, không tự kiểm nữa</h2>

      <ul>
        <li>Tiếng động lạ từ động cơ khi tăng tốc hoặc khi nổ máy nguội.</li>
        <li>Xe lệch hướng khi đi thẳng và thả tay lái (dấu hiệu về khung hoặc bánh).</li>
        <li>Rò dầu hoặc nhiên liệu nhìn thấy dưới xe khi đỗ qua đêm.</li>
        <li>Bất kỳ dấu hiệu ở mục phanh phía trên.</li>
      </ul>

      <p>
        Năm điểm tự kiểm phía trên xử lý được phần lớn nguyên nhân hỏng giữa đường vì
        chúng là những thứ mòn dần theo thời gian, không phải hỏng bất ngờ. Làm đủ năm
        điểm trước mỗi chuyến đi xa mất khoảng mười lăm phút — ngắn hơn rất nhiều so với
        thời gian đứng chờ cứu hộ giữa đường.
      </p>
    </>
  ),
};
