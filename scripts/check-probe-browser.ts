/**
 * Chạy probe phía client (lib/botdetect) trong Chromium THẬT qua Chrome DevTools
 * Protocol — phần unit test không làm được vì chỉ có `window` giả.
 *
 *   npm run check:probe-browser
 *
 * Không thêm dependency: điều khiển trực tiếp bằng WebSocket có sẵn của Node và
 * dùng Chromium trong cache của Playwright (~/AppData/Local/ms-playwright hoặc
 * ~/.cache/ms-playwright). Đặt CHROME_PATH / CHROME_HEADLESS_SHELL_PATH để ghi đè.
 *
 * Giới hạn: không có phiên Chrome CÓ GIAO DIỆN do người điều khiển ở đây, nên
 * "baseline người thật" là headless thường + CDP-input, không phải một người.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { CLIENT_PROBE_SOURCE, telemetrySignals, type ClientTelemetry } from "../src/lib/botdetect/client-signals";
import { combineWeights } from "../src/lib/botdetect/signals";

function findBrowser(prefix: string, exe: string): string | undefined {
  for (const root of [join(homedir(), "AppData", "Local", "ms-playwright"), join(homedir(), ".cache", "ms-playwright")]) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith(prefix)).sort().reverse()) {
      for (const sub of readdirSync(join(root, dir))) {
        const p = join(root, dir, sub, exe);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const CHROME = process.env.CHROME_PATH ?? findBrowser("chromium-", "chrome.exe") ?? findBrowser("chromium-", "chrome");
const SHELL =
  process.env.CHROME_HEADLESS_SHELL_PATH ??
  findBrowser("chromium_headless_shell-", "chrome-headless-shell.exe") ??
  findBrowser("chromium_headless_shell-", "chrome-headless-shell");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  private id = 0;
  private pending = new Map<number, (v: { result?: unknown; error?: { message: string } }) => void>();
  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id && this.pending.has(m.id)) this.pending.get(m.id)!(m);
    });
  }
  static async connect(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise<void>((res, rej) => {
      ws.addEventListener("open", () => res());
      ws.addEventListener("error", () => rej(new Error("ws error")));
    });
    return new Cdp(ws);
  }
  send<T = unknown>(method: string, params: object = {}): Promise<T> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) =>
      this.pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result as T))),
    );
  }
  async eval<T>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value: T }; exceptionDetails?: unknown }>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
    return r.result.value;
  }
  close() {
    this.ws.close();
  }
}

interface Scenario {
  name: string;
  exe: string | undefined;
  args: string[];
  /** Hành động sau khi probe đã cài. */
  act?: (cdp: Cdp) => Promise<void>;
  /** Điều phải đúng — nếu không là FAIL. */
  expect: (t: ClientTelemetry, ids: string[], score: number) => string | null;
}

const PAGE = "data:text/html,<title>t</title><button id=b style='position:fixed;left:20px;top:20px;width:120px;height:40px'>go</button>";

const realClick = async (cdp: Cdp) => {
  for (const [type, extra] of [
    ["mouseMoved", {}],
    ["mousePressed", { button: "left", clickCount: 1 }],
    ["mouseReleased", { button: "left", clickCount: 1 }],
  ] as const) {
    await cdp.send("Input.dispatchMouseEvent", { type, x: 60, y: 40, ...extra });
  }
};

const SCENARIOS: Scenario[] = [
  {
    name: "Chrome headless mới, không flag automation, click CDP (input tin cậy)",
    exe: CHROME,
    args: ["--headless=new"],
    act: realClick,
    expect: (t, ids) =>
      t.ut === 0 && t.ev > 0 && !ids.includes("untrusted-events") ? null : `kỳ vọng sự kiện CDP là tin cậy, nhận ut=${t.ut} ev=${t.ev}`,
  },
  {
    name: "Chrome headless mới + --enable-automation (như Playwright/Puppeteer/Selenium)",
    exe: CHROME,
    args: ["--headless=new", "--enable-automation"],
    act: realClick,
    expect: (t, ids) => (t.wd && ids.includes("webdriver-flag") ? null : `kỳ vọng navigator.webdriver=true, nhận wd=${t.wd}`),
  },
  {
    name: "Chrome headless mới, script gọi element.click() (sự kiện tổng hợp)",
    exe: CHROME,
    args: ["--headless=new"],
    act: async (cdp) => {
      await cdp.eval("document.getElementById('b').click()");
    },
    expect: (t, ids) => (t.ut > 0 && ids.includes("untrusted-events") ? null : `kỳ vọng ut>0, nhận ut=${t.ut}`),
  },
  {
    name: "Chrome headless mới, không tương tác gì và đọc probe ngay",
    exe: CHROME,
    args: ["--headless=new"],
    expect: (t, ids) => (t.ev === 0 && ids.includes("no-interaction") ? null : `kỳ vọng no-interaction, nhận ev=${t.ev}`),
  },
  {
    name: "chrome-headless-shell (headless CŨ, UA HeadlessChrome)",
    exe: SHELL,
    args: [],
    act: realClick,
    expect: (t) => (/HeadlessChrome/.test(t.ua) ? null : `kỳ vọng UA chứa HeadlessChrome, nhận ${t.ua}`),
  },
];

async function runScenario(s: Scenario, port: number): Promise<{ t: ClientTelemetry; ids: string[]; score: number }> {
  if (!s.exe) throw new Error("không tìm thấy Chromium (đặt CHROME_PATH / CHROME_HEADLESS_SHELL_PATH)");
  const profile = mkdtempSync(join(tmpdir(), "tiq-probe-"));
  const proc: ChildProcess = spawn(
    s.exe,
    [...s.args, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-sandbox", "--disable-gpu", "about:blank"],
    { stdio: "ignore" },
  );
  try {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
        target = list.find((x) => x.type === "page");
      } catch {
        /* chưa lên */
      }
    }
    if (!target) throw new Error("trình duyệt không mở cổng CDP");

    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: PAGE });
    await sleep(500);
    await cdp.eval(CLIENT_PROBE_SOURCE);
    if (s.act) {
      await sleep(400);
      await s.act(cdp);
    }
    await sleep(150);
    const t = await cdp.eval<ClientTelemetry>("window.__tiqProbe()");
    cdp.close();

    const signals = telemetrySignals(t, t.ua);
    return { t, ids: signals.map((x) => x.id), score: combineWeights(signals) };
  } finally {
    proc.kill();
  }
}

async function main(): Promise<number> {
  let bad = 0;
  let port = 9400 + Math.floor(Math.random() * 400);
  for (const s of SCENARIOS) {
    try {
      const { t, ids, score } = await runScenario(s, port++);
      const err = s.expect(t, ids, score);
      if (err) bad++;
      console.log(`${err ? "FAIL" : "ok  "} ${s.name}`);
      console.log(`       score=${score} signals=[${ids.join(", ")}] wd=${t.wd} ev=${t.ev} ut=${t.ut} win=${t.ow}x${t.oh}/${t.iw}x${t.ih} screen=${t.sw}x${t.sh} pl=${t.pl} lg=${t.lg} ch=${t.ch}`);
      if (err) console.log(`       → ${err}`);
    } catch (e) {
      bad++;
      console.log(`FAIL ${s.name}\n       → ${(e as Error).message}`);
    }
  }
  console.log(bad === 0 ? `\nPASS — ${SCENARIOS.length}/${SCENARIOS.length}` : `\nFAIL — ${bad}/${SCENARIOS.length}`);
  return bad;
}

main().then((bad) => process.exit(bad === 0 ? 0 : 1));
