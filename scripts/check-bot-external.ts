/**
 * Đo `botReason` / điểm rủi ro trên corpus của BÊN THỨ BA — không do tác giả thư viện viết, nên không bị
 * lỗi "chấm bài của chính mình" như `check:bot`.
 *
 *   npm run check:bot-external      (cần mạng; thử lại khi lỗi mạng; thường vài giây)
 *
 *   crawler-user-agents (github.com/monperrus): ~2100 UA mẫu thật của crawler — nhãn = bot.
 *   top-user-agents     (github.com/microlinkhq): ~100 UA trình duyệt phổ biến — nhãn = người.
 *   Matomo device-detector (github.com/matomo-org), thư mục Tests/fixtures: UA có nhãn theo LOẠI THIẾT BỊ
 *     (tv, feature_phone, console, car_browser, tablet, smartphone…) và `bots.yml` ~1350 UA bot.
 *
 * Vì sao có bộ Matomo: 100 UA người của microlink toàn là trình duyệt hiện đại bắt đầu bằng "Mozilla/", nên
 * "0 chặn nhầm" trên đó không nói gì về quy luật `non-browser-ua` — reviewer độc lập đã chứng minh điều này
 * (xem src/lib/botdetect/HISTORY.md). Matomo có TV, feature phone, console, xe hơi: đúng nơi rủi ro nằm.
 *
 * Dữ liệu tải về là KHÔNG TIN CẬY: chỉ đọc bằng JSON.parse / tách dòng, không thực thi, giới hạn độ dài.
 *
 * Nhãn Matomo là theo THIẾT BỊ chứ không theo "người bấm link": file smartphone/desktop có nhiều UA là stack HTTP của
 * ứng dụng (Dalvik, CFNetwork, Microsoft Office, Sonos…) — không phải cú bấm link, và bị coi là non-browser có chủ đích.
 * Gate loại khỏi phép đo chặn nhầm các UA BẮT ĐẦU bằng một tên trong NATIVE_STACK (danh sách công khai ở dưới để ai cũng soi được).
 * Stack có tiền tố tên app (`Reeder/… CFNetwork/…`) và Sonos KHÔNG được loại, nên vẫn nằm trong số chặn nhầm còn lại.
 *
 * Ngưỡng là BÁNH CÓC với biên riêng cho từng loại (TV có biên khá rộng; console và ô tô chỉ cách ngưỡng khoảng một UA vì mẫu nhỏ):
 * hạ chúng khi đo kém đi là che hồi quy.
 * Danh sách bên thứ ba thay đổi theo thời gian, nên FAIL nghĩa là "xem lại UA mới", chưa chắc lỗi code.
 */
import { NextRequest } from "next/server";
import { assessRequestSync } from "../src/lib/botdetect/assess";
import { botReason } from "../src/lib/tracking/ua";

const RAW = "https://raw.githubusercontent.com";
const SOURCES = {
  crawlers: `${RAW}/monperrus/crawler-user-agents/master/crawler-user-agents.json`,
  desktop: `${RAW}/microlinkhq/top-user-agents/master/src/desktop.json`,
  mobile: `${RAW}/microlinkhq/top-user-agents/master/src/mobile.json`,
} as const;
const MATOMO_LIST = "https://api.github.com/repos/matomo-org/device-detector/contents/Tests/fixtures";
const MATOMO_RAW = `${RAW}/matomo-org/device-detector/master/Tests/fixtures/`;
const MAX_BYTES = 8_000_000;
const MAX_UA_LEN = 2000;

/** Stack HTTP gốc của ứng dụng — không phải một cú bấm link; cố ý bị `non-browser-ua` bắt. */
const NATIVE_STACK =
  /^(?:dalvik|cfnetwork|darwin|okhttp|microsoft (?:office|outlook)|apache-httpclient|java\/|atc\/|server-bag|com\.apple|applecoremedia|quicktime|androiddownloadmanager|1passwordthumbs)/i;

async function download(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error("file quá lớn");
      return text;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error(`không tải được ${url}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
const downloadJson = async (url: string): Promise<unknown> => JSON.parse(await download(url));

const asUaList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < MAX_UA_LEN);

/** Trích các dòng `user_agent: …` của fixture Matomo (YAML) mà không cần thư viện YAML. */
function yamlUserAgents(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^\s*user_agent:\s*(.*)$/gm)) {
    let v = m[1].trim();
    if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
    else if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (v.length > 0 && v.length < MAX_UA_LEN) out.push(v);
  }
  return out;
}

// Header của một lượt bấm link bằng trình duyệt thật (người); bot thì chỉ gửi header tối giản.
const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
  "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "cross-site",
};
/** Dạng mà Node nhận UA từ socket: byte UTF-8 đọc thành Latin-1 (header HTTP không mang ký tự > 255). */
const wire = (ua: string) => Buffer.from(ua, "utf8").toString("latin1");
const isBlocked = (ua: string) => botReason(new NextRequest("http://x/go/t", { headers: { "user-agent": wire(ua) } })) !== null;
const humanScore = (ua: string) => assessRequestSync({ headers: new Headers({ "user-agent": wire(ua), ...BROWSER_HEADERS }) }).score;
const botScore = (ua: string) => assessRequestSync({ headers: new Headers({ "user-agent": wire(ua), accept: "*/*" }) }).score;
const pct = (n: number, d: number) => (100 * n) / d;
const uniq = (a: string[]) => [...new Set(a)];

/** Loại thiết bị Matomo → số file tối đa tải (loại rủi ro cao tải hết; loại khổng lồ chỉ lấy vài file đầu). */
const MATOMO_CLASSES: Record<string, number> = {
  tv: 99, feature_phone: 99, console: 99, car_browser: 99, portable_media_player: 99, tablet: 99, phablet: 99, desktop: 99, smartphone: 6,
};

async function loadMatomo(): Promise<{ human: Map<string, string[]>; bots: string[] }> {
  const listing = (await downloadJson(MATOMO_LIST)) as { name?: unknown }[];
  const names = (Array.isArray(listing) ? listing : []).map((x) => String(x.name ?? "")).filter((n) => n.endsWith(".yml"));
  const human = new Map<string, string[]>();
  for (const [cls, limit] of Object.entries(MATOMO_CLASSES)) {
    const files = names.filter((n) => n.replace(/(-\d+)?\.yml$/, "") === cls).sort((a, b) => a.localeCompare(b, "en", { numeric: true })).slice(0, limit);
    const lists = await Promise.all(files.map(async (f) => yamlUserAgents(await download(MATOMO_RAW + f))));
    human.set(cls, uniq(lists.flat()));
  }
  const bots = uniq(yamlUserAgents(await download(MATOMO_RAW + "bots.yml")));
  return { human, bots };
}

async function main(): Promise<number> {
  const [crawlerJson, desktop, mobile, matomo] = await Promise.all([
    downloadJson(SOURCES.crawlers), downloadJson(SOURCES.desktop), downloadJson(SOURCES.mobile), loadMatomo(),
  ]);
  const entries = (Array.isArray(crawlerJson) ? crawlerJson : []) as { instances?: unknown }[];
  const dev = new Set<string>();
  const hold = new Set<string>();
  entries.forEach((e, i) => asUaList(e.instances).forEach((u) => (i % 2 === 0 ? dev : hold).add(u)));
  const humans = uniq([...asUaList(desktop), ...asUaList(mobile)]);
  const all = new Set([...dev, ...hold]);

  if (all.size < 1000 || humans.length < 50 || matomo.bots.length < 500 || (matomo.human.get("tv")?.length ?? 0) < 500) {
    console.log(`FAIL — corpus quá nhỏ (crawler ${all.size}, người ${humans.length}, matomo bot ${matomo.bots.length}, matomo tv ${matomo.human.get("tv")?.length ?? 0}): nguồn có thể đã đổi định dạng`);
    return 1;
  }

  let bad = 0;
  let total = 0;
  const gate = (name: string, value: number, limit: number, dir: "min" | "max") => {
    const ok = dir === "min" ? value >= limit : value <= limit;
    total++;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(66)} ${value.toFixed(2)}% (cần ${dir === "min" ? "≥" : "≤"} ${limit}%)`);
  };
  const recall = (set: Iterable<string>, fn: (u: string) => boolean) => {
    const a = [...set];
    return pct(a.filter(fn).length, a.length);
  };

  console.log(`crawler-user-agents: ${all.size} UA (dev ${dev.size}, holdout ${hold.size}) | microlink người: ${humans.length}`);
  console.log(`Matomo: ${matomo.bots.length} UA bot | người theo loại: ${[...matomo.human].map(([c, l]) => `${c} ${l.length}`).join(", ")}\n`);

  console.log("— BOT: botReason có bắt không (mục tiêu của dự án: > 95%) —");
  gate(`crawler-user-agents DEV (${dev.size})`, recall(dev, isBlocked), 95, "min");
  gate(`crawler-user-agents HOLDOUT (${hold.size})`, recall(hold, isBlocked), 95, "min");
  gate(`crawler-user-agents tất cả (${all.size})`, recall(all, isBlocked), 95, "min");
  gate(`Matomo bots.yml (${matomo.bots.length})`, recall(matomo.bots, isBlocked), 95, "min");
  gate(`điểm rủi ro ≥ 30 — crawler-user-agents, header tối giản`, recall(all, (u) => botScore(u) >= 30), 99, "min");

  console.log("\n— NGƯỜI: có bị chặn nhầm không (chặn nhầm = người nhận Social Card, KHÔNG được redirect) —");
  gate(`microlink: bị botReason chặn (${humans.length} UA hiện đại)`, 100 - recall(humans, (u) => !isBlocked(u)), 0, "max");
  gate(`microlink: điểm ≥ 30 (kèm header trình duyệt)`, recall(humans, (u) => humanScore(u) >= 30), 0, "max");

  // Chặn nhầm theo loại thiết bị Matomo, sau khi loại stack HTTP gốc của ứng dụng.
  const limits: Record<string, number> = { tv: 3, feature_phone: 2, console: 2, car_browser: 2, portable_media_player: 5, tablet: 0.5, phablet: 5, smartphone: 0.5 };
  let allHuman = 0;
  let allBlockedReal = 0;
  for (const [cls, list] of matomo.human) {
    const blocked = list.filter((u) => isBlocked(u) && !NATIVE_STACK.test(u));
    allHuman += list.length;
    allBlockedReal += blocked.length;
    if (cls in limits) gate(`Matomo ${cls}: chặn nhầm sau khi loại stack ứng dụng (${list.length} UA)`, pct(blocked.length, list.length), limits[cls], "max");
    if (process.env.SHOW_BLOCKED === cls) for (const u of blocked.slice(0, 30)) console.log(`      ${u.slice(0, 130)}`);
  }
  gate(`Matomo TẤT CẢ loại: chặn nhầm sau khi loại stack ứng dụng (${allHuman} UA)`, pct(allBlockedReal, allHuman), 1.5, "max");

  console.log(bad === 0 ? `\nPASS — ${total}/${total} tiêu chí trên corpus bên thứ ba` : `\nFAIL — ${bad}/${total} tiêu chí không đạt`);
  return bad;
}

main()
  .then((bad) => process.exit(bad === 0 ? 0 : 1))
  .catch((err) => {
    console.error(`FAIL — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
