import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Link không còn hoạt động",
  robots: { index: false, follow: false },
};

/**
 * Đích của redirect khi token không resolve được (campaign paused, hết offer,
 * destination bị tắt, hoặc token sai). Trả về trang thân thiện thay vì 404 thô,
 * vì link này có thể đã được share ra ngoài.
 *
 * Có đúng MỘT link về trang chủ. Không phải nav — trang này không còn CTA nào để
 * click rò rỉ ra khỏi (bất biến #12 nói về landing còn sống), mà là ngõ cụt: người
 * bấm vào đây là người thật vừa gặp lỗi, để họ không có đường đi tiếp là bỏ rơi họ.
 */
export default function LinkUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Link này không còn hoạt động</h1>
      <p className="text-muted-foreground">
        Chiến dịch có thể đã kết thúc hoặc tạm dừng. Vui lòng kiểm tra lại đường
        dẫn.
      </p>
      <p className="mt-3">
        <Link
          href="/"
          className="cursor-pointer font-semibold text-primary underline hover:no-underline"
        >
          Về trang chủ {SITE.name}
        </Link>
      </p>
    </main>
  );
}
