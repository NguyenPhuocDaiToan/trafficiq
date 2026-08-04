import { Callout, CriteriaTable } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "mua-do-cu-hay-do-moi",
  title: "Mua đồ cũ hay đồ mới: một bảng tính để tự quyết trong mười phút",
  description:
    "Không phải món nào mua cũ cũng lời. Cách chia đồ thành ba nhóm theo chi phí hỏng, và bốn câu hỏi trả lời được trước khi chuyển tiền.",
  category: "tai-chinh",
  publishedAt: "2026-07-20",
  authorId: "toan",
  readingMinutes: 7,
  cover: {
    src: "/images/blog/mua-do-cu-hay-do-moi.webp",
    alt: "Món đồ trang trí phong cách vintage và hiện đại đặt cạnh nhau trong căn phòng ngập nắng",
  },
  tags: ["chi tiêu", "đồ cũ", "mua sắm", "tiết kiệm"],
  body: () => (
    <>
      <p>
        Lời khuyên &ldquo;mua đồ cũ cho tiết kiệm&rdquo; đúng một nửa. Có món mua cũ
        tiết kiệm được phần lớn tiền mà gần như không thêm rủi ro; có món mua cũ là mua
        luôn cả một hoá đơn sửa chưa biết trước. Khác biệt không nằm ở giá, mà ở{" "}
        <strong>chuyện gì xảy ra khi nó hỏng</strong>.
      </p>

      <h2>Chia đồ thành ba nhóm trước đã</h2>

      <CriteriaTable
        head={["Nhóm", "Đặc điểm", "Ví dụ", "Mua cũ?"]}
        rows={[
          [
            "Hỏng thì thấy ngay",
            "Kiểm tra được đủ trong mười phút, ít bộ phận ẩn",
            "Bàn ghế gỗ, kệ sắt, nồi gang, dụng cụ cầm tay",
            "Nên — chênh lệch giá lớn, rủi ro nhỏ",
          ],
          [
            "Hỏng dần, khó thấy",
            "Có bộ phận tiêu hao mà mắt không kiểm được",
            "Điện thoại, laptop, máy giặt, xe",
            "Được, nhưng phải kiểm đúng chỗ và trừ tiền tiêu hao",
          ],
          [
            "Hỏng thì tốn hơn cả món đồ",
            "Sửa đắt, hoặc rủi ro không nằm ở tiền",
            "Đồ có pin phồng, thiết bị điện không rõ nguồn gốc, mũ bảo hiểm",
            "Không — khoản tiết kiệm không bù được",
          ],
        ]}
      />

      <p>
        Nhóm thứ ba đáng nói thêm một câu, vì người ta hay xếp sai vào đó. Mũ bảo hiểm
        cũ nhìn còn nguyên vẫn có thể đã chịu một cú va mà lớp xốp bên trong đã xẹp —
        và đó là thứ duy nhất trong cái mũ có tác dụng. Đồ mà chức năng chính là{" "}
        <em>bảo vệ</em> thì không nên mua cũ, bất kể trông thế nào.
      </p>

      <h2>Bảng tính: bốn con số, một phép trừ</h2>

      <p>
        Đây là cách quy mọi món về cùng một đơn vị để so được. Lấy giấy ra, viết bốn số:
      </p>

      <ol>
        <li>
          <strong>Giá món cũ</strong> người ta đang bán.
        </li>
        <li>
          <strong>Chi phí phục hồi ngay.</strong> Những thứ chắc chắn phải thay để món
          dùng được như bình thường: pin, lốp, dây sạc, vệ sinh, thay dầu. Đây là khoản
          bị bỏ qua nhiều nhất, và nó thường là khoản làm hỏng cả phép tính.
        </li>
        <li>
          <strong>Giá món mới</strong> cùng loại, cùng cỡ — lấy giá thật đang bán, không
          lấy giá niêm yết lúc ra mắt.
        </li>
        <li>
          <strong>Số năm bạn định dùng.</strong> Ước lượng thật, không ước lượng lạc quan.
        </li>
      </ol>

      <p>
        Rồi tính <strong>chi phí mỗi năm</strong> cho cả hai phương án: (giá + chi phí
        phục hồi) chia cho số năm dùng được. Món cũ thường có số năm còn lại ít hơn, nên
        phép chia này mới là chỗ so sánh công bằng — chứ không phải so hai con số giá.
      </p>

      <Callout title="Ngưỡng thực dụng">
        Nếu chi phí mỗi năm của món cũ không thấp hơn món mới ít nhất khoảng một phần
        ba, hãy mua mới. Phần chênh lệch dưới mức đó không bù được cho ba thứ bạn mất
        khi mua cũ: không bảo hành, không đổi trả, và thời gian bạn bỏ ra để đi xem hàng.
      </Callout>

      <h2>Bốn câu hỏi phải trả lời trước khi chuyển tiền</h2>

      <h3>1. Món này có bộ phận tiêu hao nào, và nó còn bao nhiêu?</h3>

      <p>
        Gần như mọi món đồ có tuổi đều có một bộ phận mòn trước: pin, lốp, gioăng, lớp
        chống dính, bộ lọc. Tìm ra bộ phận đó, hỏi giá thay mới, rồi cộng vào giá mua.
        Nếu người bán không cho kiểm bộ phận đó, coi như nó đã hết.
      </p>

      <h3>2. Còn phụ tùng thay thế không?</h3>

      <p>
        Món đồ tốt mà không còn phụ tùng thì lần hỏng đầu tiên là lần cuối. Cách kiểm
        nhanh: tìm tên bộ phận thay thế của đúng model đó và xem có ai bán không. Nếu
        không tìm được gì, đó là món dùng-tới-khi-hỏng, và số năm ở bước 4 phải hạ xuống.
      </p>

      <h3>3. Vì sao người ta bán?</h3>

      <p>
        Không phải để đánh giá người bán, mà để biết mình đang mua gì. Lý do rõ ràng và
        kiểm được (chuyển nhà, đổi cỡ lớn hơn, đổi sang loại khác) thì bình thường. Lý
        do mơ hồ kèm giá thấp bất thường thì thường có một chi tiết chưa nói.
      </p>

      <h3>4. Nếu về nhà mới phát hiện vấn đề, mình mất bao nhiêu?</h3>

      <p>
        Đây là câu quyết định. Với cái kệ sắt thì câu trả lời là &ldquo;một buổi
        chiều&rdquo;. Với chiếc máy giặt thì có thể là toàn bộ số tiền cộng chi phí vận
        chuyển hai chiều. Con số đó chính là rủi ro bạn đang trả để lấy khoản tiết kiệm
        — và nó phải nhỏ hơn khoản tiết kiệm.
      </p>

      <h2>Vài chỗ mua cũ thường lời rõ</h2>

      <ul>
        <li>
          <strong>Đồ gỗ đặc và đồ sắt.</strong> Chúng già đi chứ ít hỏng, và kiểm bằng
          mắt với tay là đủ: lung lay, nứt, mối, gỉ.
        </li>
        <li>
          <strong>Nồi gang, chảo gang.</strong> Loại này không có gì để hỏng theo nghĩa
          thông thường; lớp chống dính tự nhiên còn dùng lâu hơn đồ mới rẻ.
        </li>
        <li>
          <strong>Sách, đồ chơi gỗ, dụng cụ cầm tay.</strong> Không bộ phận điện, không
          tiêu hao, giá cũ thấp hơn rõ.
        </li>
        <li>
          <strong>Màn hình máy tính.</strong> Ít bộ phận chuyển động, và lỗi điểm ảnh thì
          kiểm được ngay tại chỗ bằng một ảnh nền một màu.
        </li>
      </ul>

      <p>
        Nói gọn: đừng hỏi &ldquo;cũ có rẻ hơn không&rdquo;, hỏi{" "}
        <strong>&ldquo;mỗi năm dùng tốn bao nhiêu, và nếu hỏng thì mình mất
        gì&rdquo;</strong>. Hai câu đó trả lời được trong mười phút và nó loại gần hết
        các vụ mua hớ.
      </p>
    </>
  ),
};
