/**
 * Dữ liệu bài học của trang hướng dẫn — NGUỒN DUY NHẤT cho cả hub `/admin/huong-dan` (server) lẫn
 * coach mark `GuideTour` (client). Không import gì ở server (driver Mongo, `node:*`): file này bị bundle
 * vào trình duyệt.
 *
 * Một bài học = một trang admin + một chuỗi bước, mỗi bước chỉ vào MỘT phần tử có thật trên trang đó
 * qua thuộc tính `data-tour="<target>"`. Điều này tạo ra một ràng buộc ngầm: đổi tên/xoá `data-tour` ở
 * trang thì bước tương ứng mất điểm chỉ. `lessons.test.ts` quét mã nguồn để bắt lỗi đó — thêm bước thì
 * phải thêm `data-tour` ở trang, và test sẽ nói nếu quên.
 *
 * Bài học chạy trên MỘT trang. Việc xuyên nhiều trang (ví dụ "bắt đầu nhanh") là chuỗi các bài nối nhau
 * qua `next`, để mỗi bài đứng được một mình và người dùng vào giữa chừng cũng không lạc.
 *
 * Nội dung mỗi bước đã đối chiếu với hành vi thật của hệ thống (xem ghi chú ở `huong-dan/page.tsx`):
 * sai ở đây là chỉ người dùng làm sai.
 */

export type LessonGroupId =
  | "advertisers"
  | "destinations"
  | "campaigns"
  | "overview"
  | "log"
  | "inbox";

export interface TourStep {
  /** Giá trị `data-tour` của phần tử cần chỉ. Bỏ trống = hộp thoại ở giữa màn hình (bước mở/đóng bài). */
  target?: string;
  title: string;
  body: string;
}

export interface Lesson {
  /** Cũng là giá trị của `?huongdan=` trên URL. */
  id: string;
  group: LessonGroupId;
  title: string;
  /** Một câu: bài này giúp làm được việc gì. */
  summary: string;
  minutes: number;
  /** Trang admin mà bài học chạy trên đó (khớp đúng `pathname`). */
  page: string;
  steps: TourStep[];
  /** Bài nên học tiếp — hiện ở bước cuối. */
  next?: string;
}

export interface LessonGroup {
  id: LessonGroupId;
  label: string;
  /** Trang gốc của mục, cho nút "Mở mục". */
  page: string;
  blurb: string;
}

/** Thứ tự = thứ tự làm việc thật: có đối tác rồi mới có URL đích, có đích rồi mới gắn vào chiến dịch. */
export const GROUPS: readonly LessonGroup[] = [
  { id: "advertisers", label: "Đối tác", page: "/admin/advertisers", blurb: "Bên trả tiền cho traffic." },
  { id: "destinations", label: "URL đích", page: "/admin/destinations", blurb: "Danh sách trang mà link được phép chuyển hướng tới." },
  { id: "campaigns", label: "Chiến dịch", page: "/admin/campaigns", blurb: "Trang giới thiệu, thẻ chia sẻ và link đem đi chạy." },
  { id: "overview", label: "Tổng quan", page: "/admin/tong-quan", blurb: "Hôm nay chạy thế nào." },
  { id: "log", label: "Nhật ký", page: "/admin/nhat-ky", blurb: "Từng lượt click, khi nghi có gì đó sai." },
  { id: "inbox", label: "Hộp thư", page: "/admin/lien-he", blurb: "Thư của người đọc gửi từ trang liên hệ." },
];

export const LESSONS: readonly Lesson[] = [
  {
    id: "them-doi-tac",
    group: "advertisers",
    title: "Thêm và kích hoạt đối tác",
    summary: "Bước đầu tiên: chưa có đối tác thì chưa thêm được URL đích hay tạo chiến dịch.",
    minutes: 1,
    page: "/admin/advertisers",
    next: "them-url-dich",
    steps: [
      {
        target: "advertiser-form",
        title: "Nhập thông tin đối tác",
        body: "Chỉ tên là bắt buộc; email và ghi chú để bạn nhớ nguồn và điều khoản. Bấm “Thêm đối tác” ở cuối khung.",
      },
      {
        target: "advertiser-list",
        title: "Kích hoạt đối tác vừa thêm",
        body: "Đối tác mới ở trạng thái “Chờ duyệt” và chưa dùng được. Bấm “Kích hoạt” ở dòng của nó. “Tạm dừng” để ngưng một đối tác bất cứ lúc nào.",
      },
    ],
  },
  {
    id: "them-url-dich",
    group: "destinations",
    title: "Thêm URL đích vào danh sách cho phép",
    summary: "Khai báo trang của đối tác mà link được phép đưa người dùng tới.",
    minutes: 1,
    page: "/admin/destinations",
    next: "tao-chien-dich",
    steps: [
      {
        target: "destination-form",
        title: "Dán địa chỉ trang của đối tác",
        body: "Chọn đối tác, dán URL bắt đầu bằng https://, đặt một nhãn phân loại để nhóm lại. Hệ thống chỉ nhận http/https.",
      },
      {
        target: "destination-list",
        title: "Kích hoạt URL đích",
        body: "URL mới cũng ở “Chờ duyệt”. Phải bấm “Kích hoạt” thì chiến dịch mới chuyển hướng tới được. Đây là danh sách DUY NHẤT link được phép đi tới.",
      },
    ],
  },
  {
    id: "tao-chien-dich",
    group: "campaigns",
    title: "Tạo chiến dịch",
    summary: "Điền trang giới thiệu và thẻ chia sẻ; xem trước trước khi cho chạy.",
    minutes: 3,
    page: "/admin/campaigns/new",
    next: "gan-dich-kich-hoat",
    steps: [
      {
        target: "cf-name",
        title: "Tên và đường dẫn",
        body: "Tên chỉ để bạn nhận ra chiến dịch. Đường dẫn tĩnh tự sinh từ tên và là phần cuối của trang giới thiệu (/c/…). Sau này đổi đường dẫn sẽ làm chết các link /c/ cũ.",
      },
      {
        target: "cf-advertiser",
        title: "Chọn đối tác",
        body: "Chỉ hiện các đối tác đang chạy. Chưa có đối tác nào thì phải quay lại mục Đối tác để thêm và kích hoạt trước.",
      },
      {
        target: "cf-headline",
        title: "Nội dung trang giới thiệu",
        body: "Tiêu đề chính hiện to đầu trang. Tiêu đề phụ và thân bài không bắt buộc. Thân bài cố ý không cho chèn liên kết, để mọi lượt bấm đều đi qua nút chính.",
      },
      {
        target: "cf-hero",
        title: "Ảnh lớn đầu trang",
        body: "Dán link ảnh hoặc bấm “Tải ảnh lên” (kéo-thả cũng được). Ảnh lớn hơn 2MB tự thu nhỏ ngay trong trình duyệt; tối đa 4MB, nhận JPG, PNG, WebP.",
      },
      {
        target: "cf-cta",
        title: "Chữ trên nút bấm",
        body: "Nhãn của nút đi tiếp trên trang giới thiệu, ví dụ “Nhận ưu đãi”. Ô tự động chuyển hướng nằm trong mục “Tuỳ chọn nâng cao” ở cuối form: 0 là tắt, 1–10 là số giây trước khi tự nhảy.",
      },
      {
        target: "cf-share",
        title: "Thẻ chia sẻ",
        body: "Tiêu đề, mô tả và ảnh ở đây là thứ hiện trên X, Facebook, Zalo khi dán link — quyết định người ta có bấm hay không. Ảnh chia sẻ nên có tỉ lệ 1,91 : 1 (cỡ 1200×630).",
      },
      {
        target: "form-submit",
        title: "Lưu chiến dịch",
        body: "“Tạo chiến dịch” về danh sách; “Tạo và xem trước” mở luôn trang xem trước. Chiến dịch mới luôn ở “Chờ duyệt” nên xem trước không ảnh hưởng người đọc thật.",
      },
    ],
  },
  {
    id: "gan-dich-kich-hoat",
    group: "campaigns",
    title: "Gắn đích chuyển hướng và kích hoạt",
    summary: "Làm cho link theo dõi thật sự chạy: cần đích đang chạy và chiến dịch đang chạy.",
    minutes: 2,
    page: "/admin/campaigns",
    next: "chia-se-link",
    steps: [
      {
        target: "campaign-row",
        title: "Mở chiến dịch",
        body: "Mỗi chiến dịch là một dòng thu gọn. Bấm vào dòng để xổ chi tiết: link, các đích chuyển hướng, form thêm đích. Dòng cho biết trạng thái và có bao nhiêu đích đang chạy.",
      },
      {
        target: "offer-form",
        title: "Thêm đích chuyển hướng",
        body: "Đặt tên đích, chọn một URL đích đang chạy, và đặt “tỷ lệ chia”. Có nhiều đích thì traffic chia theo tỉ lệ này — dùng để thử A/B. Khung này chỉ hiện khi đã có URL đích đang chạy.",
      },
      {
        target: "campaign-actions",
        title: "Kích hoạt chiến dịch",
        body: "“Kích hoạt” cho link chạy; “Tạm dừng” để ngưng (link có thể còn sống thêm khoảng 1 phút). Link chỉ chuyển hướng khi chiến dịch, đích và URL đích của nó đều đang chạy.",
      },
    ],
  },
  {
    id: "chia-se-link",
    group: "campaigns",
    title: "Lấy link đem đi đăng",
    summary: "Copy đúng link (có mã ?v=) để X/Facebook luôn hiện thẻ mới nhất.",
    minutes: 2,
    page: "/admin/campaigns",
    steps: [
      {
        target: "campaign-row",
        title: "Mở chiến dịch cần đăng",
        body: "Bấm vào dòng chiến dịch để xổ chi tiết.",
      },
      {
        target: "tracking-link",
        title: "Copy Link theo dõi từ đây",
        body: "Luôn copy từ khung này, đừng tự ghép. Đuôi ?v= là mã của thẻ chia sẻ, tự đổi khi bạn sửa tiêu đề, mô tả hoặc ảnh chia sẻ — để X/Facebook lấy thẻ mới thay vì giữ ảnh cũ.",
      },
      {
        target: "campaign-actions",
        title: "Sửa xong thì copy lại link",
        body: "Bấm “Sửa nội dung” để đổi thẻ chia sẻ. Sau khi lưu, quay lại đây copy link mới. Bài đã đăng bằng link cũ không đổi được thẻ — xoá và đăng lại.",
      },
    ],
  },
  {
    id: "doc-bao-cao",
    group: "overview",
    title: "Đọc trang Tổng quan",
    summary: "Biết hôm nay có bao nhiêu click, bao nhiêu chuyển đổi và bao nhiêu bot bị chặn.",
    minutes: 2,
    page: "/admin/tong-quan",
    steps: [
      {
        target: "range",
        title: "Chọn khoảng thời gian",
        body: "Mặc định là hôm nay. Đổi sang 7 hoặc 30 ngày để xem xu hướng. Số liệu có thể chậm tới 30 giây.",
      },
      {
        target: "kpis",
        title: "Bốn con số chính",
        body: "Lượt click (đã loại bot), khách duy nhất (đếm theo IP đã băm), chuyển đổi (từ postback của đối tác) và CR (tỷ lệ chuyển đổi trên click). Cố ý không có doanh thu: số tiền do đối tác tự khai nên không đối soát được.",
      },
      {
        target: "campaign-table",
        title: "So sánh các chiến dịch",
        body: "Xếp theo số click. Mỗi dòng có sẵn link theo dõi của chiến dịch đó.",
      },
      {
        target: "bot-blocked",
        title: "Bot bị chặn",
        body: "Phần đã bị loại khỏi các số ở trên, tách theo lý do. Thấy số này bất thường thì mở Nhật ký để xem từng lượt.",
      },
    ],
  },
  {
    id: "xem-nhat-ky",
    group: "log",
    title: "Dùng Nhật ký khi nghi có gì sai",
    summary: "Trả lời câu “lượt click của tôi đi đâu mất”.",
    minutes: 2,
    page: "/admin/nhat-ky",
    steps: [
      {
        target: "log-tabs",
        title: "Hai loại bản ghi",
        body: "“Bot bị chặn” là các lượt hệ thống coi là công cụ tự động (không tính vào click). “Click thường” là các lượt tính vào số liệu. Tự bấm link mà không thấy lượt của mình thì xem nó rơi vào tab nào.",
      },
      {
        target: "log-filters",
        title: "Lọc theo thời gian, chiến dịch, lý do",
        body: "Chọn rồi bấm “Lọc”. Ô “Lý do chặn” chỉ có ở tab Bot bị chặn. Mặc định xem 7 ngày vì crawler ghé thưa, xem riêng hôm nay thường ra bảng rỗng.",
      },
      {
        target: "log-table",
        title: "Từng lượt một",
        body: "Mới nhất trước, kèm thông tin trình duyệt. Với bot, cột lý do cho biết hệ thống dựa vào đâu để chặn — đủ để đoán nó chặn đúng hay nhầm.",
      },
    ],
  },
  {
    id: "hop-thu",
    group: "inbox",
    title: "Xử lý Hộp thư liên hệ",
    summary: "Đọc và trả lời thư người đọc gửi qua trang /lien-he.",
    minutes: 1,
    page: "/admin/lien-he",
    steps: [
      {
        target: "inbox-stats",
        title: "Số thư chưa xử lý",
        body: "Hệ thống KHÔNG gửi email: thư không tự tới hộp thư của bạn, nên cần vào đây xem thường xuyên. Chuyển giữa “Chưa xử lý” và “Tất cả” ở phía trên.",
      },
      {
        target: "inbox-list",
        title: "Trả lời và đánh dấu",
        body: "Bấm vào địa chỉ email của người gửi để mở thư trả lời, rồi bấm “Đánh dấu đã xử lý”. “Mở lại” nếu cần xử lý tiếp.",
      },
    ],
  },
];

/** Lộ trình cho người mới: làm theo thứ tự này là có link chạy được. */
export const QUICK_START: readonly string[] = [
  "them-doi-tac",
  "them-url-dich",
  "tao-chien-dich",
  "gan-dich-kich-hoat",
  "chia-se-link",
];

/** Tên tham số URL kích hoạt coach mark: `/admin/campaigns?huongdan=tao-chien-dich`. */
export const TOUR_PARAM = "huongdan";

export function findLesson(id: string | null | undefined): Lesson | undefined {
  return id ? LESSONS.find((lesson) => lesson.id === id) : undefined;
}

/** Đường dẫn bắt đầu một bài: mở đúng trang và tự chạy coach mark. */
export function lessonHref(lesson: Lesson): string {
  return `${lesson.page}?${TOUR_PARAM}=${lesson.id}`;
}

export function lessonsForPage(pathname: string): Lesson[] {
  return LESSONS.filter((lesson) => lesson.page === pathname);
}
