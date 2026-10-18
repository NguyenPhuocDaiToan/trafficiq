import Link from "next/link";
import type { ReactNode } from "react";
import { LessonDoneBadge, ProgressSummary } from "@/components/guide-progress";
import {
  Card,
  Collapsible,
  Notice,
  StatusBadge,
  Table,
  TableWrap,
  Th,
  Tr,
  buttonSecondaryClass,
} from "@/components/ui";
import { clickTtlDays, publicBaseUrl } from "@/lib/env";
import {
  findLesson,
  GROUPS,
  LESSONS,
  lessonHref,
  QUICK_START,
  type Lesson,
} from "@/lib/guide/lessons";
import { CLIENT_SHRINK_ABOVE_BYTES, formatBytes, MAX_UPLOAD_BYTES } from "@/lib/media/limits";

/**
 * Trung tâm hướng dẫn cho người vận hành control plane — người tạo chiến dịch và đem link đi đăng.
 *
 * Hai tầng. Trên: HUB BÀI HỌC — mỗi mục của admin có bài riêng, và nút "Bắt đầu hướng dẫn" mở THẲNG trang
 * đó rồi chạy coach mark chỉ vào đúng nút/ô cần dùng (`GuideTour`, kích hoạt bằng `?huongdan=<bài>`), để
 * người dùng không phải đi tìm. Dưới: TÀI LIỆU THAM KHẢO đọc được liền mạch, cũng là bản dự phòng khi JS
 * chưa tải (coach mark cần JS; hub vẫn dùng được vì thẻ bài học là `<Link>` thường và các bước được liệt
 * kê bằng chữ trong `<details>`).
 *
 * Viết cho người "chỉ đi gửi link", không phải lập trình viên: mỗi mục trả lời một câu hỏi họ thật sự
 * có ("làm sao để link chạy?", "vì sao X vẫn hiện ảnh cũ?"), không giải thích kiến trúc.
 *
 * Mọi con số trong trang đọc từ nguồn thật (`limits.ts`, `clickTtlDays()`, `publicBaseUrl()`) thay vì
 * viết cứng — nếu giới hạn đổi mà trang này vẫn nói số cũ thì nó là tuyên bố sai, tệ hơn không có trang.
 * Mọi mệnh đề về hành vi (trạng thái nào cho link chạy, ai nhận thẻ chia sẻ…) đã đối chiếu với code ở
 * `lib/redirect/resolve.ts`, `app/go/[token]/route.ts`, `lib/landing/get-campaign.ts`; đổi hành vi ở đó
 * thì sửa trang này cùng lúc.
 *
 * UI theo design-system/trafficiq/pages/dashboard.md (Data-Dense Dashboard): thông tin dày nhưng có thể
 * quét — mục lục cố định bên trái, từng chủ đề một khối, xử lý sự cố gập lại bằng `<details>` (không cần
 * JS, cùng lý do với `Collapsible` ở /admin/campaigns). Thân bài giữ ≤ 75 ký tự/dòng để đọc được.
 *
 * `force-dynamic`: trang đọc biến môi trường lúc chạy (`CLICK_TTL_DAYS`, base URL); prerender lúc build
 * sẽ đóng băng giá trị của máy build.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Hướng dẫn sử dụng" };

const SECTIONS = [
  { id: "bat-dau-nhanh", label: "Bắt đầu nhanh" },
  { id: "khai-niem", label: "Khái niệm và trạng thái" },
  { id: "tao-chien-dich", label: "Tạo chiến dịch" },
  { id: "anh", label: "Ảnh: dán link hoặc tải lên" },
  { id: "chia-se-link", label: "Chia sẻ link đúng cách" },
  { id: "bao-cao", label: "Đọc báo cáo" },
  { id: "chuyen-doi", label: "Ghi nhận chuyển đổi" },
  { id: "hop-thu", label: "Hộp thư liên hệ" },
  { id: "su-co", label: "Gặp sự cố?" },
] as const;

export default function GuidePage() {
  const baseUrl = publicBaseUrl();
  const ttl = clickTtlDays();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Hướng dẫn sử dụng</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mỗi mục của trang quản trị có một bài học. Bấm <strong>Bắt đầu hướng dẫn</strong> để mở đúng trang
          và được chỉ thẳng vào nút, ô cần dùng — không phải đi tìm. Nút <strong>Hướng dẫn trang này</strong>{" "}
          ở góc dưới phải của mọi trang admin cũng mở bài của trang đang xem.
        </p>
        <nav aria-label="Các phần của trang" className="mt-3 flex flex-wrap gap-2 text-sm">
          {[
            ["lo-trinh", "Lộ trình cho người mới"],
            ["bai-hoc", "Bài học theo mục"],
            ["tai-lieu", "Tài liệu tham khảo"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      {/* ============================================================ HUB BÀI HỌC */}
      <section id="lo-trinh" className="scroll-mt-6">
        <Card
          title="Lộ trình cho người mới — năm bài để có link chạy được"
          description="Làm theo thứ tự: mỗi bài cần bài trước đã xong. Mỗi bài chỉ mất 1–3 phút."
        >
          <div className="space-y-3">
            <ProgressSummary ids={QUICK_START} />
            <ol className="space-y-2">
              {QUICK_START.map((id, index) => {
                const lesson = findLesson(id);
                if (!lesson) return null;
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary tabular-nums"
                    >
                      {index + 1}
                    </span>
                    {/* `min-w-48`: không có độ rộng tối thiểu thì flex-1 (cơ sở 0) không bao giờ xuống dòng và cột chữ bị ép thành dải hẹp ở màn điện thoại. */}
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">
                        <span className="sr-only">Bài {index + 1}: </span>
                        {lesson.title}
                        <span className="ml-2">
                          <LessonDoneBadge id={lesson.id} />
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{lesson.summary}</p>
                    </div>
                    <LessonActions lesson={lesson} />
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>
      </section>

      <section id="bai-hoc" className="scroll-mt-6 space-y-5">
        <h2 className="text-lg font-semibold">Bài học theo mục</h2>
        {GROUPS.map((group) => {
          const lessons = LESSONS.filter((lesson) => lesson.group === group.id);
          if (lessons.length === 0) return null;
          return (
            <div key={group.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-1.5">
                <h3 className="font-semibold">
                  {group.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">{group.blurb}</span>
                </h3>
                <Link href={group.page} className="cursor-pointer text-sm text-primary underline">
                  Mở mục {group.label}
                </Link>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {lessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ============================================================ TÀI LIỆU THAM KHẢO */}
      <section id="tai-lieu" className="scroll-mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tài liệu tham khảo</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Đọc liền một mạch, hoặc nhảy tới đúng phần cần tra. Vẫn đọc được khi coach mark không chạy.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
          <nav
            aria-label="Mục lục tài liệu"
            className="flex flex-wrap gap-2 text-sm lg:sticky lg:top-6 lg:flex-col lg:gap-0.5"
          >
            {SECTIONS.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground lg:rounded-none lg:border-0 lg:border-l-2 lg:px-3 lg:py-1.5 lg:hover:border-primary"
              >
                <span className="mr-1.5 tabular-nums">{index + 1}.</span>
                {section.label}
              </a>
            ))}
          </nav>

        <div className="max-w-3xl space-y-6">
          {/* ------------------------------------------------------------------ 1 */}
          <GuideSection id="bat-dau-nhanh" title="1. Bắt đầu nhanh — ảnh, URL, link">
            <p>
              Chỉ cần <strong>một ảnh và một URL đích</strong>. Chiến dịch tạo xong là{" "}
              <StatusBadge status="active" /> và <strong>chạy ngay</strong>: không còn bước duyệt tay. Mọi thứ
              còn lại (tên, đường dẫn, tiêu đề, thẻ chia sẻ, đối tác) hệ thống tự điền.
            </p>
            <ol className="space-y-3">
              <Step n={1} title="Tải ảnh và dán URL đích" href="/admin/campaigns/new" link="Tạo link">
                Kéo ảnh vào vùng tải (hoặc bấm chọn, hoặc dán bằng Ctrl+V), dán <strong>URL đích</strong> —
                địa chỉ trang của đối tác, bắt đầu bằng <Code>https://</Code> — rồi bấm{" "}
                <strong>Tạo link</strong>. Có thể nhập thêm một tiêu đề cho thẻ chia sẻ.
              </Step>
              <Step n={2} title="Sao chép link">
                Link theo dõi hiện ngay đầu trang, đã được thử sao chép sẵn; bấm <strong>Sao chép link</strong>{" "}
                nếu cần. Form bên dưới trống để tạo link tiếp theo. Xem thêm mục{" "}
                <GuideLink href="#chia-se-link">Chia sẻ link đúng cách</GuideLink>.
              </Step>
              <Step n={3} title="Đem đi đăng">
                Dán link vào bài đăng. Muốn đổi tiêu đề, mô tả hay chia traffic thử A/B thì mở chiến dịch ở{" "}
                <GuideLink href="/admin/campaigns">danh sách</GuideLink>.
              </Step>
            </ol>
          </GuideSection>

          {/* ------------------------------------------------------------------ 2 */}
          <GuideSection id="khai-niem" title="2. Khái niệm và trạng thái">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Term name="Đối tác">Bên trả tiền cho traffic. Mỗi URL đích thuộc về một đối tác.</Term>
              <Term name="URL đích">
                Địa chỉ trang của đối tác mà người bấm link sẽ tới. Chỉ URL có trong danh sách này (và
                đang chạy) mới được dùng.
              </Term>
              <Term name="Chiến dịch">
                Gồm một trang giới thiệu công khai, một thẻ chia sẻ và một link theo dõi.
              </Term>
              <Term name="Đích chuyển hướng">
                Một URL đích được gắn vào chiến dịch, kèm <em>tỷ lệ chia</em>. Chiến dịch có nhiều đích
                thì traffic được chia theo tỷ lệ này.
              </Term>
              <Term name="Link theo dõi">
                <Code>{baseUrl}/go/&lt;mã&gt;</Code> — link đem đi chạy traffic. Mã không bao giờ đổi khi
                bạn sửa chiến dịch.
              </Term>
              <Term name="Trang giới thiệu">
                <Code>{baseUrl}/c/&lt;đường dẫn&gt;</Code> — trang công khai của chiến dịch, có một nút
                đi tiếp tới link theo dõi.
              </Term>
            </dl>

            <h3 className="pt-1 text-sm font-semibold">Ba trạng thái</h3>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Trạng thái</Th>
                    <Th>Ý nghĩa</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <StatusBadge status="pending" />
                    </td>
                    <td className="px-3 py-2">
                      Chờ duyệt: trạng thái của dữ liệu tạo từ trước. Thứ tạo mới giờ <strong>chạy ngay</strong>, nên
                      thường chỉ còn thấy trạng thái này ở chiến dịch/đích cũ. Với chiến dịch:{" "}
                      <strong>link theo dõi chưa chuyển hướng</strong> nhưng trang giới thiệu vẫn xem trước được
                      (không được lập chỉ mục). Bấm Kích hoạt để chạy.
                    </td>
                  </Tr>
                  <Tr>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <StatusBadge status="active" />
                    </td>
                    <td className="px-3 py-2">Đang chạy. Link theo dõi chuyển hướng tới các đích đang chạy.</td>
                  </Tr>
                  <Tr>
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <StatusBadge status="paused" />
                    </td>
                    <td className="px-3 py-2">
                      Dừng. Link ngừng chuyển hướng và trang giới thiệu không mở được. Bấm Kích hoạt để
                      chạy lại.
                    </td>
                  </Tr>
                </tbody>
              </Table>
            </TableWrap>

            <Notice>
              Link theo dõi chỉ chạy khi <strong>cả ba</strong> điều kiện đúng: chiến dịch đang chạy, có
              ít nhất một đích chuyển hướng đang chạy, và URL đích của nó cũng đang chạy. Thiếu một thì
              người bấm sẽ thấy trang &ldquo;link không còn hoạt động&rdquo;. Sau khi bấm Tạm dừng, link
              có thể còn sống thêm khoảng 1 phút.
            </Notice>
          </GuideSection>

          {/* ------------------------------------------------------------------ 3 */}
          <GuideSection id="tao-chien-dich" title="3. Tạo link từ ảnh">
            <p>
              Vào tab <GuideLink href="/admin/campaigns/new">Tạo link</GuideLink> (cũng là trang đầu tiên sau
              khi đăng nhập). Form chỉ có:
            </p>
            <dl className="space-y-3">
              <Term name="Ảnh">
                Dùng cho cả trang giới thiệu và thẻ chia sẻ trên X, Facebook, Zalo. Kéo-thả, bấm chọn, dán
                bằng Ctrl+V, hoặc dán link ảnh.
              </Term>
              <Term name="URL đích">
                Nơi người bấm link được chuyển tới. Bấm vào ô để <strong>chọn</strong> một URL đã lưu ở{" "}
                <GuideLink href="/admin/destinations">Cài đặt → URL đích</GuideLink>, hoặc dán URL mới — nó
                tự được thêm vào danh sách và kích hoạt. Bấm &ldquo;Thêm URL đích khác&rdquo; (tối đa 5) thì
                traffic chia đều. Đối tác lấy theo URL đích, chưa có thì tự tạo theo tên miền.
              </Term>
              <Term name="Tiêu đề (không bắt buộc)">
                Hiện trên thẻ chia sẻ. Để trống thì dùng tên miền của URL đích.
              </Term>
            </dl>
            <p>
              Mọi thứ khác hệ thống tự điền: tên chiến dịch, đường dẫn tĩnh (sinh từ tên), chữ trên nút bấm,
              mô tả chia sẻ và <strong>tự động chuyển hướng 2 giây</strong>. Chữ tự điền cố ý trung tính — nếu cần lời
              kêu gọi cụ thể, mở chiến dịch ở danh sách và sửa (hiện công khai). Chiến dịch{" "}
              <StatusBadge status="active" /> ngay khi tạo; muốn ngưng thì bấm Tạm dừng ở danh sách.
            </p>
            <Notice>
              Ở form <strong>sửa</strong>, đường dẫn tĩnh không tự đổi theo tên. Đổi đường dẫn là làm chết
              mọi link <Code>/c/…</Code> cũ đã chia sẻ, nên phải bấm &ldquo;Sinh lại từ tên&rdquo; mới đổi.
              Link theo dõi <Code>/go/…</Code> thì không bao giờ đổi.
            </Notice>
          </GuideSection>

          {/* ------------------------------------------------------------------ 4 */}
          <GuideSection id="anh" title="4. Ảnh: dán link hoặc tải lên">
            <p>
              Ô ảnh nhận cả hai cách trong cùng một ô: dán link ảnh, hoặc bấm <strong>Tải ảnh lên</strong>{" "}
              (cũng kéo-thả được). Tải xong, ô tự điền đường dẫn của ảnh và hiện bản xem trước. Bấm{" "}
              <strong>Xoá ảnh</strong> để bỏ.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Nhận ảnh <strong>JPG, PNG hoặc WebP</strong>. GIF, SVG, HEIC không được nhận.
              </li>
              <li>
                Tối đa <strong>{formatBytes(MAX_UPLOAD_BYTES)}</strong> mỗi ảnh. Ảnh lớn hơn{" "}
                <strong>{formatBytes(CLIENT_SHRINK_ABOVE_BYTES)}</strong> (như ảnh chụp từ điện thoại)
                được <strong>tự thu nhỏ ngay trong trình duyệt</strong> trước khi gửi, bạn không cần tự
                nén.
              </li>
              <li>
                Ảnh được nén lại tự động để tải nhanh (khoảng 200KB) mà vẫn nét, và thông tin vị trí
                trong ảnh bị bỏ đi.
              </li>
              <li>
                <strong>Ảnh khi chia sẻ</strong> nên có tỉ lệ <strong>1,91 : 1</strong> (cỡ 1200×630).
                Lệch nhiều thì Facebook/Zalo có thể cắt hai mép; form sẽ cảnh báo nhưng vẫn cho dùng.
              </li>
              <li>
                Link ảnh dán vào phải là địa chỉ công khai bắt đầu bằng <Code>http://</Code> hoặc{" "}
                <Code>https://</Code>. Link ảnh của site khác có thể bị họ xoá hoặc chặn, nên với ảnh
                quan trọng hãy tải lên.
              </li>
            </ul>
            <p className="text-muted-foreground">
              Tải ảnh lên cần trình duyệt chạy JavaScript. Dán link thì luôn dùng được.
            </p>
          </GuideSection>

          {/* ------------------------------------------------------------------ 5 */}
          <GuideSection id="chia-se-link" title="5. Chia sẻ link đúng cách">
            <Callout tone="key" label="Quy tắc quan trọng nhất">
              Luôn <strong>copy link từ trang Chiến dịch</strong> (mở chiến dịch → Link theo dõi). Đừng
              tự gõ hay dùng lại link cũ khi vừa đổi ảnh, tiêu đề hoặc mô tả chia sẻ.
            </Callout>

            <p>Link theo dõi có dạng:</p>
            <p className="rounded-lg bg-muted px-3 py-2">
              <Code>{baseUrl}/go/&lt;mã&gt;?v=&lt;mã thẻ&gt;</Code>
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Code>/go/&lt;mã&gt;</Code> không bao giờ đổi, và link cũ đã đăng vẫn chạy bình thường.
              </li>
              <li>
                <Code>?v=</Code> là <strong>mã của thẻ chia sẻ</strong>, hệ thống tự tính từ tiêu đề, mô tả
                và ảnh. Đổi một trong ba thì mã đổi.
              </li>
            </ul>

            <h3 className="pt-1 text-sm font-semibold">Vì sao phải có mã đó</h3>
            <p>
              X, Facebook, Zalo ghi nhớ thẻ của mỗi link trong nhiều ngày và bạn không xoá được từ phía
              mình. Nếu đổi ảnh mà vẫn đăng link cũ, họ tiếp tục hiện <strong>ảnh cũ</strong>. Link có mã
              mới được họ coi là link chưa từng thấy, nên lấy thẻ mới.
            </p>

            <h3 className="pt-1 text-sm font-semibold">Khi bạn sửa thẻ chia sẻ</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Sửa tiêu đề, mô tả hoặc ảnh chia sẻ rồi bấm Lưu. Thông báo sẽ nói thẻ đã đổi.</li>
              <li>
                Quay lại Chiến dịch, <strong>copy lại Link theo dõi</strong> (đuôi <Code>?v=</Code> đã khác).
              </li>
              <li>
                Bài đã đăng bằng link cũ <strong>không sửa được thẻ</strong>. Xoá bài và đăng lại bằng
                link mới.
              </li>
            </ol>

            <h3 className="pt-1 text-sm font-semibold">Người bấm link nhìn thấy gì</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Người thật</strong> bấm link theo dõi được chuyển thẳng tới trang của đối tác.
              </li>
              <li>
                <strong>Công cụ tự động</strong> (X, Facebook… đang lấy thẻ để hiện xem trước) nhận thẻ
                chia sẻ và không bị tính là click.
              </li>
              <li>
                Muốn người đọc xem trang giới thiệu trước thì chia sẻ <Code>/c/&lt;đường dẫn&gt;</Code>;
                nút trên trang đó mới đi qua link theo dõi. Đuôi <Code>?v=</Code> chỉ có ở link theo dõi.
              </li>
            </ul>

            <h3 className="pt-1 text-sm font-semibold">Gắn nguồn traffic vào link</h3>
            <p>
              Thêm vào cuối link để báo cáo biết lượt click đến từ đâu:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Code>&amp;source=facebook</Code> (hoặc <Code>&amp;utm_source=facebook</Code>) → hiện ở mục{" "}
                <em>Nguồn traffic</em>. Không gắn thì tính là &ldquo;Truy cập trực tiếp&rdquo;.
              </li>
              <li>
                <Code>&amp;sub_id1=…</Code> đến <Code>&amp;sub_id5=…</Code> → mã tuỳ ý của bạn (ví dụ mã
                quảng cáo); được lưu lại và chuyển tiếp cho đối tác.
              </li>
            </ul>
            <p className="rounded-lg bg-muted px-3 py-2">
              <Code>{baseUrl}/go/&lt;mã&gt;?v=&lt;mã thẻ&gt;&amp;source=facebook&amp;sub_id1=qc-01</Code>
            </p>
          </GuideSection>

          {/* ------------------------------------------------------------------ 6 */}
          <GuideSection id="bao-cao" title="6. Đọc báo cáo">
            <h3 className="text-sm font-semibold">
              <GuideLink href="/admin/tong-quan">Tổng quan</GuideLink> — hôm nay chạy thế nào
            </h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Chọn <strong>Hôm nay / 7 ngày / 30 ngày</strong>. Mặc định là hôm nay. Số liệu có thể
                chậm tới 30 giây.
              </li>
              <li>
                <strong>Lượt click</strong> đã loại bot. <strong>Khách duy nhất</strong> đếm theo IP đã
                băm (hệ thống không lưu IP thô). <strong>Chuyển đổi</strong> lấy từ postback của đối
                tác. <strong>CR</strong> là tỷ lệ chuyển đổi trên click.
              </li>
              <li>
                Bên dưới có biểu đồ theo giờ (giờ Việt Nam), bảng từng chiến dịch kèm link theo dõi, nguồn
                traffic, quốc gia, thiết bị, và số lượt bot bị chặn.
              </li>
              <li>
                Cố ý <strong>không có doanh thu</strong>: số tiền do đối tác tự khai, không đối soát được
                nên không được trình bày như số liệu kế toán.
              </li>
            </ul>

            <h3 className="pt-1 text-sm font-semibold">
              <GuideLink href="/admin/nhat-ky">Nhật ký</GuideLink> — khi nghi có gì đó sai
            </h3>
            <p>
              Từng lượt vào link theo dõi, mới nhất trước, kèm thông tin trình duyệt. Hai tab:{" "}
              <strong>Bot bị chặn</strong> (không tính vào click) và <strong>Click thường</strong>. Mở trang
              này khi bạn tự bấm link mà không thấy lượt của mình: xem nó rơi vào tab nào, và cột lý do cho
              biết vì sao bị coi là bot.
            </p>

            <Notice>
              Chi tiết từng lượt click tự xoá sau <strong>{ttl} ngày</strong> để tiết kiệm dung lượng. Số
              chuyển đổi vẫn được ghi nhận dù click gốc đã bị xoá.
            </Notice>
          </GuideSection>

          {/* ------------------------------------------------------------------ 7 */}
          <GuideSection id="chuyen-doi" title="7. Ghi nhận chuyển đổi (postback)">
            <p>
              Chuyển đổi là lúc người bấm link làm xong việc đối tác muốn (đăng ký, mua…). Hệ thống chỉ
              biết điều đó khi <strong>đối tác báo lại</strong>. Khi chuyển hướng, mỗi lượt click được gắn
              một mã <Code>click_id</Code> vào địa chỉ trang đối tác; đối tác gửi mã đó về là xong.
            </p>
            <p className="rounded-lg bg-muted px-3 py-2">
              <Code>{baseUrl}/api/postback?secret=&lt;khoá&gt;&amp;click_id={"{click_id}"}&amp;payout=1.50</Code>
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Code>click_id</Code> là bắt buộc. <Code>payout</Code>, <Code>currency</Code>,{" "}
                <Code>status</Code> (<Code>approved</Code>, <Code>pending</Code> hoặc <Code>rejected</Code>) và{" "}
                <Code>transaction_id</Code> là tuỳ chọn.
              </li>
              <li>
                Gửi lại cùng một <Code>click_id</Code> <strong>không bị đếm hai lần</strong>, nên đối tác
                cứ yên tâm retry.
              </li>
              <li>
                <Code>secret</Code> là khoá do người quản trị hệ thống giữ. Gửi cho đối tác qua kênh riêng,
                không dán vào nơi nhiều người đọc được.
              </li>
            </ul>
          </GuideSection>

          {/* ------------------------------------------------------------------ 8 */}
          <GuideSection id="hop-thu" title="8. Hộp thư liên hệ">
            <p>
              Tin nhắn người đọc gửi từ trang <Code>/lien-he</Code> nằm ở{" "}
              <GuideLink href="/admin/lien-he">Hộp thư</GuideLink>. Hệ thống{" "}
              <strong>không gửi email</strong> — thư không tự tới hộp thư của bạn, nên cần vào đây xem
              thường xuyên. Trả lời bằng cách bấm vào địa chỉ email của người gửi, rồi đánh dấu đã xử lý.
            </p>
          </GuideSection>

          {/* ------------------------------------------------------------------ 9 */}
          <GuideSection id="su-co" title="9. Gặp sự cố?">
            <div className="space-y-2">
              <Collapsible summary={<span className="font-medium">Bấm link theo dõi mà thấy &ldquo;link không còn hoạt động&rdquo;</span>}>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  <li>Chiến dịch đang <strong>Tạm dừng</strong> (hoặc là chiến dịch cũ còn ở &ldquo;Chờ duyệt&rdquo; — bấm Kích hoạt).</li>
                  <li>Chiến dịch chưa có đích chuyển hướng nào.</li>
                  <li>
                    Đích chuyển hướng đang tạm dừng, hoặc <strong>URL đích</strong> của nó đang tạm dừng ở
                    mục <GuideLink href="/admin/destinations">URL đích</GuideLink>. Trong khung chiến
                    dịch có dòng cảnh báo màu cho trường hợp này.
                  </li>
                </ul>
              </Collapsible>

              <Collapsible summary={<span className="font-medium">X/Facebook vẫn hiện ảnh hoặc tiêu đề cũ</span>}>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  <li>
                    Họ lưu thẻ theo từng link. Hãy dùng link <strong>copy lại từ trang Chiến dịch</strong>{" "}
                    (đuôi <Code>?v=</Code> đã đổi) rồi đăng bài mới.
                  </li>
                  <li>Bài đã đăng thì không sửa được thẻ: xoá và đăng lại.</li>
                  <li>
                    Đổi ảnh <strong>trước khi</strong> đem link đi đăng lần đầu sẽ đỡ rắc rối nhất.
                  </li>
                </ul>
              </Collapsible>

              <Collapsible summary={<span className="font-medium">Vừa tạm dừng mà link vẫn chạy</span>}>
                <p className="text-sm">
                  Bình thường: link có thể còn sống thêm khoảng 1 phút sau khi tạm dừng hoặc đổi trạng
                  đích. Chờ rồi thử lại.
                </p>
              </Collapsible>

              <Collapsible summary={<span className="font-medium">Tải ảnh lên báo lỗi</span>}>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  <li>
                    <strong>&ldquo;Chỉ nhận ảnh JPG, PNG hoặc WebP&rdquo;</strong>: đổi định dạng ảnh (ảnh iPhone
                    dạng HEIC cần xuất sang JPG).
                  </li>
                  <li>
                    <strong>&ldquo;File quá lớn…&rdquo;</strong>: thông báo cho biết cỡ ảnh và giới hạn. Ảnh lớn
                    thường tự thu nhỏ được; nếu vẫn quá, chọn ảnh khác hoặc thu nhỏ bằng phần mềm chỉnh ảnh.
                  </li>
                  <li>
                    <strong>&ldquo;Chưa cấu hình nơi lưu ảnh&rdquo;</strong> hoặc thông báo nhắc tới Vercel
                    Blob: nơi lưu ảnh chưa được thiết lập — báo người quản trị. Trong lúc chờ, dán link ảnh.
                  </li>
                  <li>
                    <strong>&ldquo;Phiên đăng nhập đã hết hạn&rdquo;</strong>: tải lại trang và đăng nhập lại.
                  </li>
                </ul>
              </Collapsible>

              <Collapsible summary={<span className="font-medium">Tôi bấm link mà không thấy lượt click của mình</span>}>
                <p className="text-sm">
                  Vào <GuideLink href="/admin/nhat-ky">Nhật ký</GuideLink> và xem tab{" "}
                  <strong>Bot bị chặn</strong>: nếu lượt của bạn nằm ở đó thì hệ thống đã coi trình duyệt
                  của bạn là công cụ tự động, và cột lý do cho biết vì sao. Báo người quản trị kèm giờ bạn
                  bấm.
                </p>
              </Collapsible>

              <Collapsible summary={<span className="font-medium">Không lưu được: &ldquo;đường dẫn đã được dùng&rdquo;</span>}>
                <p className="text-sm">
                  Đường dẫn tĩnh của chiến dịch phải khác mọi chiến dịch khác. Đổi một chút (thêm ngày hoặc
                  số) rồi lưu lại.
                </p>
              </Collapsible>
            </div>
          </GuideSection>
        </div>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- phần tử trang */

/** Hai nút của một bài: chạy coach mark (mở đúng trang), hoặc chỉ mở trang. Đều là `<Link>` thường. */
function LessonActions({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Link href={lessonHref(lesson)} className={buttonSecondaryClass}>
        Bắt đầu hướng dẫn
      </Link>
      <Link href={lesson.page} className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground">
        Chỉ mở trang
      </Link>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-(--shadow-sm)">
      <div>
        <h4 className="font-medium">
          {lesson.title}
          <span className="ml-2">
            <LessonDoneBadge id={lesson.id} />
          </span>
        </h4>
        <p className="mt-0.5 text-sm text-muted-foreground">{lesson.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{lesson.steps.length}</span> bước · khoảng{" "}
          <span className="tabular-nums">{lesson.minutes}</span> phút
        </p>
      </div>
      <LessonActions lesson={lesson} />
      {/* Các bước bằng chữ: bản dự phòng khi coach mark không chạy (chưa có JS), và để xem lướt trước khi bắt đầu. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Xem các bước
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          {lesson.steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}.</strong> {step.body}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function GuideSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    // `scroll-mt-6`: mục tiêu của link nhảy không dính sát mép trên viewport.
    <section id={id} className="scroll-mt-6">
      <Card title={title}>
        <div className="space-y-3 text-sm leading-relaxed">{children}</div>
      </Card>
    </section>
  );
}

function Step({
  n,
  title,
  href,
  link,
  children,
}: {
  n: number;
  title: string;
  href?: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      {/* Số bước là chữ + tabular-nums, không dùng font-mono: đó là nhãn, không phải cột số liệu. */}
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold">
          <span className="sr-only">Bước {n}: </span>
          {title}
        </h3>
        <p className="mt-0.5">{children}</p>
        {href && link ? (
          <p className="mt-1">
            <GuideLink href={href}>{link}</GuideLink>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{name}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/**
 * Khối nhấn mạnh. Có NHÃN chữ ("Quy tắc quan trọng nhất") chứ không chỉ khác màu nền — màu một mình
 * không được truyền thông tin (WCAG 1.4.1). Dùng `bg-muted`, không dùng `--accent`: accent chỉ dành cho
 * CTA chính và trang này không có CTA.
 */
function Callout({ label, children }: { tone: "key"; label: string; children: ReactNode }) {
  return (
    <div role="note" className="rounded-lg border-l-4 border-primary bg-muted px-3 py-2">
      <p className="text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

/** Link có gạch chân: `--primary` gần trùng `--foreground` nên màu không đủ để nhận ra link (MASTER.md). */
function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  const className = "cursor-pointer text-primary underline";
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Địa chỉ, tham số, mã: font-mono (luật font: mono cho code/URL, không cho chữ thường). */
function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs break-all">{children}</code>;
}
