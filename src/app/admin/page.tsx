import Link from "next/link";
import { getDashboardSnapshot } from "@/lib/analytics/queries";
import { publicBaseUrl } from "@/lib/env";
import { countryLabel, deviceLabel, sourceLabel } from "@/lib/labels";
import {
  Card,
  EmptyRow,
  Stat,
  StatusBadge,
  Table,
  TableWrap,
  TdNum,
  Th,
  Tr,
} from "@/components/ui";

/**
 * Dashboard tính ON-DEMAND (Gotcha 4.4): không rollup job, không cron.
 * Chủ dự án xác nhận dashboard không cần realtime, nên số liệu được cache 30s
 * ở tầng data (`getDashboardSnapshot`, xem lib/analytics/queries.ts) để chuyển
 * tab qua lại không chạy lại 6 aggregation mỗi lần. Trang vẫn render mỗi
 * request vì đọc `searchParams` (đổi khoảng ngày), chỉ query Mongo là được cache.
 *
 * UI theo design-system/trafficiq/pages/dashboard.md.
 * Ngôn ngữ: tiếng Việt. Viết tắt của ngành (CR) giữ nguyên vì tài liệu ad
 * network dùng đúng chữ đó, nhưng luôn kèm chú thích tiếng Việt bên dưới.
 *
 * KHÔNG có cột doanh thu/EPC — lý do ghi ở lib/analytics/queries.ts § Overview.
 */

const RANGES = [1, 7, 30] as const;

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam) as (typeof RANGES)[number])
    ? Number(daysParam)
    : 7;
  const { overview, campaignRows, sources, countries, devices, series } =
    await getDashboardSnapshot(days);

  const baseUrl = publicBaseUrl();
  const peak = Math.max(1, ...series.map((point) => point.clicks));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tổng quan</h1>
        <div className="flex gap-2 text-sm">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin?days=${option}`}
              aria-current={option === days ? "page" : undefined}
              className={`cursor-pointer rounded-lg border px-3 py-1 ${
                option === days
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === 1 ? "24 giờ" : `${option} ngày`}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI row — grid-gap 8px theo density 8/10 */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Lượt click"
          value={overview.clicks.toLocaleString("vi-VN")}
          hint={`đã loại ${overview.botClicks.toLocaleString("vi-VN")} lượt bot`}
        />
        <Stat
          label="Khách duy nhất"
          value={overview.uniqueVisitors.toLocaleString("vi-VN")}
          hint="đếm theo IP đã băm"
        />
        <Stat
          label="Chuyển đổi"
          value={overview.conversions.toLocaleString("vi-VN")}
          hint="từ postback của đối tác"
        />
        <Stat label="CR" value={pct(overview.cr)} hint="tỷ lệ chuyển đổi" />
      </div>

      <Card
        title="Lượt click theo thời gian"
        description={days === 1 ? "Theo giờ (giờ UTC)" : "Theo ngày (giờ UTC)"}
      >
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có lượt click nào trong khoảng thời gian này.
          </p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {series.map((point) => (
              <div
                key={point.bucket}
                title={`${point.bucket}: ${point.clicks} click`}
                className="flex-1 rounded-t bg-secondary transition-colors hover:bg-primary"
                style={{ height: `${Math.max(2, (point.clicks / peak) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Chiến dịch"
        description="Xếp theo số lượt click trong khoảng thời gian đã chọn."
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Chiến dịch</Th>
                <Th>Link theo dõi</Th>
                <Th align="right">Click</Th>
                <Th align="right">Chuyển đổi</Th>
                <Th align="right">CR</Th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.length === 0 ? (
                <EmptyRow colSpan={5}>
                  Chưa có chiến dịch nào — tạo ở mục Chiến dịch.
                </EmptyRow>
              ) : (
                campaignRows.map((row) => (
                  <Tr key={row.campaignId}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        <StatusBadge status={row.status} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-xs text-muted-foreground">
                        {`${baseUrl}/go/${row.token}`}
                      </code>
                    </td>
                    <TdNum>{row.clicks}</TdNum>
                    <TdNum>{row.conversions}</TdNum>
                    <TdNum>{pct(row.cr)}</TdNum>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="grid gap-2 lg:grid-cols-3">
        <Breakdown title="Nguồn traffic" rows={sources} label={sourceLabel} />
        <Breakdown title="Quốc gia" rows={countries} label={countryLabel} />
        <Breakdown title="Thiết bị" rows={devices} label={deviceLabel} />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  label,
}: {
  title: string;
  rows: { key: string; clicks: number }[];
  /** Dịch mã trong DB sang nhãn tiếng Việt — chỉ ở tầng hiển thị. */
  label: (key: string) => string;
}) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex justify-between gap-4 rounded px-1 transition-colors hover:bg-muted"
            >
              <span className="truncate">{label(row.key)}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {row.clicks}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
