import Link from "next/link";
import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "dung-lai-thu-muc-may-tinh",
  /* 67 ký tự: `check:content` cảnh báo từ 72 trở lên vì phần sau đó bị cắt trên
     trang kết quả tìm kiếm. Bản trước dài 76 và mất đúng cụm "mỗi tháng" — cụm mang
     cả ý đối lập của tiêu đề. */
  title: "Dựng lại thư mục máy tính một lần cho xong, không sắp lại mỗi tháng",
  description:
    "Lý do phần lớn cách sắp xếp file thất bại sau vài tuần, và một cấu trúc bốn cấp dựa trên cách bạn tìm lại file, không dựa trên cách bạn tạo ra nó.",
  category: "lam-viec",
  publishedAt: "2026-07-06",
  updatedAt: "2026-08-05",
  authorId: "toan",
  readingMinutes: 8,
  cover: {
    src: "/images/blog/dung-lai-thu-muc-may-tinh.webp",
    alt: "Góc làm việc tối giản với máy tính hiển thị cấu trúc thư mục ngăn nắp",
  },
  tags: ["quản lý file", "năng suất", "máy tính", "sắp xếp"],
  body: () => (
    <>
      <p>
        Hầu hết cách sắp xếp thư mục thất bại vì một lý do giống nhau: chúng được dựng
        theo cách file được <em>tạo ra</em> (theo ngày, theo dự án đang làm), trong khi
        cái bạn cần lúc tìm lại là cách file được <em>dùng tới</em>. Hai thứ đó thường
        không trùng nhau, và đó là lý do một thư mục &ldquo;rất gọn&rdquo; lúc mới dựng
        vẫn biến thành đống hỗn độn sau ba tháng.
      </p>

      <h2>Bốn cấp, không hơn</h2>

      <p>
        Cấu trúc dưới đây cố định ở bốn cấp. Không phải vì bốn là số đẹp, mà vì sâu hơn
        bốn cấp thì việc điều hướng tốn nhiều cú click hơn việc gõ tìm kiếm — và khi đó
        cấu trúc thư mục hết còn giá trị.
      </p>

      <ol>
        <li>
          <strong>Cấp 1 — Vai trò lớn.</strong> Ba đến năm thư mục cố định, gần như
          không đổi qua nhiều năm: <em>Công việc</em>, <em>Cá nhân</em>,{" "}
          <em>Giấy tờ</em>, <em>Lưu trữ</em>. Đừng tạo thư mục theo tên dự án ở cấp
          này — dự án kết thúc thì cấp 1 phải còn nguyên. (Thư mục{" "}
          <em>Giấy tờ</em> ở đây là chỗ để bản chụp của{" "}
          <Link href="/blog/giu-giay-to-quan-trong-trong-nha">
            hộp giấy tờ trong nhà
          </Link>
          .)
        </li>
        <li>
          <strong>Cấp 2 — Nhóm việc.</strong> Bên trong mỗi vai trò, chia theo mảng ổn
          định: trong <em>Công việc</em> có thể là tên các khách hàng hoặc các mảng
          trách nhiệm dài hạn, không phải tên từng task.
        </li>
        <li>
          <strong>Cấp 3 — Đơn vị công việc cụ thể.</strong> Đây mới là chỗ đặt tên theo
          dự án, theo năm, theo sự kiện — thứ có ngày bắt đầu và ngày kết thúc.
        </li>
        <li>
          <strong>Cấp 4 — File hoặc nhóm file nhỏ.</strong> Không tạo thêm cấp 5. Nếu
          cảm thấy cần thêm một cấp nữa, đó là dấu hiệu cấp 3 đang gộp hai việc khác
          nhau vào một thư mục.
        </li>
      </ol>

      <Callout title="Thư mục Lưu trữ không phải nơi vứt bỏ">
        Việc đã xong không nên bị xoá khỏi cấu trúc chính rồi quăng vào một thư mục
        &quot;Archive&quot; lộn xộn — làm vậy thì hai năm sau bạn lại phải lọc lại từ đầu.
        Chuyển nguyên cả cụm cấp 2/3 của việc đã xong vào <em>Lưu trữ</em>, giữ đúng
        cấu trúc cũ. Tìm lại thì vẫn theo đúng lối cũ trong đầu, chỉ đổi gốc.
      </Callout>

      <p>
        Một điều cần nói rõ để không ai yên tâm sai: <em>Lưu trữ</em> là chỗ để việc đã
        xong, <strong>không phải bản sao lưu</strong>. Nó nằm trên cùng cái ổ với mọi thứ
        khác, nên cùng hỏng, cùng bị mã hoá, cùng mất theo máy. Cấu trúc thư mục làm việc
        tìm lại dễ hơn; thứ chống mất dữ liệu là{" "}
        <Link href="/blog/sao-luu-du-lieu-quy-tac-3-2-1">
          ba bản sao lưu theo quy tắc 3-2-1
        </Link>
        .
      </p>

      <h2>Đặt tên file: một quy tắc, áp dụng mọi nơi</h2>

      <p>
        Cấu trúc thư mục tốt vẫn vô dụng nếu tên file không nói được gì khi nhìn trong
        danh sách phẳng (ví dụ trong kết quả tìm kiếm, hoặc khi ai đó gửi lại file qua
        chat). Quy tắc: <code>YYYY-MM-DD_ten-viec_phien-ban</code>.
      </p>

      <ul>
        <li>
          Ngày ở đầu để file tự sắp theo thời gian khi xem theo tên, không phải theo
          ngày sửa đổi của hệ điều hành — ngày sửa đổi thay đổi mỗi khi file được mở
          lại, ngày trong tên thì không.
        </li>
        <li>
          Bỏ khoảng trắng, dùng gạch ngang — tránh lỗi khi file được gửi qua các hệ
          thống khác nhau, một số hệ thống thay khoảng trắng bằng ký tự lạ.
        </li>
        <li>
          Đừng dùng <code>final</code>, <code>final2</code>,{" "}
          <code>final_thật</code>. Dùng số phiên bản tăng dần (
          <code>v1</code>, <code>v2</code>) hoặc tốt hơn, dùng tính năng lịch sử phiên
          bản của công cụ đang dùng nếu có, và chỉ giữ một bản trên đĩa.
        </li>
      </ul>

      <h2>Cách chuyển từ đống cũ sang, không mất một buổi cuối tuần</h2>

      <p>
        Đừng cố sắp xếp lại toàn bộ file cũ ngay lập tức — đó là lý do phần lớn người
        bỏ giữa đường. Cách làm được:
      </p>

      <ol>
        <li>
          Tạo cấu trúc bốn cấp mới, trống hoàn toàn.
        </li>
        <li>
          Toàn bộ dữ liệu cũ chuyển thẳng vào một thư mục{" "}
          <code>Chưa phân loại — cũ</code> nằm trong <em>Lưu trữ</em>. Không xoá, không
          xem lại từng file.
        </li>
        <li>
          Từ hôm nay, mọi file <strong>mới</strong> đi thẳng vào cấu trúc mới, theo quy
          tắc trên. Đây là bước quan trọng nhất: cấu trúc mới chỉ cần đúng cho việc từ
          giờ về sau, không cần đúng ngay cho quá khứ.
        </li>
        <li>
          Khi cần một file cũ, tìm nó trong thư mục &ldquo;cũ&rdquo; bằng công cụ tìm
          kiếm, rồi <em>khi đó</em> mới di chuyển nó vào đúng chỗ trong cấu trúc mới.
          Việc phân loại quá khứ diễn ra dần, theo đúng nhu cầu thật, không phải một
          lần dồn sức mà rồi bỏ giữa đường.
        </li>
      </ol>

      <p>
        Nói gọn: dựng thư mục theo cách bạn sẽ <em>tìm</em>, không theo cách file được
        tạo ra; giữ đúng bốn cấp; và đừng cố dọn sạch quá khứ ngay — chỉ cần từ hôm nay
        mọi file mới đi đúng chỗ, phần còn lại sẽ tự gọn theo thời gian.
      </p>
    </>
  ),
};
