import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  findLesson,
  GROUPS,
  LESSONS,
  lessonHref,
  lessonsForPage,
  QUICK_START,
  TOUR_PARAM,
} from "./lessons";
import { parseDone } from "./progress";

const ROOT = path.resolve(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

/** Mọi giá trị `data-tour="…"` hoặc prop `tour="…"` có thật trong các component/trang. */
function declaredTargets(): Set<string> {
  const found = new Set<string>();
  for (const file of walk(ROOT)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:data-tour|\btour)=["']([a-z0-9-]+)["']/g)) found.add(match[1]);
  }
  return found;
}

describe("dữ liệu bài học", () => {
  it("id duy nhất, đúng dạng dùng được trên URL", () => {
    const ids = LESSONS.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
  });

  it("mỗi bài có nhóm hợp lệ, trang admin hợp lệ và ít nhất một bước", () => {
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const lesson of LESSONS) {
      assert.ok(groups.has(lesson.group), `${lesson.id}: nhóm ${lesson.group}`);
      assert.match(lesson.page, /^\/admin\/[a-z0-9\-/]+$/, lesson.id);
      assert.ok(lesson.steps.length >= 1, lesson.id);
      assert.ok(lesson.minutes >= 1 && lesson.minutes <= 10, lesson.id);
    }
  });

  it("trang của mỗi bài là một route thật (có page.tsx)", () => {
    for (const lesson of LESSONS) {
      const file = path.join(ROOT, "app", ...lesson.page.split("/").filter(Boolean), "page.tsx");
      assert.ok(existsSync(file), `${lesson.id}: thiếu ${path.relative(process.cwd(), file)}`);
    }
  });

  it("mỗi nhóm đều có ít nhất một bài và trỏ tới trang có thật", () => {
    for (const group of GROUPS) {
      assert.ok(LESSONS.some((l) => l.group === group.id), `nhóm ${group.id} không có bài`);
      assert.ok(existsSync(path.join(ROOT, "app", ...group.page.split("/").filter(Boolean), "page.tsx")), group.page);
    }
  });

  it("`next` và lộ trình bắt đầu nhanh trỏ tới bài có thật, không tự trỏ về mình", () => {
    for (const lesson of LESSONS) {
      if (!lesson.next) continue;
      assert.ok(findLesson(lesson.next), `${lesson.id} → ${lesson.next}`);
      assert.notEqual(lesson.next, lesson.id);
    }
    for (const id of QUICK_START) assert.ok(findLesson(id), `lộ trình: ${id}`);
    assert.equal(new Set(QUICK_START).size, QUICK_START.length);
  });

  it("chuỗi `next` không tạo vòng lặp", () => {
    for (const lesson of LESSONS) {
      const seen = new Set<string>();
      for (let cur = lesson as typeof lesson | undefined; cur; cur = findLesson(cur.next)) {
        assert.ok(!seen.has(cur.id), `vòng lặp quanh ${cur.id}`);
        seen.add(cur.id);
      }
    }
  });

  it("nội dung bước đủ ngắn để vừa hộp thoại (tiêu đề ≤ 60, nội dung ≤ 320 ký tự)", () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        assert.ok(step.title.length <= 60, `${lesson.id}: tiêu đề dài ${step.title.length}: ${step.title}`);
        assert.ok(step.body.length <= 320, `${lesson.id}: nội dung dài ${step.body.length}: ${step.title}`);
        assert.ok(step.title.trim() && step.body.trim());
      }
    }
  });
});

describe("điểm chỉ (data-tour) khớp với giao diện thật", () => {
  it("MỌI target của MỌI bước có thật trong mã nguồn — đổi tên/xoá data-tour là test này đỏ", () => {
    const declared = declaredTargets();
    const missing: string[] = [];
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.target && !declared.has(step.target)) missing.push(`${lesson.id} → ${step.target}`);
      }
    }
    assert.deepEqual(missing, [], `thiếu data-tour ở trang: ${missing.join(", ")}`);
  });

  it("không bỏ sót chiều ngược lại: data-tour khai báo mà không bài nào dùng thì báo (rác)", () => {
    const used = new Set(LESSONS.flatMap((l) => l.steps.map((s) => s.target).filter(Boolean)));
    const orphans = [...declaredTargets()].filter((t) => !used.has(t));
    assert.deepEqual(orphans, [], `data-tour không bài nào dùng: ${orphans.join(", ")}`);
  });
});

describe("đường dẫn và tra cứu", () => {
  it("lessonHref mở đúng trang và kích hoạt đúng bài", () => {
    const lesson = findLesson("tao-chien-dich")!;
    assert.equal(lessonHref(lesson), `/admin/campaigns/new?${TOUR_PARAM}=tao-chien-dich`);
  });

  it("findLesson chịu được đầu vào lạ (tham số URL do người ngoài đặt)", () => {
    for (const bad of [null, undefined, "", "khong-co", "__proto__", "constructor", "../x"]) {
      assert.equal(findLesson(bad as string | null), undefined, String(bad));
    }
  });

  it("lessonsForPage khớp đúng pathname, không khớp tiền tố", () => {
    assert.ok(lessonsForPage("/admin/campaigns").length >= 2);
    assert.deepEqual(
      lessonsForPage("/admin/campaigns").map((l) => l.page),
      lessonsForPage("/admin/campaigns").map(() => "/admin/campaigns"),
    );
    assert.equal(lessonsForPage("/admin/campaigns/abc/edit").length, 0);
    assert.equal(lessonsForPage("/admin").length, 0);
  });
});

describe("tiến độ lưu trong trình duyệt", () => {
  it("parseDone chịu được dữ liệu hỏng, không ném", () => {
    assert.deepEqual(parseDone(""), []);
    assert.deepEqual(parseDone("not json"), []);
    assert.deepEqual(parseDone('{"a":1}'), []);
    assert.deepEqual(parseDone('["a", 3, null, "b"]'), ["a", "b"]);
    assert.deepEqual(parseDone('["tao-chien-dich"]'), ["tao-chien-dich"]);
  });
});
