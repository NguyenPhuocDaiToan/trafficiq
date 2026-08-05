import Link from "next/link";
import { ObjectId } from "mongodb";
import {
  type BotLogPage,
  type CampaignChoice,
  type HumanLogPage,
  LOG_PAGE_SIZE,
  listBotClicks,
  listCampaignChoices,
  listHumanClicks,
} from "@/lib/analytics/click-log";
import { rangeForDays } from "@/lib/analytics/queries";
import { clickTtlDays } from "@/lib/env";
import {
  botReasonLabel,
  countryLabel,
  deviceLabel,
  formatDateTime,
  sourceLabel,
  weakSignalLabel,
} from "@/lib/labels";
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
 * Nhật ký từng lượt click ở `/go/[token]`, hai tab: bot bị chặn và click thường.
 *
 * VÌ SAO TỒN TẠI: `/admin/tong-quan` chỉ trả lời "bao nhiêu". Câu hỏi thật khi
 * nghi chặn nhầm là "lượt lúc 14:03 đó là ai" — cần từng dòng, kèm User-Agent
 * nguyên văn. Không có trang này thì cách duy nhất để biết là mở Atlas gõ query
 * tay.
 *
 * VÌ SAO MỘT TRANG HAI TAB, không phải hai trang: hai bảng đọc CÙNG một
 * collection và chỉ khác nhau ở điều kiện `device`. Người dùng chúng cũng đang
 * hỏi một câu duy nhất — "lượt của tôi rơi vào bên nào" — nên phải đổi qua lại
 * được bằng một cú bấm, không phải điều hướng sang trang khác rồi đặt lại khoảng
 * thời gian và bộ lọc chiến dịch.
 *
 * KHÔNG cache (`force-dynamic`): xem lý do ở đầu lib/analytics/click-log.ts.
 *
 * TOÀN BỘ state nằm trong URL và mọi control là `<Link>` hoặc `<form method="get">`
 * — không một dòng JS client nào, cùng lý do với `<details>` ở /admin/campaigns
 * và với action-form.tsx: control plane phải dùng được khi JS chưa tải.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Nhật ký click" };

const RANGES = [1, 7, 30] as const;
const DEFAULT_DAYS = 7;

/**
 * Mặc định 7 ngày, KHÁC với `/admin/tong-quan` (mặc định hôm nay).
 *
 * Hai trang trả lời hai câu hỏi khác nhau. Tổng quan là "hôm nay chạy thế nào"
 * nên khoảng ngắn là đúng. Nhật ký mở ra khi có nghi ngờ, mà crawler ghé thưa —
 * một campaign có thể cả ngày không có lượt crawl nào. Mặc định "hôm nay" ở đây
 * phần lớn thời gian sẽ ra bảng rỗng, và bảng rỗng đọc ra như "tính năng hỏng"
 * chứ không ra "chưa có bot nào hôm nay".
 */

type Tab = "bot" | "that";

const TABS: { value: Tab; label: string; hint: string }[] = [
  { value: "bot", label: "Bot bị chặn", hint: "Nhóm này không tính vào số liệu click." },
  { value: "that", label: "Click thường", hint: "Đây chính là số ở ô “Lượt click”." },
];

/** Giữ trùng khớp với type `BotReason` — thêm lý do mới thì thêm vào đây. */
const REASONS: { value: BotReason | "all"; label: string }[] = [
  { value: "all", label: "Tất cả lý do" },
  { value: "ua-regex", label: botReasonLabel("ua-regex") },
  { value: "twitter-asn", label: botReasonLabel("twitter-asn") },
];

function isReason(value: string | undefined): value is BotReason {
  return value === "ua-regex" || value === "twitter-asn";
}

interface UrlState {
  tab: Tab;
  days: number;
  reason?: string;
  campaign?: string;
  page: number;
  cursor?: string;
}

/**
 * Giữ nguyên các filter khác khi đổi một filter — nếu không, mỗi lần bấm là reset.
 *
 * Số trang và con trỏ KHÔNG được mang theo mặc định: chúng thuộc về một kết quả
 * cụ thể, nên đổi tab hay đổi khoảng thời gian mà giữ lại là trỏ vào chỗ không
 * còn tồn tại. Nơi nào cần giữ thì truyền tường minh trong `patch`.
 */
function hrefWith(current: UrlState, patch: Partial<UrlState>): string {
  const next = { ...current, page: 1, cursor: undefined, ...patch };
  const params = new URLSearchParams();
  if (next.tab !== "bot") params.set("loai", next.tab);
  if (next.days !== DEFAULT_DAYS) params.set("days", String(next.days));
  if (next.reason) params.set("ly_do", next.reason);
  if (next.campaign) params.set("chien_dich", next.campaign);
  if (next.page > 1) params.set("trang", String(next.page));
  if (next.cursor) params.set("tu", next.cursor);
  const qs = params.toString();
  return qs ? `/admin/nhat-ky?${qs}` : "/admin/nhat-ky";
}

export default async function ClickLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    loai?: string;
    days?: string;
    ly_do?: string;
    chien_dich?: string;
    trang?: string;
    tu?: string;
  }>;
}) {
  const params = await searchParams;

  const tab: Tab = params.loai === "that" ? "that" : "bot";
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

  const range = rangeForDays(days);
  const [log, campaignChoices] = await Promise.all([
    tab === "bot"
      ? listBotClicks({ range, reason, campaignId, page })
      : listHumanClicks({ range, campaignId, cursor: params.tu }),
    listCampaignChoices(),
  ]);

  const current: UrlState = {
    tab,
    days,
    reason,
    campaign: campaignId?.toString(),
    page: "page" in log ? log.page : 1,
    cursor: params.tu,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nhật ký click</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Từng request tới <code className="font-mono text-xs">/go/[token]</code>, mới
            nhất trước. {TABS.find((item) => item.value === tab)?.hint}
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={hrefWith(current, { days: option })}
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

      {/*
        Tab dựng bằng <Link> + border-b, cùng ngôn ngữ với AdminNav — không phải
        state React. Đổi tab là đổi URL, nên F5 hay chia sẻ link đều ra đúng chỗ.
      */}
      <nav aria-label="Loại bản ghi" className="flex gap-4 border-b border-border text-sm">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={hrefWith(current, { tab: item.value })}
            aria-current={item.value === tab ? "page" : undefined}
            className={`-mb-px cursor-pointer border-b-2 px-1 py-2 font-medium transition-colors duration-150 ${
              item.value === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Filters
        current={current}
        tab={tab}
        days={days}
        reason={reason}
        campaignId={campaignId}
        choices={campaignChoices}
      />

      {tab === "bot" ? (
        <BotTable log={log as BotLogPage} current={current} />
      ) : (
        <HumanTable log={log as HumanLogPage} current={current} />
      )}
    </div>
  );
}

/**
 * Lọc bằng `<form method="get">` chứ không phải onChange: không có JS thì select
 * vẫn gửi được bằng nút "Lọc". Nút submit là bắt buộc chính vì thế — đừng bỏ nó
 * đi rồi thay bằng auto-submit.
 *
 * Ô "Lý do chặn" chỉ có ở tab bot: click thường không có `botReason`, để ô đó ở
 * đây là mời người ta lọc theo một field luôn rỗng rồi tưởng không có dữ liệu.
 */
function Filters({
  current,
  tab,
  days,
  reason,
  campaignId,
  choices,
}: {
  current: UrlState;
  tab: Tab;
  days: number;
  reason?: string;
  campaignId?: ObjectId;
  choices: CampaignChoice[];
}) {
  return (
    <Card title="Bộ lọc">
      <form method="get" className="flex flex-wrap items-end gap-3">
        {/* Tab và khoảng thời gian nằm trong URL nên phải mang theo qua form,
            nếu không mỗi lần bấm Lọc là cả hai bật về mặc định. */}
        {tab !== "bot" ? <input type="hidden" name="loai" value={tab} /> : null}
        {days !== DEFAULT_DAYS ? <input type="hidden" name="days" value={days} /> : null}

        {tab === "bot" ? (
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
        ) : null}

        <label className="block text-sm">
          <span className="font-medium">Chiến dịch</span>
          <select
            name="chien_dich"
            defaultValue={campaignId?.toString() ?? ""}
            className={`${inputClass} mt-1 cursor-pointer sm:w-64`}
          >
            <option value="">Tất cả chiến dịch</option>
            {choices.map((choice) => (
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
            href={hrefWith(current, { reason: undefined, campaign: undefined })}
            className="cursor-pointer py-2 text-sm text-muted-foreground underline hover:text-foreground"
          >
            Xoá bộ lọc
          </Link>
        ) : null}
      </form>
    </Card>
  );
}

function BotTable({ log, current }: { log: BotLogPage; current: UrlState }) {
  const first = (log.page - 1) * LOG_PAGE_SIZE + 1;
  const last = Math.min(log.page * LOG_PAGE_SIZE, log.total);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Lượt bị chặn"
          value={log.total.toLocaleString("vi-VN")}
          hint="trong khoảng đã chọn, sau khi lọc"
        />
        <Stat
          label="Trang"
          value={`${log.page}/${log.pageCount}`}
          hint={`${LOG_PAGE_SIZE} dòng mỗi trang`}
        />
        <TtlStat />
      </div>

      <Card
        title="Các lượt bị chặn"
        description={
          log.total > 0
            ? `Hiển thị ${first.toLocaleString("vi-VN")}–${last.toLocaleString("vi-VN")} trong ${log.total.toLocaleString("vi-VN")} lượt.`
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
                    <TdTime ts={row.ts} />
                    <td className="px-3 py-2 whitespace-nowrap">
                      {botReasonLabel(row.reason)}
                    </td>
                    <TdCampaign name={row.campaignName} />
                    <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                    <td className="px-3 py-2">{countryLabel(row.country)}</td>
                    <TdUserAgent value={row.userAgent} />
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
    </>
  );
}

/**
 * Bảng click thường — chỉ có "Trang sau", không số trang, không tổng.
 *
 * Lý do kỹ thuật ở `listHumanClicks`. Hệ quả trên UI phải bù lại: đi tới thì
 * được, lùi từng bước thì KHÔNG (muốn lùi phải giữ cả ngăn xếp con trỏ, mà nhật
 * ký thì người ta đọc xuôi). Vì vậy luôn phải có đường "Về đầu" — thiếu nó thì
 * bấm quá tay một cái là kẹt, chỉ còn cách sửa URL bằng tay.
 */
function HumanTable({ log, current }: { log: HumanLogPage; current: UrlState }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat
          label="Đang hiện"
          value={log.rows.length.toLocaleString("vi-VN")}
          hint={`tối đa ${LOG_PAGE_SIZE} dòng mỗi lần`}
        />
        <Stat
          label="Vị trí"
          value={current.cursor ? "Trang tiếp" : "Mới nhất"}
          hint={log.nextCursor ? "còn dữ liệu cũ hơn" : "đã tới cuối"}
        />
        <TtlStat />
      </div>

      <Card
        title="Click thường"
        description="Đúng tập dữ liệu mà ô “Lượt click” ở Tổng quan đếm — bot đã bị loại."
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Chiến dịch</Th>
                <Th>Thiết bị</Th>
                <Th>Trình duyệt / OS</Th>
                <Th>Nguồn</Th>
                <Th>Quốc gia</Th>
                <Th>Tín hiệu yếu</Th>
                <Th>User-Agent</Th>
              </tr>
            </thead>
            <tbody>
              {log.rows.length === 0 ? (
                <EmptyRow colSpan={8}>
                  Không có lượt nào khớp — thử nới khoảng thời gian hoặc bỏ bộ lọc.
                </EmptyRow>
              ) : (
                log.rows.map((row) => (
                  <Tr key={row.clickId}>
                    <TdTime ts={row.ts} />
                    <TdCampaign name={row.campaignName} />
                    <td className="px-3 py-2 whitespace-nowrap">
                      {deviceLabel(row.device)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.browser} / {row.os}
                    </td>
                    <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                    <td className="px-3 py-2">{countryLabel(row.country)}</td>
                    {/*
                      Cột này là lý do chính để mở tab "Click thường": nó chỉ ra
                      đúng những lượt mà bản cũ của isBotRequest() ĐÃ chặn nhầm
                      (xem tracking/ua.ts). Rỗng là bình thường; có giá trị mới
                      đáng nhìn, nên tô nền warning thay vì để lẫn vào bảng.
                    */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.weakSignals.length > 0 ? (
                        <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                          {row.weakSignals.map(weakSignalLabel).join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <TdUserAgent value={row.userAgent} />
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>

        {log.nextCursor || current.cursor ? (
          <nav
            aria-label="Điều hướng nhật ký"
            className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm"
          >
            {current.cursor ? (
              <Link href={hrefWith(current, {})} className={buttonSecondaryClass}>
                ↑ Về đầu
              </Link>
            ) : (
              <span />
            )}

            {log.nextCursor ? (
              <Link
                href={hrefWith(current, { cursor: log.nextCursor })}
                className={buttonSecondaryClass}
              >
                Trang sau →
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Hết dữ liệu</span>
            )}
          </nav>
        ) : null}
      </Card>
    </>
  );
}

/**
 * Đọc từ `clickTtlDays()` chứ không viết cứng "30 ngày", cùng luật với trang
 * /chinh-sach-bao-mat: đổi CLICK_TTL_DAYS mà con số ở đây đứng yên là UI nói dối
 * về thứ đã bị TTL index xoá mất.
 */
function TtlStat() {
  return (
    <Stat
      label="Lưu tối đa"
      value={`${clickTtlDays()} ngày`}
      hint="clickEvents có TTL index — cũ hơn sẽ tự xoá"
    />
  );
}

function TdTime({ ts }: { ts: Date }) {
  return (
    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap tabular-nums">
      {formatDateTime(ts)}
    </td>
  );
}

function TdCampaign({ name }: { name: string | null }) {
  return (
    <td className="px-3 py-2">
      {name ?? <span className="text-muted-foreground">đã xoá</span>}
    </td>
  );
}

/**
 * UA là thứ DUY NHẤT phân biệt được Googlebot với một script cào hàng, và ở tab
 * click thường thì nó là cách nhận ra webview trong app. Không cắt ngắn bằng
 * ellipsis — cho cả chuỗi và để TableWrap cuộn ngang (đúng luật dashboard.md:
 * bảng rộng thì cuộn, không phá layout).
 */
function TdUserAgent({ value }: { value: string | null }) {
  return (
    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{value ?? "—"}</td>
  );
}
