# TrafficIQ

Affiliate/campaign platform: landing SSR có OG riêng theo từng campaign, redirect
tracking, postback conversion, và dashboard tính realtime.

Stack: **Next.js 16** (App Router) · **MongoDB Atlas** · **Vercel** — thiết kế để
chạy được ở mức chi phí ~0 trong giai đoạn prototype.

## Surface

| Route | Vai trò |
|---|---|
| `/c/[slug]` | Landing render server-side, OG metadata theo campaign (crawler không chạy JS vẫn đọc được) |
| `/go/[token]` | Redirect 302 tới destination đã whitelist, ghi click bất đồng bộ |
| `/api/postback` | Nhận conversion từ advertiser, idempotent |
| `/api/rollup` | Tổng hợp số liệu (tùy chọn, gọi bằng cron ngoài) |
| `/api/health` | Health check có ping DB, cho uptime monitor |
| `/admin` | Control plane: advertiser, destination whitelist, campaign, offer, dashboard |

## Chạy local

```bash
npm install
cp .env.example .env.local     # rồi điền giá trị

# Sinh secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# MongoDB local (phải là replica set — Atlas cũng vậy; standalone sẽ lỗi
# retryWrites và không có $dateTrunc):
docker run -d --name tiq-mongo -p 27017:27017 mongo:8 --replSet rs0 --bind_ip_all
docker exec tiq-mongo mongosh --quiet --eval "rs.initiate()"

npm run setup:indexes          # BẮT BUỘC — tạo TTL index và unique index
npm run seed                   # 1 campaign demo active để test end-to-end
npm run dev
```

> **Lưu ý Windows/PowerShell:** đừng tạo `.env.local` bằng
> `Set-Content -Encoding utf8` — PowerShell 5.1 ghi kèm BOM (`EF BB BF`), làm tên
> biến đầu tiên thành `U+FEFF` + `MONGODB_URI` nên Node `--env-file` không đọc
> được. Triệu chứng dễ nhầm: script vẫn in ra các biến có giá trị mặc định rồi
> mới chết vì thiếu `MONGODB_URI`. Ghi bằng UTF-8 không BOM.

## Commands

```bash
npm run dev
npm run build            # đã bao gồm typecheck
npm run typecheck
npm run lint
npm run check:contrast   # gate WCAG cho design token — phải pass

npm run setup:indexes    # chạy lại mỗi khi đổi CLICK_TTL_DAYS
npm run seed             # idempotent, chạy lại không đổi token đã share
```

## UI/UX

Design system của dự án nằm ở [`design-system/trafficiq/`](design-system/trafficiq/),
sinh bằng skill [`ui-ux-pro-max`](.claude/skills/ui-ux-pro-max/) và **là chuẩn bắt
buộc** — chi tiết trong [AGENTS.md](AGENTS.md).

Luật cốt lõi: không hard-code màu trong component. Mọi hex chỉ tồn tại trong
[`src/app/globals.css`](src/app/globals.css); component dùng semantic token
(`bg-card`, `text-muted-foreground`, `bg-accent`…). `npm run check:contrast` gác
WCAG 4.5:1 cho text và 3:1 cho UI ở cả light và dark.

## Những điều dễ phá — đọc trước khi sửa

Chi tiết và lý do nằm trong [AGENTS.md](AGENTS.md) cùng comment tại từng file:

1. `MongoClient` cache trên `globalThis` — mỗi invocation mở client mới sẽ cạn
   giới hạn ~500 connection của Atlas M0.
2. Tracking ghi **sau** response qua `after()` — serverless đóng băng ngay sau khi
   trả response, không có background worker in-process.
3. Redirect chỉ trỏ tới URL trong collection `destinations` (whitelist).
   `/go` **không bao giờ** nhận URL từ query param.
4. `clickEvents` có TTL index (M0 chỉ 512MB); `conversions` có unique index trên
   `clickId` để postback idempotent — advertiser nào cũng retry.
5. Dashboard tính on-demand bằng aggregation. Atlas shared tier **không hỗ trợ**
   `allowDiskUse` và `$merge`/`$out`.
6. IP là PII — chỉ lưu `sha256(ip + salt)`.
7. Next 16 dùng `src/proxy.ts`, không phải `middleware.ts` (đã deprecated).

## Chi phí

Vercel Hobby là gói **phi thương mại**: dùng để prototype được, nhưng khi chạy
traffic trả tiền thật thì phải lên Pro (~20 USD/tháng) để không vi phạm điều khoản.
Bandwidth Hobby ~100GB/tháng nên ảnh hero/OG cần nén (≤200KB).
