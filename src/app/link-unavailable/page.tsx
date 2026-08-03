export const metadata = {
  title: "Link không còn hoạt động",
  robots: { index: false, follow: false },
};

/**
 * Đích của redirect khi token không resolve được (campaign paused, hết offer,
 * destination bị tắt, hoặc token sai). Trả về trang thân thiện thay vì 404 thô,
 * vì link này có thể đã được share ra ngoài.
 */
export default function LinkUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Link này không còn hoạt động</h1>
      <p className="text-muted-foreground">
        Chiến dịch có thể đã kết thúc hoặc tạm dừng. Vui lòng kiểm tra lại đường
        dẫn.
      </p>
    </main>
  );
}
