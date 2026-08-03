import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Token mờ cho /go/[token].
 *
 * Không phải ObjectId, không phải slug: link công khai không được để lộ id nội
 * bộ hay cho phép đoán/enumerate campaign khác. 12 ký tự trên alphabet 56 =
 * ~69 bit, thừa đủ.
 *
 * Bỏ các ký tự dễ nhìn lẫn (l, 1, I, 0, O) vì token hay bị đọc/gõ tay.
 */
export function generateToken(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;

/** Bỏ dấu tiếng Việt: NFD tách dấu ra thành combining marks U+0300–U+036F. */
function stripDiacritics(input: string): string {
  return Array.from(input.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_START || code > COMBINING_END;
    })
    .join("");
}

export function slugify(input: string): string {
  return stripDiacritics(input)
    .replace(/[đĐ]/g, "d") // đ / Đ không có dạng tổ hợp NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
