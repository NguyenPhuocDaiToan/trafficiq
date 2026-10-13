/**
 * Gate cho `botReason()` (src/lib/tracking/ua.ts).
 *
 * Đo trên một corpus UA có gắn nhãn, theo BA nhóm — gộp chung một con số sẽ che
 * mất đúng chỗ cần nhìn:
 *
 *   human    — browser/in-app webview thật. Chặn nhầm ở đây là mất một click thật
 *              (không tới advertiser, không conversion) → đo specificity.
 *   declared — crawler/HTTP client tự khai được bằng UA hoặc ASN → đo recall.
 *              Đây là nhóm hàm này CÓ THỂ bắt; gate ở đây.
 *   stealth  — automation đội UA browser bình thường (Selenium/Playwright…).
 *              UA-regex không thể phân biệt, nên KHÔNG tính vào gate. Vẫn in ra để
 *              con số recall không bị đọc thành "bắt được mọi bot".
 *
 * Corpus là mẫu viết tay từ UA thật, không phải mẫu ngẫu nhiên của traffic —
 * tỉ lệ ở đây là chỉ báo hồi quy, không phải ước lượng tỉ lệ trên production.
 * Thêm UA mới bắt nhầm ngoài thực tế thì thêm vào đây trước khi sửa regex.
 */
import { NextRequest } from "next/server";
import { botReason } from "../src/lib/tracking/ua";

type Kind = "human" | "declared" | "stealth";

interface Sample {
  kind: Kind;
  name: string;
  ua: string;
  /** Header phụ (vd. ASN của Vercel). */
  headers?: Record<string, string>;
}

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const SAMPLES: Sample[] = [
  // ───────────────────────── human ─────────────────────────
  { kind: "human", name: "Chrome Windows", ua: CHROME_WIN },
  { kind: "human", name: "Edge Windows", ua: `${CHROME_WIN} Edg/126.0.0.0` },
  { kind: "human", name: "Firefox Windows", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0" },
  { kind: "human", name: "Firefox Linux", ua: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0" },
  { kind: "human", name: "Chrome Linux", ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  { kind: "human", name: "Chrome ChromeOS", ua: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  { kind: "human", name: "Safari macOS", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" },
  { kind: "human", name: "Chrome macOS", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  { kind: "human", name: "Chrome Android", ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36" },
  { kind: "human", name: "Samsung Internet", ua: "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36" },
  { kind: "human", name: "Firefox Android", ua: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0" },
  { kind: "human", name: "Safari iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
  { kind: "human", name: "Chrome iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1" },
  { kind: "human", name: "Safari iPad", ua: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
  { kind: "human", name: "Android tablet", ua: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  { kind: "human", name: "Opera desktop", ua: `${CHROME_WIN} OPR/111.0.0.0` },
  { kind: "human", name: "Opera Mini", ua: "Opera/9.80 (Android; Opera Mini/36.2.2254/191.249; U; en) Presto/2.12.423 Version/12.16" },
  { kind: "human", name: "Vivaldi", ua: `${CHROME_WIN} Vivaldi/6.7.3329.31` },
  { kind: "human", name: "Cốc Cốc", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 coc_coc_browser/116.0.236" },
  { kind: "human", name: "UC Browser", ua: "Mozilla/5.0 (Linux; U; Android 12; en-US; RMX3511 Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/13.4.0.1306 Mobile Safari/537.36" },
  { kind: "human", name: "MIUI Browser", ua: "Mozilla/5.0 (Linux; U; Android 13; vi-vn; 2201116SG Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.4.4" },
  { kind: "human", name: "Huawei Browser", ua: "Mozilla/5.0 (Linux; Android 10; HarmonyOS; ELS-N29; HMSCore 6.12.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/14.0.4.301 Mobile Safari/537.36" },
  { kind: "human", name: "Yandex Browser", ua: `${CHROME_WIN} YaBrowser/24.4.0.0 Yowser/2.5` },
  { kind: "human", name: "Facebook in-app Android", ua: "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;]" },
  { kind: "human", name: "Facebook in-app iOS", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.109;FBBV/616171000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]" },
  { kind: "human", name: "Messenger in-app", ua: "Mozilla/5.0 (Linux; Android 13; Redmi Note 11 Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/460.0.0.37.108;]" },
  { kind: "human", name: "Instagram in-app", ua: "Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Instagram 330.0.0.35.108 Android (33/13; 420dpi; 1080x2209; samsung; SM-G991B; o1s; exynos2100; vi_VN; 568512340)" },
  { kind: "human", name: "TikTok in-app", ua: "Mozilla/5.0 (Linux; Android 13; V2250 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 musical_ly_34.1.0 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.1.0 BytedanceWebview/d8a21c6" },
  { kind: "human", name: "Zalo in-app", ua: "Mozilla/5.0 (Linux; Android 13; 22101316G Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Zalo/24.05.1" },
  { kind: "human", name: "LINE in-app", ua: "Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 Line/14.8.1/IAB" },
  { kind: "human", name: "LinkedIn in-app", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp/9.30.1850" },
  { kind: "human", name: "Snapchat in-app", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.90.0.38 (like Safari/8618.2.12.0.4, panda)" },
  { kind: "human", name: "LG feature phone (Java/ASVM)", ua: "LG/U990/v1.0 Browser/Obigo-Q05A/3.6 MMS/LG-MMS-V1.0/1.2 Java/ASVM/1.1 Profile/MIDP-2.1 Configuration/CLDC-1.1" },
  // UA người thật KHÔNG mở đầu bằng "Mozilla/" — botReason chặn nhầm nhóm này nghĩa là người nhận Social Card
  // thay vì được redirect, nên đây là lưới an toàn của quy luật `non-browser-ua`:
  { kind: "human", name: "Opera Mini (Opera/9.80)", ua: "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.54" },
  { kind: "human", name: "Nokia feature phone", ua: "Nokia6230/2.0 (04.44) Profile/MIDP-2.0 Configuration/CLDC-1.1" },
  { kind: "human", name: "Nokia N73", ua: "NokiaN73-1/3.0649.0.0.1 Series60/3.0 Profile/MIDP-2.0 Configuration/CLDC-1.1" },
  { kind: "human", name: "BlackBerry đời cũ", ua: "BlackBerry9000/4.6.0.167 Profile/MIDP-2.0 Configuration/CLDC-1.1 VendorID/102" },
  { kind: "human", name: "Sony Ericsson", ua: "SonyEricssonK800i/R1JG Browser/NetFront/3.3 Profile/MIDP-2.0 Configuration/CLDC-1.1" },
  { kind: "human", name: "Motorola MOT-", ua: "MOT-V3/0E.41.C3R MIB/2.2.1 Profile/MIDP-2.0 Configuration/CLDC-1.0" },
  { kind: "human", name: "Samsung SAMSUNG-", ua: "SAMSUNG-SGH-A867/A867UCHJ3 SHP/VPP/R5 NetFront/35 SMM-MMS/1.2.0 profile/MIDP-2.0 configuration/CLDC-1.1" },
  { kind: "human", name: "DoCoMo (Nhật)", ua: "DoCoMo/2.0 N905i(c100;TB;W24H16)" },
  { kind: "human", name: "SoftBank (Nhật)", ua: "SoftBank/1.0/910T/TJ001/SN000000000000000 Browser/NetFront/3.3 Profile/MIDP-2.0 Configuration/CLDC-1.1" },
  { kind: "human", name: "UC Browser feature phone", ua: "UCWEB7.0.2.37/28/999" },
  { kind: "human", name: "Openwave UP.Browser", ua: "UP.Browser/3.04-TS14 UP.Link/3.4.4" },
  { kind: "human", name: "Lynx (libwww-FM)", ua: "Lynx/2.9.0 libwww-FM/2.14 SSL-MM/1.4.1 OpenSSL/3.0.2" },
  // Bẫy dương tính giả — UA người thật chứa chuỗi trùng tên crawler:
  { kind: "human", name: "Cubot phone (…CUBOT…)", ua: "Mozilla/5.0 (Linux; Android 11; CUBOT_P40) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36" },
  { kind: "human", name: "Cubot phone 2", ua: "Mozilla/5.0 (Linux; Android 10; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36" },
  { kind: "human", name: "Pinterest in-app iOS", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]" },
  { kind: "human", name: "Pinterest in-app Android", ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 [Pinterest/Android]" },
  { kind: "human", name: "DuckDuckGo browser Android", ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 DuckDuckGo/5" },
  { kind: "human", name: "DuckDuckGo browser iOS", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15" },

  // ───────────────────────── declared ─────────────────────────
  // Crawler KHÔNG mở đầu bằng "Mozilla/" và không có từ khoá bot — chỉ quy luật non-browser-ua bắt được.
  // (Lấy từ danh sách bên thứ ba `crawler-user-agents`.)
  { kind: "declared", name: "Blogtrottr (RSS)", ua: "Blogtrottr/2.0" },
  { kind: "declared", name: "TwilioProxy", ua: "TwilioProxy/1.1" },
  { kind: "declared", name: "wheresitup", ua: "wheresitup.com/1.1" },
  { kind: "declared", name: "NETVIGIE (tên trần)", ua: "NETVIGIE" },
  { kind: "declared", name: "alienfarm (tên trần)", ua: "alienfarm" },
  { kind: "declared", name: "Feedbin", ua: "Feedbin feed-id:2005098 - 2 subscribers" },
  { kind: "declared", name: "updown.io", ua: "updown.io daemon 2.11" },
  { kind: "declared", name: "NokiaScraper (tiền tố giả allowlist)", ua: "NokiaScraper/1.0" },
  { kind: "declared", name: "Lynx scraper (tiền tố giả allowlist)", ua: "Lynx scraper/1.0" },
  { kind: "declared", name: "+URL crawler idiom", ua: "Mozilla/5.0 (compatible; PR-CY.RU; + https://a.pr-cy.ru)" },
  { kind: "declared", name: "+URL không khoảng trắng", ua: "Mozilla/5.0 (compatible; Poduptime; +fediverse.observer)" },
  { kind: "declared", name: "Googlebot desktop", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { kind: "declared", name: "Googlebot smartphone", ua: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { kind: "declared", name: "Googlebot-Image", ua: "Googlebot-Image/1.0" },
  { kind: "declared", name: "AdsBot-Google", ua: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)" },
  { kind: "declared", name: "Mediapartners-Google", ua: "Mediapartners-Google" },
  { kind: "declared", name: "Google-InspectionTool", ua: "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)" },
  { kind: "declared", name: "GoogleOther", ua: "GoogleOther" },
  { kind: "declared", name: "FeedFetcher-Google", ua: "FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)" },
  { kind: "declared", name: "Google-Read-Aloud", ua: "Mozilla/5.0 (Linux; Android 7.0; SM-G930V Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)" },
  { kind: "declared", name: "Chrome-Lighthouse", ua: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse" },
  { kind: "declared", name: "bingbot", ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
  { kind: "declared", name: "BingPreview", ua: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b" },
  { kind: "declared", name: "msnbot", ua: "msnbot/2.0b (+http://search.msn.com/msnbot.htm)" },
  { kind: "declared", name: "Yahoo Slurp", ua: "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)" },
  { kind: "declared", name: "DuckDuckBot", ua: "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)" },
  { kind: "declared", name: "DuckDuckGo favicons", ua: "Mozilla/5.0 (compatible; DuckDuckGo-Favicons-Bot/1.0; +http://duckduckgo.com)" },
  { kind: "declared", name: "Baiduspider", ua: "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)" },
  { kind: "declared", name: "YandexBot", ua: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)" },
  { kind: "declared", name: "Applebot", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)" },
  { kind: "declared", name: "Sogou spider", ua: "Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)" },
  { kind: "declared", name: "SeznamBot", ua: "Mozilla/5.0 (compatible; SeznamBot/4.0; +http://napoveda.seznam.cz/seznambot-intro)" },
  { kind: "declared", name: "Qwantify", ua: "Mozilla/5.0 (compatible; Qwantify/2.4w; +https://www.qwant.com/)/2.4w" },
  { kind: "declared", name: "Twitterbot", ua: "Twitterbot/1.0" },
  { kind: "declared", name: "facebookexternalhit", ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
  { kind: "declared", name: "facebookcatalog", ua: "facebookcatalog/1.0" },
  { kind: "declared", name: "meta-externalagent (không URL)", ua: "meta-externalagent/1.1" },
  { kind: "declared", name: "meta-externalfetcher (không URL)", ua: "meta-externalfetcher/1.1" },
  { kind: "declared", name: "meta-webindexer (không URL)", ua: "meta-webindexer/1.1" },
  { kind: "declared", name: "Facebot", ua: "Mozilla/5.0 (compatible; Facebot 1.0; https://developers.facebook.com/docs/sharing/webmasters/crawler)" },
  { kind: "declared", name: "LinkedInBot", ua: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)" },
  { kind: "declared", name: "Slackbot", ua: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
  { kind: "declared", name: "Slack-ImgProxy", ua: "Slack-ImgProxy (+https://api.slack.com/robots)" },
  { kind: "declared", name: "Discordbot", ua: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" },
  { kind: "declared", name: "WhatsApp preview", ua: "WhatsApp/2.23.20.0 A" },
  { kind: "declared", name: "TelegramBot", ua: "TelegramBot (like TwitterBot)" },
  { kind: "declared", name: "Pinterest crawler", ua: "Pinterest/0.2 (+http://www.pinterest.com/bot.html)" },
  { kind: "declared", name: "Embedly", ua: "Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)" },
  { kind: "declared", name: "Skype URI Preview", ua: "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com" },
  { kind: "declared", name: "vkShare", ua: "Mozilla/5.0 (compatible; vkShare; +http://vk.com/dev/Share)" },
  { kind: "declared", name: "SemrushBot", ua: "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)" },
  { kind: "declared", name: "AhrefsBot", ua: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)" },
  { kind: "declared", name: "MJ12bot", ua: "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)" },
  { kind: "declared", name: "DotBot", ua: "Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)" },
  { kind: "declared", name: "PetalBot", ua: "Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)" },
  { kind: "declared", name: "Bytespider", ua: "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)" },
  { kind: "declared", name: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)" },
  { kind: "declared", name: "ChatGPT-User", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot" },
  { kind: "declared", name: "ClaudeBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
  { kind: "declared", name: "anthropic-ai", ua: "anthropic-ai" },
  { kind: "declared", name: "PerplexityBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { kind: "declared", name: "CCBot", ua: "CCBot/2.0 (https://commoncrawl.org/faq/)" },
  { kind: "declared", name: "Amazonbot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36" },
  { kind: "declared", name: "UptimeRobot", ua: "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)" },
  { kind: "declared", name: "Pingdom", ua: "Mozilla/5.0 (compatible; Pingdom.com_bot_version_1.4_(http://www.pingdom.com/))" },
  { kind: "declared", name: "W3C Validator", ua: "W3C_Validator/1.3 http://validator.w3.org/services" },
  { kind: "declared", name: "curl", ua: "curl/8.4.0" },
  { kind: "declared", name: "Wget", ua: "Wget/1.21.4" },
  { kind: "declared", name: "python-requests", ua: "python-requests/2.31.0" },
  { kind: "declared", name: "Python-urllib", ua: "Python-urllib/3.11" },
  { kind: "declared", name: "aiohttp", ua: "Python/3.11 aiohttp/3.9.1" },
  { kind: "declared", name: "Go-http-client", ua: "Go-http-client/1.1" },
  { kind: "declared", name: "axios", ua: "axios/1.6.2" },
  { kind: "declared", name: "node-fetch", ua: "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)" },
  { kind: "declared", name: "undici", ua: "undici" },
  { kind: "declared", name: "got", ua: "got (https://github.com/sindresorhus/got)" },
  { kind: "declared", name: "okhttp", ua: "okhttp/4.12.0" },
  { kind: "declared", name: "Java", ua: "Java/17.0.9" },
  { kind: "declared", name: "Apache-HttpClient", ua: "Apache-HttpClient/4.5.14 (Java/17.0.9)" },
  { kind: "declared", name: "libwww-perl", ua: "libwww-perl/6.67" },
  { kind: "declared", name: "Scrapy", ua: "Scrapy/2.11.0 (+https://scrapy.org)" },
  { kind: "declared", name: "HeadlessChrome", ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36" },
  { kind: "declared", name: "PhantomJS", ua: "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1" },
  { kind: "declared", name: "Twitter ASN, UA browser", ua: CHROME_WIN, headers: { "x-vercel-ip-as-number": "13414" } },

  // ───────────────────────── stealth (không tính vào gate) ─────────────────────────
  { kind: "stealth", name: "Selenium/Playwright, UA Chrome thường", ua: CHROME_WIN },
  { kind: "stealth", name: "Puppeteer new-headless, UA Chrome thường", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  { kind: "stealth", name: "Script đội UA iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
  { kind: "stealth", name: "UA rỗng", ua: "" },
];

const GATE = 0.9;

function classify(s: Sample): boolean {
  const req = new NextRequest("http://localhost/go/test", {
    headers: { "user-agent": s.ua, ...s.headers },
  });
  return botReason(req) !== null;
}

const byKind: Record<Kind, { total: number; flagged: Sample[]; missed: Sample[] }> = {
  human: { total: 0, flagged: [], missed: [] },
  declared: { total: 0, flagged: [], missed: [] },
  stealth: { total: 0, flagged: [], missed: [] },
};

for (const s of SAMPLES) {
  const g = byKind[s.kind];
  g.total++;
  const isBot = classify(s);
  if (isBot) g.flagged.push(s);
  else g.missed.push(s);
}

const humanSpecificity = byKind.human.missed.length / byKind.human.total;
const declaredRecall = byKind.declared.flagged.length / byKind.declared.total;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

console.log(`human     : ${byKind.human.missed.length}/${byKind.human.total} đi tiếp đúng  → specificity ${pct(humanSpecificity)}`);
console.log(`declared  : ${byKind.declared.flagged.length}/${byKind.declared.total} bị bắt     → recall      ${pct(declaredRecall)}`);
console.log(`stealth   : ${byKind.stealth.flagged.length}/${byKind.stealth.total} bị bắt     → (ngoài gate — UA không đủ để phân biệt)`);

if (byKind.human.flagged.length > 0) {
  console.log("\nCHẶN NHẦM người thật:");
  for (const s of byKind.human.flagged) console.log(`  ✗ ${s.name}\n      ${s.ua}`);
}
if (byKind.declared.missed.length > 0) {
  console.log("\nLỌT crawler tự khai:");
  for (const s of byKind.declared.missed) console.log(`  ✗ ${s.name}\n      ${s.ua}`);
}

// Hai điều kiện, vì ngưỡng ≥ 90% một mình quá lỏng để làm gate HỒI QUY: xoá `curl` khỏi regex chỉ hạ
// recall chỉ tụt một chút, vẫn trên ngưỡng nên mutation đó từng lọt qua. Corpus này gồm toàn UA
// đã biết và đã được sửa, nên bất kỳ UA nào trong nhóm human/declared phân loại sai là HỒI QUY (ratchet).
// Gặp UA mới bị sai ngoài thực tế thì thêm vào corpus TRƯỚC, rồi sửa regex.
const regressions = byKind.human.flagged.length + byKind.declared.missed.length;
const failed = humanSpecificity < GATE || declaredRecall < GATE || regressions > 0;
console.log(
  failed
    ? `\nFAIL — ${regressions} hồi quy trên corpus (cần 0) hoặc dưới ngưỡng ${pct(GATE)}`
    : `\nPASS — cả hai ≥ ${pct(GATE)} và 0 hồi quy trên corpus`,
);
process.exit(failed ? 1 : 0);
