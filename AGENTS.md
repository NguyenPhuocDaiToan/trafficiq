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

---

## Commands

```bash
npm run dev              # dev server
npm run build            # production build (đã bao gồm typecheck)
npm run typecheck        # tsc --noEmit
npm run lint
npm run check:contrast   # gate WCAG cho design token
npm run check:content    # gate nội dung blog (metadata, ảnh bìa, thumbnail, anchor, link nội bộ)
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
