import { redirect } from "next/navigation";

/**
 * "/admin" chỉ redirect — không phải trang thật. Mặc định vào Chiến dịch vì
 * đó là thao tác thường làm nhất khi mở control plane, không phải xem số liệu.
 * Dashboard vẫn còn, dời sang app/admin/tong-quan/page.tsx.
 */
export default function AdminIndexPage() {
  redirect("/admin/campaigns");
}
