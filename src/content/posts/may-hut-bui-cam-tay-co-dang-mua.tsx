import Link from "next/link";
import { Callout, CriteriaTable, MethodNote } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "may-hut-bui-cam-tay-co-dang-mua",
  title: "Máy hút bụi cầm tay: khi nào đáng mua, khi nào thành món đồ nằm góc",
  description:
    "Thứ quyết định máy có được dùng tiếp sau tháng đầu không phải lực hút, mà là chỗ cắm sạc và cách đổ rác. Bốn tiêu chí và cách tự thử ngay trong cửa hàng.",
  category: "nha-cua",
  publishedAt: "2026-07-27",
  updatedAt: "2026-08-05",
  authorId: "toan",
  readingMinutes: 8,
  kind: "review",
  cover: {
    src: "/images/blog/may-hut-bui-cam-tay-co-dang-mua.webp",
    alt: "Máy hút bụi cầm tay không dây hiện đại trong phòng khách thiết kế tối giản",
  },
  tags: ["gia dụng", "dọn nhà", "máy hút bụi", "mua sắm"],
  body: () => (
    <>
      <p>
        Máy hút bụi cầm tay là món đồ có tỉ lệ &ldquo;mua rồi bỏ&rdquo; cao bất thường.
        Không phải vì máy kém — phần lớn máy bán ra hút tốt hơn nhu cầu thật của một
        căn hộ. Nó bị bỏ vì những chuyện nhỏ: chỗ sạc bất tiện nên máy hết pin, đổ rác
        lích kích nên người ta lười, hoặc máy nặng hơn tưởng nên dọn xong tay mỏi.
      </p>

      <p>
        Bài này không xếp hạng model. Nó nói về bốn tiêu chí quyết định máy có được
        dùng đến lần thứ ba mươi hay không, và cách bạn tự thử từng tiêu chí đó.
      </p>

      <MethodNote>
        <p>
          Thông số nhà sản xuất công bố cho các nhóm máy phổ biến, cộng với các tiêu
          chí sử dụng có thể tự kiểm ngay tại cửa hàng. Tôi{" "}
          <strong>không</strong> dùng thử từng model, nên bài này so sánh theo{" "}
          <em>nhóm máy</em> và không cho điểm. Con số trong bài là mức thường gặp của
          nhóm, không phải cam kết của bất kỳ hãng nào — kiểm lại trên tờ thông số của
          đúng máy bạn đang nhắm.
        </p>
      </MethodNote>

      <h2>Trước hết: nhà bạn cần loại nào</h2>

      <CriteriaTable
        head={["Nhóm máy", "Dùng tốt cho", "Điểm yếu thường gặp"]}
        rows={[
          [
            "Cầm tay nhỏ, pin trong",
            "Ghế sofa, bàn ăn, trong xe, vụn bánh",
            "Thời lượng ngắn; không thay được pin",
          ],
          [
            "Cầm tay có cần nối",
            "Sàn căn hộ nhỏ, gầm giường",
            "Nặng đầu tay khi hút cao; giá cao hơn",
          ],
          [
            "Cắm điện trực tiếp",
            "Dọn định kỳ cả nhà, nhà có thú nuôi",
            "Vướng dây; không tiện dọn nhanh một chỗ",
          ],
        ]}
      />

      <p>
        Câu hỏi phân loại đơn giản: bạn định dọn{" "}
        <strong>một chỗ trong ba phút</strong>, hay <strong>cả nhà trong ba mươi
        phút</strong>? Máy cầm tay nhỏ làm rất tốt việc đầu và rất tệ việc sau. Người
        thất vọng với máy cầm tay hầu như luôn là người mua nó để làm việc thứ hai.
      </p>

      <h2>Bốn tiêu chí, xếp theo mức ảnh hưởng thật</h2>

      <h3>1. Chỗ sạc — quan trọng hơn thời lượng pin</h3>

      <p>
        Máy hết pin là máy không tồn tại. Và máy hết pin gần như luôn vì chỗ sạc nằm ở
        nơi bất tiện: trong hộp, dưới gầm tủ, hoặc cần một ổ điện mà chỗ đó không có.
      </p>

      <p>
        Nên trước khi xem thời lượng, hãy xác định <em>chỗ máy sẽ đứng</em> trong nhà
        bạn: gần ổ điện, không chắn đường đi, và với tay lấy được mà không phải cúi.
        Nếu máy có giá treo tường thì tốt, nhưng chỉ khi bạn thật sự sẽ khoan tường —
        nếu không thì cần loại đứng được một mình.
      </p>

      <h3>2. Cách đổ rác</h3>

      <p>
        Đây là việc bạn sẽ làm sau <em>mỗi</em> lần dọn. Ba câu để tự kiểm ngay tại cửa
        hàng, cầm máy trên tay:
      </p>

      <ul>
        <li>Mở khoang chứa bằng một tay được không, hay phải đặt máy xuống dùng hai tay?</li>
        <li>Bụi ra hết khi dốc xuống, hay phải thò tay vào gạt?</li>
        <li>Bộ lọc tháo ra rửa được không, và rửa xong bao lâu thì khô?</li>
      </ul>

      <p>
        Câu thứ ba có một cái bẫy: bộ lọc phải <strong>khô hoàn toàn</strong> mới được
        lắp lại, nếu không nó ẩm và sinh mùi — đúng cơ chế của{" "}
        <Link href="/blog/xu-ly-am-moc-trong-nha">mốc trên tường</Link>: bụi hữu cơ cộng
        độ ẩm giữ lâu. Máy chỉ có một bộ lọc thì trong lúc chờ
        khô, bạn không có máy để dùng. Đó là lý do nhiều người mua thêm một bộ lọc dự
        phòng — nên hỏi luôn giá bộ lọc rời khi mua máy.
      </p>

      <h3>3. Trọng lượng ở tay, không phải trọng lượng trên tờ thông số</h3>

      <p>
        Một máy 1,5 kg cầm sát người rất nhẹ, nhưng cùng máy đó gắn thêm cần nối và
        chĩa lên cao thì cảm giác khác hoàn toàn — vì trọng tâm ra xa tay. Cách thử tại
        chỗ: cầm máy đúng tư thế bạn sẽ dùng nhiều nhất (hút cao, hoặc hút gầm) và giữ
        nguyên <strong>ba mươi giây</strong>. Ba mươi giây là đủ để phát hiện máy nào
        sẽ làm bạn mỏi trước khi dọn xong phòng.
      </p>

      <h3>4. Tiếng ồn — chỉ thành vấn đề nếu bạn dọn buổi tối</h3>

      <p>
        Chỉ số ồn trên hộp ít giúp được vì cách đo không thống nhất giữa các hãng, và
        vì cảm nhận phụ thuộc âm sắc chứ không chỉ độ lớn. Điều đáng cân là hoàn cảnh
        của bạn: nhà có trẻ nhỏ ngủ sớm, hoặc chung cư vách mỏng, thì đây thành tiêu
        chí thật. Nếu bạn chỉ dọn cuối tuần ban ngày, đừng trả thêm tiền cho nó.
      </p>

      <Callout title="Ba con số nên hỏi trước khi trả tiền">
        Giá bộ lọc thay thế, giá cục pin thay thế (nếu thay được), và thời gian bảo
        hành cho pin — pin thường có thời gian bảo hành ngắn hơn máy. Ba con số này
        quyết định chi phí thật của máy sau hai năm, và không có con nào in trên
        biển giá. Cách cộng chúng lại thành{" "}
        <Link href="/blog/mua-do-cu-hay-do-moi">chi phí mỗi năm</Link> — con số duy nhất
        so được giữa hai món khác giá — ở bài về mua đồ cũ hay đồ mới.
      </Callout>

      <h2>Khi nào thì đừng mua</h2>

      <ul>
        <li>
          <strong>Nhà bạn chủ yếu là sàn trải thảm dày.</strong> Máy cầm tay hút thảm
          dày kém rõ, và đây là chỗ máy cắm điện có ưu thế thật.
        </li>
        <li>
          <strong>Bạn đã có máy hút bụi thường và thấy vấn đề chỉ là &ldquo;lười lấy
          ra&rdquo;.</strong> Vậy vấn đề là chỗ cất, không phải cái máy. Chuyển máy cũ
          ra chỗ dễ lấy trước, một tuần sau xem còn muốn mua nữa không.
        </li>
        <li>
          <strong>Bạn định dùng nó để hút nước hoặc bụi xây dựng.</strong> Máy dân dụng
          không làm việc đó; bụi mịn xi măng làm nghẹt bộ lọc rất nhanh và có loại máy
          hút chuyên cho việc này.
        </li>
      </ul>

      <p>
        Nói gọn: mua khi bạn cần dọn <em>nhanh, một chỗ, thường xuyên</em> — vụn dưới
        bàn ăn, lông thú trên sofa, sàn xe. Chọn theo chỗ sạc và cách đổ rác trước, lực
        hút sau. Và cân cả giá bộ lọc thay thế vào giá máy, vì đó là khoản bạn sẽ trả
        đi trả lại.
      </p>
    </>
  ),
};
