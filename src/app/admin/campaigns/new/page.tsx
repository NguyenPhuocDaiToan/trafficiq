import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CampaignEditLivePreview } from "@/components/campaign-edit-live-preview";
import { CampaignFields } from "@/components/campaign-fields";
import { Card, Notice } from "@/components/ui";
import { createCampaign } from "@/lib/control-plane/actions";
import { listActiveOptions } from "@/lib/control-plane/queries";
import { publicBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tạo chiến dịch" };

/**
 * Tách khỏi trang danh sách: form tạo có nhiều field, để chung một màn hình thì
 * danh sách bị đẩy xuống dưới và không xem được gì nếu không cuộn.
 *
 * Tạo xong, `createCampaign` redirect về /admin/campaigns?new=<slug> — trang đó
 * tự bung chi tiết chiến dịch mới để thêm đích chuyển hướng ngay.
 *
 * Field nằm ở <CampaignFields>, dùng chung với trang sửa. Đừng thêm field trực
 * tiếp vào đây: nó sẽ có ở form tạo mà không có ở form sửa, và mỗi lần admin bấm
 * Lưu là field đó bị xoá trắng.
 */
export default async function NewCampaignPage() {
  const options = await listActiveOptions();
  const baseUrl = publicBaseUrl();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/campaigns"
          className="cursor-pointer text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          ← Quay lại danh sách chiến dịch
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Tạo chiến dịch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đường dẫn tĩnh tự sinh từ tên chiến dịch, sửa lại được. Mã link theo dõi
          được sinh tự động, không đoán được. Chiến dịch mới ở trạng thái chờ duyệt
          — thêm đích chuyển hướng rồi kích hoạt thì link /go mới chạy. Bấm{" "}
          <span className="font-medium">Tạo và xem trước</span> để lưu nháp rồi xem
          ngay trang giới thiệu.
        </p>
      </div>

      {options.advertisers.length === 0 ? (
        <Card title="Chưa thể tạo chiến dịch">
          <Notice>
            Cần ít nhất một đối tác đang chạy trước khi tạo chiến dịch.{" "}
            <Link href="/admin/advertisers" className="cursor-pointer underline">
              Thêm đối tác
            </Link>
            .
          </Notice>
        </Card>
      ) : (
        <CampaignEditLivePreview baseUrl={baseUrl}>
          <Card title="Thông tin chiến dịch">
            <ActionForm
              action={createCampaign}
              submitLabel="Tạo chiến dịch"
              className="grid gap-3 sm:grid-cols-2"
              /*
               * Xem trước lúc tạo = lưu bản nháp rồi mở đúng trang xem trước đang
               * có. Chiến dịch mới luôn `pending` nên nó đã là nháp — không cần
               * (và không nên) dựng một đường render riêng cho nội dung chưa lưu:
               * hai bản render sẽ lệch nhau, và preview lệch tệ hơn không preview.
               */
              secondarySubmit={{
                name: "afterCreate",
                value: "preview",
                label: "Tạo và xem trước",
              }}
            >
              <CampaignFields advertisers={options.advertisers} />
            </ActionForm>
          </Card>

          {options.destinations.length === 0 ? (
            <Notice>
              Chưa có URL đích nào đang chạy. Tạo chiến dịch xong vẫn phải thêm URL
              đích ở mục URL đích rồi mới gắn được đích chuyển hướng.
            </Notice>
          ) : null}
        </CampaignEditLivePreview>
      )}
    </div>
  );
}
