"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nhãn tiếng Việt. Toàn bộ control plane dùng tiếng Việt vì người vận hành là
 * người Việt — thuật ngữ nào là danh từ riêng của ngành thì giữ nguyên trong
 * ngoặc để đối chiếu với tài liệu ad network (postback, offer, destination…).
 */
const NAV = [
  { href: "/admin/campaigns", label: "Chiến dịch" },
  { href: "/admin/tong-quan", label: "Tổng quan" },
  { href: "/admin/destinations", label: "URL đích" },
  { href: "/admin/advertisers", label: "Đối tác" },
  { href: "/admin/lien-he", label: "Hộp thư" },
  // Trang chẩn đoán, đứng cuối vì mở thưa hơn hẳn bốn mục trên. Vẫn phải có tab
  // riêng chứ không chỉ là link từ Tổng quan: nó là chỗ trả lời "click của tôi
  // đi đâu mất", và người đang đi tìm câu đó không nghĩ tới việc vào báo cáo.
  { href: "/admin/nhat-ky", label: "Nhật ký" },
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
        const active = isActive(pathname, item.href);
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
