import Link from "next/link";
import { Callout, CriteriaTable, MethodNote } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "chon-noi-com-dien",
  title: "Chọn nồi cơm điện: những thông số thật sự ảnh hưởng tới nồi cơm",
  description:
    "Dung tích thật khác dung tích in trên hộp, và phần lớn chế độ nấu không dùng tới lần thứ hai. Bốn thứ nên cân, ba thứ nên bỏ qua.",
  category: "bep",
  publishedAt: "2026-07-24",
  updatedAt: "2026-08-05",
  authorId: "toan",
  readingMinutes: 8,
  kind: "review",
  cover: {
    src: "/images/blog/chon-noi-com-dien.webp",
    alt: "Nồi cơm điện hiện đại trên mặt bếp gỗ trong nhà bếp tối giản",
  },
  tags: ["nồi cơm điện", "đồ bếp", "mua sắm", "gia dụng"],
  body: () => (
    <>
      <p>
        Nồi cơm điện là món đồ bếp được dùng nhiều nhất trong phần lớn gia đình Việt,
        và cũng là món người ta chọn bằng ít thông tin nhất: xem giá, xem dung tích,
        xem có bao nhiêu chế độ nấu, xong. Trong ba thứ đó thì hai thứ gần như không
        ảnh hưởng tới nồi cơm bạn ăn.
      </p>

      <MethodNote>
        <p>
          Thông số nhà sản xuất công bố cho các nhóm nồi phổ biến, cách quy đổi dung
          tích, và các phép thử bạn tự làm được tại nhà hoặc tại cửa hàng. Tôi{" "}
          <strong>không</strong> nấu thử từng model để so sánh, nên bài này không cho
          điểm và không xếp hạng — nó nói cơ chế, để bạn tự đọc tờ thông số của nồi
          mình đang nhắm.
        </p>
      </MethodNote>

      <h2>Bốn thứ nên cân</h2>

      <h3>1. Dung tích — và cái bẫy quy đổi</h3>

      <p>
        Con số in trên hộp là <strong>thể tích lòng nồi</strong>, không phải lượng cơm
        nấu được. Đa số nồi cơm điện đều có vạch mức nước tối đa in sẵn trong lòng nồi
        — nấu vượt vạch đó là dấu hiệu rõ nhất cho biết đang nấu quá tải, dễ trào và
        cơm nhão ở trên, sát ở dưới. Cách chọn thực dụng là tính theo số bát cơm một
        bữa đông nhất của nhà bạn (nếu bạn đã{" "}
        <Link href="/blog/di-cho-mot-lan-cho-ca-tuan">lên khung bữa cho cả tuần</Link>{" "}
        thì con số đó có sẵn, khỏi phải ước), rồi lấy nồi có thể tích lớn hơn mức đó khoảng một
        nửa — con số &ldquo;một nửa&rdquo; là mức dư an toàn thường gặp, không phải
        quy tắc cố định cho mọi nồi; vạch mức nước trên chính nồi bạn mua luôn là mốc
        đáng tin hơn.
      </p>

      <p>
        Nồi quá lớn không &ldquo;an toàn hơn&rdquo; như nhiều người nghĩ: nấu lượng gạo
        ít trong nồi to thì lớp cơm quá mỏng, nhiệt phân bố kém và cơm khô mặt. Nồi
        đúng cỡ nấu ngon hơn nồi to.
      </p>

      <h3>2. Kiểu làm nóng</h3>

      <CriteriaTable
        head={["Kiểu", "Cách hoạt động", "Khác biệt bạn cảm được"]}
        rows={[
          [
            "Mâm nhiệt (cơ / điện tử)",
            "Một mâm nóng dưới đáy nồi",
            "Rẻ, bền, ít hỏng. Cơm dưới đáy dễ khác trên mặt.",
          ],
          [
            "Cao tần (từ trường)",
            "Sinh nhiệt trên toàn thành lòng nồi",
            "Cơm đều hơn, kiểm soát nhiệt tốt hơn. Giá cao hơn nhiều.",
          ],
        ]}
        caption="Chênh lệch rõ nhất khi nấu lượng lớn hoặc nấu gạo dẻo; với một bữa hai người thì khác biệt nhỏ hơn khoảng giá."
      />

      <p>
        Đây là tiêu chí duy nhất trong bài mà trả thêm tiền đổi lấy khác biệt cảm được.
        Nhưng nó chỉ đáng nếu nhà bạn nấu cơm hằng ngày và ăn cơm là chính. Nấu ba lần
        một tuần thì tiền đó nên để dành cho tiêu chí thứ ba.
      </p>

      <h3>3. Lòng nồi: độ dày và lớp chống dính</h3>

      <p>
        Lòng nồi là bộ phận bạn chạm vào mỗi ngày và cũng là bộ phận hỏng trước cả nồi.
        Hai thứ đáng xem:
      </p>

      <ul>
        <li>
          <strong>Độ dày.</strong> Lòng dày thường giữ nhiệt đều hơn và ít móp. Một
          cách cảm nhận nhanh nhưng chỉ mang tính tương đối, không phải phép đo chính
          xác: cầm lòng nồi lên, gõ nhẹ vào thành — tiếng đục, nặng tay thường ứng với
          thành dày hơn tiếng vang, nhẹ. Nếu tờ thông số có ghi độ dày bằng mm, hãy tin
          số đó hơn cảm giác gõ tay.
        </li>
        <li>
          <strong>Lớp chống dính.</strong> Mọi lớp chống dính đều mòn theo thời gian —
          nhanh hay chậm phụ thuộc bạn có dùng muỗng kim loại và cọ nhám hay không, hơn
          là phụ thuộc hãng. Vì vậy điều đáng hỏi không phải &ldquo;lớp này bền
          không&rdquo; mà <strong>&ldquo;bán lòng nồi rời không, giá bao nhiêu&rdquo;</strong>.
          Nồi bán lòng rời thì dùng được gấp đôi thời gian. Đây là cùng một câu hỏi phụ
          tùng quyết định{" "}
          <Link href="/blog/mua-do-cu-hay-do-moi">một món đồ dùng được bao lâu</Link>:
          hết phụ tùng thì lần hỏng đầu tiên là lần cuối.
        </li>
      </ul>

      <h3>4. Nắp và van hơi có tháo rửa được không</h3>

      <p>
        Đây là chi tiết nhỏ nhưng ảnh hưởng tới việc dùng lâu dài. Hơi nước mang theo
        tinh bột đọng lại ở nắp trong và van hơi; không rửa được thì sau vài tháng nó
        thành mùi. Kiểm bằng cách mở nắp và thử tháo tấm nắp trong ngay tại cửa hàng —
        nếu phải dùng dụng cụ thì coi như không tháo.
      </p>

      <h2>Ba thứ nên bỏ qua</h2>

      <ul>
        <li>
          <strong>Số lượng chế độ nấu.</strong> Phần lớn nhà dùng đúng hai chế độ: nấu
          cơm và hâm. Một nồi mười hai chế độ không nấu cơm ngon hơn nồi ba chế độ cùng
          kiểu làm nóng — nó chỉ nhiều nút hơn.
        </li>
        <li>
          <strong>Công suất tính bằng watt.</strong> Watt cao nghĩa là tốn điện hơn khi
          chạy, không nghĩa là cơm ngon hơn. Cơm ngon phụ thuộc phân bố nhiệt và chương
          trình nấu, không phụ thuộc con số này.
        </li>
        <li>
          <strong>Nồi kèm quá nhiều phụ kiện.</strong> Xửng hấp và muôi đặc biệt nghe
          hấp dẫn lúc mua; sau một tháng chúng nằm trong tủ. Nếu bạn thật sự hấp thường
          xuyên, một cái xửng rời mua riêng thường tốt hơn cái kèm theo.
        </li>
      </ul>

      <Callout title="Nếu cơm nhà bạn đang không ngon">
        Trước khi đổi nồi, thử ba việc: vo gạo nhẹ tay hơn (vo mạnh làm mất lớp ngoài
        hạt), giảm nước xuống một chút so với thói quen, và sau khi nồi báo chín thì để
        yên mười phút trước khi mở nắp. Rất nhiều trường hợp &ldquo;nồi kém&rdquo; là
        ba việc này, và cả ba đều miễn phí.
      </Callout>

      <h2>Cách tự kiểm nồi sau khi mua</h2>

      <ol>
        <li>
          <strong>Nấu một mẻ đúng lượng bạn thường nấu.</strong> Không nấu thử một lon
          gạo trong nồi lớn — nó không nói gì về cách nồi hoạt động khi dùng thật.
        </li>
        <li>
          <strong>Xem ba vị trí:</strong> cơm sát đáy, cơm giữa và cơm sát thành. Chênh
          lệch nhiều giữa ba chỗ là dấu hiệu phân bố nhiệt kém — và đây là lúc còn đổi
          được hàng.
        </li>
        <li>
          <strong>Để chế độ hâm bốn giờ rồi ăn thử.</strong> Đây là điểm khác biệt lớn
          nhất giữa nồi tốt và nồi kém mà không tờ thông số nào ghi: cơm hâm lâu bị khô
          mặt và vàng đáy tới mức nào.
        </li>
      </ol>

      <p>
        Nói gọn: chọn dung tích theo bữa đông nhất rồi cộng một nửa, ưu tiên nồi{" "}
        <strong>bán lòng nồi rời</strong>, kiểm nắp trong có tháo rửa được không, và chỉ
        trả thêm cho nồi cao tần nếu nhà bạn ăn cơm hằng ngày. Số chế độ nấu thì bỏ qua.
      </p>
    </>
  ),
};
