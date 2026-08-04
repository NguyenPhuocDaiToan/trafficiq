import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "giu-giay-to-quan-trong-trong-nha",
  title: "Giữ giấy tờ quan trọng trong nhà: một hộp, một bản chụp, một danh sách",
  description:
    "Phần lớn nhà không thiếu chỗ cất giấy tờ — thiếu cách biết đang thiếu giấy gì. Cách dựng một hệ thống ba lớp làm một lần, cập nhật vài phút mỗi năm.",
  category: "doi-song",
  publishedAt: "2026-06-22",
  authorId: "toan",
  readingMinutes: 6,
  cover: {
    src: "/images/blog/giu-giay-to-quan-trong-trong-nha.webp",
    alt: "Các bìa hồ sơ và tệp tài liệu quan trọng được gắn nhãn xếp ngăn nắp trên kệ",
  },
  tags: ["giấy tờ", "sắp xếp", "sao lưu", "việc nhà"],
  body: () => (
    <>
      <p>
        Vấn đề thường không phải &ldquo;giấy tờ để đâu&rdquo; — hầu như nhà nào cũng có
        một ngăn kéo hoặc một hộp cho việc đó. Vấn đề là <strong>không biết đang có gì
        trong đó</strong>, nên tới lúc cần một tờ cụ thể (làm hộ chiếu, vay ngân hàng,
        bảo hiểm), người ta lục cả ngăn kéo mà không chắc đã tìm hết.
      </p>

      <h2>Ba lớp, làm một lần trong một buổi tối</h2>

      <h3>Lớp 1 — Một hộp vật lý, có mục lục dán ngoài</h3>

      <p>
        Không cần hộp chuyên dụng — một hộp nhựa có nắp là đủ, miễn là chống được ẩm.
        Điều quan trọng hơn cái hộp là <strong>tờ mục lục dán ở mặt trong nắp</strong>:
        liệt kê tên từng loại giấy đang có trong hộp. Khi thêm hay bỏ giấy, cập nhật
        luôn tờ mục lục — việc này mất mười giây và là thứ khiến cả hệ thống còn dùng
        được sau nhiều năm.
      </p>

      <p>Nhóm giấy theo bốn ngăn nhỏ trong hộp, dùng phong bì hoặc kẹp giấy phân chia:</p>

      <ul>
        <li>Giấy tuỳ thân: giấy khai sinh, hộ khẩu, giấy đăng ký kết hôn.</li>
        <li>Giấy tài sản: sổ đỏ/sổ hồng, hợp đồng mua bán, giấy tờ xe.</li>
        <li>Hợp đồng bảo hiểm và giấy tờ ngân hàng.</li>
        <li>Bằng cấp, chứng chỉ.</li>
      </ul>

      <h3>Lớp 2 — Một bản chụp số hoá, để ở nơi khác vị trí vật lý</h3>

      <p>
        Hộp giấy giải quyết được việc mất do lộn xộn, nhưng không giải quyết được việc
        mất do cháy, ngập hoặc mất trộm — vì tất cả bản gốc đều nằm một chỗ. Chụp lại
        từng tờ bằng điện thoại (đủ nét để đọc được số, không cần máy scan chuyên
        dụng), rồi lưu bản chụp ở một nơi <strong>tách biệt vật lý</strong> với hộp
        giấy: một dịch vụ lưu trữ trên mạng, hoặc một thẻ nhớ gửi ở nhà người thân.
      </p>

      <Callout title="Đặt tên file theo thứ tìm, không theo ngày chụp">
        Đặt tên kiểu <code>ho-chieu-nguyen-van-a.jpg</code>, không phải{" "}
        <code>IMG_2847.jpg</code>. Lúc cần, bạn tìm theo tên giấy tờ, không tìm theo
        ngày mình chụp nó.
      </Callout>

      <h3>Lớp 3 — Một danh sách &ldquo;ai cần biết gì&rdquo; cho người thân</h3>

      <p>
        Đây là lớp thường bị bỏ qua nhất vì nó không phải giấy tờ của bạn dùng hằng
        ngày, mà là thứ người khác cần dùng khi bạn không có mặt để chỉ. Một trang
        giấy, để trong hộp, ghi: hộp giấy tờ ở đâu, bản chụp số hoá lưu ở đâu và ai có
        quyền truy cập, và số điện thoại của người/đơn vị cần liên hệ khi có việc gấp
        (bảo hiểm, ngân hàng, luật sư nếu có).
      </p>

      <p>
        Không cần ghi số tài khoản hay mật khẩu vào trang này — chỉ cần ghi{" "}
        <em>chỗ tìm thấy chúng</em>. Trang giấy này giá trị nhất đúng vào lúc bạn không
        thể tự trả lời, nên nó phải đơn giản tới mức người chưa từng thấy hộp này cũng
        hiểu ngay.
      </p>

      <h2>Duy trì: vài phút mỗi năm, không phải mỗi tháng</h2>

      <p>
        Chọn một ngày cố định mỗi năm (sinh nhật, đầu năm dương lịch) để làm ba việc:
        kiểm giấy nào sắp hết hạn (căn cước, hộ chiếu, bảo hiểm), thêm giấy mới phát
        sinh trong năm vào cả hộp và bản chụp, và đọc lại tờ mục lục xem còn đúng
        không. Ba việc này gộp lại khoảng mười lăm phút — ngắn hơn nhiều so với một lần
        đi lục cả ngăn kéo lúc đang cần gấp.
      </p>

      <p>
        Nói gọn: một hộp có mục lục, một bản chụp lưu tách biệt, và một trang chỉ đường
        cho người thân. Không hệ thống nào trong ba lớp này khó làm — cái khó là làm
        đủ ba lớp, vì thiếu một lớp thì hai lớp còn lại chỉ giải quyết được một loại
        rủi ro.
      </p>
    </>
  ),
};
