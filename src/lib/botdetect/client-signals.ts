import type { Signal } from "./types";

/**
 * Lớp 3 — telemetry thu bằng JS ở trình duyệt.
 *
 * Đây là lớp DUY NHẤT thấy được thứ header không có (navigator.webdriver, cửa
 * sổ, sự kiện chuột/phím, isTrusted). Nhưng nó cũng là lớp dễ giả nhất: client
 * tự báo cáo, nên kẻ viết stealth plugin gửi đúng giá trị "người" là xong. Cách
 * dùng đúng: coi nó là TÍN HIỆU làm tăng chi phí cho đối thủ, không phải bằng
 * chứng; không bao giờ để một mình nó quyết định chặn người.
 *
 * Chưa có trang nào nhúng probe và chưa có endpoint nhận payload — module này
 * chỉ cung cấp phần chấm điểm + probe đã test. Nối vào trang là bước riêng.
 */
export interface ClientTelemetry {
  /** navigator.webdriver === true */
  wd: boolean;
  /** navigator.plugins.length */
  pl: number;
  /** navigator.languages.length */
  lg: number;
  /** window.outerWidth/outerHeight, innerWidth/innerHeight */
  ow: number;
  oh: number;
  iw: number;
  ih: number;
  /** screen.width/height */
  sw: number;
  sh: number;
  /** navigator.hardwareConcurrency (0 nếu không có) */
  hc: number;
  /** navigator.userAgent mà JS thấy */
  ua: string;
  /** !!window.chrome */
  ch: boolean;
  /** Số sự kiện người dùng (move/touch/key/scroll/click) trước khi gửi. */
  ev: number;
  /** Số sự kiện có isTrusted === false (dispatchEvent / element.click()). */
  ut: number;
  /** ms từ lúc trang tải tới lúc gửi payload. */
  dw: number;
}

const NUM_FIELDS = ["pl", "lg", "ow", "oh", "iw", "ih", "sw", "sh", "hc", "ev", "ut", "dw"] as const;
const MAX_UA_LENGTH = 512;

/**
 * Payload telemetry đến từ client nên là dữ liệu KHÔNG đáng tin: sai kiểu, NaN,
 * số khổng lồ, chuỗi vô hạn. Gọi hàm này trước `telemetrySignals()`. Trả `null`
 * nếu sai hình dạng — người gọi nên coi là "không có telemetry", không phải
 * "đáng ngờ": một payload hỏng không chứng minh gì về người gửi.
 */
export function parseTelemetry(input: unknown): ClientTelemetry | null {
  try {
    return parseTelemetryUnsafe(input);
  } catch {
    return null; // getter/Proxy độc ném lỗi — payload hỏng, không phải lỗi của ta
  }
}

function parseTelemetryUnsafe(input: unknown): ClientTelemetry | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const out: Partial<ClientTelemetry> = {};
  for (const key of NUM_FIELDS) {
    const v = raw[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9) return null;
    out[key] = v;
  }
  if (typeof raw.wd !== "boolean" || typeof raw.ch !== "boolean") return null;
  if (typeof raw.ua !== "string" || raw.ua.length > MAX_UA_LENGTH) return null;
  out.wd = raw.wd;
  out.ch = raw.ch;
  out.ua = raw.ua;
  return out as ClientTelemetry;
}

const MIN_DWELL_MS = 300;
const DEFAULT_HEADLESS_SCREENS = [
  [800, 600],
  [0, 0],
];

export function telemetrySignals(
  t: ClientTelemetry,
  headerUa: string | null,
): Signal[] {
  const signals: Signal[] = [];
  const chromeUa = /chrome\//i.test(headerUa ?? t.ua) && !/mobile/i.test(headerUa ?? t.ua);

  // Spec W3C: true khi trình duyệt đang bị điều khiển bởi automation.
  if (t.wd) signals.push({ id: "webdriver-flag", weight: 75 });

  // Sự kiện tổng hợp: người thật không tạo ra event có isTrusted = false.
  // Sự kiện tổng hợp đơn lẻ lẫn trong tương tác thật là extension/thư viện, không phải
  // automation — thứ phân biệt là có hay không sự kiện TIN CẬY đi cùng.
  if (t.ut > 0) {
    // Có ít nhất một sự kiện tin cậy (chạm/chuột thật) đi kèm 1–2 sự kiện tổng hợp: FastClick,
    // trình quản lý mật khẩu. Automation dùng element.click() thì KHÔNG có sự kiện thật nào.
    const mostlyReal = t.ut <= 2 && t.ev - t.ut >= 1;
    signals.push({ id: "untrusted-events", weight: mostlyReal ? 25 : 70, detail: `${t.ut}/${t.ev}` });
  }

  // JS thấy UA khác UA trong header → một trong hai đã bị sửa.
  if (headerUa !== null && t.ua && headerUa !== t.ua) {
    signals.push({ id: "ua-mismatch", weight: 45 });
  }

  // 20 chứ không 25: Android 4.x thật không có navigator.languages, và cộng thêm các tín
  // hiệu yếu khác (không hardwareConcurrency…) từng đẩy người dùng đó lên 31.
  if (t.lg === 0) signals.push({ id: "empty-languages", weight: 20 });

  // Headless cũ không có khung cửa sổ: outer* = 0 trong khi inner* > 0.
  if ((t.ow === 0 || t.oh === 0) && (t.iw > 0 || t.ih > 0)) {
    // Đo trong Chromium thật: cả headless mới và cũ đều báo 800x600, không phải 0
    // (scripts/check-probe-browser.ts). Giữ cho bản headless rất cũ, nhưng một
    // WebView báo outer = 0 là có thật nên không để nặng.
    signals.push({ id: "zero-window", weight: 15 });
  }

  if (DEFAULT_HEADLESS_SCREENS.some(([w, h]) => t.sw === w && t.sh === h)) {
    signals.push({ id: "default-screen", weight: 20 });
  }

  // Bấm trước khi người kịp đọc, và không có một sự kiện nào trước đó.
  if (t.ev === 0 && t.dw < MIN_DWELL_MS) {
    signals.push({ id: "no-interaction", weight: 35, detail: `${Math.round(t.dw)}ms` });
  }

  // Yếu có chủ đích — WebView Android có thể thiếu window.chrome / plugins.
  if (chromeUa && !t.ch) signals.push({ id: "no-chrome-object", weight: 12 });
  if (chromeUa && t.pl === 0) signals.push({ id: "no-plugins", weight: 8 });
  if (!t.hc) signals.push({ id: "no-hardware-concurrency", weight: 5 });

  return signals;
}

/**
 * Probe chạy ở trình duyệt, trả về `ClientTelemetry`. Viết thẳng bằng JS (không
 * phải hàm TS `.toString()`) để compiler không biến đổi nó — nó có test chạy
 * trong `vm` với stub `window`, xem botdetect.test.ts (chạy probe trong `vm`).
 *
 * Dùng: `const t = window.__tiqProbe()` ngay trước khi gửi/điều hướng.
 */
export const CLIENT_PROBE_SOURCE = `(function () {
  var start = performance.now();
  var events = 0, untrusted = 0;
  var names = ["mousemove", "touchstart", "keydown", "scroll", "click", "pointerdown"];
  names.forEach(function (n) {
    window.addEventListener(n, function (e) {
      events++;
      if (e.isTrusted === false) untrusted++;
    }, { passive: true, capture: true });
  });
  window.__tiqProbe = function () {
    var nav = window.navigator;
    return {
      wd: nav.webdriver === true,
      pl: nav.plugins ? nav.plugins.length : 0,
      lg: nav.languages ? nav.languages.length : 0,
      ow: window.outerWidth, oh: window.outerHeight,
      iw: window.innerWidth, ih: window.innerHeight,
      sw: window.screen.width, sh: window.screen.height,
      hc: nav.hardwareConcurrency || 0,
      ua: nav.userAgent,
      ch: !!window.chrome,
      ev: events, ut: untrusted,
      dw: performance.now() - start
    };
  };
})();`;
