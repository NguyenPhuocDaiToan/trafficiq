import Link from "next/link";
import { Callout, CriteriaTable, MethodNote } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "chon-o-cung-di-dong",
  title: "Ổ cứng di động, SSD di động hay thẻ nhớ: chọn cái nào cho việc gì",
  description:
    "Ba loại thiết bị lưu trữ rời khác nhau ở độ bền khi rơi, tốc độ và giá mỗi GB. Cách chọn theo việc bạn định làm, kèm cách tự kiểm ổ trước khi tin nó.",
  category: "cong-nghe",
  publishedAt: "2026-08-01",
  authorId: "toan",
  readingMinutes: 9,
  kind: "review",
  cover: {
    src: "/images/blog/chon-o-cung-di-dong.webp",
    alt: "Ổ cứng di động SSD và HDD đặt cạnh laptop trên bàn làm việc",
  },
  tags: ["lưu trữ", "sao lưu", "ổ cứng", "SSD", "thẻ nhớ"],
  body: () => (
    <>
      <p>
        Ba loại thiết bị này nằm cùng một kệ trong cửa hàng và nhìn thì na ná nhau:
        đều cắm cáp vào máy, đều hiện ra một ổ đĩa. Nhưng bên trong chúng là ba công
        nghệ khác nhau, và mỗi loại hỏng theo một kiểu khác nhau. Chọn sai không làm
        bạn mất tiền ngay — nó làm bạn mất dữ liệu vài năm sau.
      </p>

      <MethodNote>
        <p>
          Thông số do nhà sản xuất công bố, mức giá tương đối giữa ba nhóm tại thời
          điểm viết, cộng với cách tự kiểm mà bạn làm được tại nhà. Tôi{" "}
          <strong>không</strong> dùng thử từng model, nên bài này so sánh theo{" "}
          <em>nhóm thiết bị</em> chứ không xếp hạng model cụ thể — tiêu chí thì đúng
          lâu, còn số liệu của một model thì cũ đi sau vài tháng.
        </p>
      </MethodNote>

      <h2>Khác nhau ở đâu, nói ngắn</h2>

      <CriteriaTable
        head={["Loại", "Bên trong", "Sợ nhất", "Việc phù hợp"]}
        rows={[
          [
            "Ổ cứng di động (HDD)",
            "Đĩa từ quay, đầu đọc cơ",
            "Rơi lúc đang chạy",
            "Sao lưu dung lượng lớn, để yên một chỗ",
          ],
          [
            "SSD di động",
            "Chip nhớ, không bộ phận chuyển động",
            "Nhiệt và nguồn điện bẩn",
            "Mang theo người, làm việc trực tiếp trên ổ",
          ],
          [
            "Thẻ nhớ",
            "Chip nhớ, vỏ nhựa mỏng",
            "Mất, gãy, tháo ra lúc đang ghi",
            "Trong máy ảnh, máy quay, thiết bị nhỏ",
          ],
        ]}
        caption="Cột “sợ nhất” là kiểu hỏng phổ biến nhất của mỗi loại, không phải kiểu duy nhất."
      />

      <h2>Ba câu hỏi quyết định, theo thứ tự</h2>

      <h3>1. Ổ này sẽ nằm yên hay đi theo bạn?</h3>

      <p>
        Đây là câu hỏi quan trọng nhất và cũng là câu người ta bỏ qua nhiều nhất. Ổ
        cứng cơ có một đĩa kim loại quay rất nhanh và một đầu đọc lơ lửng bên trên nó
        ở khoảng cách cực nhỏ. Rơi lúc đứng yên thì thường không sao; rơi{" "}
        <strong>lúc đang quay</strong> thì đầu đọc có thể chạm mặt đĩa và cào mất
        đúng phần dữ liệu ở đó.
      </p>

      <p>
        SSD không có bộ phận nào chuyển động, nên chuyện đó không tồn tại. Nếu ổ sẽ
        nằm trong balo cùng với chìa khoá và bình nước, đừng cân nhắc gì thêm — lấy
        SSD. Nếu ổ sẽ cắm sau máy tính ở nhà và mỗi tháng bật một lần để sao lưu, ổ
        cơ vẫn hoàn toàn hợp lý và rẻ hơn nhiều cho cùng dung lượng.
      </p>

      <h3>2. Bạn chỉ chép vào đó, hay còn làm việc trực tiếp trên đó?</h3>

      <p>
        Chép vào rồi để đấy thì tốc độ gần như không quan trọng: chênh lệch chỉ là bạn
        chờ mười phút hay hai phút, mỗi tháng một lần. Nhưng nếu bạn mở file trực tiếp
        từ ổ ngoài để dựng video, chỉnh ảnh nặng, hay chạy máy ảo, thì tốc độ đọc ngẫu
        nhiên là thứ quyết định trải nghiệm — và đây là chỗ ổ cơ thua rất xa, không
        phải thua một chút.
      </p>

      <Callout title="Một cái bẫy về cổng cắm">
        Ổ nhanh cắm vào cổng chậm thì thành ổ chậm. Trước khi mua ổ đắt, kiểm xem máy
        bạn có cổng gì: cùng một đầu cắm USB-C có thể là cổng chậm hay nhanh gấp nhiều
        lần, tuỳ máy. Xem tài liệu máy hoặc ký hiệu nhỏ cạnh cổng. Mua ổ nhanh hơn cổng
        của máy là mua phần tốc độ mà bạn không dùng tới.
      </Callout>

      <h3>3. Dung lượng bao nhiêu là đủ?</h3>

      <p>
        Cách tính thực dụng: lấy dung lượng dữ liệu bạn đang có{" "}
        <strong>nhân hai</strong>, rồi làm tròn lên mức bán sẵn gần nhất. Nhân hai
        không phải để phòng xa mơ hồ — nó có hai lý do cụ thể. Một, dữ liệu ảnh và
        video tăng đều mỗi năm mà không ai chủ động thêm. Hai, ổ nhớ dạng chip
        (SSD, thẻ nhớ) khi gần đầy thì chậm đi rõ, vì nó không còn chỗ trống để dồn
        dữ liệu.
      </p>

      <p>
        Và nhớ rằng con số in trên vỏ luôn lớn hơn dung lượng bạn thấy trong máy: nhà
        sản xuất tính 1 GB là một tỉ byte, còn hệ điều hành tính theo lũy thừa của hai.
        Đó là chênh lệch cách đếm, không phải ai gian.
      </p>

      <h2>Cách tự kiểm một ổ mới, trước khi tin nó</h2>

      <p>
        Ổ lưu trữ có một đặc điểm khó chịu: nó hỏng im lặng. Bạn chép dữ liệu vào, thấy
        báo xong, và chỉ phát hiện vấn đề đúng lúc cần lấy ra. Bốn bước dưới đây mất
        khoảng một buổi tối và đáng làm với mọi ổ mới:
      </p>

      <ol>
        <li>
          <strong>Chép đầy khoảng một nửa ổ bằng dữ liệu thật</strong> mà bạn còn bản
          gốc ở chỗ khác. Ổ có vấn đề thường lộ ra ở lần ghi lượng lớn đầu tiên, không
          phải lúc ghi một vài file nhỏ.
        </li>
        <li>
          <strong>Rút ổ ra, cắm lại, mở thử vài file</strong> ở đầu, giữa và cuối đợt
          chép. Mở được nội dung mới là ghi thành công — nhìn thấy tên file thì chưa.
        </li>
        <li>
          <strong>So sánh dung lượng đã dùng</strong> giữa nguồn và ổ mới. Lệch nhiều
          nghĩa là có file không chép được, và trình chép thường báo lỗi đó rất nhẹ.
        </li>
        <li>
          <strong>Nghe tiếng</strong> (chỉ với ổ cơ). Tiếng quay đều là bình thường;
          tiếng lách cách lặp lại theo nhịp thì đem đổi ngay trong thời gian bảo hành,
          đừng chờ xem nó có tự hết không.
        </li>
      </ol>

      <h2>Một điều quan trọng hơn cả việc chọn loại nào</h2>

      <p>
        Không loại nào trong ba loại trên là bản sao lưu, nếu nó là bản duy nhất. Cả ba
        đều hỏng được, và cả ba đều hỏng đúng lúc bạn cần chúng nhất. Nếu bạn đang mua
        ổ để giữ ảnh gia đình hay hồ sơ công việc, hãy đọc kèm{" "}
        {/* `Link`, không phải `<a>`: link nội bộ đi qua router thì không tải lại cả
            trang. `.prose a` trong globals.css style cả hai như nhau. */}
        <Link href="/blog/sao-luu-du-lieu-quy-tac-3-2-1">
          quy tắc 3-2-1 cho người không làm IT
        </Link>{" "}
        — một cái ổ tốt mà chỉ có một bản thì vẫn là một điểm hỏng duy nhất.
      </p>

      <p>
        Nói gọn lại: <strong>mang theo người thì SSD</strong>, dung lượng lớn để yên
        một chỗ thì ổ cơ, và thẻ nhớ thì chỉ nên là chỗ dữ liệu{" "}
        <em>đi qua</em> — chụp xong thì chuyển ra, đừng dùng thẻ làm nơi lưu lâu dài.
      </p>
    </>
  ),
};
