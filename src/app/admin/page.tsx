import Link from "next/link";
import {
  getCampaignBreakdown,
  getClicksTimeseries,
  getDimensionBreakdown,
  getOverview,
  rangeForDays,
} from "@/lib/analytics/queries";
import { publicBaseUrl } from "@/lib/env";
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
 * `force-dynamic` vì mọi số liệu phải là realtime — cache trang ở đây là sai.
 *
 * UI theo design-system/trafficiq/pages/dashboard.md.
 */
export const dynamic = "force-dynamic";

const RANGES = [1, 7, 30] as const;

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
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
  const range = rangeForDays(days);

  const [overview, campaignRows, sources, countries, devices, series] =
    await Promise.all([
      getOverview(range),
      getCampaignBreakdown(range),
      getDimensionBreakdown(range, "source"),
      getDimensionBreakdown(range, "country"),
      getDimensionBreakdown(range, "device"),
      getClicksTimeseries(range, days === 1 ? "hour" : "day"),
    ]);

  const baseUrl = publicBaseUrl();
  const peak = Math.max(1, ...series.map((point) => point.clicks));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-semibold">Dashboard</h1>
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Clicks"
          value={overview.clicks.toLocaleString("vi-VN")}
          hint={`${overview.botClicks.toLocaleString("vi-VN")} bot đã loại`}
        />
        <Stat
          label="Unique"
          value={overview.uniqueVisitors.toLocaleString("vi-VN")}
          hint="theo IP đã hash"
        />
        <Stat label="Conversions" value={overview.conversions.toLocaleString("vi-VN")} />
        <Stat label="CR" value={pct(overview.cr)} />
        <Stat label="Payout" value={usd(overview.payout)} hint={`EPC ${usd(overview.epc)}`} />
      </div>

      <Card
        title="Clicks theo thời gian"
        description={days === 1 ? "Theo giờ (UTC)" : "Theo ngày (UTC)"}
      >
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có click nào trong khoảng này.</p>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {series.map((point) => (
              <div
                key={point.bucket}
                title={`${point.bucket}: ${point.clicks}`}
                className="flex-1 rounded-t bg-secondary transition-colors hover:bg-primary"
                style={{ height: `${Math.max(2, (point.clicks / peak) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Campaigns" description="Xếp theo số click trong khoảng đã chọn.">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th>Link</Th>
                <Th align="right">Clicks</Th>
                <Th align="right">Conv.</Th>
                <Th align="right">CR</Th>
                <Th align="right">EPC</Th>
                <Th align="right">Payout</Th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.length === 0 ? (
                <EmptyRow colSpan={7}>
                  Chưa có campaign nào — tạo ở tab Campaigns.
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
                    <TdNum>{usd(row.epc)}</TdNum>
                    <TdNum>{usd(row.payout)}</TdNum>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="grid gap-2 lg:grid-cols-3">
        <Breakdown title="Top source" rows={sources} />
        <Breakdown title="Top quốc gia" rows={countries} />
        <Breakdown title="Thiết bị" rows={devices} />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; clicks: number }[];
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
              <span className="truncate">{row.key}</span>
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
