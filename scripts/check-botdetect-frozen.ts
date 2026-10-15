/**
 * Xác minh mã nguồn `lib/botdetect` (+ regex UA ở `lib/tracking/ua.ts`) còn NGUYÊN như bản đã được
 * review độc lập — bằng SHA-256, không bằng lời.
 *
 *   npm run check:botdetect-frozen              # so với src/lib/botdetect/FROZEN.sha256
 *   npm run check:botdetect-frozen -- --write   # ghim lại bản HIỆN TẠI (chỉ làm sau một vòng review mới)
 *
 * Vì sao cần: "không có thay đổi sau vòng review N" phải kiểm được bằng một lệnh, độc lập với việc đã commit hay
 * chưa (một commit có thể gộp mã đã review lẫn chưa review) — và mtime vô nghĩa vì mutation test khôi phục file
 * bằng `cp`. Manifest biến câu đó thành lệnh chạy được. Nó KHÔNG nằm trong `check:botdetect-all` có chủ ý: sửa mã hợp lệ về
 * sau phải đi qua review rồi mới `--write`, và gate này đỏ chính là tín hiệu "bản này chưa được review".
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const BOTDETECT = join("src", "lib", "botdetect");
const MANIFEST = join(ROOT, BOTDETECT, "FROZEN.sha256");

/** Mã nguồn không phải test, + file chứa regex UA dùng chung. Test không ghim: chúng được phép đổi. */
function sourceFiles(): string[] {
  const own = readdirSync(join(ROOT, BOTDETECT))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .sort()
    .map((f) => join(BOTDETECT, f).replace(/\\/g, "/"));
  return [...own, "src/lib/tracking/ua.ts"];
}

function digest(file: string): string {
  // Chuẩn hoá CRLF → LF để cùng một nội dung ra cùng một hash trên Windows lẫn Linux.
  const text = readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text).digest("hex");
}

function current(): Map<string, string> {
  return new Map(sourceFiles().map((f) => [f, digest(f)]));
}

if (process.argv.includes("--write")) {
  const lines = [...current()].map(([f, h]) => `${h}  ${f}`);
  writeFileSync(MANIFEST, lines.join("\n") + "\n", "utf8");
  console.log(`Đã ghim ${lines.length} file vào ${BOTDETECT}/FROZEN.sha256`);
  process.exit(0);
}

let pinned: Map<string, string>;
try {
  pinned = new Map(
    readFileSync(MANIFEST, "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => {
        const [hash, ...rest] = l.split(/\s+/);
        return [rest.join(" "), hash] as [string, string];
      }),
  );
} catch {
  console.error("FAIL — chưa có FROZEN.sha256 (chạy với --write sau một vòng review)");
  process.exit(1);
}

const now = current();
const problems: string[] = [];
for (const [file, hash] of now) {
  const want = pinned.get(file);
  if (want === undefined) problems.push(`MỚI   ${file} (chưa được review/ghim)`);
  else if (want !== hash) problems.push(`ĐỔI   ${file}`);
}
for (const file of pinned.keys()) if (!now.has(file)) problems.push(`MẤT   ${file}`);

for (const [file, hash] of now) console.log(`${pinned.get(file) === hash ? "ok  " : "DIFF"} ${hash.slice(0, 12)}  ${file}`);
console.log(
  problems.length === 0
    ? `\nPASS — ${now.size} file khớp bản đã review`
    : `\nFAIL — ${problems.length} khác biệt so với bản đã review:\n  ${problems.join("\n  ")}`,
);
process.exit(problems.length === 0 ? 0 : 1);
