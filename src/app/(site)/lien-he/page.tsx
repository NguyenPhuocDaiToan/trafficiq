import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/site";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Liên hệ",
  description: `Gửi câu hỏi, góp ý hoặc đề nghị hợp tác tới ${SITE.name}.`,
  alternates: { canonical: "/lien-he" },
  openGraph: { title: `Liên hệ · ${SITE.name}`, url: "/lien-he" },
};

/**
 * Form ghi vào collection `contactMessages` và đọc lại được ở /admin/lien-he.
 * Không gửi email — dự án không có hạ tầng mail. Cố tình KHÔNG hứa "tôi sẽ
 * gửi email xác nhận" vì điều đó không xảy ra.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Về site"
        title="Liên hệ"
        intro="Báo một chi tiết không còn đúng, đề nghị chủ đề muốn được viết, hoặc đặt câu hỏi về nội dung — đều gửi được ở đây."
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-8 text-sm">
          <section>
            <h2 className="font-semibold">Email trực tiếp</h2>
            <p className="mt-2 text-muted-foreground">
              Nếu bạn muốn gửi kèm tệp hoặc cần lưu vết trao đổi:
            </p>
            <p className="mt-2">
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="cursor-pointer font-mono text-primary underline"
              >
                {SITE.contactEmail}
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Thời gian phản hồi</h2>
            <p className="mt-2 text-muted-foreground">
              Thường trong 1–2 ngày làm việc. Đây là một nhóm nhỏ, không phải bộ phận
              hỗ trợ, nên vào cuối tuần có thể chậm hơn.
            </p>
            {/*
              Nói thẳng là không có email xác nhận — AGENTS.md bất biến #10: dự án
              không có hạ tầng mail, hứa gửi thư xác nhận là hứa điều không xảy ra.
            */}
            <p className="mt-2 text-muted-foreground">
              Form không gửi email xác nhận tự động. Tôi đọc tin nhắn và trả lời
              bằng chính email bạn để lại.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Về dữ liệu bạn gửi</h2>
            <p className="mt-2 text-muted-foreground">
              Tôi lưu tên, email và nội dung tin nhắn để trả lời bạn, cùng một
              giá trị băm của địa chỉ IP để chống spam —{" "}
              <strong>không lưu IP dạng thô</strong>. Chi tiết trong{" "}
              <Link href="/chinh-sach-bao-mat" className="cursor-pointer underline">
                chính sách quyền riêng tư
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Điều tôi không làm</h2>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Không nhận bài đăng trả tiền dưới dạng bài viết thường.</li>
              <li>Không bán hoặc chia sẻ email của bạn cho bên thứ ba.</li>
              <li>Không thêm bạn vào danh sách gửi thư nào.</li>
              <li>Không tư vấn đầu tư, tài chính, y tế hay pháp lý.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
