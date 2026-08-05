import Link from "next/link";
import { ObjectId } from "mongodb";
import {
  BOT_LOG_PAGE_SIZE,
  listBotClicks,
  listCampaignChoices,
} from "@/lib/analytics/bot-log";
import { rangeForDays } from "@/lib/analytics/queries";
import { clickTtlDays } from "@/lib/env";
import { botReasonLabel, countryLabel, formatDateTime, sourceLabel } from "@/lib/labels";
import type { BotReason } from "@/lib/types";
import {
  Card,
  EmptyRow,
  Stat,
  Table,
  TableWrap,
  Th,
  Tr,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";

/**
 * Nhật ký từng lượt bot bị chặn ở `/go/[token]`.
 *
 * VÌ SAO TỒN TẠI: `/admin/tong-quan` chỉ trả lời "bao nhiêu" và "vì lý do gì".
 * Câu hỏi thật khi nghi chặn nhầm là "lượt lúc 14:03 đó là ai" — cần từng dòng,
 * kèm User-Agent nguyên văn. Không có trang này thì cách duy nhất để biết là mở
 * Atlas gõ query tay.
 *
 * KHÔNG cache (`force-dynamic`): xem lý do ở đầu lib/analytics/bot-log.ts.
 *
 * TOÀN BỘ state nằm trong URL và mọi control là `<Link>` hoặc `<form method="get">`
 * — không một dòng JS client nào, cùng lý do với `<details>` ở /admin/campaigns
 * và với action-form.tsx: control plane phải dùng được khi JS chưa tải.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Nhật ký bot" };

const RANGES = [1, 7, 30] as const;
const DEFAULT_DAYS = 7;

/**
 * Mặc định 7 ngày, KHÁC với `/admin/tong-quan` (mặc định hôm nay).
 *
 * Hai trang trả lời hai câu hỏi khác nhau. Tổng quan là "hôm nay chạy thế nào"
 * nên khoảng ngắn là đúng. Nhật ký bot mở ra khi có nghi ngờ, mà crawler ghé
 * thưa — một campaign có thể cả ngày không có lượt crawl nào. Mặc định "hôm nay"
 * ở đây phần lớn thời gian sẽ ra bảng rỗng, và bảng rỗng đọc ra như "tính năng
 * hỏng" chứ không ra "chưa có bot nào hôm nay".
 */

/** Giữ trùng khớp với type `BotReason` — thêm lý do mới thì thêm vào đây. */
const REASONS: { value: BotReason | "all"; label: string }[] = [
  { value: "all", label: "Tất cả lý do" },
  { value: "ua-regex", label: botReasonLabel("ua-regex") },
  { value: "twitter-asn", label: botReasonLabel("twitter-asn") },
];

function isReason(value: string | undefined): value is BotReason {
  return value === "ua-regex" || value === "twitter-asn";
}

/** Giữ nguyên các filter khác khi đổi một filter — nếu không, mỗi lần bấm là reset. */
function hrefWith(
  current: { days: number; reason?: string; campaign?: string; page: number },
  patch: Partial<{ days: number; reason?: string; campaign?: string; page: number }>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.days !== DEFAULT_DAYS) params.set("days", String(next.days));
  if (next.reason) params.set("ly_do", next.reason);
  if (next.campaign) params.set("chien_dich", next.campaign);
  if (next.page > 1) params.set("trang", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/nhat-ky-bot?${qs}` : "/admin/nhat-ky-bot";
}

export default async function BotLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    ly_do?: string;
    chien_dich?: string;
    trang?: string;
  }>;
}) {
  const params = await searchParams;

  const days = RANGES.includes(Number(params.days) as (typeof RANGES)[number])
    ? Number(params.days)
    : DEFAULT_DAYS;
  const reason = isReason(params.ly_do) ? params.ly_do : undefined;
  // ObjectId.isValid trước khi dựng: `?chien_dich=abc` là chuỗi người ta gõ tay
  // vào URL, và `new ObjectId("abc")` thì THROW chứ không trả null — tức 500 cho
  // một lỗi đánh máy. Không hợp lệ thì coi như không lọc.
  const campaignId =
    params.chien_dich && ObjectId.isValid(params.chien_dich)
      ? new ObjectId(params.chien_dich)
      : undefined;
  const requestedPage = Number(params.trang);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [log, campaignChoices] = await Promise.all([
    listBotClicks({ range: rangeForDays(days), reason, campaignId, page }),
    listCampaignChoices(),
  ]);

  const current = {
    days,
    reason,
    campaign: campaignId?.toString(),
    page: log.page,
  };
  const firstOnPage = (log.page - 1) * BOT_LOG_PAGE_SIZE + 1;
  const lastOnPage = Math.min(log.page * BOT_LOG_PAGE_SIZE, log.total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nhật ký bot</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Từng request bị chặn ở <code className="font-mono text-xs">/go/[token]</code>{" "}
            và được trả Social Card thay vì chuyển hướng. Các lượt này{" "}
            <strong className="font-medium text-foreground">không</strong> nằm trong số
            liệu click ở Tổng quan.
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={hrefWith(current, { days: option, page: 1 })}
              aria-current={option === days ? "page" : undefined}
              className={`cursor-pointer rounded-lg border px-3 py-1 transition-colors duration-150 ${
                option === days
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === 1 ? "Hôm nay" : `${option} ngày`}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Lượt bị chặn"
          value={log.total.toLocaleString("vi-VN")}
          hint="trong khoảng đã chọn, sau khi lọc"
        />
        <Stat
          label="Trang"
          value={`${log.page}/${log.pageCount}`}
          hint={`${BOT_LOG_PAGE_SIZE} dòng mỗi trang`}
        />
        <Stat
          label="Lưu tối đa"
          value={`${clickTtlDays()} ngày`}
          /* Đọc từ clickTtlDays() chứ không viết cứng, cùng luật với trang
             /chinh-sach-bao-mat: đổi CLICK_TTL_DAYS mà con số ở đây đứng yên là
             UI nói dối về thứ đã bị TTL index xoá mất. */
          hint="clickEvents có TTL index — cũ hơn sẽ tự xoá"
        />
      </div>

      {/*
        Lọc bằng <form method="get"> chứ không phải onChange: không có JS thì
        select vẫn gửi được bằng nút "Lọc". Nút submit là bắt buộc chính vì thế —
        đừng bỏ nó đi rồi thay bằng auto-submit.
      */}
      <Card title="Bộ lọc">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {/* days nằm trong URL nên phải mang theo qua form, nếu không mỗi lần
              lọc là khoảng thời gian bật về mặc định. */}
          {days !== DEFAULT_DAYS ? (
            <input type="hidden" name="days" value={days} />
          ) : null}

          <label className="block text-sm">
            <span className="font-medium">Lý do chặn</span>
            <select
              name="ly_do"
              defaultValue={reason ?? "all"}
              className={`${inputClass} mt-1 cursor-pointer sm:w-64`}
            >
              {REASONS.map((option) => (
                <option
                  key={option.value}
                  // "all" gửi chuỗi rỗng => không xuất hiện trong URL.
                  value={option.value === "all" ? "" : option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium">Chiến dịch</span>
            <select
              name="chien_dich"
              defaultValue={campaignId?.toString() ?? ""}
              className={`${inputClass} mt-1 cursor-pointer sm:w-64`}
            >
              <option value="">Tất cả chiến dịch</option>
              {campaignChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className={`${buttonSecondaryClass} py-2`}>
            Lọc
          </button>

          {reason || campaignId ? (
            <Link
              href={hrefWith({ days, page: 1 }, {})}
              className="cursor-pointer py-2 text-sm text-muted-foreground underline hover:text-foreground"
            >
              Xoá bộ lọc
            </Link>
          ) : null}
        </form>
      </Card>

      <Card
        title="Các lượt bị chặn"
        description={
          log.total > 0
            ? `Hiển thị ${firstOnPage.toLocaleString("vi-VN")}–${lastOnPage.toLocaleString("vi-VN")} trong ${log.total.toLocaleString("vi-VN")} lượt, mới nhất trước.`
            : undefined
        }
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Lý do</Th>
                <Th>Chiến dịch</Th>
                <Th>Nguồn</Th>
                <Th>Quốc gia</Th>
                <Th>User-Agent</Th>
              </tr>
            </thead>
            <tbody>
              {log.rows.length === 0 ? (
                <EmptyRow colSpan={6}>
                  Không có lượt nào khớp — thử nới khoảng thời gian hoặc bỏ bộ lọc.
                </EmptyRow>
              ) : (
                log.rows.map((row) => (
                  <Tr key={row.clickId}>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap tabular-nums">
                      {formatDateTime(row.ts)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {botReasonLabel(row.reason)}
                    </td>
                    <td className="px-3 py-2">
                      {row.campaignName ?? (
                        <span className="text-muted-foreground">đã xoá</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                    <td className="px-3 py-2">{countryLabel(row.country)}</td>
                    {/*
                      UA là thứ DUY NHẤT phân biệt được Googlebot với một script
                      cào hàng, nên không cắt ngắn bằng ellipsis — cho cả chuỗi
                      và để TableWrap cuộn ngang (đúng luật dashboard.md: bảng
                      rộng thì cuộn, không phá layout).
                    */}
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.userAgent ?? "—"}
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>

        {log.pageCount > 1 ? (
          <nav
            aria-label="Phân trang"
            className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"
          >
            {log.page > 1 ? (
              <Link
                href={hrefWith(current, { page: log.page - 1 })}
                className={buttonSecondaryClass}
              >
                ← Trang trước
              </Link>
            ) : (
              /* Giữ chỗ để nút "Trang sau" không nhảy sang trái ở trang 1. */
              <span />
            )}

            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {log.page}/{log.pageCount}
            </span>

            {log.page < log.pageCount ? (
              <Link
                href={hrefWith(current, { page: log.page + 1 })}
                className={buttonSecondaryClass}
              >
                Trang sau →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
