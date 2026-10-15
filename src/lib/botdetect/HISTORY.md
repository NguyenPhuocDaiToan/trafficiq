# Lịch sử đo của `botdetect` — GHI CHÉP MỘT LẦN, không phải khẳng định về mã hiện tại

File này giữ những con số và câu chuyện đã tách khỏi [README.md](./README.md). Mọi thứ ở đây là **kết quả của một lần đo trên một bản mã
cụ thể tại một thời điểm**, hoặc **con số do một reviewer độc lập báo mà repo không có script tái tạo**. Chúng giải thích VÌ SAO mã ra
như hiện nay, nhưng chúng đổi theo thời gian (danh sách bên thứ ba thay đổi, mã thay đổi) nên không được đọc như một khẳng định về hiện
tại. Thứ kiểm chứng lại được hôm nay là các lệnh `check:*` trong README.

## Độ nhạy của gate (mutation test): làm hỏng thư viện rồi xem gate có đỏ không

Các dòng dưới đây đo tại thời điểm tương ứng; mã đã đổi nhiều sau đó.

| Lỗi cố ý | Gate | Kết quả |
|---|---|---|
| `hostMatchesSuffix` chấp nhận mọi host (VM Google Cloud lọt qua) | `check:botdetect-live` | đỏ |
| FCrDNS luôn trả `error` (resolver hỏng, hết 3 lần thử) | `check:botdetect-live` | đỏ |
| `BOT_UA_REGEX` khớp `mozilla` (chặn nhầm người) | `check:bot` | đỏ (đo lại ở vòng 17: 27,5%) |
| Probe không đếm sự kiện tổng hợp | `check:probe-browser` | đỏ |
| Bỏ forward-confirm, bỏ kiểm tra hết hạn/chủ thể PoW, miễn crawler dù UA có tên automation, hạ `unverified-crawler` về 40, cost âm cộng token, điểm NaN rơi vào allow, tín hiệu header mạnh chỉ cho `Mozilla/5.0` | `test:botdetect` | đỏ cả 8 (4–11 test fail mỗi lần) |
| `BOT_UA_REGEX` mất `curl` | `check:bot` | **lọt lần đầu** (recall 98,6% ≥ 90%) → thêm bánh cóc "0 hồi quy trên corpus" → đỏ lúc đó. **LỖI THỜI:** nay `non-browser-ua` cũng bắt `curl/8.4.0`, nên mutation này và mutation khớp `cubot` (đoạn nền tảng Android được làm trống) không còn làm `check:bot` đỏ; độ nhạy hiện tại nằm ở `check:bot-external` (tắt `non-browser-ua` thì recall tụt dưới 90%) |


## Đo trên dữ liệu bên thứ ba — và cái nó làm lộ ra

Nội dung nguyên văn của mục này trong README trước khi tách (các số đo, "trước/sau", bảng "gain", danh sách quy luật đã thử và bỏ):

`check:bot` dùng corpus do tác giả viết, nên nó chấm bài của chính mình: nó báo 100% trong khi `botReason`
(hàm quyết định redirect hay Social Card ở `/go`) chỉ bắt **62,1%** crawler trong danh sách `crawler-user-agents` (bản chưa có các quy luật dưới đây; regex gốc, tức bản trước commit f17cbe4, đo ra 59,1% trên danh sách hôm nay)
do cộng đồng duy trì — dưới mục tiêu 90% ban đầu của dự án. Điểm rủi ro (≥ 30) thì bắt 99,95% nhờ `non-browser-ua`.

Sửa `botReason` theo quy luật (chọn chỉ dựa trên nửa DEV, kiểm trên nửa HOLDOUT), rồi một reviewer độc lập chứng minh
con số "0 chặn nhầm" ban đầu vô nghĩa — 100 UA người của `top-user-agents` toàn là trình duyệt hiện đại bắt đầu bằng
`Mozilla/` — bằng cách chạy hàng chục nghìn UA không-bot (Matomo, uap-core, WhichBrowser…; reviewer báo 65.288 UA và 5.594 bị chặn — số do reviewer báo, repo không có script tái tạo):
quy luật mới chặn nhầm hàng nghìn UA,
trong đó có người thật. Sửa tiếp, đo lại trên bộ Matomo có nhãn theo LOẠI THIẾT BỊ:

Cột "Trước" là số đo thủ công ở các build cũ, KHÔNG phải một mốc chung giữa các hàng và không tái tạo được từ mã hiện tại. Ngoại lệ đo lại được: "trước commit f17cbe4" là regex ở `git show f17cbe4~1:src/lib/tracking/ua.ts`, "commit f17cbe4" là `botReason` ở commit đó (regex + `isNonBrowserUa` + làm trống đoạn tên máy); riêng regex `BOT_UA_REGEX` ở commit đó chỉ đạt 83,2% (crawler-user-agents) và 72,6% (Matomo bots). Cột "Sau" = bản tại thời điểm đo (số HIỆN TẠI: `npm run check:bot-external`). Mọi số đo bằng
một script chạy lại được trên dữ liệu bên thứ ba; chặn nhầm tính SAU KHI loại stack ứng dụng (`NATIVE_STACK`) ở cả hai cột.

| Chỉ số (corpus bên thứ ba) | Trước | Sau |
|---|---|---|
| `crawler-user-agents`, `botReason` recall (2120 UA) | 59,1% (trước commit f17cbe4) → 94,4% (commit f17cbe4) | **96,7%** (dev 96,77 / holdout 96,53 / tất cả 96,65) |
| Matomo `bots.yml`, `botReason` recall (1348 UA) | 46,5% (trước commit f17cbe4) → 90,7% (commit f17cbe4) | **95,62%** |
| Matomo UA người bị chặn nhầm, đã loại stack ứng dụng (35.258 UA, 9 loại thiết bị) | 2,03% | **0,67%** (236 UA; gate tập con 15.727 UA: **1,11%**) |
| ↳ cùng phép đo, CHƯA loại stack ứng dụng (thô) | — | 3,27% (1.153 UA) |
| ↳ feature phone (190) | 27,89% | **0,53%** |
| ↳ console (50) | 8,00% | **0%** |
| ↳ TV (3.121) | 5,58% | **1,92%** |
| ↳ desktop (615) | 15,28% | 5,69% |
| ↳ smartphone (23.219) | 1,16% | **0,32%** (gate: 0,38%) |

Dòng "thô" cố ý đặt cạnh số đã loại: phần chênh (917 UA) là stack HTTP của ứng dụng mà `NATIVE_STACK` khớp ĐẦU chuỗi (Dalvik 750, Microsoft Office 136, và vài chục UA 1PasswordThumbs,
AndroidDownloadManager, QuickTime, AppleCoreMedia, server-bag, CFNetwork) mà quy luật cố ý bắt. Stack có tiền tố tên app (`Reeder/… CFNetwork/…`) và Sonos
KHÔNG khớp nên vẫn nằm trong số chặn nhầm còn lại (23 UA có Sonos/CFNetwork, chủ yếu ở fixture desktop và tablet/phablet). Chúng nằm trong các fixture đó vì Matomo nhận dạng THIẾT BỊ, không phải vì ai đó bấm link.
Nếu bạn không đồng ý rằng đó là "không phải cú bấm link", con số trung thực là 3,27%, không phải 0,67%.

Gate `check:bot-external` dùng một tập con của Matomo (đủ 9 loại thiết bị, riêng `smartphone` cắt còn 3.688 UA; tổng ~15.700 UA) để chạy nhanh, nên con số
tổng của gate (≤ 1,5%) khác 0,67% ở trên; các ngưỡng theo loại là bánh cóc với biên riêng cho từng loại (TV 1,92% so với 3%; console và ô tô chỉ cách ngưỡng khoảng một UA).

| Quy luật trong `lib/tracking/ua.ts` | Gain DEV / HOLDOUT | Người khớp nhầm (CHỈ trên các tập đã đo, không phải bảo đảm) |
|---|---|---|
| `+<URL>` (`+http://x`, `+ https://x`, `+www.x`, `+host.tld`) | +140 / +134 | 0 |
| `https?://` ở bất kỳ đâu, `mailto:` (bot tự khai bằng URL trần) | +34 / +28 và +6 / +2 (Matomo / crawler-ua) | 3 / 35.258 (Matomo, đo lại vòng 17; từng là 1 khi chọn quy luật); reviewer độc lập thấy thêm ~15 UA kiểu IE6 có URL của trang web trong ~42k UA khác, vd `Firefox/0.8 (John Bokma, http://johnbokma.com/)` |
| Email liên hệ trong UA (`@host.tld`, `[at]host.tld`, `(at)host.tld`; regex `@[a-z0-9.-]{1,64}\.[a-z]{2,10}` không neo cuối nên `x@example.photography` vẫn bị bắt; nhưng cần một dấu `.` nằm trong 65 ký tự đầu sau `@` và theo sau bởi ≥ 2 chữ cái; vì vậy `@` + 64 chữ + `.com` và `@` + 62 chữ + `.1.com` bị bắt, còn `@` + 65 chữ + `.com` và `@` + 63 chữ + `.1.com` thì lọt) | không có script tái tạo; số do một lần đo thủ công, đừng dựa vào | 0 chặn nhầm trên Matomo (đo ở thời điểm thêm) |
| Frameworks automation (`playwright`, `selenium`, `puppeteer`, `webdriver`) | không có script tái tạo; số do một lần đo thủ công, đừng dựa vào | 0 chặn nhầm trên Matomo (đo ở thời điểm thêm) |
| Crawler dịch vụ Google (`google (?:web preview|page speed|search console)`, `google-(?:ads|adsense|...)`) | không có script tái tạo; số do một lần đo thủ công, đừng dựa vào | 0 chặn nhầm trên Matomo (đo ở thời điểm thêm) |
| Dịch vụ giám sát / audit / fetcher: danh sách TÊN riêng (`pingdom`, `siteimprove`, `netcraft`, `nutch`, `httrack`, `synthetics?`, `optimizer`...) | không có script tái tạo; số do một lần đo thủ công, đừng dựa vào; các tên này lấy từ chính corpus nên KHÔNG chứng minh khái quát | 0 chặn nhầm trên Matomo (đo ở thời điểm thêm) |
| gốc `crawl`; danh từ `fetcher\|scanner\|monitor\|checker\|validator\|harvest\|extractor\|indexer\|probe` | +24 / +7 và +44 / +52 | 0 |
| AI agent khai danh không có chữ "bot" (Claude-User, Perplexity-User, ChatGPT-User…) | +1 / +1 | 0 |
| **`non-browser-ua`**: UA không có dấu hiệu trình duyệt (`Mozilla/<số>` ở bất kỳ đâu, token bộ máy, Java ME/WAP, TV…) | ~+15 điểm recall | xem trên |
| `bot` là một TỪ (không khớp "Caboto", "Abbott"); xoá đoạn nền tảng Android trước khi tìm "bot" ("M bot 54") | — | −21 người |

Các số "Gain DEV / HOLDOUT" ở bảng trên do tác giả đo bằng script tạm lúc chọn quy luật (không nằm trong repo); thứ kiểm chứng lại được bằng
một lệnh là TỔNG recall/chặn nhầm của `check:bot-external`.

Đã thử và **bỏ**: danh sách tên (`grub\|findlinks\|teoma\|jeeves`: +35 ở DEV, **+0 ở HOLDOUT** — chỉ vá đúng mẫu đã thấy; về sau `teoma` (có ranh giới từ, để không chặn nhầm thanh công cụ `TeomaBar`) và nhiều tên khác VẪN được thêm vào regex, xem README),
`agent\|client` (quá chung chung), và `audit\|preview\|proxy\|check…` (+23/+19 nhưng chặn nhầm 3 người).


## Các vòng review độc lập (tóm tắt)

Mỗi vòng dùng một reviewer mới, không đọc test của vòng trước, với phương pháp khác nhau. Số liệu do reviewer báo; repo không có script tái tạo
chúng. Điều rút ra, chứ không phải số, mới là thứ đáng giữ:

- Vòng 1–9: thư viện chấm điểm (FCrDNS, PoW, rate limit, telemetry). Tìm ra hàng chục lỗi thật; lỗi đáng ngại nhất là chính các bản sửa của tác giả
  từng tạo ra lỗi mới (gắn token crawler làm điểm giảm, bucket chung cho người lẫn bot).
- Vòng 10–16: `botReason` (quyết định redirect). Vòng 10 chứng minh con số "0 chặn nhầm" ban đầu vô nghĩa vì 100 UA thử toàn trình duyệt hiện đại;
  vòng 11 tìm ra các ReDoS bậc hai (tác giả tự đưa vào ba lần), một bypass do làm trống đoạn Android vô điều kiện, và nhiều lớp chặn nhầm.
- Vòng 13, 15, 16, 17: không còn lỗi hành vi; các lỗi còn lại là tài liệu lệch số.
- Vòng 8–17 mới (đợt thêm token tên riêng + email-trong-UA): recall `botReason` tăng trên `crawler-user-agents` và Matomo, nhưng phần lớn mức tăng đến từ TÊN riêng có sẵn trong corpus (xem README "Giới hạn của phép đo này"), nên DEV/HOLDOUT không còn độc lập. Số HIỆN TẠI: `npm run check:bot-external`. Bánh cóc `check:bot-external` nâng ngưỡng lên ≥ 95%.
- Vòng 9 nâng cao (chống giả mạo): thêm `client-hints-brand-mismatch`, `mobile-hint-mismatch`, `fetch-dest-mismatch`, mở rộng dải ASN datacenter/proxy (Leaseweb, Contabo, Scaleway, Alibaba, Tencent, Oracle, Hostinger, BuyVM, Serverius, Equinix), và chữ ký công cụ scraping stealth (`camoufox`, `crawlee`, `tls-client`, `curl-impersonate`, `brightdata`, `zenrows`, `cloudscraper`). Reviewer vòng 24 và một phản biện thủ công sau đó đã chỉnh lại: `client-hints-brand-mismatch` hạ từ 85 xuống 45 (extension đổi UA của người thật trông y hệt), `fetch-dest-mismatch` chỉ chấm dest không thể là điều hướng, Cloudflare (13335) bị BỎ khỏi danh sách (iCloud Private Relay/WARP), regex Safari phải có giới hạn `{0,200}` (bản đầu là bậc hai), và việc xác minh X bằng IP/XFF/header tracing bị gỡ vì client giả được.
