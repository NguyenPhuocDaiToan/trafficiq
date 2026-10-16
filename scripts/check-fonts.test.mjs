import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkSource, checkStack, splitStack } from "./check-fonts.mjs";

const AR = new Set(["Noto Sans Arabic", "Noto Naskh Arabic"]);

describe("splitStack", () => {
  it("tôn trọng nháy và ngoặc", () => {
    assert.deepEqual(splitStack('"Noto Sans Arabic", var(--font-be-vietnam-pro), system-ui, sans-serif'), [
      '"Noto Sans Arabic"',
      "var(--font-be-vietnam-pro)",
      "system-ui",
      "sans-serif",
    ]);
    assert.deepEqual(splitStack('"A, B", var(--x, fallback), serif'), ['"A, B"', "var(--x, fallback)", "serif"]);
  });
});

describe("checkStack — các cấu hình sai đã đo thấy làm hỏng chữ", () => {
  it("đạt: font Ả Rập → font next/font → từ khoá chung ở cuối", () => {
    assert.deepEqual(checkStack("--font-sans", '"Noto Sans Arabic", var(--font-be-vietnam-pro), system-ui, sans-serif', AR), []);
    assert.deepEqual(checkStack("--font-display", '"Noto Naskh Arabic", var(--font-fraunces), Georgia, serif', AR), []);
    assert.deepEqual(checkStack("--font-mono", "var(--font-jetbrains-mono), ui-monospace, monospace", AR), []);
  });

  it("LỖI #1: font Ả Rập đứng SAU font next/font → Arial dự phòng chiếm chữ Ả Rập", () => {
    const errs = checkStack("--font-sans", 'var(--font-be-vietnam-pro), "Noto Sans Arabic", system-ui, sans-serif', AR);
    assert.equal(errs.length, 1);
    assert.match(errs[0], /Arial/);
  });

  it("LỖI #2: từ khoá chung nằm GIỮA danh sách → mọi thứ sau nó bị bỏ qua (chữ Ả Rập rơi sang Segoe UI)", () => {
    const errs = checkStack("--font-sans", '"Be Vietnam Pro", sans-serif, "Noto Sans Arabic", system-ui', AR);
    assert.ok(errs.some((e) => /SAU từ khoá chung/.test(e)), errs.join("|"));
  });

  it("LỖI #3: var() đứng sau từ khoá chung", () => {
    const errs = checkStack("--font-sans", "system-ui, sans-serif, var(--font-be-vietnam-pro)", AR);
    assert.ok(errs.some((e) => /SAU từ khoá chung/.test(e)));
  });

  it("LỖI #4: thiếu từ khoá chung ở cuối", () => {
    const errs = checkStack("--font-sans", '"Noto Sans Arabic", var(--font-be-vietnam-pro)', AR);
    assert.ok(errs.some((e) => /thiếu từ khoá chung/.test(e)));
  });

  it("tên font hệ thống (Georgia) đứng trước từ khoá chung là được", () => {
    assert.deepEqual(checkStack("--font-display", "var(--font-fraunces), Georgia, serif", AR), []);
  });
});

describe("checkSource — luật dùng font trong .tsx", () => {
  const pub = "src/components/site.tsx";
  const admin = "src/app/admin/campaigns/page.tsx";
  const cls = (c) => `<h1 className="${c}">x</h1>`;

  it("đạt: font-display + font-bold ở bề mặt công khai", () => {
    assert.deepEqual(checkSource(pub, cls("font-display text-4xl font-bold")), []);
  });

  it("font-display ngoài bề mặt công khai (admin) bị chặn", () => {
    const errs = checkSource(admin, cls("font-display font-bold"));
    assert.ok(errs.some((e) => /chỉ dành cho bề mặt công khai/.test(e)));
  });

  it("font-display thiếu font-bold, hoặc đi với semibold/italic bị chặn", () => {
    assert.ok(checkSource(pub, cls("font-display text-2xl")).some((e) => /font-bold/.test(e)));
    assert.ok(checkSource(pub, cls("font-display font-bold font-semibold")).some((e) => /font-semibold/.test(e)));
    assert.ok(checkSource(pub, cls("font-display font-bold italic")).some((e) => /italic/.test(e)));
    assert.ok(checkSource(pub, cls("font-display font-bold font-medium")).some((e) => /font-medium/.test(e)));
  });

  it("nhận cả className dạng template literal", () => {
    assert.ok(checkSource(pub, "<h1 className={`font-display ${x}`}>a</h1>").some((e) => /font-bold/.test(e)));
  });

  it("độ đậm chưa nạp bị chặn", () => {
    for (const w of ["thin", "extralight", "light", "extrabold", "black"]) {
      assert.ok(checkSource(pub, cls(`font-${w}`)).length > 0, w);
    }
    assert.deepEqual(checkSource(pub, cls("font-medium font-semibold font-bold")), []);
  });

  it("hard-code font-family bị chặn", () => {
    assert.ok(checkSource(pub, '<text fontFamily="sans-serif">1</text>').length > 0);
    assert.ok(checkSource(pub, "const s = { fontFamily: 'Arial' }").length > 0);
  });

  it("font-mono bọc chữ tiếng Việt có dấu bị chặn (ca thật: khung xem trước social card)", () => {
    const bad = '<span className="text-[10px] font-mono">Đã chia sẻ liên kết • Preview Social Card</span>';
    assert.ok(checkSource(admin, bad).some((e) => /mono chỉ cho số/.test(e)));
  });

  it("font-mono bọc số/URL/code là được; chữ Việt NẰM NGOÀI thẻ mono không tính", () => {
    assert.deepEqual(checkSource(admin, '<code className="font-mono text-xs">/c/{slug}</code>'), []);
    assert.deepEqual(checkSource(admin, '<span className="font-mono tabular-nums">{n}</span> phút đọc'), []);
    assert.deepEqual(checkSource(admin, '<td className="font-mono">12.480</td>'), []);
  });

  it("báo đúng số dòng", () => {
    const errs = checkSource(pub, 'a\nb\n<span fontFamily="x">1</span>');
    assert.match(errs[0], /site\.tsx:3:/);
  });
});
