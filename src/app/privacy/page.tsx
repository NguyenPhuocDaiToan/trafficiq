export const metadata = {
  title: "Chính sách quyền riêng tư · TrafficIQ",
  description: "Cách TrafficIQ thu thập và xử lý dữ liệu khi bạn click vào link.",
};

/**
 * TODO trước khi chạy traffic thật: cho legal review và điền tên pháp nhân,
 * email liên hệ, cơ sở pháp lý xử lý dữ liệu (GDPR/PDPA nếu có traffic EU/SG).
 * Đây là bản khung, không phải văn bản pháp lý hoàn chỉnh.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16">
      <h1 className="text-3xl font-bold">Chính sách quyền riêng tư</h1>

      <h2 className="pt-4 text-xl font-semibold">Dữ liệu chúng tôi thu thập</h2>
      <p>
        Khi bạn click vào một link theo dõi, chúng tôi ghi lại: thời điểm click,
        campaign tương ứng, nguồn traffic, quốc gia/khu vực (mức thành phố), loại
        thiết bị, trình duyệt, hệ điều hành và trang giới thiệu (referrer).
      </p>

      <h2 className="pt-4 text-xl font-semibold">Địa chỉ IP</h2>
      <p>
        Chúng tôi <strong>không lưu địa chỉ IP dạng thô</strong>. IP được băm một
        chiều (SHA-256 với salt bí mật) trước khi lưu, chỉ nhằm đếm lượt truy cập
        duy nhất và phát hiện gian lận. Từ giá trị đã băm không thể suy ra IP gốc.
      </p>

      <h2 className="pt-4 text-xl font-semibold">Thời gian lưu trữ</h2>
      <p>
        Dữ liệu click chi tiết được tự động xóa sau 30 ngày. Sau đó chúng tôi chỉ
        giữ số liệu tổng hợp, không còn gắn với từng lượt truy cập.
      </p>

      <h2 className="pt-4 text-xl font-semibold">Chia sẻ với bên thứ ba</h2>
      <p>
        Khi bạn được chuyển tới trang của đối tác quảng cáo, chúng tôi truyền một
        mã click ngẫu nhiên (click ID) để đối chiếu chuyển đổi. Mã này không chứa
        thông tin cá nhân của bạn.
      </p>

      <h2 className="pt-4 text-xl font-semibold">Liên hệ</h2>
      <p>
        Để yêu cầu truy cập hoặc xóa dữ liệu, liên hệ: <em>[điền email]</em>.
      </p>
    </main>
  );
}
