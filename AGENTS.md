<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TrafficIQ

Affiliate/campaign platform trên Next.js 16 (App Router) + MongoDB Atlas + Vercel.
Ba surface: landing SSR có OG per-campaign (`/c/[slug]`), redirect tracking
(`/go/[token]`), postback conversion (`/api/postback`). Control plane ở `/admin`.

Surface thứ tư — **website nội dung công khai** (`/`, `/blog/**`, `/chuyen-muc/**`
và các trang tĩnh) — là một site **nội dung tổng hợp** thật (công nghệ, tiền bạc,
đời sống), KHÔNG phải blog về affiliate/performance marketing. Nó là nơi người đọc
tới vì nội dung; tracking chỉ nằm sau các liên kết tài trợ trong bài.
Xem bất biến kiến trúc số 13 về tên hiển thị.

---

## UI/UX — CHUẨN BẮT BUỘC CỦA DỰ ÁN

**Mọi việc liên quan tới UI/UX PHẢI đi qua skill `ui-ux-pro-max`.** Không tự bịa
màu, font, spacing, layout. Không copy pattern từ nơi khác vào.

### Thứ tự tra cứu (bắt buộc, không được đảo)

1. `design-system/trafficiq/pages/<page>.md` — nếu có file cho page đang làm,
   **luật trong đó override MASTER**.
2. `design-system/trafficiq/MASTER.md` — luật chung. Đọc cả block
   "⚠️ Sai lệch có chủ đích" ở mục Color Palette.
3. `src/app/globals.css` — giá trị token đang chạy thật.

Page override hiện có:

| Page | File | Đặc điểm |
|---|---|---|
| `/admin/**` | `pages/dashboard.md` | Data-Dense Dashboard, density 8/10, max-w 1400px |
| `/c/[slug]` | `pages/campaign-landing.md` | Hero-Centric + Conversion-Optimized, density 4/10, một CTA |
| `/`, `/blog/**`, `/chuyen-muc/**`, `/gioi-thieu`, `/lien-he`, `/dieu-khoan`, `/chinh-sach-bao-mat`, `/tiet-lo-lien-ket` | `pages/blog.md` | Editorial Grid / Magazine, **tầng token riêng `.theme-editorial`**, trang chủ = pattern Front Page, thân bài 68ch, không ảnh |

Làm page mới chưa có override → dùng MASTER. Nếu page đó lệch bản chất so với
MASTER (ví dụ một surface marketing mới), sinh override bằng skill trước khi code:

```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<mô tả page>" \
  --design-system --stack nextjs -p TrafficIQ --format markdown \
  --persist --output-dir . --page <tên-page>
```

Lưu ý khi chạy lệnh trên: `--design-system` chọn **style theo dial `--variance`**,
không theo độ liên quan của query. Với `--variance` 1–3 nó từng trả về
"Dark Mode (OLED)" và "Exaggerated Minimalism" cho một query dashboard. **Luôn
đối chiếu style nó chọn với `--domain style`** trước khi tin:

```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<mô tả>" --domain style -n 4
```

Nếu hai kết quả lệch nhau, lấy theo `--domain style` và ghi lý do vào file override.

### Luật token — tuyệt đối

- **KHÔNG hard-code màu trong component.** Không `text-neutral-500`, không
  `bg-slate-900`, không `#hex`. Chỉ dùng semantic token: `bg-card`,
  `text-muted-foreground`, `border-border`, `bg-accent`, `text-destructive`…
- Toàn bộ hex chỉ được tồn tại trong `src/app/globals.css`. Grep này phải luôn
  rỗng ngoài `globals.css`:

  ```bash
  rg "(text|bg|border|from|via|to|fill|stroke|ring|divide|outline|shadow|decoration)-(neutral|slate|zinc|gray|stone)-[0-9]{2,3}|#[0-9a-fA-F]{6}" src --glob '!globals.css' --glob '!icon.svg'
  ```

  `icon.svg` được loại vì nó là **file ảnh**, không phải component: favicon nằm
  trong tab trình duyệt, ngoài cây DOM của trang, nên không có CSS variable nào
  phân giải được ở đó. Nó là bản sinh ra từ `scripts/generate-icons.mjs` — sửa
  màu ở script rồi chạy `npm run gen:icons`, đừng sửa tay file SVG.

  Bản cũ của grep này là `rg "neutral-|slate-|zinc-|gray-|#[0-9a-fA-F]{6}"` và nó
  **báo nhầm**: `slate-` khớp cả bên trong `translate-x-1` (utility transform, không
  phải màu), còn `neutral-` khớp cả chính các dòng comment nhắc luật này. Bản trên
  buộc phải có prefix thuộc tính + số thang màu nên chỉ bắt đúng màu hard-code.

- **HAI SCOPE TOKEN, không phải một.** `:root` = bộ nền (`/admin`, `/c/[slug]`,
  `/link-unavailable`). `.theme-editorial` = bộ công khai, áp ở
  `src/app/(site)/layout.tsx`. Cùng một danh sách tên token, khác giá trị — nên
  `bg-card`/`text-accent` tự phân giải theo cây DOM, không cần biến thể class nào.
  Thêm token màu mới thì phải thêm vào **cả hai** scope, và thêm cặp vào
  `pairsFor()` (gate chạy bốn bộ: root/editorial × light/dark).
  Lý do tách: `pages/blog.md` § "Colors".
- `--border` chỉ cho divider/viền card. Viền input/select/textarea dùng
  `--input` (đạt 3:1). Đừng đổi chỗ hai cái này.
- `--accent` là màu **duy nhất** được dùng cho CTA chính. Action phụ dùng outline
  `--primary`. Hai CTA accent trên cùng một view = sai.
- **Bo góc: 0 trên toàn surface công khai.** Không viết `rounded-*` trong
  `(site)/**` — Editorial Grid dựng thứ bậc bằng gạch kẻ. `/admin` vẫn bo góc.
- Font — **ba họ, mỗi họ một việc**:
  - `font-sans` (**Be Vietnam Pro**): body của cả ba surface, và **mọi** chữ ở
    `/admin` kể cả heading.
  - `font-display` (**Fraunces**, serif): **chỉ** nhan đề của surface công khai —
    wordmark, tiêu đề bài, `.prose h2/h3`, `PageHeader`. Chỉ nạp **weight 700**
    nên luôn đi kèm `font-bold`; đặt `font-semibold` lên `font-display` là bắt
    browser giả độ đậm. KHÔNG dùng cho nhãn nhỏ uppercase (`SectionHeading`, nhãn
    chuyên mục) và KHÔNG dùng ở `/admin`.
  - `font-mono` (**JetBrains Mono**): **chỉ** cột số liệu (`tabular-nums`), code,
    token/URL — **không dùng cho heading**. Ngày tháng không phải cột số.
  - **Chữ Ả Rập** (nội dung có thể có tiếng Ả Rập): **Noto Sans Arabic** cho body/giao diện,
    **Noto Naskh Arabic** cho nhan đề — là hai `@font-face` TỰ HOST ở đầu `globals.css` (file ở
    `src/app/fonts/`), KHÔNG qua `next/font`. Đừng "đơn giản hoá" bằng `Noto_Sans_Arabic` của next/font: nó vẽ
    luôn chữ Việt bằng glyph Latin của font Ả Rập, và font dự phòng Arial của nó (không tắt được trên Turbopack)
    chiếm chữ Ả Rập. Thứ tự trong `--font-sans`/`--font-display` là luật: font Ả Rập ĐẦU, font Latin/Việt sau,
    từ khoá chung (`sans-serif`/`serif`) chỉ ở CUỐI. Giải thích và số đo: `globals.css` (khối `--font-sans`) và
    MASTER.md § Typography "Đa ngôn ngữ". Mọi `font-family` đi qua `font-sans`/`font-display`/`font-mono` —
    không hard-code, không dùng thẳng biến `--font-be-vietnam-pro`…

  Đừng quay lại Fira Code: nó không có subset `vietnamese` nên chữ có dấu thanh
  (U+1EA0–1EF9) rơi sang font hệ thống ngay giữa từ. Lý do đầy đủ + cách kiểm
  trong MASTER.md § Typography. Font mới nào cũng phải có subset `vietnamese`:

  ```bash
  node -e "console.log(require('next/dist/compiled/@next/font/dist/google/font-data.json')['<Tên Font>'].subsets.join(','))"
  ```

  Và phải đo chi phí thật sau khi build trước khi thêm weight thứ hai: một weight
  Fraunces = ~44KB cho trang tiếng Việt (latin 32.9KB + vietnamese 11.3KB, browser
  tải cả hai vì một câu có dấu chạm cả hai `unicode-range`).

### Gate trước khi coi UI là xong

```bash
npm run check:contrast   # WCAG: 4.5:1 text, 3:1 UI. PHẢI pass.
npm run check:fonts      # font: subset vietnamese, thứ tự ngăn xếp Ả Rập, luật font-display/font-mono. PHẢI pass.
npm run lint
npm run build
```

`check:contrast` đọc trực tiếp `globals.css` và gác **bốn** bộ token (`:root` và
`.theme-editorial`, mỗi bộ light + dark). Thêm cặp màu mới vào UI thì thêm cặp đó
vào `pairsFor()` trong `scripts/check-contrast.mjs` — gate không tự biết.

Khi đọc output, kiểm cả **tên bộ** in ra đúng màu của bộ đó: `parseBlock()` phải
khớp selector ở đầu dòng vì comment đầu `globals.css` cũng nhắc tên hai selector —
bản trước dùng `indexOf()` nên bắt vào comment rồi đo lại bộ `:root` mà vẫn in nhãn
"CÔNG KHAI" và báo PASS.

Checklist còn lại (từ MASTER.md, kiểm bằng mắt):

- [ ] Không dùng emoji làm icon — dùng SVG (Heroicons/Lucide)
- [ ] `cursor-pointer` trên mọi thứ click được
- [ ] Transition 150–300ms, không đổi state tức thì
- [ ] Focus state nhìn thấy được khi tab bằng keyboard
- [ ] `prefers-reduced-motion` được tôn trọng
- [ ] Responsive tại 375 / 768 / 1024 / 1440px
- [ ] Bảng rộng thì scroll ngang, không phá layout
- [ ] Không horizontal scroll ở mobile

### Lưu ý môi trường

Tài liệu skill viết `python3`, nhưng trên máy này `python3` là stub WindowsApps
và sẽ fail. **Dùng `python`** (Python 3.9.13).

### Các skill khác đã cài kèm

`ui-styling` (Tailwind/shadcn), `design-system` (token architecture),
`design` (logo/icon/CIP), `brand`, `slides`, `banner-design`.
Dùng khi đúng việc; `ui-ux-pro-max` vẫn là nơi chốt quyết định design.

---

## Bất biến kiến trúc — đừng phá

Đây là các quyết định có lý do vận hành, không phải style. Sửa thì đọc comment
tại chỗ trước.

1. **`MongoClient` cache trên `globalThis`** (`src/lib/db/client.ts`).
   Mỗi invocation mở client mới sẽ cạn giới hạn ~500 connection của Atlas M0.
   Không bao giờ `client.close()` trong request handler.

2. **Tracking ghi sau response, qua `after()`** (`src/lib/tracking/emit.ts`).
   Serverless đóng băng ngay sau khi trả response nên không có background worker
   in-process. Redirect trả 302 trước, ghi `clickEvent` sau. Tracking lỗi
   không bao giờ được làm gãy redirect.

3. **Redirect chỉ 302 tới URL trong whitelist** (`destinations` collection).
   `/go/[token]` **không bao giờ** nhận URL từ query param — đó là open-redirect.
   `buildTargetUrl()` chỉ được *thêm* param vào URL đã whitelist.
   Sửa URL đích (`updateDestination`) cũng PHẢI đi qua `destinationSchema` (qua `destinationUpdateSchema` = `.extend`) —
   luật chỉ http/https là toàn bộ phòng thủ chống `javascript:`/`data:` vào whitelist, đừng thêm đường ghi `url` nào khác;
   và phải `invalidateRouteCache()` vì routing map trong RAM mang theo URL cũ.

4. **`clickEvents` có TTL index; `conversions` có unique index trên `clickId`.**
   TTL vì M0 chỉ 512MB. Unique để postback idempotent — advertiser nào cũng retry.
   Đổi `CLICK_TTL_DAYS` thì phải chạy lại `npm run setup:indexes`.

5. **Dashboard tính on-demand bằng aggregation**, không rollup job.
   Vercel Cron free tier không chạy mỗi phút. Atlas shared tier **không hỗ trợ**
   `allowDiskUse` và `$merge`/`$out` — đừng dùng. `/api/rollup` chỉ để dành cho
   khi aggregation chậm, gọi bằng cron ngoài (GitHub Actions).

6. **IP là PII — chỉ lưu `sha256(ip + salt)`**, không lưu thô. Đổi `IP_HASH_SALT`
   sẽ làm sai toàn bộ số "unique visitors" lịch sử.

7. **Next 16 dùng `src/proxy.ts`**, không phải `middleware.ts` (đã deprecated).
   File này chạy trên Edge runtime → không import driver Mongo hay `node:crypto`.

8. **Route cache của redirect là per-instance.** `invalidateRouteCache()` chỉ xóa
   cache trên instance đang chạy; instance warm khác còn giữ route cũ tới 60s.
   Sau khi pause campaign, tính là link còn sống thêm ~1 phút.

9. **Nội dung blog là module TSX trong `src/content/`, không phải bản ghi DB.**
   Trang blog render tĩnh lúc build → 0 query, 0 compute mỗi lượt xem. Thêm bài
   phải thêm `import` tường minh vào `REGISTRY` trong `src/content/index.ts` —
   quét thư mục động sẽ làm `generateStaticParams` không thấy bài.

   Hệ quả: hai thứ của mỗi bài được **sinh từ chính cây JSX**, đừng đặt tay.
   `withHeadingAnchors()` (`src/content/headings.tsx`) gắn `id` vào h2/h3 và trả về
   mục lục của đúng những `id` đó trong một lần đi cây — nên không có mục lục nào trỏ
   vào anchor không tồn tại. Anchor bỏ dấu bằng `slugify()` dùng chung với slug chiến
   dịch: hai hàm bỏ dấu khác nhau sẽ cho hai anchor khác nhau cho cùng một tiêu đề, và
   link đã chia sẻ trỏ vào chỗ trống.

   **Structured data (JSON-LD) chỉ sinh từ `src/lib/seo.ts`.** Các node trỏ nhau bằng
   `@id` (`#website`, `#person`), nên trang nào tự viết JSON-LD là trang có tham chiếu
   treo — build vẫn xanh và không gate nào bắt được. Cùng lý do, `canonical` + link RSS
   đi qua `publicAlternates()`: Next **thay thế** cả field `alternates` khi trang con
   khai lại nó, nên đặt `types` một lần ở layout sẽ bị xoá đúng ở những trang cần nó.
   Danh sách node theo từng trang, và ba loại schema cố ý KHÔNG khai (`SearchAction`,
   `FAQPage`/`HowTo`, `aggregateRating`), ở `design-system/trafficiq/pages/blog.md`.

10. **Form liên hệ ghi vào `contactMessages`, KHÔNG gửi email.** Dự án không có
    hạ tầng mail. Vì vậy `/admin/lien-he` là bắt buộc phải tồn tại — bỏ trang đó
    là thư của người thật rơi vào chỗ không ai đọc. Đừng thêm câu "chúng tôi sẽ
    gửi email xác nhận" vào UI: điều đó không xảy ra.

11. **`/chinh-sach-bao-mat` phải khớp với hành vi thật của code.** Thời gian lưu
    click đọc trực tiếp từ `clickTtlDays()`, không viết cứng "30 ngày". Đổi cách
    thu thập dữ liệu ở đâu thì sửa cả trang đó — sai ở trang này là tuyên bố sai
    sự thật với người dùng, không phải lỗi hiển thị.

12. **`(site)` là route group, `/c/[slug]` cố ý nằm ngoài nó.** Landing không có
    nav/footer: mọi link ngoài CTA đều là chỗ rò rỉ click. Đừng "thống nhất
    layout" bằng cách kéo landing vào `(site)`.

13. **Hai cái tên, đừng trộn.** `SITE.name` trong `src/lib/site.ts` là **thương
    hiệu công khai** của website nội dung (hiện: "InsightDaily", người viết
    `SITE.owner` = "Toàn") — hiện ở header, footer, OG, RSS, JSON-LD.
    Hai rủi ro đã biết của tên hiện tại (tên tiếng Anh nghe như công cụ analytics;
    "Daily" hứa nhịp hằng ngày trong khi nhịp thật là hằng tuần) đã được chủ dự án
    cân và chấp nhận — lý do đầy đủ ghi ở comment trong `src/lib/site.ts`. Đừng
    "sửa" tên về tiếng Việt mà không hỏi, và đừng thêm câu nào ở UI/metadata
    khẳng định site ra bài mỗi ngày.
    **"TrafficIQ" là tên hệ thống nội bộ**: repo,
    `/admin/**`, tài liệu kỹ thuật. `/admin/**` hard-code "TrafficIQ" là ĐÚNG, không
    phải chỗ bỏ sót — đừng "đồng bộ" nó về `SITE.name`, và đừng đưa "TrafficIQ" ra
    surface công khai. Lý do: người đọc một bài về điện thoại không có lý do gì phải
    thấy tên một công cụ tracking, và để tên đó ở đó làm site trông như trang thu
    traffic thay vì trang nội dung — tín hiệu xấu với cả người đọc lẫn ad network.

    Site chạy dưới **thương hiệu cá nhân**, nên `AUTHORS` trong
    `src/content/taxonomy.ts` là một NGƯỜI (`SITE.owner`), không phải "ban biên
    tập", và JSON-LD dùng `"@type": "Person"`. Đừng đổi ngược về Organization để
    trông "lớn" hơn: byline phải khớp thực tế, đó là thứ ad network kiểm.

14. **Dashboard KHÔNG hiển thị doanh thu/EPC — cố ý bỏ.** `conversions.payout`
    vẫn được `/api/postback` ghi xuống và `/api/rollup` vẫn cộng, nhưng đó là số
    advertiser tự khai: không đối soát được, không sửa được, không biết đã trả
    hay chưa. Đưa lên dashboard là biến một ước tính thành thứ trông như sự thật
    kế toán. Muốn hiện lại thì phải làm chỗ quản lý đối soát trước, không phải
    chỉ thêm lại cột vào `getOverview`/`getCampaignBreakdown`.

15. **`/admin/campaigns` chỉ là DANH SÁCH; form tạo ở `/admin/campaigns/new`.**
    Form tạo có 11 field — nhét chung một màn hình thì danh sách bị đẩy khỏi
    viewport. Mỗi hàng chiến dịch là `<details>` (không phải state React) vì
    control plane phải dùng được khi JS chưa tải, giống lý do ở `action-form.tsx`.
    `createCampaign` redirect về `?new=<slug>` để danh sách bung sẵn chiến dịch
    vừa tạo — đổi tên param đó thì sửa cả hai đầu.

    Field của form nằm ở `src/components/campaign-fields.tsx`, **dùng chung** giữa
    `/new` và `/[id]/edit`. Đừng thêm field trực tiếp vào một trong hai trang: nó
    sẽ có ở form tạo mà không có ở form sửa, và vì `updateCampaign` ghi cả object
    `landing`/`og` bằng `$set`, mỗi lần bấm Lưu là field đó bị xoá trắng.

    **Đường dẫn tĩnh tự sinh từ tên — nhưng CHỈ khi tạo.** `slugify()`
    (`src/lib/slug.ts`) chạy ở cả hai phía: client điền sẵn khi admin gõ tên, server
    suy ra khi field để trống (đường duy nhất còn lại khi JS chưa tải — vì vậy field
    `slug` ở form tạo **không** có `required`). Một hàm duy nhất, nếu không thì
    bật/tắt JS cho ra hai đường dẫn khác nhau cho cùng một tên.

    Ở form **sửa** thì KHÔNG tự sinh lại theo tên: đường dẫn đang sống, tự đổi nó
    nghĩa là sửa một chữ trong tên rồi bấm Lưu là mọi link `/c/…` đã chia sẻ thành
    404 mà không ai chọn điều đó. Muốn đổi thì bấm nút "Sinh lại từ tên" — vẫn làm
    được, nhưng phải cố ý. Đừng "thống nhất hành vi hai form".

    **"Tạo và xem trước"** là nút submit thứ hai gửi `afterCreate=preview`
    (`<button name value>`, nên chạy cả khi không có JS) để `createCampaign` chuyển
    sang trang xem trước thay vì về danh sách. Không có cơ chế nháp riêng và không
    cần: chiến dịch mới luôn `pending`, tức nó ĐÃ là nháp. Đừng dựng đường render
    riêng cho nội dung chưa lưu — đó là bản render thứ hai sẽ lệch khỏi trang thật.

16. **`landing.bodyHtml` chỉ được ghi qua `sanitizeLandingBody()`.** Thân bài
    landing render bằng `dangerouslySetInnerHTML` trên `/c/[slug]` — một trang
    CÔNG KHAI. Hai đường ghi hiện có (`createCampaign`, `updateCampaign`) đều gọi
    sanitizer; thêm đường thứ ba mà quên gọi là stored XSS chạy trong browser của
    người đọc thật.

    Whitelist thẻ là **cố định** và có lý do, không phải danh sách tuỳ ý — xem
    `design-system/trafficiq/pages/campaign-landing.md` § "Thân bài rich-text".
    Hai điểm dễ bị nới sai:
    - **`<a>` bị chặn** vì bất biến 12: landing không có nav/footer do mọi link
      ngoài CTA là chỗ rò rỉ click. Cho link vào thân bài là mở lại đúng lỗ đó.
    - **`style`/`class`/`id` bị chặn** vì nội dung phải nằm trong design token.
      Cho admin đặt màu tay là `npm run check:contrast` mất ý nghĩa — gate đó đọc
      `globals.css`, không đọc được HTML nằm trong Mongo.

    Whitelist ở `rich-text-editor.tsx` (tắt extension) chỉ là UX: field submit là
    một `<textarea>` thật nên ai cũng gõ HTML tay vào được. Sửa một bên mà không
    sửa bên kia thì hoặc admin mất định dạng lúc lưu, hoặc có lỗ bảo mật.

    `landing.bodyText` là bản phẳng đời đầu, **@deprecated**. `LandingView` còn
    đọc nó để campaign cũ không mất nội dung, và form sửa nạp
    `bodyHtml ?? bodyText` để lần lưu kế tiếp di trú sang HTML. Đừng ghi mới vào
    `bodyText`, và đừng bỏ đường đọc nó khi chưa chắc mọi campaign đã di trú.

17. **`/campaign-preview/[id]` nằm NGOÀI `/admin` — và phải có entry riêng trong
    `proxy.ts`.** Nó là `src` của iframe ở `/admin/campaigns/[id]/preview`.
    `src/app/admin/layout.tsx` bọc mọi route con bằng header + nav admin và layout
    cha thì không bỏ được từ route con, nên đặt khung dưới `/admin` là có nav admin
    nằm trong iframe — preview không còn giống trang thật.

    Hệ quả: nó không được matcher `/admin` bảo vệ. Bỏ
    `"/campaign-preview/:path*"` khỏi matcher là bản nháp và bản đã tạm dừng của
    mọi campaign thành công khai cho bất kỳ ai đoán được ObjectId.

    Dùng iframe chứ không phải một `<div>` hẹp vì breakpoint Tailwind tính theo
    **viewport**, không theo container: landing trong div 375px trên màn desktop
    vẫn ăn `sm:text-5xl`, tức khung "điện thoại" nói dối đúng cái người ta mở nó
    ra để kiểm.

    `getCampaignById` **không lọc status** (khác `getLandingCampaign` chỉ nhận
    active|pending) — đó là điểm chính của trang sửa/xem trước: `paused` chính là
    lúc cần mở ra sửa rồi chạy lại. Preview không truyền `ctaHref` nên CTA không
    điều hướng: bấm thử mà đi qua `/go/[token]` là tạo click giả trong chính báo
    cáo mà dashboard đang đọc.

18. **`lib/botdetect` chấm điểm rủi ro — điểm chỉ được dùng để ghi log, giới
    hạn tần suất, ra thử thách PoW.** Không dùng nó để trả nội dung khác nhau cho
    crawler và người (cloaking). Ở `/go/[token]` nó đang chạy **chế độ bóng**: ghi
    `riskScore`/`riskSignals` vào `clickEvent` (chỉ khi điểm > 0 và request không bị `botReason` chặn trước), không đổi response. Trang
    `/chinh-sach-bao-mat` đang khẳng định đúng điều đó (bất biến 11) — cho điểm này
    quyết định redirect thì phải sửa trang đó cùng lúc.

    FCrDNS (`assessRequest`) cần DNS nên **không chạy trên hot path** — dùng
    `assessRequestSync` ở đó. Module import `node:dns`/`node:crypto` nên không
    được import từ `proxy.ts` (Edge, bất biến 7). Google: **đừng** nới suffix về
    `googleusercontent.com` trần — mọi VM Google Cloud có PTR dạng đó, nghĩa là ai
    cũng giả được Googlebot. Chi tiết từng lớp: `src/lib/botdetect/README.md`.

    **`botReason()` (`lib/tracking/ua.ts`) quyết định ai được redirect — chặn nhầm một người nghĩa là họ nhận
    Social Card thay vì được chuyển tiếp.** Quy luật `non-browser-ua` bắt UA KHÔNG có dấu hiệu trình duyệt nào:
    không `Mozilla/<số>` Ở BẤT KỲ ĐÂU trong chuỗi (webview đặt tên app trước `Mozilla/5.0`; `Mozilla` viết lệch cũng
    tính), không token bộ máy (AppleWebKit, Gecko, Trident, …), không dấu hiệu Java ME/WAP, TV hay in-app, và không
    phải dạng điện thoại đời cũ (`LEGACY_BROWSER_UA`, cố ý rộng). Stack HTTP gốc của ứng dụng (Dalvik, CFNetwork,
    Microsoft Office, Sonos…) cố ý bị tính là không-phải-trình-duyệt. Số đo HIỆN TẠI: `npm run check:bot-external`
    (corpus bên thứ ba, có ngưỡng); số đo trước/sau và lý do từng quy luật: `src/lib/botdetect/HISTORY.md`.

    Thêm quy luật bắt bot vào đây thì phải đo CHẶN NHẦM NGƯỜI trước (`check:bot` + `check:bot-external`), không chỉ
    recall. Regex trong file này đã từng bị tìm ra là bậc hai (ReDoS) nhiều lần, kể cả của chính tác giả (xem `src/lib/botdetect/HISTORY.md`):
    đừng dùng `[...]*` hay `[^)]*` không giới hạn trước một ký tự có thể không xuất hiện, và hai `\s*` kề nhau quanh một
    thành phần tuỳ chọn; giới hạn độ dài (`{0,300}`), và chạy lại các dạng đầu vào bất lợi trong `botdetect.test.ts`.

19. **Ảnh campaign: một field, hai nguồn — Mongo chỉ lưu đường dẫn, byte ảnh nằm trên đĩa.**
    `heroImageUrl`/`ogImageUrl` là một chuỗi: admin dán link http(s) ngoài HOẶC tải ảnh lên
    (`ImageUrlField`) — tải lên chỉ là điền `/uploads/<sha256>.<ext>` vào chính field đó.
    KHÔNG được lưu byte ảnh vào MongoDB: Atlas M0 chỉ 512MB và dữ liệu ảnh không phải việc
    của database này.

    **Nơi lưu chọn bằng một cờ: `STORAGE_DRIVER=disk|vercel|s3`** (`src/lib/media/storage-config.ts`,
    đầy đủ biến ở `.env.example`). Mỗi driver là một module trong `src/lib/media/drivers/` và chỉ
    driver được chọn mới được nạp. **Mặc định (để trống cờ) là `vercel`** vì CI/CD deploy lên Vercel,
    nơi đĩa không bền: Vercel Blob (`BLOB_READ_WRITE_TOKEN`, store PUBLIC). Thiếu token thì upload báo
    lỗi rõ ràng và dán link vẫn chạy; chạy local không có token thì đặt `STORAGE_DRIVER=disk`. `disk`
    ghi vào `UPLOAD_DIR` và trả `/uploads/<tên>` (route `/uploads/[file]` phục vụ) — chỉ chọn tường
    minh, `UPLOAD_DIR` đơn lẻ KHÔNG bật nó, và `disk` trên Vercel bị từ chối. `s3` dùng mọi dịch vụ
    tương thích S3 (R2, MinIO, B2, AWS) và trả URL tuyệt đối dưới `S3_PUBLIC_URL` — bucket phải đọc
    được công khai, code không đặt ACL từng object.
    Thêm nơi lưu mới = thêm một driver + một nhánh ở `saveImage`. Đổi driver giữa chừng không làm hỏng
    campaign cũ vì schema nhận cả đường dẫn `/uploads/…` lẫn URL http(s); route `/uploads` vẫn phục vụ
    ảnh cũ nếu `UPLOAD_DIR` còn được đặt.

    Với `disk` trên VM: `UPLOAD_DIR` PHẢI nằm ngoài thư mục deploy và là đường dẫn TUYỆT ĐỐI; nginx nên
    đọc thẳng thư mục đó, và route upload cần `client_max_body_size 5m` (mẫu cấu hình ở comment đầu
    `src/app/uploads/[file]/route.ts`). Client S3 tắt checksum tự động (`WHEN_REQUIRED`) vì AWS SDK
    mới mặc định gắn CRC32 + `aws-chunked`, thứ R2/B2/MinIO cũ từ chối. Giữ `import()` động cho từng
    driver trong `store.ts`: đó cũng là thứ giữ cho `npm run build` không in cảnh báo Turbopack "whole
    project was traced" (đường dẫn đọc ở driver `disk` do biến môi trường quyết định).

    **Độ nét — đã đo, đừng "tối ưu" lại bằng cảm tính.** `processImage()` giữ nguyên bề rộng
    (hero 1400px, OG 1200px) và hạ chất lượng từ 88 xuống sàn (WebP 50, JPEG 60) cho tới khi
    ≤ 200KB. KHÔNG thu nhỏ ảnh để lọt ngân sách: ở ảnh dày chi tiết, thu nhỏ xuống 1190px làm
    mất 13% cạnh (giữ 87%) trong khi q50 ở 1400px giữ 98%. Ảnh PNG đồ hoạ (chữ, ảnh chụp màn
    hình) đi qua WebP lossless khi ≤ ngân sách — nhỏ hơn lossy và giữ nguyên từng điểm ảnh.
    Ảnh có ICC (Display P3 của iPhone, CMYK) được sharp tự chuyển sang sRGB; test giữ điều này.
    Số đo và lý do nằm ở comment `QUALITY_LADDER`; `media.test.ts` có các phép đo chống hồi quy
    (PSNR, giữ cạnh, lossless, màu P3) trên ảnh thật của dự án.

    **Giới hạn kích thước — nói bằng số, và đừng bắt admin nén tay.** Trần file gửi lên là 4MB
    (`MAX_UPLOAD_BYTES`, `src/lib/media/limits.ts`): Vercel cắt body Function ở 4,5MB và không nâng
    được; nginx mặc định 1MB. Ảnh chụp điện thoại thường 3–12MB nên `ImageUrlField` tự thu nhỏ trong
    trình duyệt (`client-shrink.ts`) khi file > 2MB: cạnh dài về 2800px (gấp đôi ảnh lớn nhất server
    xuất, nên Lanczos của sharp vẫn thu nhỏ tiếp từ bản còn dư độ phân giải — độ nét cuối không đổi),
    JPEG q0,92; PNG/WebP có alpha giữ PNG; EXIF Orientation được trình duyệt xử lý. Đo trên Chromium
    thật: ảnh 12,8MB → 1,1MB → 97KB trên server, PNG trong suốt 15,4MB vẫn giữ 51% điểm ảnh trong suốt,
    ảnh dọc EXIF ra đúng chiều. Mọi thông báo lỗi kèm kích thước thật và giới hạn thật (lỗi 413 của
    nền tảng/proxy cũng được nhận ra và giải thích) — đừng quay lại câu chung chung "file quá lớn".
    Hằng số nằm ở `limits.ts` (không import `sharp`) để client dùng chung với server.

    **Bảo mật upload — nhiều lớp độc lập** (xem comment đầu `src/app/admin/upload-image/route.ts`):
    proxy chặn `/admin/**`; handler TỰ kiểm lại cookie phiên (đừng dựa riêng vào matcher);
    CSRF bằng `Sec-Fetch-Site` rồi mới đến Origin/`X-Forwarded-Host` (so Origin với `Host` trần
    sai sau nginx); bắt buộc `content-length` hợp lệ và ≤ 4MB TRƯỚC khi đọc body; giới hạn 20
    lượt/phút và 3 lượt xử lý đồng thời (`upload-guard.ts`); lỗi hạ tầng trả câu chung, không
    lộ đường dẫn. `processImage()` là cửa duy nhất trước khi ghi: chỉ nhận jpeg/png/webp theo
    NỘI DUNG (không tin `Content-Type` hay tên file), **từ chối SVG** (có thể chứa script), luôn
    giải mã rồi mã hoá lại, bỏ EXIF/GPS, chặn ảnh khổng lồ về số điểm ảnh, và bị chặn CPU ở ảnh
    nhiễu hạt (thử sàn chất lượng trước). Tên file = sha256 của byte đã nén (dùng chung cả ba driver, nên không có gì do client khai lọt vào khoá
    object); `UPLOAD_FILE_RE` là toàn bộ phòng thủ path traversal của route phục vụ — đừng nới. File ghi bằng cờ `wx` qua
    tên tạm rồi `rename` (nguyên tử), và tên tạm bị xoá nếu ghi lỗi. Route phục vụ gắn
    `nosniff` + CSP `default-src 'none'; sandbox`. Ghi file mà không qua `processImage` là lỗ
    XSS/rò vị trí.

    Tải lên đi qua route handler, KHÔNG qua server action: giới hạn body 1MB của action áp cho
    cả site (kể cả form liên hệ công khai), đừng nâng nó để chứa ảnh. Với `disk`, giá trị lưu là đường dẫn
    TƯƠNG ĐỐI để đổi domain không làm hỏng ảnh cũ; chỗ nào xuất ra ngoài (thẻ OG, ở
    `og-card.ts`) phải qua `absoluteImageUrl()` vì crawler không resolve được đường dẫn tương
    đối. Chưa có dọn rác: ảnh bị thay thế vẫn nằm trên đĩa. Upload cần JS — dán link vẫn chạy
    khi JS chưa tải.

20. **Link chia sẻ = `/go/<token>?v=<mã thẻ>` — token KHÔNG BAO GIỜ đổi, đổi `?v=` mới làm mới thẻ.**
    X/Facebook/Zalo lưu thẻ chia sẻ (tiêu đề, mô tả, ảnh) THEO URL trong nhiều ngày và không có cách
    xoá từ phía mình; admin đổi ảnh xong thì link đã gửi vẫn hiện ảnh cũ, trong khi người dùng hệ thống
    chỉ đi gửi link. Vì vậy mọi nơi admin hiện link theo dõi (`/admin/campaigns`, trang sửa,
    `/admin/tong-quan`) hiện link có đuôi `?v=`, tính bằng `shareUrl()` (`src/lib/landing/share-link.ts`)
    từ CHÍNH nội dung thẻ (hash của title + description + imageUrl). Đổi một trong ba → mã đổi → URL
    mới → nền tảng lấy thẻ mới. Không có bộ đếm phiên bản nào để quên tăng, và bật/tắt trạng thái, đổi
    đích, sửa landing không làm link đổi. `updateCampaign` báo ngay lúc lưu khi thẻ đổi kèm mã mới.

    KHÔNG tạo lại `token` để "làm mới link": nó là link đã đem đi chạy traffic, mọi `clickEvent` lịch sử
    neo vào campaign qua nó, và link cũ sẽ chết. `?v=` là tham số tuỳ chọn mà `/go` bỏ qua khi redirect
    và `buildTargetUrl` không chuyển tiếp cho advertiser, nên link cũ không có đuôi vẫn chạy — chỉ là
    thẻ của nó có thể còn bản cũ ở phía nền tảng. Card trả cho bot ở `/go` phản chiếu `?v=` vào
    `og:url` (không vào `canonical`, vẫn là `/c/[slug]` sạch): nền tảng nào lưu thẻ theo `og:url` thì
    mới thấy URL mới. Giá trị `?v=` đi vào HTML nên chỉ nhận đúng dạng mã (`parseShareVersion`).

21. **Trang hướng dẫn `/admin/huong-dan` là hub bài học + coach mark, và `src/lib/guide/lessons.ts` là nguồn
    DUY NHẤT của bài học.** Mỗi bài = một trang admin + chuỗi bước, mỗi bước chỉ vào MỘT phần tử qua
    `data-tour="<target>"`. `?huongdan=<id bài>` trên URL mở đúng trang và chạy coach mark (`GuideTour`, gắn một
    lần ở `app/admin/layout.tsx`); nút nổi "Hướng dẫn trang này" ở góc dưới phải mở bài của trang đang xem.
    Thẻ bài học ở hub là `<Link>` thường và các bước cũng được liệt kê bằng chữ trong `<details>` — coach mark
    cần JS, hub thì không.

    **Thêm/đổi giao diện admin thì kiểm điểm chỉ.** Đổi tên hoặc xoá một `data-tour` là bước tương ứng mất chỗ
    chỉ; `npm run test:guide` quét mã nguồn và đỏ nếu bài học trỏ tới `data-tour` không còn tồn tại, hoặc nếu
    có `data-tour` mà không bài nào dùng. Thêm bước mới = thêm `data-tour` ở trang rồi thêm bước vào
    `lessons.ts` (cả hai, test sẽ nói nếu quên một). Nội dung bước đã đối chiếu với hành vi thật (điều kiện để
    link chạy, ai nhận thẻ chia sẻ, giới hạn ảnh…): đổi hành vi ở code thì sửa bài học cùng lúc, vì sai ở đây
    là chỉ người dùng làm sai. Mọi con số trong trang hướng dẫn đọc từ nguồn thật (`limits.ts`,
    `clickTtlDays()`), đừng viết cứng.

    Coach mark KHÔNG khoá trang (lớp tối và vòng sáng `pointer-events: none`), tự mở `<details>` bao quanh mục
    tiêu, và khi không tìm thấy mục tiêu (ví dụ chưa có chiến dịch nào nên chưa có dòng để chỉ) thì hiện hộp
    thoại ở giữa kèm giải thích chứ KHÔNG bỏ qua bước. Nút chính dùng `--primary`, không dùng `--accent`
    (accent chỉ cho CTA chính của trang). Tiến độ "Đã xem" chỉ lưu trong `localStorage` của trình duyệt — hệ
    thống chỉ có một mật khẩu admin dùng chung nên không có "người dùng" nào để gắn tiến độ.

22. **Script/thẻ bên thứ ba chỉ ở `(site)/layout.tsx`, khai ở một nơi (`src/lib/monetization.ts`), và thêm một cái là
    PHẢI sửa ba trang pháp lý cùng lúc.** Hiện có: thẻ xác minh `clckd` (mạng quảng cáo) và script Skimlinks (chỉ
    nạp ở production). KHÔNG gắn vào `/admin`, `/c/[slug]` (bất biến 12: landing không rò rỉ click, không thêm
    script) hay `/go/[token]`. Skimlinks tự chuyển link ra ngoài thành link có hoa hồng LÚC BẤM, kể cả link không có
    nhãn, và đặt cookie — nên `/chinh-sach-bao-mat` (mục 2 và 6), `/tiet-lo-lien-ket` (mục Skimlinks) và
    `/gioi-thieu` (nguyên tắc thứ ba) phải nói đúng điều đó, và dòng tiết lộ affiliate ở chân mọi trang
    (`SiteFooter`) phải còn. Trước khi gắn Skimlinks các trang đó từng khẳng định "không đặt cookie nào, không có mã
    theo dõi của bên thứ ba" và "mọi liên kết không có nhãn là không sinh tiền" — thêm script mà không sửa là tuyên bố
    sai sự thật với người đọc, build vẫn xanh và không gate nào bắt được. Đổi `policyUpdatedAt` trong `lib/site.ts`
    khi sửa. CHƯA có banner đồng ý cookie: nếu site nhắm người đọc ở EU/Anh (GDPR/ePrivacy) thì script theo dõi phải
    chờ sự đồng ý trước khi nạp — xem cảnh báo đã nêu với chủ dự án.

23. **Đăng nhập admin là nhiều tài khoản trong Mongo (`adminUsers`), phiên là cookie KÝ — và kiểm tài khoản bằng DB ở
    ba nơi, không chỉ ở proxy.** Cookie `v2.<uid>.<tokenVersion>.<hết hạn>.<HMAC>` (`lib/auth/session.ts`, Web Crypto để chạy
    được ở Edge). `proxy.ts` chỉ kiểm chữ ký + hạn vì Edge không có DB. Phần "tài khoản còn hoạt động và `tokenVersion` khớp"
    do `lib/auth/current-user.ts` làm: layout admin, route upload, trang xem trước, và **đầu MỌI server action** (`requireUser()`;
    action của owner dùng `requireOwner()`). Server action không đi qua layout nên action nào quên `requireUser()` là người vừa
    bị tắt vẫn ghi được tới khi cookie hết hạn 7 ngày — thêm action admin mới thì gọi nó ở dòng đầu. Layout giữ qua các lần
    chuyển trang bằng link nên không phải rào chắn dữ liệu; trang chỉ-owner tự gọi `requireOwner()`.
    Tắt tài khoản / đổi vai trò / đổi hoặc đặt lại mật khẩu đều tăng `tokenVersion` → mọi cookie cũ chết. Khoá ký là
    `SESSION_SECRET` (≥32 ký tự) hoặc, nếu chưa đặt, dẫn xuất từ `IP_HASH_SALT`+`ADMIN_PASSWORD` — KHÔNG BAO GIỜ từ mật khẩu
    một mình: chữ ký kiểm được offline và thành viên nào cũng có một cookie hợp lệ, khoá yếu là họ tự ký cookie owner.
    Mật khẩu băm scrypt (`password.ts`). Sai 5 lần khoá 5 phút theo TÀI KHOẢN (serverless không có chỗ đếm theo IP) và UI chỉ có
    MỘT câu lỗi cho sai mật khẩu/không có tài khoản/đã tắt/bị khoá (không cho dò email); email lạ vẫn tốn một lượt băm.
    `ADMIN_PASSWORD` chỉ còn là mật khẩu BOOTSTRAP: tạo owner đầu tiên khi bảng rỗng. Mất owner cuối → `npm run admin:user`.
    Không thể tắt/hạ owner cuối (`otherActiveOwners`). Cần `npm run setup:indexes` (unique `email`, `host`) — action tạo cũng
    kiểm trùng trước, vì thiếu chỉ mục thì unique im lặng không có.
    Mọi tài khoản thấy toàn bộ dữ liệu; chiến dịch chỉ ghi `createdBy`/`updatedBy` để biết ai làm. Không có phân vùng theo người.

24. **Tên miền chia sẻ (`shareDomains`, `campaign.shareDomain`) chỉ là NHÃN HIỂN THỊ của link `/go` — đừng cho `Host` điều khiển
    hành vi.** Cùng một deployment phục vụ mọi tên miền: cùng whitelist đích, cùng thẻ chia sẻ, `canonical`/`og:url` luôn là tên
    miền chính (`publicBaseUrl()`). `/go/[token]` KHÔNG đọc `Host` và không có nhánh nào đối xử khác nhau theo tên miền — thêm một
    nhánh như vậy là tự mở cổng cho việc trả nội dung khác nhau theo nơi truy cập (bất biến 18). Link dựng bằng
    `resolveShareBase` (`lib/domains/links.ts`); tên miền chỉ dùng khi `verified`, đã tắt thì rơi về tên miền chính VÀ báo
    `fellBack` (đừng im lặng đưa link chết). `verifyDomainReachable` gọi `https://<host>/api/health` đòi `{"app":"trafficiq"}`
    (đừng bỏ field `app` ở health) với chống SSRF: chỉ https, đường dẫn cố định, từ chối IP riêng/nội bộ, không theo redirect,
    chỉ trả lý do ngắn. Thêm tên miền vào app KHÔNG làm nó tới được app — DNS và việc thêm vào Vercel/nginx là việc bên ngoài.
    Chỉ owner quản lý tên miền. Chưa có tự động hoá DNS/Vercel API cố ý: mã không kiểm thử được ở đây.

---

## Commands

```bash
npm run dev              # dev server
npm run build            # production build (đã bao gồm typecheck)
npm run typecheck        # tsc --noEmit
npm run lint
npm run check:contrast   # gate WCAG cho design token
npm run check:fonts      # gate font chữ (Việt · English · Ả Rập), xem Bất biến UI/UX § Font
npm run test:fonts       # test của chính gate font (các cấu hình sai đã gặp thật)
npm run check:content    # gate nội dung blog (metadata, ảnh bìa, thumbnail, anchor, link nội bộ)
npm run check:bot        # gate regex UA crawler: recall + specificity ≥ 90% trên corpus
npm run test:guide       # bài học coach mark: dữ liệu hợp lệ và mọi data-tour có thật trên giao diện
npm run test:auth        # mật khẩu scrypt, cookie ký, chính sách đăng nhập/khoá/bootstrap
npm run test:domains     # chuẩn hoá tên miền, dựng link theo tên miền, chống SSRF khi kiểm tra
npm run admin:user -- <email> [tên]  # cứu hộ: tạo/khôi phục owner (mật khẩu qua biến NEW_ADMIN_PASSWORD)
npm run test:share       # mã ?v= của link chia sẻ và og:url ở /go
npm run test:media       # ảnh tải lên: nén/độ nét, bảo mật route upload, ba driver lưu trữ (disk/vercel/s3)
npm run test:botdetect   # unit test lib/botdetect (FCrDNS, điểm, rate limit, PoW)
npm run check:botdetect-live  # FCrDNS với DNS thật (cần mạng, không nằm trong CI)
npm run check:probe-browser   # probe client trong Chromium thật qua CDP (cần Chromium của Playwright)
npm run gen:thumbs       # sinh thumbnail 160×90 — chạy khi thêm/đổi ảnh bìa bài viết

npm run setup:indexes    # BẮT BUỘC chạy 1 lần sau khi tạo cluster
npm run seed             # seed 1 campaign demo active để test end-to-end
```

Cần `.env.local` (copy từ `.env.example`) trước khi chạy `setup:indexes`/`seed`.

---

## Ràng buộc chi phí cần nhớ

Vercel Hobby là gói **phi thương mại**. Prototype thì được, nhưng khi chạy
traffic trả tiền thật thì phải lên Pro (~20 USD/tháng) — không phải để tăng
hạn mức mà để không vi phạm điều khoản. Bandwidth Hobby ~100GB/tháng, nên ảnh
hero/OG phải nén (≤200KB) và không đi qua Image Optimization.
