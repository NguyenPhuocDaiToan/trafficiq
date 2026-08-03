# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** TrafficIQ
**Generated:** 2026-08-03 20:54:39
**Category:** Analytics Dashboard
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 3/10 (Subtle) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E40AF` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| Accent/CTA | `#D97706` | `--color-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#1E3A8A` | `--color-foreground` |
| Muted | `#E9EEF6` | `--color-muted` |
| Border | `#DBEAFE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#1E40AF` | `--color-ring` |

**Color Notes:** Blue data + amber highlights [Accent adjusted from #F59E0B for WCAG 3:1]

> ### ⚠️ Sai lệch có chủ đích so với palette sinh tự động
>
> Bảng trên là output gốc của ui-ux-pro-max. **5 giá trị trong đó không đạt chính
> checklist "text contrast 4.5:1" ở cuối file này.** Giá trị đang chạy thật nằm ở
> `src/app/globals.css`, kiểm được bằng `npm run check:contrast`.
>
> | Token | Palette gốc | Đang dùng | Lý do |
> |---|---|---|---|
> | `--accent` | `#D97706` | `#92400E` | Gốc chỉ đạt **3.19:1** với chữ trắng. 3:1 là ngưỡng UI phi-text, nhưng accent là nền nút có chữ → cần 4.5:1. Giá trị mới đạt **7.09:1**, thoả luôn mục tiêu CTA 7:1 của `pages/campaign-landing.md`. |
> | `--muted-foreground` | `#64748B` | `#556274` | Gốc chỉ **4.08:1** trên nền `--muted` (badge paused). Mới: **5.32:1**. |
> | `--success` | `#15803D` | `#166534` | Gốc **4.09:1** trên nền tint 15% của chính nó. Mới: **5.66:1**. |
> | `--warning` | `#B45309` | `#854D0E` | Gốc **4.08:1** trên tint 15%. Mới: **5.46:1**. |
> | `--card` | `#F8FAFC` | `#FFFFFF` | Component spec `.card` bên dưới đặt background **trùng hệt** `--background` → card vô hình. `#FFFFFF` là Card role trong palette gốc. |
>
> Thêm token không có trong palette gốc:
>
> - `--input` (`#7C8DA5` light / `#64748B` dark) — viền control phải đạt 3:1 theo
>   WCAG 1.4.11. `--border` (`#DBEAFE`) giữ nhạt và **chỉ** dùng cho divider/viền
>   card; nó không mang thông tin trạng thái nên không bị ràng 3:1.
> - Toàn bộ **bộ dark** — palette gốc chỉ có light, nhưng style
>   "Data-Dense Dashboard" khai báo `Dark ✓ Full` nên buộc phải suy ra.
>   Cách suy: giữ họ xanh, đảo trục sáng, làm sáng primary/accent.
>
> **Quy tắc:** đổi màu thì sửa bảng này TRƯỚC, rồi đồng bộ xuống `globals.css`,
> rồi chạy `npm run check:contrast`. Không sửa ngược lại.

### Typography

- **Heading Font:** Be Vietnam Pro
- **Body Font:** Be Vietnam Pro
- **Numeric / Code Font:** JetBrains Mono
- **Mood:** vietnamese, humanist, readable, friendly, precise-where-it-counts

> ### ⚠️ Sai lệch có chủ đích so với pairing sinh tự động
>
> Output gốc của `--design-system` cho dự án này là pairing **#42 "Dashboard Data"
> = Fira Code (heading) + Fira Sans (body)**. Đã dùng nó ở bản đầu và **nó sai với
> một site tiếng Việt**:
>
> **Fira Code không có subset `vietnamese`.** Kiểm được bằng hai nguồn độc lập:
>
> ```bash
> # 1. Dữ liệu font của Next
> node -e "console.log(require('next/dist/compiled/@next/font/dist/google/font-data.json')['Fira Code'].subsets.join(','))"
> # -> cyrillic,cyrillic-ext,greek,greek-ext,latin,latin-ext,symbols2   (KHÔNG có vietnamese)
>
> # 2. Chính data của skill: cột Subsets trong data/google-fonts.csv
> ```
>
> Hệ quả cụ thể: MASTER cũ quy định heading admin dùng `font-mono` (Fira Code), nên
> mọi chữ có dấu thanh — khối precomposed **U+1EA0–1EF9** (ạ ả ấ ầ ế ệ ộ ớ ợ ữ…) —
> rơi sang font hệ thống **ngay giữa từ**. `"Trạng thái"` render bằng hai font khác
> nhau: `Tr` + `ng th` là Fira Code, `ạ` và `á` là font fallback. Toàn bộ admin
> tiếng Việt bị lệch baseline và lệch độ đậm. `latin-ext` không cứu được vì nó chỉ
> chứa Ăă Đđ Ơơ Ưư (U+0102-0103, U+0110-0111, U+01A0-01A1, U+01AF-01B0) — không
> chứa các ký tự đã ghép dấu thanh.
>
> | | Pairing gốc (#42) | Đang dùng | Lý do |
> |---|---|---|---|
> | Heading | Fira Code | **Be Vietnam Pro** | Fira Code không render được tiếng Việt (trên). Be Vietnam Pro là pairing **#21 "Vietnamese Friendly"** trong chính `typography.csv`, và là font `--design-system` tự chọn khi query có chữ "Vietnamese". |
> | Body | Fira Sans | **Be Vietnam Pro** | Fira Sans có VI và không sai, nhưng gộp về một family: bớt một họ font tải về, và heading/body cùng họ thì hệ thống chữ nhất quán hơn. |
> | Số liệu / code | Fira Code | **JetBrains Mono** | Vẫn cần mono để cột số `tabular-nums` thẳng hàng. JetBrains Mono **có** subset `vietnamese` nên nếu chữ Việt lỡ nằm trong ngữ cảnh mono cũng không vỡ. |
>
> **Đổi luật quan trọng:** mono **không còn dùng cho heading**. Trước: heading admin
> = mono. Nay: mono chỉ dùng cho **cột số liệu, code, token/URL**. Heading của cả ba
> surface đều là `font-sans`.
>
> `--design-system` còn đề xuất một palette khác hẳn cho surface blog (editorial
> black + accent hồng `#EC4899`) — **bị bỏ**. Dự án có đúng một tầng token; thêm
> accent thứ hai là phá luật "một màu accent duy nhất cho CTA" và sẽ làm
> `npm run check:contrast` gãy. Xem `pages/blog.md`.

**Cấu hình thật** (`src/app/layout.tsx` — dùng `next/font`, self-host lúc build,
không `@import` sang fonts.googleapis.com trên hot path):

```ts
Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400","500","600","700"], style: ["normal","italic"] })
JetBrains_Mono({ subsets: ["latin", "vietnamese"] })   // variable: 1 file/subset
```

Không nạp `latin-ext`: Ăă Đđ Ơơ Ưư đã nằm trong subset `vietnamese`.

**Leading:** body `1.6`, heading `1.25` (xem `globals.css`). Cao hơn mặc định vì
tiếng Việt có dấu ở **cả hai phía** con chữ — mũ/móc phía trên, dấu nặng phía dưới —
nên hai dòng liền nhau ở `1.5` sẽ chạm nhau.

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #D97706;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 2px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Data-Dense Dashboard

**Keywords:** Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout, space-efficient, maximum data visibility

**Best For:** Business intelligence dashboards, financial analytics, enterprise reporting, operational dashboards, data warehousing

**Key Effects:** Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Motion

**Stagger List** (Subtle) — Trigger: load or scroll | Duration: 250-350ms | Easing: `power1.out`

```js
gsap.from('.list-item', { opacity: 0, y: 8, duration: 0.3, stagger: 0.03 });
```

**Framework notes:** Select items with a stable class/data-attribute (not array index) so re-renders in React don't break targeting

- ✅ Keep per-item stagger delay small (0.02-0.04s) for lists longer than 10 items
- ❌ Don't stagger by more than 0.1s per item on long lists; total reveal time becomes sluggish
- ⚡ For virtualized lists, only animate items currently mounted in the DOM

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ No filtering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
