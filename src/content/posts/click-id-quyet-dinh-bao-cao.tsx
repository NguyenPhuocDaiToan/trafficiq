import { Callout } from "@/components/content";
import type { Post } from "@/content/types";

export const post: Post = {
  slug: "click-id-quyet-dinh-bao-cao",
  title: "Click ID: mảnh dữ liệu nhỏ nhất quyết định toàn bộ báo cáo",
  description:
    "Một chuỗi ký tự sinh ra trong 2ms nhưng nếu chọn sai kiểu, toàn bộ báo cáo phân bổ của bạn sai theo. Bốn tiêu chí và các lỗi thường gặp.",
  category: "do-luong",
  publishedAt: "2026-07-20",
  authorId: "bien-tap",
  readingMinutes: 6,
  tags: ["click id", "idempotency", "thiết kế dữ liệu"],
  body: () => (
    <>
      <p>
        Toàn bộ chuỗi phân bổ trong affiliate treo trên một giá trị duy nhất: click
        ID. Bạn sinh nó khi người dùng bấm link, gắn vào URL chuyển tới đối tác, và
        đợi nó quay về trong postback vài phút hoặc vài tuần sau. Nếu giá trị đó
        không đáng tin, mọi con số phía sau đều không đáng tin — và điều tệ là báo
        cáo vẫn trông rất bình thường.
      </p>

      <h2>Bốn tiêu chí, không thương lượng</h2>

      <h3>Không đoán được</h3>

      <p>
        Đừng dùng số tăng dần. Click ID xuất hiện trong URL, tức là nó nằm trong
        log của đối tác, trong lịch sử trình duyệt, trong header referrer. Nếu nó là{" "}
        <code>10432</code> thì bất kỳ ai cũng bắn thử được <code>10433</code> tới
        endpoint postback của bạn.
      </p>

      <p>
        Nó cũng tiết lộ khối lượng kinh doanh của bạn: hai click cách nhau một giờ
        cho ra hai số, hiệu của chúng là lượng traffic bạn chạy trong giờ đó. Đối
        thủ đọc được điều đó chỉ bằng cách bấm link của bạn hai lần.
      </p>

      <h3>Sinh ra ở phía bạn, không phải phía họ</h3>

      <p>
        Vài đối tác đề nghị họ tự sinh mã giao dịch và bạn dùng theo. Nghe tiện
        nhưng nó bỏ mất khả năng đối chiếu: khi số lệch, bạn không có tập hợp nào
        độc lập để so. Bạn sinh ID, bạn giữ bản ghi của mình, họ giữ bản ghi của họ
        — hai tập hợp độc lập mới so được với nhau.
      </p>

      <h3>Duy nhất, và được cơ sở dữ liệu bảo đảm điều đó</h3>

      <p>
        &ldquo;Duy nhất vì tôi dùng bộ sinh ngẫu nhiên tốt&rdquo; là niềm tin, không
        phải bảo đảm. Đặt unique index. Chi phí gần như bằng 0 và nó biến một lỗi
        dữ liệu âm thầm thành một exception nhìn thấy được.
      </p>

      <pre>
        <code>{`await clickEvents.createIndex({ clickId: 1 }, { unique: true });
await conversions.createIndex({ clickId: 1 }, { unique: true });`}</code>
      </pre>

      <p>
        Dòng thứ hai quan trọng hơn dòng thứ nhất: nó chính là thứ làm cho postback
        idempotent. Không có nó, mỗi lần đối tác retry là một chuyển đổi nữa trong
        báo cáo của bạn.
      </p>

      <h3>Sống lâu hơn cửa sổ attribution</h3>

      <p>
        Click ID phải còn tra được vào ngày cuối cùng mà đối tác còn có thể báo
        chuyển đổi. Nếu họ ghi nhận trong 30 ngày mà bạn xóa dữ liệu click sau 7
        ngày, bạn đã tự tạo ra một vùng 23 ngày mà mọi chuyển đổi về đều không phân
        bổ được.
      </p>

      <Callout title="Cách rẻ để giữ phân bổ mà không giữ toàn bộ dữ liệu click">
        Bản ghi click đầy đủ khá nặng: user agent, referrer, thiết bị, vị trí. Nếu
        dung lượng là vấn đề, hãy để bản ghi đầy đủ tự xóa sớm, nhưng giữ riêng một
        bảng cực nhẹ chỉ gồm <code>clickId</code>, <code>campaignId</code> và mốc
        thời gian. Bảng đó nhỏ hơn vài chục lần nên giữ 90 ngày vẫn rẻ, và nó là
        thứ duy nhất bạn cần để phân bổ đúng chiến dịch.
      </Callout>

      <h2>UUID v4 là lựa chọn mặc định đúng</h2>

      <p>
        Đủ cả bốn tiêu chí, có sẵn trong thư viện chuẩn của mọi ngôn ngữ, và không
        cần tọa độ tập trung nào để sinh:
      </p>

      <pre>
        <code>{`import { randomUUID } from "node:crypto";
const clickId = randomUUID();   // "b3f1c2a4-7d8e-4f10-9a2b-5c6d7e8f9012"`}</code>
      </pre>

      <p>
        36 ký tự là hơi dài cho URL nhưng đổi lại bạn không phải tự viết bộ sinh.
        Nếu độ dài URL thật sự là vấn đề, base62 của 16 byte ngẫu nhiên cho khoảng
        22 ký tự với cùng độ an toàn. Đừng cắt ngắn UUID để cho gọn — mỗi ký tự bỏ
        đi là giảm không gian giá trị theo cấp số nhân.
      </p>

      <h2>Bốn lỗi hay gặp</h2>

      <h3>Sinh click ID ở phía trình duyệt</h3>

      <p>
        Nếu JavaScript trên trang sinh ID rồi mới gửi lên, bạn mất mọi click từ
        người dùng chặn script, và mất luôn khả năng biết có bao nhiêu người bị mất.
        Sinh ở phía server, trong đúng request xử lý chuyển hướng.
      </p>

      <h3>Dùng lại một ID cho nhiều click</h3>

      <p>
        Một người bấm cùng link ba lần là ba click, ba ID. Dùng lại ID (ví dụ hash
        từ IP cộng chiến dịch) sẽ làm unique index chặn ngay click thứ hai, và bạn
        mất dữ liệu ngay tại chỗ.
      </p>

      <h3>Ghi click ID rồi mới chuyển hướng</h3>

      <p>
        Chờ ghi xong DB rồi mới trả lệnh chuyển hướng là cộng thẳng độ trễ của DB
        vào thời gian chờ của người dùng. Trả chuyển hướng trước, ghi sau — người
        dùng đã sang trang đích trong lúc bản ghi được lưu.
      </p>

      <p>
        Đổi lại, việc ghi có thể fail sau khi người dùng đã đi. Đó là đánh đổi đúng:
        mất một bản ghi click thì mất một dòng trong báo cáo, còn để người dùng chờ
        thêm 300ms thì mất chính lượt chuyển đổi đó.
      </p>

      <h3>Đưa click ID vào một tham số mà đối tác không trả lại</h3>

      <p>
        Mỗi đối tác có tên tham số riêng: <code>subid</code>, <code>aff_sub</code>,{" "}
        <code>s1</code>, <code>clickid</code>. Chọn sai tham số thì họ nhận được
        nhưng không gửi lại, và bạn có click mà không bao giờ có chuyển đổi. Luôn
        chạy thử một chuyển đổi thật trước khi mở traffic — và kiểm rằng đúng giá
        trị bạn gửi đi đã quay về.
      </p>

      <Callout title="Kiểm trong 5 phút, trước khi tiêu đồng đầu tiên">
        Bấm chính link của bạn. Lấy click ID vừa sinh trong DB. Gọi tay endpoint
        postback với đúng ID đó. Mở dashboard: chuyển đổi phải hiện ra, đúng chiến
        dịch, đúng nguồn. Làm xong bước này rồi hãy chạy quảng cáo.
      </Callout>
    </>
  ),
};
