# Page Override — Website nội dung công khai

**Áp dụng cho:** `/` (trang chủ), `/blog`, `/blog/[slug]`, `/chuyen-muc/[slug]`,
`/gioi-thieu`, `/lien-he`, `/dieu-khoan`, `/chinh-sach-bao-mat`,
`/tiet-lo-lien-ket`

> Luật trong file này **override MASTER.md** cho các route trên.
> `/admin/**` vẫn theo `pages/dashboard.md`. `/c/[slug]` vẫn theo
> `pages/campaign-landing.md`. Ba surface, ba bộ luật.

---

## Vì sao cần override

MASTER.md sinh ra cho category **Analytics Dashboard**: density 8/10, row height
36px, mọi thứ nén chặt để nhìn được nhiều số. Surface này ngược hẳn — người đọc ở
đây đang **đọc văn bản dài**, không quét số liệu. Dùng density 8/10 cho một bài
2000 chữ thì chữ chật và không ai đọc hết.

---

## Dials

| Dial | MASTER | Ở đây | Lý do |
|---|---|---|---|
| Style | Data-Dense Dashboard | **Editorial Grid / Magazine** + Bold Typography | xem mục dưới |
| Pattern | Real-Time / Operations Landing | **Front Page** (trang chủ) / Content-First Index (trang danh sách) | xem § "Trang chủ: pattern Front Page" |
| Density | 8/10 | **3/10** cho thân bài, **5/10** cho trang chủ | văn bản dài cần khoảng trắng (68ch, leading 1.75); trang nhất thì ngược lại — thưa quá là để lộ site còn ít bài |
| Motion | 3/10 | **2/10** | chỉ hover và focus. Không reveal-on-scroll, không parallax |
| Variance | 4/10 | **4/10** | giữ nguyên — vẫn là cùng một brand |
| Token scope | `:root` | **`.theme-editorial`** | tầng token riêng, xem § Colors |

### Chốt style: lấy `--domain style`, không lấy `--design-system`

Hai lệnh của skill trả về hai kết quả khác nhau cho cùng surface này:

```bash
# (1) theo độ liên quan của query
python .claude/skills/ui-ux-pro-max/scripts/search.py \
  "blog content website with article list, post detail, long-form reading, SEO, about and contact pages" \
  --domain style -n 5
# -> #1 Editorial Grid / Magazine
#    "Best For: News sites, blogs, magazines, editorial content, long-form articles, journalism"
#    WCAG AAA | Tailwind 10/10 | Complexity Low | Dark ✓ Full

# (2) theo dial --variance
python .claude/skills/ui-ux-pro-max/scripts/search.py \
  "Vietnamese blog content website: article list, post detail long-form reading, about, contact, privacy policy" \
  --design-system --stack nextjs -p TrafficIQ --format markdown
# -> Swiss Modernism 2.0 + pattern "Newsletter / Content First"
```

Theo luật trong `AGENTS.md` ("nếu hai kết quả lệch nhau, lấy theo `--domain style`"):
**dùng Editorial Grid / Magazine.**

Hai thứ trong output `--design-system` bị **bỏ hẳn**, ghi lại để sau không ai
tưởng là quên:

1. **Pattern "Newsletter / Content First"** — toàn bộ conversion focus của nó là
   thu email (`Single field form (Email only)`, `Show 'Join X,000 readers'`,
   `Sticky header form`). Dự án **không có** hệ thống gửi mail, không có
   subscriber. Dựng form email không xử lý được là lừa người đọc. Dùng pattern
   **Content-First Index** thay thế: trang chủ = bài nổi bật + danh sách mới nhất
   + chuyên mục, CTA là "đọc bài", không phải "đăng ký".
2. ~~**Palette riêng** (`--primary #18181B`, `--accent #EC4899`, background
   `#FAFAFA`) — bỏ.~~ **Đã đảo lại quyết định này — xem mục dưới.**

### Colors: tầng token RIÊNG cho surface này (`.theme-editorial`)

> **Quyết định mới nhất, override cả hai mục bên dưới.** Chủ dự án chọn đổi theme
> cho surface công khai mà `/admin` **đứng yên**. Vì vậy `globals.css` giờ có hai
> scope: `:root` (nền — admin, `/c/[slug]`, `/link-unavailable`) và
> `.theme-editorial` (surface này, áp ở `src/app/(site)/layout.tsx`).
>
> Palette công khai: **near-black + cam đất**.
>
> | Token | Light | Dark | Ghi chú |
> |---|---|---|---|
> | `--background` | `#FAFAFA` | `#0A0A0A` | |
> | `--foreground` / `--primary` | `#0A0A0A` | `#FAFAFA` | near-black, không phải zinc — nhan đề serif nét mảnh ở zinc-900 trông xám |
> | `--accent` | `#C2410C` | `#FB923C` | 4.96:1 làm chữ trên bg; `#EA580C` chỉ 3.6:1 → FAIL |
> | `--muted` / `--muted-foreground` | `#F0F0EF` / `#525252` | `#262626` / `#A3A3A3` | thang **neutral**, không zinc: zinc lạnh cạnh cam đất ra tông đục |
> | `--rule` | `#0A0A0A` | `#A3A3A3` | trang nhất dùng 3px (`border-t-[3px]`) |
>
> Hai hệ quả phải nhớ:
>
> 1. `scripts/check-contrast.mjs` gác **bốn** bộ, không phải hai. Thêm màu mới thì
>    thêm vào **cả hai** scope, không chỉ scope đang sửa.
> 2. Nỗi lo "hai accent trong một codebase" ở mục dưới là **thật** — nó được xử lý
>    bằng gate, không bằng cách tránh. Đừng thêm scope thứ ba mà không mở rộng gate.
>
> Phần còn lại của mục này giữ nguyên vì lý do kỹ thuật của nó vẫn đúng: `--primary`
> vẫn gần trùng `--foreground` nên **link vẫn PHẢI có underline**, và
> `hover:text-primary` vẫn vô hình nên hover vẫn dùng `--accent`.

### Colors: (bản trước) đã đổi ở tầng MASTER, không override ở đây

Bản đầu giữ nguyên palette "Analytics Dashboard" của MASTER với lý do *"blog và
admin là cùng một sản phẩm"*. Lý do đó **sai ở hai điểm**:

1. Về **thương hiệu**: kể từ khi tách tên (bất biến #13 trong `AGENTS.md`), blog và
   admin cố ý **không** là cùng một sản phẩm với người xem — một là site nội dung
   công khai, một là công cụ nội bộ.
2. Về **tính đọc được**: palette đó đặt `--foreground` là navy `#1E3A8A`, tức thân
   bài 2000 chữ là chữ xanh. Nó qua được gate 4.5:1 nên không ai bắt được, nhưng nó
   là nguyên nhân thật của cảm giác "theme xấu".

Cách sửa **không phải** thêm tầng token thứ hai cho blog (đúng như mục 2 ở trên đã
lo: hai accent trong một codebase, `check:contrast` gác hai bộ cặp màu). Cách sửa là
**đổi palette ở tầng MASTER cho cả dự án** sang hàng `Magazine/Blog` của
`colors.csv` — chính là palette mà mục 2 từng gạch đi. Chi tiết, bảng sai lệch và
số đo nằm ở `MASTER.md § Color Palette`.

Hệ quả phải nhớ khi code surface này:

- **Link `text-primary` PHẢI có underline.** `--primary` (editorial black) gần trùng
  `--foreground`, ở dark mode thì trùng hệt → màu không còn phân biệt được link.
- **`hover:text-primary` là vô hình. Dùng `hover:text-accent`.** Áp cho wordmark,
  tiêu đề bài trong `PostCard`/`FeaturedCard`, và `.prose a:hover`.

### Typography: CÓ override — thêm font display (Fraunces)

Bản trước bỏ gợi ý serif của Editorial Grid với lý do bandwidth. **Đã đảo lại**, và
lý do bandwidth vẫn được tôn trọng chứ không bị bỏ qua:

- **Thêm `font-display` = Fraunces (serif), CHỈ cho nhan đề của surface công khai.**
  Thân bài vẫn là Be Vietnam Pro — gợi ý "serif cho body" của Editorial Grid vẫn bị
  bỏ, vì Be Vietnam Pro là font thiết kế riêng cho dấu tiếng Việt và đó là thứ quan
  trọng hơn ở đoạn văn 2000 chữ.
- **Vì sao đáng thêm:** surface này có **0 byte ảnh** theo thiết kế. Khi không có
  ảnh, hình dáng chữ là phương tiện tạo hình duy nhất; tiêu đề và thân bài cùng một
  họ sans thì không có gì tách "nhan đề" khỏi "văn bản" ngoài cỡ chữ.
- **Chi phí thật, đo trên bản build:** một weight = ~44KB cho trang tiếng Việt
  (latin 32.9KB + vietnamese 11.3KB — một câu có dấu chạm cả hai `unicode-range`).
  Vì vậy nạp **đúng một weight (700)**, không phải 600 + 700: thứ bậc lấy bằng cỡ
  chữ. Mọi chỗ dùng `font-display` phải đi kèm `font-bold`.
- Fraunces có subset `vietnamese` (đã kiểm bằng lệnh trong AGENTS.md § Luật token).
- `.prose h2/h3` dùng serif, fallback `Georgia` để lúc `display: swap` chưa xong
  chữ vẫn là serif — không nhảy sans → serif giữa lúc đọc.
- **Không dùng serif cho nhãn nhỏ uppercase** (`SectionHeading`, `CategoryTag`,
  dateline): ở 11px + tracking rộng, serif mất hết đặc điểm và chỉ còn cảm giác nhoè.

### KHÔNG override

- **Shadow** — nguyên MASTER (và surface này gần như không dùng shadow).
- **Radius** — override thành **0 tuyệt đối**: không `rounded-*` ở đâu trong
  `(site)/**`, kể cả nút CTA, chip chuyên mục, tag và `.prose pre`. Thứ bậc là gạch
  kẻ; một khối bo góc 12px giữa trang là hình duy nhất "mềm" và nó lộ ngay.

---

## Layout

```
Header  sticky, border-b, bg-card/blur — MASTHEAD HAI HÀNG:
          hàng 1: wordmark (trái) + CTA "Liên hệ" (phải), min-h-14
          hàng 2: dải MAIN_NAV, overflow-x-auto
Main    max-width theo ngữ cảnh:
          - trang chủ / danh sách:  max-w-6xl  (grid 12 cột)
          - thân bài viết:          max-w-none nhưng .prose tự giới hạn 68ch
Footer  3 cột (Nội dung / Về site / Pháp lý) + dòng bản quyền + tiết lộ affiliate
```

Grid: `repeat(12, 1fr)`, `gap: 1rem` (Editorial Grid). Bài nổi bật chiếm 12 cột,
bài thường 4 cột ở desktop → 6 ở tablet → 12 ở mobile.

### Thứ bậc dựng bằng GẠCH KẺ + CỠ CHỮ, không bằng HỘP

Đây là luật quan trọng nhất của surface này, và là chỗ bản đầu làm sai.

Bản đầu bọc mọi thứ trong `rounded-xl border border-border bg-card`: hero, bài nổi
bật, từng thẻ bài, từng thẻ chuyên mục, ghi chú affiliate. Kết quả là trang chủ =
**tám hình chữ nhật bo góc giống nhau xếp dọc**, tức đúng ngôn ngữ thị giác của một
trang admin — trong khi cách bên cạnh (`pages/dashboard.md`) mới là chỗ được dùng
hộp. Không có sai lệch token nào ở đó cả; sai ở chỗ chọn hộp làm đơn vị bố cục.

Editorial Grid tạo thứ bậc bằng ba thứ khác:

| Vai trò | Cách dựng |
|---|---|
| Bài dẫn / mở đầu một khối | `border-t-2 border-rule` (gạch đậm 2px; `--rule` = `#18181B` light / `#A1A1AA` dark) |
| Phân cách các bài trong danh sách | `divide-y divide-border` ở container |
| Nhãn section | chữ nhỏ uppercase + `border-b border-border` hết chiều rộng |
| Bài quan trọng hơn | **cỡ chữ**, không phải nền hay viền |

Hệ quả bắt buộc: grid nào chứa thẻ có gạch trên thì `gap-x` phải ≥ `2.5rem`
(`gap-x-10`). Khe hẹp làm gạch của hai cột cạnh nhau đọc thành một đường liền.

Gạch đậm là token riêng `--rule`, không dùng thẳng `--primary`: ở bộ dark
`--primary` là `#FAFAFA`, tức gạch 2px trắng tinh chạy hết chiều rộng — loá như
thanh đèn. `--rule` cho phép bộ dark hạ xuống zinc-400 mà component không cần một
biến thể `dark:` nào (dự án giữ đúng một tầng token).

Hộp chỉ còn được dùng ở đúng hai chỗ trên surface này: **nút CTA** (`bg-accent`,
`rounded-md`) và **`.prose pre`** (khối code cần nền để tách khỏi thân bài).

### Vì sao header hai hàng, không phải một hàng wrap

Bản một hàng (`flex-wrap` với logo + nav + CTA) hỏng ở mobile theo cách không
nhìn thấy ngay: DOM là `logo → nav → CTA`, còn mắt ở 375px thấy `logo → CTA` rồi
nav xuống dòng. Sửa bằng `order-*` thì thứ tự tab không còn khớp thứ tự trên màn
hình (WCAG 2.4.3 Focus Order). Hai hàng cố định thì DOM và mắt trùng nhau ở **mọi**
breakpoint, không cần một utility `order` nào, và dải chuyên mục cũng đúng chất
báo/magazine hơn. Dải nav dùng `overflow-x-auto` + `-mx-4 px-4` để ở 375px nó cuộn
trong khung chứ không đẩy cả trang scroll ngang.

### Trang chủ: pattern Front Page (thay Content-First Index)

Bản đầu là "hero + bài nổi bật + danh sách + chuyên mục". **Đã đổi** sang bố cục
trang nhất báo, rồi mở rộng thêm hai dải khi nội dung dày hơn (12 bài, 7 chuyên
mục, có bài dạng "chọn mua"). Lý do đổi ban đầu là một vấn đề thật, không phải gu:
hero cao ~380px đẩy bài đầu tiên xuống dưới fold, và danh sách dọc phẳng để lộ
ngay là site còn mỏng.

Thứ tự khối (5 khối, không còn ghi chú affiliate ở cuối — xem "Colors" và
`SiteFooter` cho lý do bỏ):

1. **Dateline** — dải kẹp giữa `border-y`: tagline (accent) + số bài + số chuyên mục
   + ngày cập nhật (số dùng `font-mono tabular-nums`, **ngày tháng không mono**).
   Đây là thứ thay cho hero. KHÔNG form email. KHÔNG in lại tên site — header sticky
   phía trên đã có wordmark cỡ `3xl`.
2. **Trang nhất** — `border-t-[3px] border-rule`, grid 12 cột:
   - 7/12: `LeadStory` — `CategoryTag` + `KindTag`, **bìa lớn** (`PostCover
     size="lg"`), `<h1>` là **tiêu đề bài dẫn** (`text-[1.875rem]` →
     `sm:text-[2.5rem]` → `lg:text-[3.25rem]`, `leading-[1.1]`), mô tả, byline,
     CTA accent + link "Site này là gì".
   - 5/12: hai `SidePost` (không bìa — xem lý do dưới), `lg:border-l lg:pl-10`,
     phân cách `divide-y`.
3. **Chọn mua** — chỉ hiện khi có bài `kind: "review"`. Lưới `PostCard` (có bìa)
   3 cột, tối đa 3 bài, loại bài đã lên trang nhất. Đây là dải DUY NHẤT trên trang
   chủ dùng bìa ở dạng lưới nhiều cột cạnh nhau — chủ ý, để một trang toàn chữ có
   một điểm nhìn có hình, không rải bìa ở mọi dải.
4. **Mới nhất** — `LatestList`: danh sách theo thời gian, rail ngày 3/12 (không
   mono) + nội dung 9/12, `divide-y`. Có **thumbnail 80×45** (`PostThumb`) đứng
   trong cột nội dung, không thành cột thứ ba: rail ngày là thứ để mắt quét dọc,
   chen ảnh vào giữa sẽ phá nhịp đó.
5. **Theo chuyên mục** — `SectionHeading` + 7 cột `CategoryColumn`, mỗi cột:
   nhan đề chuyên mục (sans, uppercase, `border-b`, kèm tổng số bài mono) →
   danh sách ≤3 bài (`divide-y`, **thumbnail 80×45** + tiêu đề `font-display
   text-base`) → mô tả chuyên mục → link "Cả chuyên mục". `gap-x-10` là bắt buộc:
   gạch dưới nhan đề hai cột cạnh nhau sẽ đọc thành một đường liền nếu khe hẹp.

**Vì sao có cả dải "Mới nhất" VÀ dải "Theo chuyên mục"**, dù một bài có thể xuất
hiện ở cả hai: hai dải trả lời hai câu khác nhau. "Mới nhất" trả lời *có gì mới*
(người quay lại cần đúng câu đó); "Theo chuyên mục" trả lời *site này có những
mảng gì* (người vào lần đầu cần đúng câu đó). Báo in cũng in mục lục hai cách như
vậy — không phải trùng lặp, là hai lối vào khác nhau cho cùng nội dung.

**Ba cỡ hình trên trang chủ, ba vai khác nhau** — không phải "chỗ nào cũng có bìa":

| Cỡ | Ở đâu | Vai |
|---|---|---|
| Bìa lớn (`aspect-video`, ảnh gốc) | `LeadStory` | điểm mở đầu trang, `loading="eager"` |
| Bìa thẻ (`PostCard`, ảnh gốc) | dải "Chọn mua" | minh hoạ món đồ — đây là dải sản phẩm |
| Thumbnail 80×45 (`PostThumb`, file sinh sẵn) | "Mới nhất", `CategoryColumn` | **dấu nhận diện**, không phải minh hoạ |

Bản trước hai dải danh sách **không có hình gì** với lý do "hình làm chậm việc
quét". Lý do đó chỉ đúng với hình cỡ bìa: một ô 80×45 cạnh tiêu đề là mốc để mắt
nhận ra bài đã đọc, không cạnh tranh với tiêu đề. Nhưng nó chỉ đúng khi dùng
**file thumbnail riêng** — xem ràng buộc `PostThumb` bên dưới, đó là phần bắt buộc.

**`<h1>` của trang chủ là tiêu đề bài dẫn, cố ý.** Trang nhất một tờ báo không có
khẩu hiệu cỡ lớn, nó có một tin dẫn. Câu định vị của site nằm ở `Dateline` và ở
`/gioi-thieu`; thêm một H1 kiểu "Hướng dẫn dùng được ngay…" chỉ tạo hai thứ cùng
đòi to nhất trên một màn hình.

**Chỉ MỘT CTA accent trên trang chủ** — ở `LeadStory`. Link "Cả chuyên mục" và
"Site này là gì" là chữ `--primary`/underline, không phải nút.

**Nhãn section (`SectionHeading`) là chữ NHỎ, không phải `text-2xl font-bold`.**
Trên một trang mục lục, thứ phải to nhất là **tiêu đề bài**. Bản đầu để nhãn
section 24px cạnh tiêu đề bài 18px nên không có thứ bậc nào cả — chính là cảm giác
"trang phẳng, chỗ nào cũng như chỗ nào". Giờ nhãn thu về `0.6875rem` uppercase
tracking `0.18em` + gạch dưới hết chiều rộng, tiêu đề bài phóng lên. Vẫn là `<h2>`
nên cấu trúc heading không đổi. Mô-típ gạch accent ngắn phía trên nhãn (bản đầu,
lặp `.prose h2`) đã bỏ: `.prose h2` giữ nguyên gạch accent, nhãn section dùng gạch
kẻ ngang — hai vai trò khác nhau nên không cần trùng hình.

---

## Ràng buộc riêng của surface này

- **Ảnh bitmap: vẫn không có.** Bandwidth Hobby ~100GB/tháng và AGENTS.md đã
  ràng ảnh ≤200KB. Không `<img>`, không Image Optimization, 0 byte ảnh tải thêm.

  **Nhưng trang chủ và các trang mục lục CÓ hình** — `PostCover`
  (`components/site.tsx`): art SVG vẽ tại chỗ theo chuyên mục, khắc nét mảnh
  `currentColor` trên nền `--muted`, tỉ lệ `aspect-video`. Đây không phải ngoại
  lệ của luật "không ảnh" — nó là cách có hình mà vẫn 0 byte tải thêm:
  - Mỗi `CategorySlug` có đúng một hình trong `COVER_MOTIF`
    (`Record<CategorySlug, …>` nên thêm chuyên mục mà quên thêm hình là lỗi
    build, không phải lỗi lặng).
  - Toàn bộ nét dùng token (`currentColor` kế thừa `text-rule/45`, chi tiết nhấn
    dùng `text-accent`) nên tự đúng ở cả light/dark, không cần biến thể nào.
  - `aria-hidden` + `role="presentation"`: hình là trang trí theo mục, không
    mang thông tin gì mà tiêu đề cạnh nó chưa nói.

  Nếu sau này có ảnh thật (ảnh chụp, ảnh mua): thêm field `cover?: { src, alt }`
  vào `Post`, ưu tiên nó trong `PostCover`, giữ SVG làm fallback cho bài chưa có
  ảnh. Ảnh thật phải qua đúng ràng buộc ≤200KB/WebP/lazy đã ghi trong AGENTS.md —
  `PostCover` không tự miễn ràng buộc đó.

  **Ảnh thật ĐÃ CÓ** (12/12 bài, WebP 1200×675, 54–181KB). Vì vậy có thêm một tầng
  thứ hai, và đây là ràng buộc bắt buộc:

  **Thumbnail trong danh sách phải là FILE RIÊNG, không phải ảnh bìa co bằng CSS.**
  AGENTS.md cấm đi qua Image Optimization, nên `<img>` trỏ ảnh gốc sẽ tải đủ
  1200×675 rồi mới co xuống 80px. Dải "Theo chuyên mục" có tới 21 dòng → trang chủ
  từ 282KB lên 1,2MB để hiện những ô 80px. Đo thật sau khi làm đúng cách: **+35,1KB
  cho cả 16 thẻ img** (12 file khác nhau), tổng ảnh trang chủ 317KB.

  Quy ước ở `src/lib/thumb.ts` (**nguồn duy nhất** cho cả ba chỗ: script sinh,
  component đọc, gate kiểm): `/images/blog/thumb/<tên>.webp`, 160×90 — đúng 2× cỡ
  hiển thị 80×45 để màn 2x không nhoè, và là thu nhỏ thuần vì ảnh gốc đã 16:9 chằn.

  - Thêm bài có ảnh bìa, hoặc thay ảnh bìa cũ → **chạy `npm run gen:thumbs`**.
  - `npm run check:content` chặn ba kiểu sai: thiếu file, file >20KB (dấu hiệu ai đó
    copy ảnh gốc vào thư mục thumb), và cỡ khác 160×90. Đã thử ngược cả ba.
  - `alt=""` + `aria-hidden` ở `PostThumb` là CỐ Ý, khác `cover.alt` ở bìa lớn: ô
    này nằm ngay cạnh tiêu đề, mà tiêu đề chính là nội dung của link — đặt alt mô tả
    làm screen reader đọc hai lần cùng một bài.
  - Khai `width`/`height` tường minh: ảnh lazy không có kích thước sẽ làm nhảy layout
    khi tải xong, và 21 dòng nhảy cùng lúc là CLS thật, không phải lý thuyết.

  Cấu trúc `PostCard` / `LeadStory` / `SidePost` / `CategoryColumn` /
  `LatestList` (`components/site.tsx`):

  | Component | Dùng ở | Cấu trúc |
  |---|---|---|
  | `Dateline` | trang chủ | dải `border-y`: tagline (accent) + số bài + số chuyên mục + ngày cập nhật |
  | `LeadStory` | trang chủ, 1 bài | 7/12: nhãn + `KindTag` → bìa lớn (`size="lg"`) → `<h1>` `font-display` cỡ `lg:text-[3.25rem]` → mô tả → byline → CTA accent + link |
  | `SidePost` | trang chủ, 2 bài | 5/12 (`lg:border-l`): nhãn → tiêu đề `sm:text-xl` → mô tả → meta. Không có bìa — xem lý do ở "Chọn mua" dưới. `divide-y` do container cấp |
  | `PostCard` | `/blog`, `/chuyen-muc/[slug]`, dải "Chọn mua" | cột báo: `border-t-2 border-rule` → nhãn → **bìa** (`withCover`, mặc định bật) → tiêu đề `font-display text-xl` → mô tả → meta |
  | `LatestList` | trang chủ, dải "Mới nhất" | rail ngày (3/12, không mono) + `PostThumb` 80×45 & nhãn/tiêu đề/mô tả (9/12), `divide-y` |
  | `CategoryColumn` | trang chủ, 7 cột | nhan đề chuyên mục (sans, `border-b`, kèm tổng số bài mono) → ≤3 bài (`divide-y`, `PostThumb` + tiêu đề) → mô tả mục → link "Cả chuyên mục" |
  | `PostThumb` | `LatestList`, `CategoryColumn` | ô 80×45 dùng file thumbnail sinh sẵn, `alt=""` + `aria-hidden`, `loading="lazy"`, khai `width`/`height`. Bài không có `cover` rơi về SVG của `PostCover` |
  | `KindTag` | mọi nơi hiện `CategoryTag` | nhãn "Chọn mua" cho `post.kind === "review"`, đứng cạnh `CategoryTag` |

  `PostRow`, `FeaturedCard`, `CategoryCard`, `AffiliateNote` của các bản trước đã
  **xoá** — không còn trang nào dùng.

  Bản đầu đặt tiêu đề lên khối `bg-muted` ("cover kiểu chữ") — **đã bỏ**. Nó làm
  tiêu đề, thứ quan trọng nhất của một bài, trông như nhãn bị vô hiệu hoá, và cộng
  với viền bo góc thì ra đúng hình một thẻ trong admin. Tiêu đề giờ nằm trên chính
  nền trang.

  Hệ quả cho gate màu: `--accent` **không còn** làm chữ trên nền `--muted` ở surface
  công khai (chỉ còn ở badge `paused` của `/admin`). Cặp `accent / muted` trong
  `pairsFor()` của `scripts/check-contrast.mjs` **giữ nguyên** — nó vẫn đúng cho
  admin, và bỏ ra chỉ để mất một lưới an toàn. Thêm nền tint mới ở đâu thì vẫn phải
  thêm cặp mới; gate không tự biết.
- **Không drop cap** dù Editorial Grid gợi ý `::first-letter { font-size: 4em }`.
  Chữ hoa tiếng Việt có dấu ("Ở", "Ế", "Ộ") phóng 4em sẽ bị cắt dấu hoặc đè dòng
  trên. Lý do ghi trong `globals.css` ngay chỗ bỏ.
- **Trang này ĐƯỢC index** — ngược với `/admin/**` và `/c/[slug]` preview.
  Mỗi bài phải có: `alternates.canonical`, OG đầy đủ, JSON-LD `BlogPosting`.

  **Structured data sinh từ `src/lib/seo.ts`, KHÔNG viết tay tại trang.** Các node
  trỏ nhau bằng `@id` (`#website`, `#person`), nên một trang tự viết JSON-LD là một
  trang có tham chiếu treo mà build vẫn xanh. Bảng hiện có:

  | Trang | Node |
  |---|---|
  | `/` | `WebSite` + `Person` |
  | `/blog`, `/chuyen-muc/[slug]` | `WebSite` + `Person` + `CollectionPage` (kèm `ItemList`) + `BreadcrumbList` |
  | `/blog/[slug]` | `WebSite` + `Person` + `BlogPosting` + `BreadcrumbList` |
  | `/gioi-thieu` | `WebSite` + `Person` + `ProfilePage` |

  `WebSite` + `Person` lặp ở **mọi** trang là cố ý, không phải chỗ bỏ sót cần tối ưu:
  tham chiếu `@id` chỉ phân giải được trong graph của cùng một trang, nên trang nào có
  node trỏ tới `#website`/`#person` thì phải mang theo hai node đó. Bỏ ra để tiết kiệm
  vài trăm byte là đổi lấy một tham chiếu treo.

  Ba thứ cố ý KHÔNG khai, đừng thêm lại mà không đọc lý do:
  - **`SearchAction`** — site không có trang kết quả tìm kiếm. Khai một chức năng
    không tồn tại là structured data sai sự thật.
  - **`FAQPage` / `HowTo`** — Google đã bỏ rich result của cả hai cho site thường
    (FAQ giới hạn cho cơ quan y tế/chính phủ từ 2023, HowTo bỏ hẳn). Nhét vào chỉ
    thêm markup phải bảo trì mà không đổi được gì trên SERP.
  - **`aggregateRating` / `Review`** — bài `kind: "review"` ở đây so sánh theo NHÓM
    và không cho điểm (xem `Post.kind`). Không có điểm thì không có rating để khai.
- **Breadcrumb: một mảng `Crumb`, hai đích.** `<Breadcrumb>` render và
  `breadcrumbNode()` sinh JSON-LD từ cùng mảng đó. Google chỉ in đường dẫn thay URL
  khi hai thứ khớp nhau — viết tay hai chỗ là cách chắc chắn để chúng lệch.
- **`id` của heading và mục lục do `withHeadingAnchors()` sinh, không đặt tay.**
  Thân bài là TSX nên `id` viết tay sẽ bị quên; ở đây anchor và mục lục ra từ cùng
  một lần đi cây nên không thể có mục trỏ vào anchor chết. Ngưỡng hiện ở
  `TOC_MIN_ENTRIES` (4 mục) — dưới ngưỡng thì mục lục chỉ là một khối phải bỏ qua
  trước khi tới chữ đầu tiên.
- **Tag là nhãn, KHÔNG phải link, và không có trang `/the/[tag]`.** 12 bài chia theo
  tag tự do sẽ ra hàng chục trang một-hai bài — thin content, đúng thứ hạ tín nhiệm
  một site nội dung mới. Đường "đọc thêm cùng mảng" đã có `relatedPosts()` và trang
  chuyên mục. Mở trang tag khi mỗi tag có ~5 bài, và trước đó phải chuẩn hoá tag
  thành danh sách cố định như `CATEGORIES` (hiện "điện thoại" và "dien thoai" là hai
  tag khác nhau).
- **Mỗi bài phải có ít nhất một link nội bộ trong thân bài, và ít nhất một bài khác
  trỏ về nó.** `npm run check:content` gác cả hai chiều (bài không ai trỏ tới = orphan,
  crawler chỉ tới được nó qua trang danh sách). Link phải nằm trong câu đang nói đúng
  việc đó — không dựng khối "Bài liên quan" thứ hai bằng tay, `relatedPosts()` đã làm
  việc đó ở cuối trang.
- **`npm run check:content` là gate thứ hai của surface này**, cạnh
  `check:contrast`. Nó đọc thẳng `src/content` bằng `tsx` (không regex trên chuỗi TSX)
  và chặn: mô tả ngoài khoảng 120–165 ký tự, `cover.src` trỏ vào file không tồn tại,
  `cover.alt` rỗng, thumbnail thiếu/sai cỡ/quá nặng, bài không có `<h2>`, anchor trùng
  nhau, link nội bộ tới slug không tồn tại, orphan, và ngày sai (`updatedAt` sớm hơn
  `publishedAt` hoặc ở tương lai). Cảnh báo (không chặn): tiêu đề từ 72 ký tự, link ra
  ngoài thiếu `rel="nofollow"`.
- **Mọi link ra ngoài có tính chất affiliate phải `rel="nofollow sponsored"`** và
  bài đó phải hiện nhãn tiết lộ tại chỗ qua `PromoBox`
  (`components/content.tsx`). Không có ngoại lệ — đây là yêu cầu pháp lý, không
  phải lựa chọn design. Dòng tiết lộ chung ở footer và ở cuối trang chủ đã **bỏ**
  vì hiện không bài nào có link tài trợ (xem `SiteFooter`); nhãn tại chỗ của
  `PromoBox` không phụ thuộc quyết định đó và không bao giờ được bỏ.
- **Không có nội dung nào chỉ hiện khi có JS.** Blog phải đọc được với JS tắt và
  crawler phải thấy toàn văn trong HTML đầu tiên.

---

## Taxonomy và dạng bài

**7 chuyên mục** (`CategorySlug` trong `content/types.ts`): Công nghệ & thiết bị,
Tiền bạc & chi tiêu, Đời sống & kỹ năng, Nhà cửa & gia dụng, Bếp & thực phẩm, Đi
lại & xe cộ, Làm việc & học tập. Thêm chuyên mục mới thì phải sửa đồng thời bốn
chỗ: `CategorySlug`, `CATEGORIES` (`content/taxonomy.ts`), `COVER_MOTIF`
(`components/site.tsx` — thiếu entry là lỗi build, không phải lỗi lặng), và
`MAIN_NAV`/`FOOTER_NAV` nếu chuyên mục đủ quan trọng để lên header.

**`MAIN_NAV` chỉ 5 mục** (Bài viết + 4 chuyên mục dày nhất), **`FOOTER_NAV` liệt
kê đủ 7**. Lý do: dải nav là `overflow-x-auto`, dải phải cuộn mới thấy hết coi như
vô hình với phần lớn người đọc; cột "Chuyên mục" ở footer là nơi DUY NHẤT liệt kê
đủ toàn bộ, và cũng là đường crawler tới được mọi trang chuyên mục từ bất kỳ trang
nào.

**`Post.kind`: `"guide"` (mặc định) hoặc `"review"`.** `"review"` = bài giúp CHỌN
một món đồ. Ràng buộc bắt buộc cho dạng này (đọc đầy đủ ở comment tại
`content/types.ts`):

- **Không kể trải nghiệm không có thật.** Không "tôi đã dùng ba tháng", không cho
  điểm 8.5/10, không so sánh hai model cụ thể bằng số đo tự đo. Đây không phải
  lựa chọn văn phong — bịa trải nghiệm là cách nhanh nhất làm mất uy tín với cả
  người đọc lẫn ad network, tức phá đúng mục tiêu đang xây.
- **So sánh theo NHÓM** (kiểu máy, tầm giá), không theo model cụ thể: tiêu chí thì
  đúng lâu, số liệu của một model cụ thể cũ đi trong vài tháng và không ai cập
  nhật.
- **Mọi bài `kind: "review"` phải có `<MethodNote>`** (`components/content.tsx`)
  nói rõ bài dựa trên cái gì. Đây là khối kiểm được bằng mắt khi review bài mới —
  thiếu nó thì đừng merge.
- Bảng so sánh dùng `<CriteriaTable>`, không tự viết `<table>` tay — nó đảm bảo có
  `<thead>` (bảng thiếu `<thead>` là bảng vô hình với screen reader) và style ăn
  sẵn với `.prose table` (scroll ngang ở mobile).
- `KindTag` hiện nhãn "Chọn mua" cạnh `CategoryTag` ở mọi nơi bài đó xuất hiện.

**Không viết nội dung nhạy cảm.** Không tư vấn y tế/thuốc cụ thể, không tư vấn
đầu tư/vay nợ cụ thể, không hướng dẫn thao tác có thể nguy hiểm nếu làm sai mà
không kèm cảnh báo rõ (ví dụ: sửa điện, sửa phanh xe) — những chỗ đó phải chỉ
người đọc ra nơi có chuyên môn, không tự hướng dẫn làm thay. Số liệu không có
nguồn xác thực (mẹo cảm quan, ước lượng) phải được nói rõ là ước lượng/tương đối,
không viết như một sự thật đo được.

---

## Pre-Delivery Checklist (kế thừa MASTER + thêm)

- [ ] Không emoji làm icon — SVG (Heroicons/Lucide)
- [ ] `cursor-pointer` trên mọi thứ click được
- [ ] Transition 150–300ms
- [ ] Focus visible khi tab
- [ ] `prefers-reduced-motion` được tôn trọng
- [ ] Responsive 375 / 768 / 1024 / 1440
- [ ] Không horizontal scroll ở mobile; bảng/code scroll trong khung
- [ ] **Thân bài ≤ 68ch/dòng**
- [ ] **Mỗi bài có canonical + OG + JSON-LD BlogPosting**
- [ ] **Link affiliate có `rel="nofollow sponsored"` + nhãn tiết lộ**
- [ ] **Tắt JS vẫn đọc được toàn bộ bài**
- [ ] **Heading dùng `font-sans`, không phải `font-mono`** (xem MASTER § Typography)
