/**
 * Kiểm chứng `lib/botdetect` với DNS THẬT — phần unit test không làm được vì
 * dùng resolver giả. Cần mạng; không nằm trong CI mặc định.
 *
 *   npm run check:botdetect-live
 *
 * IP mẫu là dải crawler đã công bố; DNS của nhà vận hành có thể đổi, nên một
 * dòng FAIL ở đây nghĩa là "đối chiếu lại tài liệu nhà vận hành", chưa chắc là
 * lỗi code.
 */
import { KNOWN_CRAWLERS } from "../src/lib/botdetect/crawlers";
import { verifyFcrdns } from "../src/lib/botdetect/fcrdns";

const suffixes = (id: string) => KNOWN_CRAWLERS.find((c) => c.id === id)!.rdnsSuffixes!;

const CASES: { ip: string; crawler: string; expect: "verified" | "failed"; note: string }[] = [
  { ip: "66.249.66.1", crawler: "google", expect: "verified", note: "Googlebot" },
  { ip: "66.249.64.10", crawler: "google", expect: "verified", note: "Googlebot" },
  { ip: "157.55.39.1", crawler: "bing", expect: "verified", note: "msnbot" },
  { ip: "40.77.167.1", crawler: "bing", expect: "verified", note: "msnbot" },
  { ip: "17.58.98.1", crawler: "apple", expect: "verified", note: "Applebot" },
  { ip: "77.88.5.1", crawler: "yandex", expect: "verified", note: "Yandex spider" },
  { ip: "220.181.108.75", crawler: "baidu", expect: "verified", note: "Baiduspider" },
  // Phải FAIL — giả mạo mà UA-only sẽ cho qua:
  { ip: "34.74.90.64", crawler: "google", expect: "failed", note: "VM Google Cloud (PTR *.bc.googleusercontent.com)" },
  { ip: "8.8.8.8", crawler: "google", expect: "failed", note: "DNS công cộng của Google, không phải crawler" },
  { ip: "1.1.1.1", crawler: "google", expect: "failed", note: "Cloudflare" },
  { ip: "66.249.66.1", crawler: "bing", expect: "failed", note: "IP Googlebot khai là Bing (sai nhà vận hành)" },
  { ip: "157.55.39.1", crawler: "google", expect: "failed", note: "IP Bing khai là Google" },
];

async function main(): Promise<number> {
  let bad = 0;
  for (const c of CASES) {
    // `error` (timeout, SERVFAIL) là NHIỄU MẠNG, không phải kết luận: thư viện cố ý coi nó là
    // "không biết" chứ không phải giả mạo. Gate thử lại tối đa 3 lần thay vì fail oan; chỉ `error`
    // kéo dài cả 3 lần mới tính là sai.
    let r = await verifyFcrdns(c.ip, suffixes(c.crawler));
    for (let attempt = 1; attempt < 3 && r.status === "error"; attempt++) {
      await new Promise((res) => setTimeout(res, 1500));
      r = await verifyFcrdns(c.ip, suffixes(c.crawler));
    }
    const ok = r.status === c.expect;
    if (!ok) bad++;
    const detail = r.status === "verified" ? r.hostname : r.reason;
    console.log(`${ok ? "ok  " : "FAIL"} ${c.ip.padEnd(15)} khai ${c.crawler.padEnd(6)} → ${r.status.padEnd(8)} (${detail})  [${c.note}]`);
  }

  console.log(bad === 0 ? `\nPASS — ${CASES.length}/${CASES.length}` : `\nFAIL — ${bad}/${CASES.length} sai`);
  return bad;
}

main().then((bad) => process.exit(bad === 0 ? 0 : 1));
