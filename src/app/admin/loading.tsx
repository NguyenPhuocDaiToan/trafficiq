/**
 * Suspense fallback cho MỌI route con của /admin — layout (header + nav) đứng
 * yên, chỉ phần page bên trong đổi khi chuyển tab, nên một file này che được
 * cả 5 tab (Tổng quan/Chiến dịch/URL đích/Đối tác/Hộp thư) trong lúc RSC mới
 * đang stream, thay vì màn hình trắng không phản hồi.
 *
 * `motion-safe:animate-pulse` để tôn trọng prefers-reduced-motion — checklist
 * UI/UX bắt buộc, xem AGENTS.md.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-muted motion-safe:animate-pulse ${className}`} />
  );
}

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Bar className="h-8 w-40" />
        <Bar className="h-8 w-48" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-20" />
        ))}
      </div>

      <Bar className="h-40" />

      <Bar className="h-64" />
    </div>
  );
}
