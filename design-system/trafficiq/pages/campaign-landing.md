# Campaign Landing Page Overrides

> **PROJECT:** TrafficIQ
> **Page Type:** Conversion Landing (`/c/[slug]`)
> **Nguồn:** ui-ux-pro-max — query "high-converting offer landing page single CTA above the fold mobile traffic", dials density 4 / variance 4 / motion 2

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/trafficiq/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Vì sao page này cần override

MASTER được sinh cho **admin dashboard**: density 8/10, data-dense, nhiều widget. Campaign landing
là surface ngược lại — một CTA duy nhất, ít chữ, phần lớn traffic là mobile. Dùng luôn density của
MASTER ở đây sẽ ra landing chật và giảm CR.

---

## Page-Specific Rules

### Style Override

- **Style:** Conversion-Optimized (thay cho Data-Dense Dashboard của MASTER)
- **Keywords:** Form-focused, minimalist, single CTA focus, high contrast, trust signals, clear value
- **Mode Support:** Light ✓ Full | Dark ✓ Full

### Pattern Override

- **Pattern:** Hero-Centric Design
- **Conversion Focus:** Một CTA chính duy nhất. Hero chiếm 60–80% above the fold. Mobile giữ nguyên hierarchy.
- **CTA Placement:** Hero dominant (center/bottom) + sticky nav CTA
- **Section Order:** 1. Full-bleed hero (headline + visual), 2. Single value prop strip, 3. Key benefit/proof, 4. Primary CTA

### Spacing Overrides

- **Content Density:** 4/10 — Standard. KHÔNG dùng `--space-*` scale dày của MASTER cho landing.
- Hero padding tối thiểu `--space-3xl`; giữa các section dùng ≥ 48px.

### Typography Overrides

- **Không override.** Dùng Fira Sans / Fira Code của MASTER.
- *Lý do:* generator gợi ý Space Grotesk cho page này, nhưng mood của nó là
  "brutalist / street / high-energy" — không khớp một landing offer trung tính, và mỗi surface một
  bộ font sẽ làm platform trông rời rạc. Chốt: một hệ font cho toàn dự án.
- Ngoại lệ duy nhất: heading landing dùng **Fira Sans** (không phải Fira Code) — heading monospace
  hợp bảng số liệu admin, không hợp headline bán hàng.

### Color Overrides

- **Không override palette.** Dùng nguyên palette MASTER.
- *Lý do:* generator gợi ý palette "academic navy + gold keynote" cho page này; đổi màu theo từng
  page sẽ phá tính nhất quán thương hiệu. Nội dung riêng của từng campaign đã do advertiser quyết
  định qua headline/hero image.
- **Chiến lược màu:** CTA phải đạt contrast ≥ 7:1 so với background. Dùng `--color-accent` (#D97706)
  cho CTA chính — accent là màu duy nhất được phép dùng cho CTA.

### Motion Overrides

- **Motion:** 2/10 — chỉ page transition, KHÔNG stagger list như MASTER.
- Duration 200–300ms, easing `power1.inOut`. Cap exit ≤ 250ms — không bao giờ block navigation.
- Bắt buộc tôn trọng `prefers-reduced-motion`.

---

## Ràng buộc riêng của TrafficIQ (không đến từ skill)

Đây là các ràng buộc kỹ thuật của dự án, đứng trên mọi gợi ý design:

- **CTA phải là `<a href>` thật** trỏ tới `/go/[token]`, không phải `<button onClick>`. Redirect
  tracking phải hoạt động cả khi JS chưa load / bị chặn.
- **CTA phải giữ query param tracking** (`source`, `sub_id1..5`) khi forward sang `/go`. Mất param
  = mất attribution.
- **OG image tối ưu dung lượng.** Landing là surface chịu traffic trả tiền và bandwidth Vercel
  Hobby chỉ ~100GB/tháng. Không dùng ảnh hero > 200KB.
- **Không animation ở above-the-fold** làm chậm LCP — traffic paid tính tiền theo click, LCP chậm
  là đốt tiền thật.
- **Không dark-mode toggle trên landing.** Landing đi theo `prefers-color-scheme` của thiết bị;
  thêm toggle là thêm CLS và JS không cần thiết.

---

## Thân bài rich-text (bổ sung)

Trước đây thân bài landing là một `textarea` phẳng, render bằng `bodyText.split("\n")` — không
có heading phụ, bullet, hay chữ nhấn mạnh. Admin không dựng được một trang bán hàng thật. Nay
thân bài soạn bằng editor WYSIWYG (Tiptap) và lưu HTML đã sanitize ở `landing.bodyHtml`.

**Đây KHÔNG phải một section mới.** Nó là section **3. Key benefit / proof** của pattern
Hero-Centric đã chốt ở trên. Hệ quả bắt buộc giữ nguyên:

- Hero vẫn chiếm 60–80% above the fold. Thân bài nằm **dưới** hero.
- Vẫn **MỘT** CTA accent duy nhất, đặt sau thân bài. Thân bài dài hơn không phải cớ để thêm CTA thứ hai.
- Density vẫn 4/10 — đây là chỗ để 3–5 luận điểm có cấu trúc, không phải chỗ nhồi 2000 từ SEO.

### Whitelist node — cố định, không nới bằng cách sửa component

Editor chỉ bật đúng các node dưới đây, và server sanitize lại lần nữa trước khi ghi Mongo
(`src/lib/landing/sanitize-body.ts`). Client whitelist là UX, server whitelist là luật.

| Cho phép | Vì sao |
| --- | --- |
| `p`, `br` | đoạn văn |
| `h2`, `h3` | cấu trúc luận điểm. KHÔNG có `h1` — `h1` là headline của campaign, một trang một `h1` |
| `strong`, `em` | nhấn mạnh |
| `ul`, `ol`, `li` | "Benefit bullets" — chính pattern landing gợi ý |
| `blockquote` | trust signal / trích dẫn |
| `hr` | ngắt mạch giữa các luận điểm |
| `img` | ảnh minh hoạ trong bài |

| Chặn | Vì sao |
| --- | --- |
| `a` | **Bất biến kiến trúc 12**: mọi link ngoài CTA là chỗ rò rỉ click. Landing không có nav/footer chính vì lý do này — cho `<a>` vào thân bài là mở lại đúng cái lỗ đó |
| `style`, `class`, `id`, `on*` | nội dung phải nằm trong design token. Cho admin đặt màu tay là `npm run check:contrast` mất hết ý nghĩa: gate chỉ đọc `globals.css`, không đọc được nội dung trong DB |
| `script`, `iframe`, `form`, `table` | XSS / nhúng ngoài / thứ không thuộc một landing 4 section |

### Style thân bài

Dùng lại class `.prose` của `pages/blog.md` (đã có trong `globals.css`) + modifier
`.prose-landing` để bỏ `max-width: 68ch`. Lý do bỏ: khung landing là `max-w-2xl` và
headline/CTA canh theo khung đó — giữ 68ch thì riêng thân bài hẹp hơn, lệch trái so với
mọi thứ còn lại. Không viết bộ CSS thứ hai cho thân bài landing: hai bộ sẽ lệch nhau.

### Ảnh trong thân bài

`img` bị ép `loading="lazy"` + `decoding="async"` khi sanitize. Ảnh thân bài nằm dưới fold nên
không được tranh băng thông với LCP của hero.

**KHÔNG hiện ghi chú giới hạn dung lượng trong UI admin.** Ảnh nằm trên CDN ngoài nên con số đó
không kiểm được bằng code, và một ràng buộc không kiểm được mà vẫn ghi cạnh field thì chỉ làm
form rối chứ không ngăn được gì. Ràng buộc băng thông thật vẫn ở AGENTS.md § "Ràng buộc chi phí"
(nơi nó là quyết định vận hành của dự án), không phải ở nhãn field.

### Editor không thuộc file này

Khung soạn thảo nằm ở `/admin/campaigns/**` nên theo `pages/dashboard.md` (Data-Dense
Dashboard), không theo file này. File này chỉ chi phối thứ được render ra `/c/[slug]`.

---

## Anti-Patterns cho page này

- ❌ Muted colors — CTA phải nổi bật
- ❌ Low energy — headline phải rõ value prop
- ❌ Nhiều CTA cạnh tranh nhau (chỉ MỘT primary CTA)
- ❌ Form nhiều field trước khi redirect (landing này không thu form, chỉ redirect)
