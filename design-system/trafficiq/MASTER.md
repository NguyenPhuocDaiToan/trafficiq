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

Palette đang dùng: hàng **"Magazine/Blog"** trong `colors.csv`
(*editorial black, accent pink*).

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#18181B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3F3F46` | `--color-secondary` |
| Accent/CTA | `#EC4899` | `--color-accent` |
| Background | `#FAFAFA` | `--color-background` |
| Foreground | `#09090B` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Muted | `#E8ECF0` | `--color-muted` |
| Muted Foreground | `#64748B` | `--color-muted-foreground` |
| Border | `#E4E4E7` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#18181B` | `--color-ring` |

**Color Notes:** Editorial black + accent pink

> ### ⚠️ VÌ SAO ĐỔI KHỎI PALETTE "ANALYTICS DASHBOARD"
>
> Bản đầu dùng hàng **"Analytics Dashboard"** (`--primary #1E40AF`,
> `--accent #D97706`, `--background #F8FAFC`, `--foreground #1E3A8A`). Nó sai ở một
> chỗ không nhìn thấy khi chỉ soi dashboard: **`--foreground` là navy `#1E3A8A`**,
> nên mọi dòng chữ trong toàn bộ sản phẩm là chữ xanh, kể cả thân bài 2000 chữ trên
> surface công khai. Cộng thêm `--accent` phải đẩy tối tới `#92400E` để đạt WCAG thì
> thành nâu đục. Kết quả: đúng gate, vẫn xấu.
>
> Hai nguồn trong chính skill nói ngược lại lựa chọn đó:
>
> - `styles.csv` → **Editorial Grid / Magazine**: *"High contrast: Black #000000,
>   White #FFFFFF, accent brand color"*.
> - `colors.csv` → hàng **Magazine/Blog** (`Best For: news sites, blogs, magazines`):
>   `--foreground #09090B`, `--primary #18181B`, `--accent #EC4899`.
>
> Palette Magazine/Blog áp cho **cả codebase**, gồm `/admin/**` — dự án giữ đúng
> **một** tầng token trong `globals.css`. Cái giá phải trả là dashboard mất tông
> xanh, đổi sang đen/xám + bar chart xám (`--secondary #3F3F46`). Chấp nhận: một
> tầng token là thứ giữ cho `check:contrast` không phải gác hai bộ cặp màu và giữ
> cho không ai dùng lẫn token giữa hai surface.
>
> ### ⚠️ Sai lệch có chủ đích so với palette sinh tự động
>
> Bảng trên là output gốc của ui-ux-pro-max. Một số giá trị trong đó không đạt chính
> checklist "text contrast 4.5:1" ở cuối file này. Giá trị đang chạy thật nằm ở
> `src/app/globals.css`, kiểm được bằng `npm run check:contrast`.
>
> | Token | Palette gốc | Đang dùng | Lý do |
> |---|---|---|---|
> | `--accent` | `#EC4899` | `#BE185D` | Chữ trắng trên gốc chỉ đạt **3.53:1** → FAIL ngưỡng 4.5:1 của nền nút có chữ. Mới đạt **6.04:1**; và vì accent còn dùng làm *màu chữ* nên đo cả ba nền: **5.78:1** trên `--background`, **6.04:1** trên `--card`, **5.09:1** trên `--muted`. |
> | `--muted` | `#E8ECF0` | `#ECECEE` | Gốc là xám **hơi xanh** (b > r), lệch khỏi thang zinc trung tính của cả palette (`#09090B`/`#18181B`/`#FAFAFA`); cạnh accent hồng `#BE185D` thì ra tông đục. `#ECECEE` cùng độ sáng, bỏ sắc xanh — vẫn thấy ranh giới với `--card #FFFFFF`. Đo lại: accent trên muted **5.12:1**, muted-fg trên muted **6.55:1**. |
> | `--muted-foreground` | `#64748B` | `#52525B` | Gốc chỉ **4.01:1** trên nền `--muted` (badge paused). `#52525B` là zinc-600, cùng họ với `--primary`, đạt **6.55:1**. |
> | `--success` | `#15803D` | `#166534` | Gốc **4.09:1** trên nền tint 15% của chính nó. Mới: **5.66:1**. |
> | `--warning` | `#B45309` | `#854D0E` | Gốc **4.08:1** trên tint 15%. Mới: **5.46:1**. |
>
> Thêm token không có trong palette gốc:
>
> - `--input` (`#71717A` light / `#71717A` dark) — viền control phải đạt 3:1 theo
>   WCAG 1.4.11. `--border` (`#E4E4E7`) giữ nhạt và **chỉ** dùng cho divider/viền
>   card; nó không mang thông tin trạng thái nên không bị ràng 3:1.
> - `--rule` (`#18181B` light / `#A1A1AA` dark) — **gạch kẻ đậm 2px kiểu báo in**
>   (`border-rule`): mở đầu bài dẫn, đầu mỗi cột bài, trên footer. Xem
>   `pages/blog.md § "Thứ bậc dựng bằng gạch kẻ + cỡ chữ"`. Vì sao không dùng thẳng
>   `--primary`: ở dark `--primary` là `#FAFAFA`, tức một gạch trắng tinh chạy hết
>   chiều rộng — loá. Token riêng cho phép bộ dark hạ xuống zinc-400 mà component
>   **không** cần biến thể `dark:` nào (dự án giữ đúng một tầng token; không có
>   `dark:` trong bất kỳ file `.tsx` nào). Cũng như `--border`, nó là gạch trang trí
>   → không mang thông tin trạng thái → WCAG 1.4.11 không ràng 3:1, nên
>   `check-contrast` không gác cặp nào cho nó.
> - Toàn bộ **bộ dark** — palette gốc chỉ có light, nhưng cả hai style đang dùng
>   (Editorial Grid, Data-Dense Dashboard) đều khai báo `Dark ✓ Full` nên buộc phải
>   suy ra. Cách suy: đảo trục sáng của thang zinc (`#09090B` ↔ `#FAFAFA`), giữ họ
>   pink cho accent nhưng làm sáng lên `#F472B6`.
>
> ### ⚠️ `--primary` gần trùng `--foreground` — hệ quả bắt buộc phải nhớ
>
> `--primary #18181B` và `--foreground #09090B` chênh nhau rất ít (light), và ở dark
> thì `--primary` **trùng hệt** `--foreground` (`#FAFAFA`). Hai hệ quả:
>
> 1. **Link tô bằng `--primary` PHẢI có underline.** Màu không còn phân biệt được
>    link với chữ thường → bỏ underline là vi phạm WCAG 1.4.1 (không dùng riêng màu
>    để truyền thông tin). Đã áp trong `.prose a` và mọi link `text-primary`.
> 2. **`hover:text-primary` là vô hình — đừng dùng.** Hover của link, tiêu đề bài và
>    wordmark đổi sang **`--accent`**. Đây là lý do accent xuất hiện ngoài CTA, và là
>    lý do `check-contrast` gác accent trên cả ba nền.
>
> **Quy tắc:** đổi màu thì sửa bảng này TRƯỚC, rồi đồng bộ xuống `globals.css`,
> rồi chạy `npm run check:contrast`. Không sửa ngược lại.

### Typography

- **Heading Font:** Be Vietnam Pro
- **Body Font:** Be Vietnam Pro
- **Numeric / Code Font:** JetBrains Mono
- **Display Font:** Fraunces (serif) — **CHỈ surface công khai**, xem
  `pages/blog.md § Typography`. `/admin` và `/c/[slug]` không nạp font này, nên luật
  "heading của /admin là `font-sans`" ở khối bên dưới vẫn đúng nguyên văn.
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
>
> **⚠️ Hai câu trên đã cũ.** Từ bản hiện tại, dự án có **hai** tầng token
> (`:root` + `.theme-editorial`) và surface công khai dùng accent riêng (cam đất
> `#C2410C`). Luật "một accent duy nhất cho CTA" vẫn giữ — nó là *một accent trên
> mỗi view*, không phải một accent cho cả codebase — và `check:contrast` không gãy
> vì đã được mở rộng để gác cả bốn bộ token. Chi tiết và lý do:
> `pages/blog.md § Colors`.

**Cấu hình thật** (`src/app/layout.tsx` — dùng `next/font`, self-host lúc build,
không `@import` sang fonts.googleapis.com trên hot path):

```ts
Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400","500","600","700"], style: ["normal","italic"] })
JetBrains_Mono({ subsets: ["latin", "vietnamese"] })   // variable: 1 file/subset
Fraunces({ subsets: ["latin", "vietnamese"], weight: ["700"] })  // chỉ (site), 1 weight
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

> Các block dưới đây là output gốc, viết bằng hex của palette **cũ**. Đã cập nhật
> sang token của palette đang chạy. Trong code thì **không bao giờ** viết hex —
> dùng semantic token (`bg-accent`, `border-primary`…). Xem luật ở `AGENTS.md`.

```css
/* Primary Button — CTA duy nhất dùng --accent */
.btn-primary {
  background: var(--accent);      /* #BE185D, gốc ghi #D97706 */
  color: var(--on-accent);
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

/* Secondary Button — outline editorial black */
.btn-secondary {
  background: transparent;
  color: var(--primary);          /* #18181B, gốc ghi #1E40AF */
  border: 2px solid var(--primary);
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
  /* Gốc ghi #F8FAFC — TRÙNG HỆT --background nên card vô hình.
     Dùng Card role của palette: #FFFFFF. */
  background: var(--card);
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
  /* Gốc ghi #E2E8F0 — quá nhạt, không đạt 3:1 nên không chỉ ra được ranh giới
     vùng nhập liệu. Dùng --input (#71717A), KHÔNG dùng --border. */
  border: 1px solid var(--input);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: var(--ring);      /* #18181B, gốc ghi #1E40AF */
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 12%, transparent);
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
