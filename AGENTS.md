<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TrafficIQ

Affiliate/campaign platform trên Next.js 16 (App Router) + MongoDB Atlas + Vercel.
Ba surface: landing SSR có OG per-campaign (`/c/[slug]`), redirect tracking
(`/go/[token]`), postback conversion (`/api/postback`). Control plane ở `/admin`.

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
| `/`, `/blog/**`, `/chuyen-muc/**`, `/gioi-thieu`, `/lien-he`, `/dieu-khoan`, `/chinh-sach-bao-mat`, `/tiet-lo-lien-ket` | `pages/blog.md` | Editorial Grid / Magazine, density 3/10, thân bài 68ch, không ảnh |

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
  rg "neutral-|slate-|zinc-|gray-|#[0-9a-fA-F]{6}" src --glob '!globals.css'
  ```

- `--border` chỉ cho divider/viền card. Viền input/select/textarea dùng
  `--input` (đạt 3:1). Đừng đổi chỗ hai cái này.
- `--accent` là màu **duy nhất** được dùng cho CTA chính. Action phụ dùng outline
  `--primary`. Hai CTA accent trên cùng một view = sai.
- Font: `font-sans` (**Be Vietnam Pro**) cho body và **mọi heading của cả ba
  surface**. `font-mono` (**JetBrains Mono**) **chỉ** cho cột số liệu
  (`tabular-nums`), code, và token/URL — **không dùng cho heading**.
  Đừng quay lại Fira Code: nó không có subset `vietnamese` nên chữ có dấu thanh
  (U+1EA0–1EF9) rơi sang font hệ thống ngay giữa từ. Lý do đầy đủ + cách kiểm
  trong MASTER.md § Typography. Font mới nào cũng phải có subset `vietnamese`:

  ```bash
  node -e "console.log(require('next/dist/compiled/@next/font/dist/google/font-data.json')['<Tên Font>'].subsets.join(','))"
  ```

### Gate trước khi coi UI là xong

```bash
npm run check:contrast   # WCAG: 4.5:1 text, 3:1 UI. PHẢI pass.
npm run lint
npm run build
```

`check:contrast` đọc trực tiếp `globals.css`. Thêm cặp màu mới vào UI thì thêm
cặp đó vào `pairsFor()` trong `scripts/check-contrast.mjs` — gate không tự biết.

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

---

## Commands

```bash
npm run dev              # dev server
npm run build            # production build (đã bao gồm typecheck)
npm run typecheck        # tsc --noEmit
npm run lint
npm run check:contrast   # gate WCAG cho design token

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
