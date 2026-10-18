import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Kiểm tên miền có thật sự dẫn tới ỨNG DỤNG NÀY không: GET `https://<host>/api/health` và đòi
 * `{"app":"trafficiq"}` trong JSON trả về.
 *
 * Vì sao kiểm bằng cách gọi thật chứ không soi bản ghi DNS: giá trị DNS đúng phụ thuộc nơi deploy (Vercel dùng
 * A/CNAME riêng theo dự án và đổi theo thời gian; VM thì là IP của máy) — mã cứng một giá trị là sai ở chỗ
 * khác. "Mở link ra có tới app không" là phép thử duy nhất không cần biết nơi deploy, và cũng là thứ người
 * nhận link sẽ gặp.
 *
 * Đây là request ra ngoài do owner kích hoạt, tới hostname owner nhập → rủi ro SSRF. Hạn chế:
 *   - chỉ `https`, cổng mặc định, chỉ đường dẫn cố định `/api/health` (owner không chọn được đường dẫn);
 *   - từ chối nếu BẤT KỲ địa chỉ nào hostname phân giải ra là địa chỉ riêng/nội bộ (`isPrivateAddress`);
 *   - không theo redirect (`redirect: "manual"`), timeout 6s, chỉ đọc tối đa 4KB;
 *   - giao diện chỉ nhận lại một lý do ngắn, KHÔNG bao giờ nhận lại nội dung phản hồi.
 * Chưa chặn được DNS rebinding giữa lúc phân giải và lúc gọi; chấp nhận vì chỉ owner gọi được, phản hồi không
 * được trả lại, và phải khớp đúng JSON đánh dấu mới tính là thành công.
 */

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function isPrivateAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local + metadata cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) || // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
      (a === 198 && (b === 18 || b === 19)) || // benchmark
      a >= 224 // multicast + reserved + broadcast
    );
  }
  if (v === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    // ::ffff:7f00:1 (dạng hex của IPv4-mapped)
    const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // fc00::/7 unique-local
      /^fe[89ab]/.test(lower) || // fe80::/10 link-local
      /^ff/.test(lower) // multicast
    );
  }
  return true; // không phải địa chỉ IP hợp lệ → coi như không an toàn
}

export interface VerifyDeps {
  resolve: (host: string) => Promise<string[]>;
  fetchJson: (url: string) => Promise<{ status: number; body: string }>;
}

const realDeps: VerifyDeps = {
  async resolve(host) {
    return (await lookup(host, { all: true })).map((r) => r.address);
  },
  async fetchJson(url) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json", "user-agent": "TrafficIQ-domain-check" },
      cache: "no-store",
    });
    const reader = res.body?.getReader();
    let body = "";
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      while (received < 4096) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        body += decoder.decode(value, { stream: true });
      }
      void reader.cancel();
    }
    return { status: res.status, body: body.slice(0, 4096) };
  },
};

export async function verifyDomainReachable(host: string, deps: VerifyDeps = realDeps): Promise<VerifyResult> {
  let addresses: string[];
  try {
    addresses = await deps.resolve(host);
  } catch {
    return { ok: false, reason: "Tên miền chưa phân giải được — DNS chưa trỏ hoặc chưa lan truyền (có thể mất vài phút đến vài giờ)." };
  }
  if (addresses.length === 0) return { ok: false, reason: "Tên miền không có bản ghi địa chỉ nào." };
  if (addresses.some(isPrivateAddress)) {
    return { ok: false, reason: "Tên miền đang trỏ tới địa chỉ nội bộ/riêng, không thể là máy chủ công khai của ứng dụng." };
  }

  let response: { status: number; body: string };
  try {
    response = await deps.fetchJson(`https://${host}/api/health`);
  } catch {
    return {
      ok: false,
      reason: "Không mở được https://" + host + " (quá thời gian hoặc lỗi chứng chỉ). Kiểm tra đã thêm tên miền vào dự án Vercel và chứng chỉ đã cấp xong.",
    };
  }
  if (response.status >= 300 && response.status < 400) {
    return { ok: false, reason: "Tên miền đang chuyển hướng sang nơi khác (ví dụ www ↔ không www). Thêm đúng tên miền sẽ phục vụ ứng dụng, không phải bản chuyển hướng." };
  }
  try {
    const json = JSON.parse(response.body) as { app?: unknown };
    if (json.app === "trafficiq") return { ok: true };
  } catch {
    // rơi xuống thông báo chung bên dưới
  }
  return {
    ok: false,
    reason: `Tên miền mở được (HTTP ${response.status}) nhưng không phải ứng dụng này — có thể nó đang trỏ tới dự án/máy chủ khác.`,
  };
}
