# botdetect — phát hiện traffic tự động

Chấm điểm 0–100 cho một request: **0 = người dùng thông thường, 100 = gần như
chắc chắn automation.** Điểm dùng để **ghi log, giới hạn tần suất, và ra thử
thách PoW** — không dùng để đổi nội dung trang trả về.

```
npm run test:botdetect   # unit + property + fuzz (`botdetect.test.ts` của tác giả + `independent.test.ts` và các file `round*.test.ts` do các vòng reviewer độc lập viết; số test thay đổi theo thời gian, đừng tin con số ở đây — chạy lệnh để biết)
npm run check:bot        # gate recall/specificity của regex UA (ua.ts)
npm run check:botdetect-live  # FCrDNS với DNS THẬT (cần mạng)
npm run check:probe-browser   # probe client trong Chromium thật qua CDP
npm run check:bot-external    # botReason trên corpus BÊN THỨ BA (cần mạng)
npm run check:botdetect-frozen # 11 file mã nguồn còn nguyên bản đã review (SHA-256)
npm run check:botdetect-all   # chạy các gate trên (TRỪ check:botdetect-frozen)
```

## Tiêu chí chấp nhận (đo được) — `npm run check:botdetect-all`

"Đạt chuẩn" ở đây là các điều kiện sau, không phải cảm giác. Lệnh trên chạy lần lượt từng gate (TRỪ `check:botdetect-frozen`, chạy riêng) và
dừng ở gate đầu tiên đỏ:

| # | Tiêu chí | Ngưỡng | Gate |
|---|---|---|---|
| 1 | Unit + property + fuzz (chạy tuần tự; các test thời gian đo trên máy rảnh, có thể đỏ khi CPU đang bị chiếm) | 0 test fail | `test:botdetect` |
| 2 | Regex UA: recall crawler tự khai / specificity người thật (gate 135 UA = 51 người + 84 crawler; 4 UA stealth nằm ngoài gate) | ≥ 90% mỗi chỉ số **và 0 UA phân loại sai trên corpus** (bánh cóc hồi quy) | `check:bot` |
| 2b | **Corpus bên thứ ba** (không do tác giả viết): `botReason` recall trên `crawler-user-agents` (DEV/HOLDOUT theo crawler) và Matomo `bots.yml`; chặn nhầm người trên `top-user-agents` và trên Matomo THEO LOẠI THIẾT BỊ (TV, feature phone, console, ô tô, tablet, smartphone…) sau khi loại stack ứng dụng | recall ≥ 90% mỗi nửa DEV/HOLDOUT và Matomo, ≥ 93% trên danh sách gộp, ≥ 99% điểm rủi ro ≥ 30 trên crawler-user-agents; 0 chặn nhầm trên UA hiện đại; chặn nhầm theo loại ≤ 0,5–5%, tổng ≤ 1,5% | `check:bot-external` (cần mạng, 16 tiêu chí) |
| 3 | FCrDNS trên DNS thật (Google, Bing, Apple, Yandex, Baidu + 5 ca giả mạo) | 12/12; `error` (timeout) được thử tối đa 3 lần (2 lần thử lại) | `check:botdetect-live` |
| 4 | Probe client trong Chromium thật (5 kịch bản) | 5/5 đúng kỳ vọng | `check:probe-browser` |
| 5 | Typecheck | 0 lỗi | `typecheck` |
| 6 | Hiệu năng: không đầu vào 1MB nào làm chấm điểm > 600ms (test hồi quy ReDoS) | trong `test:botdetect` | — |
| 7 | Không byte NUL trong mã nguồn | trong `test:botdetect` | — |
| 8 | Vòng review độc lập cuối (sau lần sửa mã cuối) không còn: bypass, chặn nhầm người thật, DoS, crash | 0 phát hiện (phán đoán của reviewer, không phải số đo) | thủ công; xem [HISTORY.md](./HISTORY.md) |
| 9 | Mã nguồn thư viện còn nguyên bản đã review (SHA-256 của 11 file) | 0 khác biệt | `check:botdetect-frozen` |

**Độ nhạy của gate** (nó có thật sự đỏ khi thư viện hỏng không) đã được đo bằng mutation test — làm hỏng mã một cách có chủ đích
rồi chạy gate. Kết quả từng lần đo, kể cả mutation từng LỌT QUA, nằm trong [HISTORY.md](./HISTORY.md); README này không lặp lại
chúng vì chúng là số đo một lần về các bản mã cũ, không phải khẳng định về mã hiện tại.

Tiêu chí 8 là phán đoán của một reviewer độc lập chứ không phải số đo, nên nó là phần yếu nhất của
bảng này: nó chứng minh "một reviewer mới không tìm ra gì", không chứng minh "không còn lỗi". Câu "không có thay đổi nào
sau vòng N" **không** được phát biểu bằng lời ở đây, vì thư mục này chưa nằm trong git (không có `git diff`)
và mtime vô nghĩa (mutation test khôi phục file bằng `cp`). Thay vào đó mã nguồn được ghim bằng SHA-256:
`npm run check:botdetect-frozen` so 11 file (mọi `*.ts` không phải test trong thư mục này, cộng
`lib/tracking/ua.ts`) với `FROZEN.sha256`, là bản mà vòng review độc lập cuối đã đọc. Sửa, thêm hay xoá một file đều làm lệnh đó đỏ. Sửa mã hợp lệ về sau thì lệnh đỏ là ĐÚNG — nghĩa là bản đó chưa
được review; review xong mới `-- --write` để ghim lại.

### Đo trên dữ liệu bên thứ ba

`check:bot` dùng corpus do tác giả viết, nên nó chấm bài của chính mình. Vì vậy `check:bot-external` đo `botReason` (hàm quyết định
redirect hay Social Card ở `/go`) trên corpus do BÊN THỨ BA duy trì, và in ra các con số HIỆN TẠI mỗi lần chạy:

- bot: `crawler-user-agents` (chia DEV/HOLDOUT theo crawler) và Matomo `bots.yml` — ngưỡng recall của gate: ≥ 90% mỗi nửa / mỗi danh sách;
- người: `top-user-agents` (UA trình duyệt hiện đại) và Matomo THEO LOẠI THIẾT BỊ (TV, feature phone, console, ô tô, tablet, smartphone…)
  sau khi loại stack HTTP của ứng dụng — ngưỡng chặn nhầm của gate: 0% trên UA hiện đại, ≤ 0,5–5% theo loại, ≤ 1,5% tổng.

README không chép lại các con số đo (chúng đổi theo thời gian và theo danh sách); chạy lệnh để biết số hiện tại. Lịch sử đo trước/sau từng
quy luật, lý do chọn/bỏ từng quy luật, và những con số do reviewer báo nằm trong [HISTORY.md](./HISTORY.md) — ghi chép một lần, KHÔNG phải
khẳng định về mã hiện tại.

Các quy luật trong `lib/tracking/ua.ts` (mô tả định tính): `+<URL>` và `https?://`/`mailto:` (bot tự khai bằng URL); gốc `crawl` và vài danh từ
(`fetcher`, `scanner`, `monitor`, `checker`, `validator`, `harvest`, `extractor`, `indexer`, `probe`); AI agent khai danh không có chữ "bot";
`bot` là một TỪ (không khớp "Caboto") NHƯNG một token có chứa "bot" kèm phiên bản (`bot…/<số>`) vẫn bị bắt, nên `Caboto/1` hay `Abbott/1.0` bị chặn; làm trống đoạn nền tảng Android/Instagram trước khi tìm "bot" ("M bot 54") trừ khi trong đó có dấu hiệu
crawler; và **`non-browser-ua`**: UA không có dấu hiệu trình duyệt nào (`Mozilla/<số>` ở bất kỳ đâu, token bộ máy, Java ME/WAP, TV, app…).

**Rủi ro của `non-browser-ua` ở `botReason`:** khác với tầng chấm điểm (chỉ gắn cờ), chặn nhầm một người ở đây nghĩa là
họ nhận Social Card thay vì được redirect. Vì vậy allowlist điện thoại đời cũ cố ý rộng, UA RỖNG không bị tính, và
**stack HTTP gốc của ứng dụng (Dalvik, CFNetwork, Microsoft Office, Sonos…) bị tính là không-phải-trình-duyệt có chủ
đích** — đó không phải một cú bấm link. Người dùng thật với UA không có dấu hiệu trình duyệt nào (hiếm, thiết bị đã
ngừng sản xuất) sẽ nhận Social Card; lý do ghi ở nhật ký là `non-browser-ua`, lọc được ở `/admin/nhat-ky`.

**Đánh đổi đã biết (reviewer độc lập thấy, CHƯA sửa có chủ đích):**
- Quy tắc URL (`https?://` bất kỳ đâu) chặn nhầm một số trình duyệt cổ: QtWeb (`http://www.QtWeb.net`), K-Meleon
  (`+http://www.kangaroo-personal.de`), Opera 9.x có URL trong comment, IE nhúng (`from: http://bsalsa.com/`). Đổi lại nó bắt
  thêm nhiều bot tự khai bằng URL trần; né nó bằng một ngoại lệ sẽ để lọt bot đội vỏ trình duyệt.
- `libwww` (Amaya, NCSA/VMS Mosaic) và `java/` (HotJava) khớp các trình duyệt cổ; cả hai là thư viện HTTP phổ biến của bot.
- Bot giấu tên trong ngoặc nền tảng Android MÀ KHÔNG kèm phiên bản/URL/"crawler" (`(Linux; Android 10; GPTBot)`) lọt — giống
  việc viết `Mozilla/5.0`. `Java/11 Configuration/CLDC-1.1` lọt vì dấu hiệu MIDP/CLDC rộng hơn tài liệu.
- Một UA bắt đầu bằng U+0085 / U+00AD (ký tự vô hình) rồi tới tiền tố allowlist (ví dụ soft-hyphen + `Lynx/2.9`) làm `botReason`
  (cắt bằng `trim()`) và `uaSignals` (cắt bằng `cleanUa`, rộng hơn) bất đồng: `botReason` trả `non-browser-ua` (người đó nhận Social Card,
  KHÔNG được redirect) trong khi điểm rủi ro coi UA là sạch. Hiếm và chưa thấy UA người thật nào mang dạng này.
- Mô hình/thương hiệu có chữ "bot" nằm NGOÀI phần đã làm trống (`UCWEB/2.0 (… Adr 4.0.4; …; M bot 54)`, hậu tố Weibo/BiliApp)
  vẫn bị chặn nhầm; vài trình duyệt WAP cổ (`Blazer`, `Browser/WAP2.0`, `Browser/MAUI`) bị coi là không-phải-trình-duyệt.
- Ba UA Google xếp vào "retired special-case crawlers" mang hình dạng Chrome/WebView (`Google Favicon`, `DuplexWeb-Google`,
  `googleweblight`) chưa bị bắt. Với hai cái đầu, bắt là AN TOÀN (token độc nhất, không người nào được thấy mang chúng) và chỉ chưa thêm vì
  chúng đã ngừng và ít giá trị; `googleweblight` thì không nên bắt vì nó phục vụ một người đang duyệt thật. `Amzn-User`, `Google-CWS`,
  `Google-Site-Verification` thì bị bắt. Yandex Browser trên Android (`(Linux; arm_64; Android 12; M bot 54)`) từng bị chặn
  nhầm; đã sửa bằng cách cho phép tới 2 token tuỳ ý trước "Android" ở đoạn nền tảng.
- Các token tự khai có "bot" kèm phiên bản được bắt, nhưng "bot" dính liền với chữ và không có phiên bản (ví dụ `Mozilla/5.0 (compatible; botx)`) thì không — regex gốc ở HEAD bắt được dạng đó, và đây là một hồi quy nhỏ có chủ đích so với HEAD. (`Foo bot-x` thì BỊ bắt, vì "bot" đứng trước dấu gạch.)

**Giới hạn của phép đo này:** (1) corpus bên thứ ba là các crawler ĐÃ TỰ KHAI — không đo bot đội UA trình duyệt;
(2) nhãn Matomo là theo THIẾT BỊ, không theo "người bấm link", nên gate phải loại stack ứng dụng bằng một danh sách
(`NATIVE_STACK`, công khai trong `scripts/check-bot-external.ts`); (3) các danh sách đổi theo thời gian; (4) ngưỡng
của gate là bánh cóc đặt sát giá trị đo được — hạ chúng khi đo kém đi là che hồi quy.

## Trạng thái nối vào hệ thống — ĐỌC TRƯỚC

| Phần | Đã nối? |
|---|---|
| Chấm điểm đồng bộ (lớp 1 bằng ASN + lớp 2) | **Có, ở `/go/[token]`, chế độ BÓNG**: ghi `riskScore`/`riskSignals` vào `clickEvent` (chỉ khi điểm > 0 và request không bị `botReason` chặn trước; click trả Social Card không mang điểm), không đổi response. |
| FCrDNS (xác minh Googlebot/Bing/Apple/Yandex/Baidu) | Chưa nối. Cần DNS nên không được chạy trên hot path; gọi `assessRequest()` ở chỗ chịu được vài trăm ms (vd. trong `after()`). |
| Rate limit (`decide`) | Chưa nối. |
| Thử thách PoW | Chưa nối — chưa có trang/endpoint nào phát và nhận. |
| Telemetry client (lớp 3) | Chưa nối — chưa trang nào nhúng probe, chưa có endpoint nhận. |

Nối từng phần là bước riêng, nên làm **sau khi** có vài ngày dữ liệu bóng để
chọn ngưỡng bằng số liệu (nhóm nào convert) thay vì cảm giác.

## Ba lớp phòng thủ

### Lớp 1 — Danh tính crawler (`crawlers.ts`, `fcrdns.ts`)

*Câu hỏi: request tự xưng là Googlebot có thật sự là Googlebot không?*

UA là chuỗi ai cũng đặt được, nhưng **IP nguồn thì không giả được ở tầng TCP**.
Nhà vận hành crawler kiểm soát PTR của dải IP họ sở hữu nên:

1. `PTR(ip)` → hostname, hostname phải kết thúc bằng domain của nhà vận hành;
2. `A/AAAA(hostname)` phải chứa lại đúng `ip`.

Thiếu bước 2 thì kẻ có dải IP riêng tự đặt PTR = `crawl.googlebot.com` là qua,
vì PTR do chủ IP tự khai còn A record của `googlebot.com` thì không.

Ba kết quả, và sự khác biệt giữa chúng là cốt lõi:

| Kết quả | Nghĩa | Điểm |
|---|---|---|
| `verified` | rDNS đúng domain **và** forward khớp | 0, bỏ qua mọi heuristic |
| `failed` → `spoofed` | Có bằng chứng chống lại (không PTR, sai domain, forward lệch) | ≥ 95 |
| `error` → `unverified` | Timeout/SERVFAIL — **không kết luận được** | 55 (= `unknown-declared-bot`: khai thêm crawler không được hạ điểm) |

DNS chập chờn mà coi là giả thì chặn mất Googlebot thật; nên lỗi DNS **không bao
giờ** thành `spoofed`.

Chi tiết dễ sai đã được test (và hai chỗ đo trên DNS thật bằng `npm run check:botdetect-live`):
- Khớp suffix theo **ranh giới nhãn**: `evilgooglebot.com` và
  `googlebot.com.evil.net` đều trượt.
- **Google: KHÔNG chấp nhận `*.googleusercontent.com` trần.** Google liệt kê domain
  này, nhưng mọi VM Google Cloud của khách hàng có PTR `*.bc.googleusercontent.com`
  và forward khớp — thuê một VM là giả được Googlebot. Chỉ nhận
  `gae.googleusercontent.com`.
- Hostname phải là chuỗi nhãn DNS hợp lệ trước khi khớp suffix: `evil\0.googlebot.com`
  (resolver C cắt tại NUL) và `evil.com#.googlebot.com` từng qua được phép khớp đuôi.
- IP không parse được là `error` (không kết luận), **không** phải `failed`: coi là giả thì
  Googlebot thật phía sau proxy ghi `ip:port` bị challenge. Cổng đi kèm (`1.2.3.4:443`,
  `[::1]:443`) được bỏ trước khi so; danh sách `X-Forwarded-For` thì caller phải lọc.
- Resolver ngoài trả KHÔNG-PHẢI-MẢNG (`undefined`…) hoặc ném đối tượng có getter `code` độc: thành `error`, không làm sập request.
  Phần tử không phải chuỗi TRONG một mảng thì bị LỌC bỏ (mảng `[42]` ra `failed/wrong-domain`, không phải `error`).
- Registry Yandex chỉ khớp UA crawler (`YandexBot`, `yandex.com/bots`…), không khớp `yandex`
  trần (app `YandexSearch` của người dùng).
- IPv6 được chuẩn hoá (`::1` = `0:0:0:0:0:0:0:1`, `::ffff:a.b.c.d` = IPv4) trước
  khi so.
- Kết quả cache per-instance: xác định 6h, lỗi 60s.

**Meta và X không có rDNS.** Meta chỉ công bố UA và ASN 32934; X dùng ASN 13414.
Hai bên được xác minh bằng ASN đọc từ header `x-vercel-ip-as-number` (chỉ có khi
chạy trên Vercel; thiếu header → `unverified`, không phải `spoofed`). ASN chỉ
chứng minh "IP nằm trong mạng của họ", yếu hơn FCrDNS.

Nguồn từng suffix ở đầu `crawlers.ts`. **Baidu chỉ có nguồn bên thứ ba** — kiểm
lại trước khi tin.

### Lớp 2 — Heuristic UA + header (`signals.ts`)

*Không cần JS phía client, không I/O, chạy được trên hot path.*

| Tín hiệu | Trọng số | Ghi chú |
|---|---|---|
| `headless-ua` (HeadlessChrome, PhantomJS, Puppeteer, Selenium…) | 90 | |
| `headless-client-hint` (`sec-ch-ua` chứa HeadlessChrome) | 90 | Bắt cả khi UA đã bị sửa |
| `http-library-ua` (curl, python, axios, Go, okhttp, Java, Scrapy…) | 85 | |
| `unknown-declared-bot` | 55 | Tự khai là bot, không có trong registry |
| `non-browser-ua` (UA không mở đầu bằng `Mozilla/<số>` hay `Opera/`) | 40 | Đảo ngược việc liệt kê thư viện: `GuzzleHttp`, `Ruby`, `colly`… không bao giờ đủ danh sách. Dưới bậc rate-limit chặt (60) và challenge (80), nhưng dùng chung bucket `s:` nên vượt burst 30 vẫn bị 429 |
| `empty-ua` | 60 | |
| `platform-mismatch` (UA nói Windows, `sec-ch-ua-platform` nói Android) | 45 | Dấu hiệu UA bị sửa |
| `programmatic-fetch` (`sec-fetch-mode` khác `navigate`/`same-origin`: `cors`, `no-cors`, `websocket`, `nested-navigate`, giá trị lạ) | 30 | Click của người là `navigate` |
| `datacenter-asn` (AWS, GCP, Azure, DO, OVH, Hetzner…) | 20 | Có người dùng VPN; dưới ngưỡng flag một mình |
| `non-document-accept` (Accept không có `text/html`/`xhtml`) | 20 | Điều hướng của trình duyệt luôn có; Accept kiểu axios là lời gọi API |
| `no-accept` / `wildcard-accept` / `no-accept-language` / `no-sec-fetch` | 10–18 | Yếu; webview cũ thiếu các header này |

**Hai ngoại lệ có chủ đích** (cả hai chỉ gỡ cờ cho người thật, không gỡ bằng chứng automation):

- **UA điện thoại/trình duyệt đời cũ không bị `non-browser-ua`:** trình duyệt chữ (`Lynx/2.9`,
  `Links (2.29`, `w3m/`, `ELinks/`, `NetSurf/`, `Midori/`, `Dolphin/`), điện thoại có mã máy
  (`Nokia6230/`, `NokiaN73`, `BlackBerry9000/`, `SonyEricssonK800i`, `MOTORIZR-Z8/`), và các dạng
  `MOT-`/`SAMSUNG-`/`LG-`/`SEC-`/`SIE-`/`HTC-`/`Alcatel-…`, `LG/U990/…`, `UCWEB7.0`, `UP.Browser/…`.
  Đúng DẠNG UA thật, không phải tiền tố tuỳ ý (`NokiaScraper/1.0`, `Lynx scraper/1.0` vẫn bị +40).
  Allowlist này đứng SAU kiểm tra headless/thư viện/từ khoá bot, nên thêm tiền tố `Nokia6230/` vào UA
  của curl không né được phát hiện; nó chỉ gỡ đúng cờ +40, tín hiệu header mạnh vẫn giữ nguyên.
- **`Java/ASVM` không bị `http-library-ua`:** đó là máy ảo Java của điện thoại LG đời cũ
  (`… Java/ASVM/1.1 Profile/MIDP-2.1`), không phải thư viện HTTP. Chỉ loại trừ khi `Java/ASVM` là
  dấu hiệu DUY NHẤT: `okhttp/4 Java/ASVM`, `python-requests Java/ASVM`, `… HeadlessChrome Java/ASVM`
  vẫn bị bắt như cũ. Áp dụng cùng ở `lib/tracking/ua.ts` (quyết định 302 hay Social Card ở `/go`).

Các tín hiệu header chia làm hai nhóm:

- **Bằng chứng MẠNH** (`headless-client-hint`, `platform-mismatch`, `programmatic-fetch`) áp cho
  **mọi** UA, bất kể UA nói gì về mình. Nếu chỉ áp cho UA `Mozilla/5.0` thì đổi UA thành
  `Mozilla/4.0 (compatible; MSIE 8.0)` hay `Opera/9.80` là tắt hết (90 → 0), và gắn thêm token
  crawler vào UA Chrome kèm client hint HeadlessChrome từng hạ điểm 90 → 50.
- **Tín hiệu "vắng header"** (`no-sec-fetch`, `no-accept-language`, `no-accept`, `wildcard-accept`,
  `non-document-accept`, `datacenter-asn`) chỉ áp cho UA trình duyệt sạch (có `Mozilla/N` hoặc
  `Opera/`, không có từ khoá bot) — crawler thật vắng chúng một cách hợp lệ.

Các tín hiệu "vắng header" chỉ áp cho UA **tự xưng là browser**. Với thư viện HTTP, "thiếu
Sec-Fetch" là hiển nhiên và đã nằm trong trọng số UA; cộng thêm là tính một sự
thật hai lần.

**UA được chuẩn hoá một lần** (`cleanUa`) rồi dùng cho mọi phép khớp: cắt khoảng trắng và ký tự
vô hình hai đầu (NBSP, zero-width, soft hyphen, NEL, BOM…). Node giao byte 0xA0 đầu chuỗi thành
`\u00a0`; trước khi chuẩn hoá, UA đó thoát khỏi cả hai nhánh chấm điểm và nhận 0. Hàm này
là vòng lặp từ hai đầu chứ không phải regex `[\s…]+$`, vốn quadratic trên UA có dải khoảng trắng dài ở giữa.

**Gộp điểm bằng noisy-OR**: `điểm = 1 − Π(1 − wᵢ)`. Không cộng vì cộng thì vượt
trần 100 và mất thông tin. Noisy-OR luôn trong [0,100], đơn điệu (thêm tín hiệu
không bao giờ làm điểm giảm), không phụ thuộc thứ tự, và nhiều tín hiệu yếu không
dồn lên tuyến tính (bốn tín hiệu yếu 10/10/12/15 ra 39, không phải 47). Mỗi tính
chất này có test.

### Lớp 3 — Telemetry phía client (`client-signals.ts`)

*Lớp duy nhất thấy được thứ header không có — và cũng dễ giả nhất.*

Probe JS (`CLIENT_PROBE_SOURCE`) thu: `navigator.webdriver`, plugins, languages,
kích thước cửa sổ/màn hình, `hardwareConcurrency`, UA mà JS thấy, `window.chrome`,
số sự kiện người dùng, số sự kiện `isTrusted === false`, thời gian ở lại trang.

| Tín hiệu | Trọng số |
|---|---|
| `webdriver-flag` | 75 |
| `untrusted-events` (`element.click()`/`dispatchEvent`) | 70; chỉ 25 nếu có ≤ 2 sự kiện tổng hợp VÀ ít nhất một sự kiện tin cậy đi cùng (extension, FastClick) |
| `ua-mismatch` (UA JS ≠ UA header) | 45 |
| `zero-window` (outer = 0, inner > 0) | 15 — **không kích hoạt ở Chromium hiện nay** (xem dưới) |
| `no-interaction` (bấm trong < 300ms, không một sự kiện nào) | 35 |
| `empty-languages` | 20 |
| `default-screen` (800×600, 0×0) | 20 |
| `no-chrome-object` 12, `no-plugins` 8, `no-hardware-concurrency` 5 | — |

Client tự báo cáo, nên stealth plugin gửi đúng giá trị "người" là xong. Dùng nó
để **tăng chi phí** cho đối thủ, không phải làm bằng chứng; không để một mình nó
quyết định chặn người. Phần chấm điểm và probe có test (probe chạy trong `vm` với
`window` giả).

### Kết quả đo trong Chromium thật (`npm run check:probe-browser`)

| Kịch bản | Điểm | Tín hiệu |
|---|---|---|
| Headless mới, không flag automation, click CDP | 20 | `default-screen` |
| Headless mới + `--enable-automation` (như Playwright/Puppeteer/Selenium) | 80 | `webdriver-flag`, `default-screen` |
| Headless mới, script gọi `element.click()` | 76 | `untrusted-events`, `default-screen` |
| Headless mới, đọc probe ngay, không tương tác | 48 | `default-screen`, `no-interaction` |
| `chrome-headless-shell` (headless cũ) | 84 | `webdriver-flag`, `default-screen`, `no-chrome-object`, `no-plugins` |

Điều đo được mà tôi đã đoán sai: cả hai kiểu headless đều báo MÀN HÌNH (`screen`) **800×600** và cửa sổ ngoài khác 0 (không phải outer = 0), nên `zero-window` không bao giờ kích hoạt ở đây. Và một
Chrome headless mới KHÔNG có cờ automation, bấm bằng input CDP, chỉ bị 20 điểm
(`default-screen`) — dưới ngưỡng flag. Đó là giới hạn thật của lớp 3, không phải
lỗi cần "sửa" bằng cách hạ ngưỡng (sẽ chặn nhầm người dùng cửa sổ nhỏ).

### Khi UA tự khai là crawler — chế độ đồng bộ chỉ là "sàn"

`assessRequestSync` (đang chạy ở `/go`) **không có DNS**, nên crawler cần FCrDNS (Google, Bing, Apple, Yandex, Baidu) chỉ có thể là
`unverified` (55). Meta và X thì được xác minh bằng ASN (header `x-vercel-ip-as-number`) NGAY CẢ ở chế độ đồng bộ: ASN đúng cho điểm 0,
ASN sai cho `spoofed`, thiếu header cho `unverified`. Hệ quả đã biết và được chấp nhận:

- UA rỗng/giữ chỗ cộng `(compatible; Googlebot/2.1)` (ví dụ `Mozilla/5.0 (compatible; Googlebot/2.1)`)
  không thể phân biệt với UA crawler tối giản mà Bingbot thật dùng — phạt nó là phạt crawler thật.
  Điểm có thể tụt khi gắn token crawler vào UA rỗng/giữ chỗ; đó là giới hạn của chế độ đồng bộ, không phải lỗi.
- Lớp có thẩm quyền là `assessRequest` (FCrDNS): `spoofed` ≥ 95. **Muốn thực thi (challenge/limit) thì
  gọi bản bất đồng bộ**, không dựa vào điểm sync của UA khai crawler.
- Crawler "đã xác minh" mà UA có tên công cụ automation (`Playwright`, `node`…) **không** được miễn
  điểm: UA crawler thật không bao giờ chứa chúng.

## Điểm → hành động (`policy.ts`)

| Điểm | Hành động | Bucket | Chi phí |
|---|---|---|---|
| 0–29 | `allow` | `h:` sạch (120 burst, 2/s) | 1 |
| 30–59 | `flag` — đi tiếp, ghi log; vượt 30 burst thì `rate-limited` | `s:` nghi ngờ (30 burst, 0.5/s) | 1 |
| 60–79 | `flag` + hạn mức chặt; vượt thì `rate-limited` (429) | `s:` | 5 (≈ 6 burst) |
| 80–100 | `challenge` — giải PoW | không dùng bucket | — |

**Hai bucket cho mỗi khoá, và ranh giới là cố ý.** Một bucket duy nhất (thiết kế sau
vòng 1) để một bot bậc cao rút cạn hạn mức của mọi NGƯỜI SẠCH dùng chung IP với nó
(CGNAT di động, văn phòng) — vòng 2 bắt được. Bucket riêng mỗi bậc (thiết kế đầu) thì
luân phiên giữa các bậc cộng dồn 120 + 30 + 6. Hai bucket giữ được cả hai: bot không
chạm tới bucket sạch, tổng tối đa bị chặn (~150) bởi hai trần cố định. Điểm không hữu
hạn (lỗi phía gọi) rơi vào bậc `flag`, không phải `allow`.

Crawler đã `verified` không bao giờ bị challenge/rate-limit chặt.

**Rate limit** (`rate-limit.ts`) là token bucket in-memory, giới hạn kích thước. Đồng hồ
nhảy lùi không "hồi" token ma; `cost` không hợp lệ (âm, NaN, 0) **ném lỗi** thay vì
âm thầm từ chối; khi đầy thì đá bucket còn ≥ 50% token trước (client rảnh), không đá bucket
cũ nhất — LRU thuần cho phép kẻ phun khoá lạ reset bucket đã cạn của chính nó. Khi
một request không bao giờ thoả (cost > capacity), `retryAfterSec` để trống thay vì
hứa một thời hạn sai.
**Per-instance**: N instance warm thì hạn mức thực là N × limit. Đủ chặn một
client xả vào một instance, không đảm bảo trần toàn hệ thống; cần cái sau thì
implement `RateLimitStore` bằng Redis/Upstash.

**PoW** (`challenge.ts`) là hashcash không trạng thái: token ký HMAC chứa
`{subject, hạn, độ khó, id ngẫu nhiên}`; client tìm `nonce` sao cho
`sha256(token:nonce)` có ≥ `d` bit 0 đầu. `issueChallenge` **ném `RangeError`** với tham số không an toàn (độ khó không nguyên
hoặc ngoài 1–32 — NaN từng bị JSON hoá thành `null` nên mọi nonce đều qua; secret < 16
ký tự; ttl ≤ 0 hoặc > 1 giờ). Verify kiểm: kiểu, kích thước token (≤ 1024), dạng
base64url chuẩn tắc (không `=`, xuống dòng, ký tự lạ hay bit thừa — nếu không một chữ
ký có vô số chuỗi bí danh), chữ ký (constant-time), hạn, chủ thể, công thực, và replay
(kiểm cuối cùng, để lời giải sai không đốt token). Replay guard **fail-closed** khi đầy
toàn id còn sống: đá id cũ nhất ra sẽ mở lại replay cho lời giải đó. Đây là **cái thuế**, không phải CAPTCHA: không phân biệt người với máy,
chỉ làm automation quy mô lớn tốn kém. Kẻ có GPU/farm vẫn giải được. 16 bit ≈
65k lần băm ≈ chưa tới 1s trong browser.

## Giới hạn — những thứ module này KHÔNG làm được

- **Automation đội đủ header Chrome thật không bị lớp 2 phát hiện.** Test
  `GIỚI HẠN ĐÃ BIẾT` ghi lại điều này; điểm thấp ≠ "chắc chắn là người".
- Lớp 1 chỉ chứng minh danh tính **crawler tự khai**. Nó không nói gì về bot
  không khai danh.
- Lớp 3 cần trang nhúng probe, và client có thể nói dối. Payload telemetry là dữ liệu
  không đáng tin: luôn qua `parseTelemetry()` (kiểm kiểu, hữu hạn, trần số, độ dài UA,
  bỏ field thừa) trước khi chấm.
- Header ASN (`x-vercel-ip-as-number`) chỉ có trên Vercel; `readAsn` chỉ nhận số thập phân
  ≤ 2³²−1 (`0x80A6` từng được đọc thành ASN 32934 của Meta).
- IP nguồn do caller truyền vào. Trên Vercel `x-forwarded-for` đáng tin; ở host khác
  client tự đặt được header này, và khi đó FCrDNS/rate limit theo IP không có nghĩa.
- Không có tín hiệu hành vi theo thời gian (tần suất/IP, chuỗi điều hướng): đó
  là việc của rate limit dùng chung + log, chưa có.
- Danh sách UA/ASN là liệt kê nên lỗi thời theo thời gian; thêm mẫu vào
  `scripts/check-bot-detection.ts` trước khi sửa regex.
- Telemetry có `dw` > 10⁹ ms (tab mở > 11 ngày) bị `parseTelemetry` bỏ — nghĩa là "không có
  telemetry", không phải đáng ngờ.
- Rate limiter có bộ nhớ trần nên kẻ có > 512 khoá đã cạn (IPv6 xoay vòng) vẫn ép được
  đường lùi "đá bucket cũ nhất". Chống triệt để cần store dùng chung + khoá theo /64.
- Replay guard giới hạn số id sống mỗi chủ thể (≤ 1/10 bảng), nên một IP không khoá được
  người khác; nhưng bảng vẫn fail-closed nếu nhiều chủ thể khác nhau cùng lấp đầy nó.
- Không có con số "độ chính xác X%" cho điểm rủi ro: chưa có dữ liệu thật có
  nhãn. Hai thứ đo được: `npm run check:bot` (corpus viết tay, chấm bài của chính mình) và `npm run check:bot-external`
  (recall/chặn nhầm của `botReason` trên corpus bên thứ ba; số liệu in ra mỗi lần chạy).
