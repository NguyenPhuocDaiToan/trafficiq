"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nhãn tiếng Việt. Toàn bộ control plane dùng tiếng Việt vì người vận hành là
 * người Việt — thuật ngữ nào là danh từ riêng của ngành thì giữ nguyên trong
 * ngoặc để đối chiếu với tài liệu ad network (postback, offer, destination…).
 */
interface NavItem {
  href: string;
  label: string;
  /** Các đường dẫn khác cũng làm tab này sáng (tab "Cài đặt" gom nhiều trang con). */
  alsoActive?: string[];
}

/**
 * Các trang trong "Cài đặt". Giữ nguyên đường dẫn riêng của từng trang (bài học hướng dẫn, link cũ và route
 * action đều bám vào chúng) — "Cài đặt" chỉ là một cách gom chúng lại dưới một tab và một thanh tab con.
 * `ownerOnly`: trang và action của chúng tự chặn member; ẩn ở đây chỉ là tiện.
 */
export const SETTINGS_PAGES: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: "/admin/advertisers", label: "Đối tác" },
  { href: "/admin/destinations", label: "URL đích" },
  { href: "/admin/ten-mien", label: "Tên miền", ownerOnly: true },
  { href: "/admin/thanh-vien", label: "Thành viên", ownerOnly: true },
];

const NAV: NavItem[] = [
  { href: "/admin/campaigns", label: "Chiến dịch" },
  { href: "/admin/tong-quan", label: "Tổng quan" },
  // Trang chẩn đoán, đứng sau hai mục làm việc chính vì mở thưa hơn. Vẫn phải có tab
  // riêng chứ không chỉ là link từ Tổng quan: nó là chỗ trả lời "click của tôi
  // đi đâu mất", và người đang đi tìm câu đó không nghĩ tới việc vào báo cáo.
  { href: "/admin/nhat-ky", label: "Nhật ký" },
  // Đối tác, URL đích, Tên miền, Thành viên: việc thiết lập, làm một lần rồi ít đụng lại.
  { href: SETTINGS_PAGES[0].href, label: "Cài đặt", alsoActive: SETTINGS_PAGES.map((page) => page.href) },
  // Trung tâm bài học + coach mark. Đứng cuối cùng và tách khỏi các mục làm việc: mở thưa hơn hẳn, nhưng
  // phải có tab riêng để người mới thấy ngay thay vì phải biết đường tìm.
  { href: "/admin/huong-dan", label: "Hướng dẫn" },
  // "Hộp thư" (/admin/lien-he) cố ý KHÔNG có tab: trang vẫn tồn tại và vào được bằng đường dẫn — form liên hệ công
  // khai ghi vào `contactMessages` (bất biến 10), nên bỏ trang đó mới là mất thư của người thật, còn ẩn tab thì không.
];

/**
 * "/admin" (không có route con) chỉ còn là redirect sang /admin/campaigns
 * (xem app/admin/page.tsx) nên không có tab nào cần khớp tuyệt đối nữa — mọi
 * tab dùng prefix để route con vẫn giữ tab cha sáng (vd /admin/campaigns/new
 * → "Chiến dịch").
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Client component vì `usePathname` chỉ chạy phía client. Chỉ phần link là
 * client — layout và trang vẫn là server component.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((item) => {
        const active = [item.href, ...(item.alsoActive ?? [])].some((href) => isActive(pathname, href));
        return (
          <Link
            key={item.href}
            href={item.href}
            // aria-current để screen reader biết tab nào đang mở, không chỉ dựa vào màu.
            aria-current={active ? "page" : undefined}
            className={`cursor-pointer border-b-2 py-1 font-medium transition-colors duration-150 ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Thanh tab con của "Cài đặt". Là client component tự quyết định có hiện không theo đường dẫn hiện tại: layout
 * admin được Next giữ nguyên khi chuyển trang bằng link nên nó không thể biết pathname đã đổi.
 */
export function SettingsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  if (!SETTINGS_PAGES.some((page) => isActive(pathname, page.href))) return null;

  return (
    <nav aria-label="Cài đặt" className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
      <span className="mr-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Cài đặt</span>
      {SETTINGS_PAGES.filter((page) => isOwner || !page.ownerOnly).map((page) => {
        const active = isActive(pathname, page.href);
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}
