import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proof-of-Work không trạng thái (kiểu hashcash).
 *
 * Máy chủ phát một token đã ký HMAC; client phải tìm `nonce` sao cho
 * sha256(token + ":" + nonce) có ít nhất `difficulty` bit 0 ở đầu. Chi phí
 * ~2^difficulty lần băm: không đáng kể với một người bấm một lần, nhưng nhân
 * lên theo số request của một con bot xả hàng nghìn lượt.
 *
 * Nó là một cái THUẾ, không phải CAPTCHA: không phân biệt người với máy, chỉ làm
 * automation ở quy mô lớn tốn kém. Kẻ có GPU hoặc farm vẫn giải được.
 */

export interface ChallengeOptions {
  /** HMAC secret — dùng secret riêng, đừng tái dùng IP_HASH_SALT. */
  secret: string;
  now?: () => number;
}

export interface IssueOptions extends ChallengeOptions {
  /** Gắn token với một chủ thể (ipHash) để không đem giải hộ rồi dùng chỗ khác. */
  subject: string;
  /** Bit 0 đầu cần có. 16 ≈ 65k lần băm ≈ chưa tới 1s trong browser. */
  difficultyBits?: number;
  ttlMs?: number;
}

export interface Challenge {
  token: string;
  difficultyBits: number;
  expiresAt: number;
}

export type ChallengeFailure =
  | "malformed"
  | "bad-signature"
  | "expired"
  | "wrong-subject"
  | "insufficient-work"
  | "replayed";

export type VerifyResult = { ok: true } | { ok: false; reason: ChallengeFailure };

/** Chống dùng lại một lời giải trong thời hạn token. Per-instance như rate limit. */
export interface ReplayGuard {
  /**
   * Trả true nếu `id` đã thấy; nếu chưa thì đánh dấu. `subject` (nếu có) bị giới hạn số id
   * còn sống: một chủ thể không được chiếm hết bộ nhớ chung và khoá mọi người khác.
   */
  seen(id: string, expiresAt: number, subject?: string): boolean;
}

/** Trần tuyệt đối; hạn mức thực còn nhỏ hơn khi bảng nhỏ (xem createReplayGuard). */
const MAX_LIVE_IDS_PER_SUBJECT = 100;

export function createReplayGuard(now: () => number = Date.now, maxEntries = 10_000): ReplayGuard {
  const used = new Map<string, number>();
  const bySubject = new Map<string, Map<string, number>>();
  // Một chủ thể không được chiếm quá 1/10 bảng chung, để nó không thể khoá người khác.
  const perSubject = Math.min(MAX_LIVE_IDS_PER_SUBJECT, Math.max(1, Math.floor(maxEntries / 10)));
  return {
    seen(id, expiresAt, subject) {
      const t = now();
      if (subject !== undefined) {
        let mine = bySubject.get(subject);
        if (!mine) bySubject.set(subject, (mine = new Map()));
        for (const [k, exp] of mine) if (exp <= t) mine.delete(k);
        // Quá hạn mức của CHÍNH chủ thể này: từ chối chỉ chủ thể đó, không chạm tới người khác.
        if (!mine.has(id) && mine.size >= perSubject) return true;
        mine.set(id, expiresAt);
        if (bySubject.size > maxEntries) bySubject.delete(bySubject.keys().next().value as string);
      }
      const prior = used.get(id);
      if (prior !== undefined && prior > t) return true;
      if (used.size >= maxEntries) {
        for (const [key, exp] of used) if (exp <= t) used.delete(key);
        // Còn đầy toàn id CHƯA hết hạn: đá id cũ nhất ra là mở lại replay cho lời giải
        // đó, nên thà từ chối lời giải mới (fail-closed). Kẻ tấn công phải trả 10k lời
        // giải PoW thật trong một TTL mới đẩy được tới đây.
        if (used.size >= maxEntries) return true;
      }
      used.set(id, expiresAt);
      return false;
    },
  };
}

interface Payload {
  s: string; // subject
  e: number; // expiresAt (ms)
  d: number; // difficulty bits
  r: string; // random id
}

/** Token cho subject là ipHash (64 hex) dài ~200 ký tự; 1024 là rất rộng. */
const MAX_TOKEN_LENGTH = 1024;
/** Secret ngắn là secret đoán được → token giả được. */
const MIN_SECRET_LENGTH = 16;
/** 2^32 lần băm đã là hàng phút trong browser; trên nữa là không giải nổi. */
const MAX_DIFFICULTY_BITS = 32;

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest();

export function issueChallenge(options: IssueOptions): Challenge {
  const { secret, subject, difficultyBits = 16, ttlMs = 60_000, now = Date.now } = options;
  // Tham số sai phải NÉM ngay ở phía phát — lỗi cấu hình ở đây từng âm thầm cho ra
  // token mà mọi nonce đều qua (độ khó NaN → null) hoặc không ai giải được (> 256).
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new RangeError(`secret phải là chuỗi ≥ ${MIN_SECRET_LENGTH} ký tự`);
  }
  if (typeof subject !== "string" || subject.length === 0 || subject.length > 256) {
    throw new RangeError("subject phải là chuỗi 1–256 ký tự");
  }
  if (!Number.isInteger(difficultyBits) || difficultyBits < 1 || difficultyBits > MAX_DIFFICULTY_BITS) {
    throw new RangeError(`difficultyBits phải là số nguyên 1–${MAX_DIFFICULTY_BITS}`);
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 3_600_000) {
    throw new RangeError("ttlMs phải trong (0, 1 giờ]");
  }
  const expiresAt = now() + ttlMs;
  const payload: Payload = { s: subject, e: expiresAt, d: difficultyBits, r: randomBytes(12).toString("base64url") };
  const body = b64(JSON.stringify(payload));
  const token = `${body}.${b64(sign(secret, body))}`;
  // Subject nhiều byte (Unicode, ký tự điều khiển) nở ra khi JSON + base64: token mà verifyChallenge sẽ từ chối là lỗi ở phía phát.
  if (token.length > MAX_TOKEN_LENGTH) throw new RangeError(`subject quá dài: token ${token.length} > ${MAX_TOKEN_LENGTH} ký tự`);
  return { token, difficultyBits, expiresAt };
}

export function leadingZeroBits(digest: Buffer): number {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

const work = (token: string, nonce: string) =>
  createHash("sha256").update(`${token}:${nonce}`).digest();

export function verifyChallenge(
  token: string,
  nonce: string,
  options: ChallengeOptions & { subject: string; replay?: ReplayGuard },
): VerifyResult {
  const { secret, subject, replay, now = Date.now } = options;
  // Cấu hình sai phải ồn ào: secret rỗng ở endpoint chỉ-verify (biến môi trường quên đặt) nghĩa
  // là bất kỳ ai cũng tự ký được token hợp lệ.
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new RangeError(`secret phải là chuỗi ≥ ${MIN_SECRET_LENGTH} ký tự`);
  }

  // Chặn kích thước TRƯỚC khi tính HMAC/băm: token do client gửi lên, không giới
  // hạn thì mỗi request rác bắt server băm một chuỗi dài tuỳ ý.
  if (typeof token !== "string" || typeof nonce !== "string") return { ok: false, reason: "malformed" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || nonce.length === 0 || nonce.length > 64) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);

  const sigPart = token.slice(dot + 1);
  const given = Buffer.from(sigPart, "base64url");
  // Buffer.from(..., "base64url") khoan dung: bỏ qua '=', xuống dòng, ký tự lạ và bit
  // thừa ở ký tự cuối, nên nhiều chuỗi khác nhau cho cùng một chữ ký. Bắt đúng một
  // dạng chuẩn tắc để token không có "bí danh".
  if (b64(given) !== sigPart || b64(Buffer.from(body, "base64url")) !== body) {
    return { ok: false, reason: "malformed" };
  }
  const expected = sign(secret, body);
  // timingSafeEqual ném lỗi khi độ dài khác nhau — kiểm trước.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.e <= now()) return { ok: false, reason: "expired" };
  if (payload.s !== subject) return { ok: false, reason: "wrong-subject" };
  if (leadingZeroBits(work(token, nonce)) < payload.d) return { ok: false, reason: "insufficient-work" };
  // Kiểm replay CUỐI CÙNG: lời giải sai không được "đốt" id của token thật.
  if (replay?.seen(payload.r, payload.e, payload.s)) return { ok: false, reason: "replayed" };

  return { ok: true };
}

/** Giải ở phía Node — dùng trong test và script; browser dùng `CHALLENGE_CLIENT_SOLVER`. */
export function solveChallenge(token: string, difficultyBits: number): string {
  for (let n = 0; ; n++) {
    const nonce = n.toString(36);
    if (leadingZeroBits(work(token, nonce)) >= difficultyBits) return nonce;
  }
}

/**
 * Bộ giải cho browser (WebCrypto). Trả Promise<string> nonce. `difficulty` đọc
 * từ payload không cần tin: server tự kiểm lại `d` trong token đã ký.
 */
export const CHALLENGE_CLIENT_SOLVER = `async function solvePow(token, bits) {
  var enc = new TextEncoder();
  for (var n = 0; ; n++) {
    var nonce = n.toString(36);
    var h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token + ":" + nonce)));
    var zeros = 0;
    for (var i = 0; i < h.length; i++) {
      if (h[i] === 0) { zeros += 8; continue; }
      zeros += Math.clz32(h[i]) - 24;
      break;
    }
    if (zeros >= bits) return nonce;
  }
}`;
