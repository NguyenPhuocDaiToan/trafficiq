import Link from "next/link";
import { FieldsButton } from "@/components/action-form";
import { Card, Stat } from "@/components/ui";
import { setContactHandled } from "@/lib/contact/actions";
import { countUnhandledMessages, listContactMessages } from "@/lib/contact/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hộp thư liên hệ" };

/**
 * Hộp thư cho tin nhắn từ /lien-he.
 *
 * Tồn tại vì một lý do cụ thể: form liên hệ ghi vào DB chứ không gửi email. Không
 * có trang này thì thư của người thật rơi vào chỗ không ai đọc — tệ hơn là không
 * có form.
 */
export default async function ContactInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>;
}) {
  const { tat_ca } = await searchParams;
  const showAll = tat_ca === "1";

  const [rows, unhandled] = await Promise.all([
    listContactMessages(!showAll),
    countUnhandledMessages(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hộp thư liên hệ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tin nhắn gửi từ form ở trang{" "}
            <Link href="/lien-he" className="cursor-pointer text-primary underline">
              /lien-he
            </Link>
            . Hệ thống không gửi email — trả lời bằng cách bấm vào địa chỉ email của
            người gửi.
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <Link
            href="/admin/lien-he"
            aria-current={showAll ? undefined : "page"}
            className={`cursor-pointer rounded-lg border px-3 py-1 ${
              showAll
                ? "border-border text-muted-foreground hover:text-foreground"
                : "border-primary bg-primary text-on-primary"
            }`}
          >
            Chưa xử lý
          </Link>
          <Link
            href="/admin/lien-he?tat_ca=1"
            aria-current={showAll ? "page" : undefined}
            className={`cursor-pointer rounded-lg border px-3 py-1 ${
              showAll
                ? "border-primary bg-primary text-on-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Tất cả
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Chưa xử lý" value={unhandled.toLocaleString("vi-VN")} />
        <Stat
          label={showAll ? "Đang hiện (tất cả)" : "Đang hiện (chưa xử lý)"}
          value={rows.length.toLocaleString("vi-VN")}
          hint="tối đa 200 thư gần nhất"
        />
      </div>

      {rows.length === 0 ? (
        <Card title={showAll ? "Chưa có tin nhắn nào" : "Không còn thư chưa xử lý"}>
          <p className="text-sm text-muted-foreground">
            {showAll
              ? "Chưa ai gửi tin nhắn qua form liên hệ."
              : "Đã xử lý hết. Bấm “Tất cả” để xem lại thư cũ."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-sm)"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-semibold">{row.subject}</h2>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </p>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {row.name} ·{" "}
                <a
                  href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject}`)}`}
                  className="cursor-pointer text-primary underline"
                >
                  {row.email}
                </a>
              </p>

              {/* whitespace-pre-line: giữ đúng cách người gửi xuống dòng. */}
              <p className="mt-3 text-sm whitespace-pre-line">{row.message}</p>

              <div className="mt-4">
                {row.handled ? (
                  <FieldsButton
                    action={setContactHandled}
                    fields={{ id: row.id, handled: "false" }}
                    label="Mở lại"
                  />
                ) : (
                  <FieldsButton
                    action={setContactHandled}
                    fields={{ id: row.id, handled: "true" }}
                    label="Đánh dấu đã xử lý"
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
