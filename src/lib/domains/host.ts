/**
 * Chuẩn hoá và kiểm tên miền do owner nhập. Thuần hàm — không DNS, không DB — để test được và dùng chung
 * giữa action (ghi) và `links.ts` (đọc).
 *
 * Đầu ra là HOSTNAME trần, chữ thường, punycode nếu có chữ có dấu: không scheme, không cổng, không đường dẫn.
 * Cố ý từ chối thay vì "sửa hộ" những thứ đáng ngờ (cổng, user@, IPv6, IP trần): tên miền này sẽ được ghép
 * vào link đem đi chạy traffic, nên một chuỗi lạ lọt vào đây là một link sai được đăng đi khắp nơi.
 */

const RESERVED_TLDS = new Set([
  "localhost",
  "local",
  "localdomain",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "test",
  "invalid",
  "example",
  "onion",
]);

export type HostResult = { ok: true; host: string } | { ok: false; error: string };

export function normalizeHost(input: string): HostResult {
  let h = input.trim().toLowerCase();
  if (h.length === 0) return { ok: false, error: "Chưa nhập tên miền." };
  if (h.length > 600) return { ok: false, error: "Tên miền quá dài." };

  // Cho phép dán nguyên URL: bỏ scheme, rồi cắt từ dấu / ? # đầu tiên.
  h = h.replace(/^https?:\/\//, "");
  h = h.split(/[/?#]/, 1)[0] ?? "";

  if (/[\s@]/.test(h)) return { ok: false, error: "Tên miền không được chứa khoảng trắng hoặc ký tự @." };
  if (h.includes(":")) return { ok: false, error: "Không nhập cổng hoặc địa chỉ IPv6 — chỉ tên miền (vd. go.example.com)." };
  if (h.endsWith(".")) h = h.slice(0, -1);

  // Chữ có dấu / IDN → punycode qua parser URL của chuẩn WHATWG.
  if (/[^\x00-\x7f]/.test(h)) {
    try {
      h = new URL(`http://${h}`).hostname;
    } catch {
      return { ok: false, error: "Tên miền không hợp lệ." };
    }
  }

  if (h.length > 253) return { ok: false, error: "Tên miền quá dài (tối đa 253 ký tự)." };
  const labels = h.split(".");
  if (labels.length < 2) return { ok: false, error: "Tên miền phải có dạng ten.com (có ít nhất một dấu chấm)." };
  for (const label of labels) {
    if (!/^[a-z0-9-]{1,63}$/.test(label) || label.startsWith("-") || label.endsWith("-")) {
      return { ok: false, error: `Phần "${label}" của tên miền không hợp lệ (chỉ a-z, 0-9, dấu gạch ngang; tối đa 63 ký tự).` };
    }
  }

  const tld = labels[labels.length - 1];
  // TLD toàn chữ số = địa chỉ IPv4 (1.2.3.4) hoặc số thập phân (2130706433) — không phải tên miền.
  if (!/^[a-z]{2,63}$/.test(tld) && !tld.startsWith("xn--")) {
    return { ok: false, error: "Đuôi tên miền không hợp lệ. Không dùng địa chỉ IP." };
  }
  if (RESERVED_TLDS.has(tld)) return { ok: false, error: `Đuôi .${tld} là đuôi nội bộ/dành riêng, không dùng được trên internet.` };

  return { ok: true, host: h };
}
