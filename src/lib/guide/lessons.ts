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
    title: "Quản lý đối tác",
    summary: "Không bắt buộc: tạo chiến dịch tự tạo đối tác theo URL đích. Trang này để thêm tay và sửa.",
    minutes: 1,
    page: "/admin/advertisers",
    next: "them-url-dich",
    steps: [
      {
        target: "advertiser-form",
        title: "Thêm đối tác bằng tay",
        body: "Chỉ tên là bắt buộc; email và ghi chú để bạn nhớ nguồn và điều khoản. Đối tác mới chạy ngay. Thường bạn không cần bước này: tạo chiến dịch với URL đích mới đã tự tạo đối tác.",
      },
      {
        target: "advertiser-list",
        title: "Sửa hoặc tạm dừng đối tác",
        body: "Bấm “Sửa thông tin” ở một dòng để đổi tên, email, ghi chú (để trống là xoá). “Tạm dừng” để ngưng một đối tác bất cứ lúc nào, “Kích hoạt” để chạy lại.",
      },
    ],
  },
  {
    id: "them-url-dich",
    group: "destinations",
    title: "Quản lý URL đích",
    summary: "Danh sách trang mà link được phép đưa người dùng tới. Tạo chiến dịch cũng tự thêm vào đây.",
    minutes: 1,
    page: "/admin/destinations",
    next: "tao-chien-dich",
    steps: [
      {
        target: "destination-form",
        title: "Thêm URL đích bằng tay",
        body: "Chọn đối tác, dán URL bắt đầu bằng https://, đặt nhãn phân loại. Hệ thống chỉ nhận http/https. URL mới dùng được ngay. Thường bạn chỉ cần dán URL ở form tạo chiến dịch.",
      },
      {
        target: "destination-list",
        title: "Sửa hoặc tạm dừng URL đích",
        body: "Bấm “Sửa” để đổi URL, đối tác hay nhãn: link đang chạy sẽ chuyển tới URL mới trong tối đa khoảng 1 phút. “Tạm dừng” ngưng chuyển hướng tới URL đó. Đây là danh sách DUY NHẤT link được phép đi tới.",
      },
    ],
  },
  {
    id: "tao-chien-dich",
    group: "campaigns",
    title: "Tạo link từ ảnh",
    summary: "Tải ảnh, dán URL đích, bấm tạo — có link theo dõi để sao chép ngay.",
    minutes: 1,
    page: "/admin/campaigns/new",
    next: "chia-se-link",
    steps: [
      {
        target: "cf-hero",
        title: "Tải ảnh lên",
        body: "Kéo ảnh vào vùng này, bấm để chọn file, hoặc dán ảnh bằng Ctrl+V. Cũng dán được link ảnh ở ô bên dưới. Ảnh lớn hơn 2MB tự thu nhỏ trong trình duyệt; tối đa 4MB, nhận JPG, PNG, WebP.",
      },
      {
        target: "cf-urls",
        title: "Dán URL đích",
        body: "Nơi người bấm link được chuyển tới. Bấm vào ô để CHỌN URL đã lưu ở Cài đặt → URL đích, hoặc dán URL mới (tự được lưu và kích hoạt). “Thêm URL đích khác” để chia đều traffic cho nhiều đích.",
      },
      {
        target: "cf-headline",
        title: "Tiêu đề (không bắt buộc)",
        body: "Hiện trên thẻ khi dán link lên X, Facebook, Zalo. Để trống thì dùng tên miền của URL đích. Tên, đường dẫn, mô tả và nút bấm đều được tự điền; muốn đổi thì sửa chiến dịch sau khi tạo.",
      },
      {
        target: "form-submit",
        title: "Tạo link",
        body: "Chiến dịch chạy ngay. Link theo dõi hiện ở đầu trang (đã thử sao chép sẵn), form trống bên dưới để tạo link tiếp theo.",
      },
    ],
  },
  {
    id: "gan-dich-kich-hoat",
    group: "campaigns",
    title: "Thêm đích và bật/tạm dừng chiến dịch",
    summary: "Thêm đích thứ hai để chia traffic, hoặc tạm dừng/bật lại chiến dịch.",
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
        body: "Chiến dịch tạo xong đã có đích từ URL bạn dán. Cần thêm đích thì đặt tên, chọn một URL đích đang chạy và “tỷ lệ chia”: nhiều đích thì traffic chia theo tỉ lệ này — dùng để thử A/B.",
      },
      {
        target: "campaign-actions",
        title: "Tạm dừng và bật lại",
        body: "“Tạm dừng” để ngưng (link có thể còn sống thêm khoảng 1 phút), “Kích hoạt” để chạy lại. Link chỉ chuyển hướng khi chiến dịch, đích và URL đích của nó đều đang chạy.",
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
        body: "Mỗi dòng là một chiến dịch. Bấm vào dòng để xổ chi tiết (đích chuyển hướng, trạng thái) — riêng link theo dõi thì nằm sẵn trên dòng, không cần bung.",
      },
      {
        target: "tracking-link",
        title: "Sao chép link theo dõi từ đây",
        body: "Link nằm ngay trên dòng chiến dịch, bấm “Sao chép” là xong. Luôn sao chép từ đây, đừng tự ghép. Đuôi ?v= là mã của thẻ chia sẻ, tự đổi khi bạn sửa tiêu đề, mô tả hoặc ảnh chia sẻ — để X/Facebook lấy thẻ mới thay vì giữ ảnh cũ. Lưu ý: tự mở link cũng được tính là một click thật.",
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
  "tao-chien-dich",
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
