import type { EntityStatus } from "@/lib/types";

/*
 * Primitives theo design-system/trafficiq/MASTER.md + pages/dashboard.md.
 *
 * Luật: KHÔNG hard-code màu (không `neutral-500`, không `#hex`). Chỉ dùng
 * semantic token khai báo trong globals.css. Đổi màu = sửa MASTER.md.
 */

const STATUS_STYLES: Record<EntityStatus, string> = {
  active: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  paused: "bg-muted text-muted-foreground",
};

/**
 * Nhãn tiếng Việt cho trạng thái. Giá trị trong DB vẫn là "active"/"pending"/
 * "paused" — chỉ đổi cách hiển thị. Đừng dịch giá trị lưu xuống Mongo, sẽ vỡ
 * mọi filter trong aggregation và resolve.ts.
 */
export const STATUS_LABELS: Record<EntityStatus, string> = {
  active: "Đang chạy",
  pending: "Chờ duyệt",
  paused: "Tạm dừng",
};

export function StatusBadge({ status }: { status: EntityStatus | string }) {
  const style = STATUS_STYLES[status as EntityStatus] ?? STATUS_STYLES.paused;
  const label = STATUS_LABELS[status as EntityStatus] ?? status;
  return (
    // font-sans, KHÔNG font-mono: nhãn giờ là chữ tiếng Việt có dấu.
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
  );
}

export function Field({
  label,
  hint,
  help,
  helpTone = "muted",
  tour,
  className,
  children,
}: {
  label: string;
  /** Chú thích NGẮN cùng dòng với nhãn, vd "(không bắt buộc)". Câu dài thì dùng `help`. */
  hint?: string;
  /**
   * Chú thích dưới ô nhập. Câu dài để ở đây chứ không để cạnh nhãn: cạnh nhãn nó tràn xuống dòng và làm hai
   * cột đứng cạnh nhau lệch độ cao, ô nhập không còn thẳng hàng.
   */
  help?: string;
  /** `warning` cho điều có hậu quả (vd đổi đường dẫn làm link đã chia sẻ chết). */
  helpTone?: "muted" | "warning";
  /** Điểm chỉ của coach mark (`data-tour`) — xem `lib/guide/lessons.ts`. */
  tour?: string;
  /** Vd `sm:col-span-2` để field chiếm cả hàng của lưới cha. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`} data-tour={tour}>
      <span className="font-medium">{label}</span>
      {hint ? <span className="ml-1 text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1">{children}</div>
      {help ? (
        <p className={`mt-1 text-xs ${helpTone === "warning" ? "text-warning" : "text-muted-foreground"}`}>{help}</p>
      ) : null}
    </label>
  );
}

/**
 * Một nhóm field trong form dài: tiêu đề + một câu mô tả + lưới field. Dùng thay cho việc xếp mọi field vào
 * một lưới phẳng với vài dòng tiêu đề nhỏ — ở form 12 field đó là thứ khiến form trông rối: không có chỗ nào
 * để mắt dừng, và các ô không liên quan nằm chung một hàng.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="border-b border-border pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Input dùng `border-input` (đạt 3:1) chứ KHÔNG dùng `border-border` — viền
 * control là thứ duy nhất chỉ ra vùng nhập liệu nên phải nhìn thấy được.
 * Focus ring do :focus-visible global lo (globals.css).
 */
export const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none";

/** CTA chính. Accent là màu DUY NHẤT được dùng cho primary action. */
export const buttonPrimaryClass =
  "cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/** Action phụ: outline theo primary, không tranh chấp với CTA. */
export const buttonSecondaryClass =
  "cursor-pointer rounded-lg border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * CTA chính khi nó là một <Link> chứ không phải <button> (vd "Tạo chiến dịch"
 * điều hướng sang trang tạo). Cùng hình dáng với `buttonPrimaryClass` để một
 * view không có hai kiểu nút accent khác nhau.
 */
export const linkPrimaryClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity duration-150 hover:opacity-90";

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-md)">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Mũi tên của hàng bung/thu. SVG chứ không emoji (checklist MASTER.md). */
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
    >
      <path
        d="M7.5 4.5 13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hàng bấm vào để xổ chi tiết.
 *
 * Dựng bằng `<details>` chứ không phải state React, cùng lý do với action-form:
 * control plane phải dùng được khi JS chưa tải xong. `<summary>` còn có sẵn
 * focus ring, Enter/Space và semantics expand/collapse từ trình duyệt — tự nối
 * lại bằng div + onClick là tự bỏ hết những thứ đó.
 */
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  tour,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Điểm chỉ của coach mark (`data-tour`) — xem `lib/guide/lessons.ts`. */
  tour?: string;
}) {
  return (
    <details
      data-tour={tour}
      open={defaultOpen}
      // Khi đóng, summary là đáy card nên phải bo nốt góc dưới — nếu không,
      // nền hover vuông góc sẽ thò ra khỏi viền bo của card.
      className="group rounded-xl border border-border bg-card text-card-foreground shadow-(--shadow-sm) [&:not([open])>summary]:rounded-b-xl"
    >
      <summary className="flex list-none cursor-pointer items-center gap-3 rounded-t-xl px-4 py-3 transition-colors duration-150 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <ChevronIcon />
        <div className="min-w-0 flex-1">{summary}</div>
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

/** KPI card. Số liệu dùng font-mono để các card thẳng hàng theo chiều dọc. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-card-foreground shadow-(--shadow-sm)">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/*
 * Table primitives — Data-Dense Dashboard: row height 36px, font-size 12-14px,
 * sticky header, row highlight on hover, horizontal scroll thay vì phá layout.
 */

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}

export function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`sticky top-0 bg-card px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="h-9 border-t border-border transition-colors hover:bg-muted">
      {children}
    </tr>
  );
}

/** Ô số liệu: luôn mono + tabular-nums, luôn canh phải. */
export function TdNum({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-right font-mono tabular-nums">{children}</td>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

/** Cảnh báo blocking trong control plane (thiếu advertiser active, v.v.). */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">{children}</p>
  );
}
