"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  findLesson,
  lessonHref,
  lessonsForPage,
  TOUR_PARAM,
  type Lesson,
} from "@/lib/guide/lessons";
import { markDone } from "@/lib/guide/progress";

/**
 * Coach mark: hướng dẫn tương tác chỉ thẳng vào nút/ô trên trang admin THẬT.
 *
 * Kích hoạt bằng URL — `/admin/campaigns?huongdan=<id bài>` — nên mọi thẻ bài học ở hub chỉ cần là một
 * `<Link>`: mở đúng trang rồi tự chạy, không có state toàn cục nào phải đồng bộ giữa hub và trang đích.
 * Gắn một lần ở layout admin; không có `?huongdan=` thì chỉ hiện nút trợ giúp nhỏ.
 *
 * Không khoá trang: lớp tối và vòng sáng có `pointer-events: none`, chỉ hộp thoại bắt chuột. Người dùng
 * vẫn bấm thật vào phần tử đang được chỉ nếu muốn — bài học dạy làm chứ không chỉ để xem.
 *
 * Phần tử được chỉ qua `[data-tour="<target>"]`. Không tìm thấy (ví dụ chưa có chiến dịch nào nên chưa có
 * dòng để chỉ) thì hộp thoại hiện ở giữa kèm câu giải thích, KHÔNG bỏ qua bước: nội dung bước vẫn có ích
 * ngay cả khi không có gì để chỉ. Phần tử nằm trong `<details>` đang đóng thì mở ra rồi mới chỉ.
 */

const POPOVER_W = 352;
const EDGE = 12;
const PAD = 6;
const GAP = 10;
/** Chiều cao ước lượng của hộp thoại, để chọn đặt phía trên hay phía dưới mục tiêu. */
const POPOVER_H = 230;
const NARROW = 640;

type Rect = { top: number; left: number; width: number; height: number };

const subscribeViewport = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
/** Snapshot là CHUỖI ("1440x900") để so sánh theo giá trị, nếu không useSyncExternalStore lặp vô hạn. */
const readViewport = () => `${window.innerWidth}x${window.innerHeight}`;

function useViewport(): { w: number; h: number } {
  const raw = useSyncExternalStore(subscribeViewport, readViewport, () => "1024x768");
  const [w, h] = raw.split("x").map(Number);
  return { w, h };
}

const subscribeNothing = () => () => {};
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Mở mọi `<details>` bao quanh phần tử — chỉ vào thứ nằm trong khối đang gập thì không nhìn thấy gì. */
function openAncestors(el: Element): void {
  let details = el.parentElement?.closest("details");
  while (details) {
    details.open = true;
    details = details.parentElement?.closest("details");
  }
}

const findTarget = (target?: string) =>
  target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;

export function GuideTour() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  const lessonId = params.get(TOUR_PARAM);
  const lesson = findLesson(lessonId);
  const running = lesson !== undefined && lesson.page === pathname;

  function close() {
    const next = new URLSearchParams(params.toString());
    next.delete(TOUR_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (pathname.startsWith("/admin/login")) return null;

  return (
    <>
      {running ? <Tour key={lesson.id} lesson={lesson} onClose={close} /> : null}
      {!running ? <HelpButton pathname={pathname} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ hộp thoại */

function Tour({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const viewport = useViewport();
  const reduced = useReducedMotion();
  const primaryRef = useRef<HTMLButtonElement>(null);

  const step = lesson.steps[index];
  const last = index === lesson.steps.length - 1;
  const narrow = viewport.w < NARROW;
  const nextLesson = findLesson(lesson.next);

  // Đo và đuổi theo phần tử được chỉ: cuộn mượt mất vài trăm ms nên đo MỖI KHUNG HÌNH trong ~0,8s sau
  // khi đổi bước, rồi chỉ đo lại khi cuộn/đổi cỡ cửa sổ. Mọi `setRect` nằm trong callback của rAF/event,
  // không chạy đồng bộ trong thân effect.
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const el = findTarget(step.target);
    if (el) {
      openAncestors(el);
      el.scrollIntoView({
        block: window.innerWidth < NARROW ? "start" : "center",
        behavior: reduced ? "auto" : "smooth",
      });
    }

    const measure = () => {
      const current = findTarget(step.target);
      if (!current) return setRect(null);
      const r = current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const started = performance.now();
    const loop = () => {
      if (!alive) return;
      measure();
      if (performance.now() - started < 800) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [step.target, reduced]);

  // Chuyển tiêu điểm vào hộp thoại mỗi bước (để Enter/Space đi tiếp được bằng bàn phím) và trả lại khi đóng.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  function finish() {
    markDone(lesson.id);
    onClose();
  }
  const goNext = () => (last ? finish() : setIndex((i) => i + 1));
  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null;
      // Đừng cướp phím khi đang gõ vào ô nhập.
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Vị trí hộp thoại.
  const targeted = rect !== null;
  let popoverStyle: React.CSSProperties;
  const popoverClass = "fixed z-50 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-(--shadow-md)";
  if (narrow) {
    // Màn hẹp: hộp thoại là tấm trượt dưới đáy, mục tiêu được cuộn lên đầu màn hình.
    popoverStyle = { left: EDGE, right: EDGE, bottom: EDGE };
  } else if (!targeted) {
    popoverStyle = { left: "50%", top: "50%", width: POPOVER_W, transform: "translate(-50%, -50%)" };
  } else {
    const left = Math.min(Math.max(rect.left, EDGE), viewport.w - POPOVER_W - EDGE);
    const below = viewport.h - (rect.top + rect.height + PAD);
    const above = rect.top - PAD;
    if (below >= POPOVER_H + GAP) {
      popoverStyle = { left, top: rect.top + rect.height + PAD + GAP, width: POPOVER_W };
    } else if (above >= POPOVER_H + GAP) {
      popoverStyle = { left, bottom: viewport.h - rect.top + PAD + GAP, width: POPOVER_W };
    } else {
      // Mục tiêu cao gần bằng cả màn hình: đặt hộp thoại ở góc dưới, đè lên mục tiêu còn hơn bị tràn.
      popoverStyle = { right: EDGE, bottom: EDGE, width: POPOVER_W };
    }
  }

  return (
    <>
      {/* Lớp tối + vòng sáng. `box-shadow` khổng lồ tạo lỗ sáng đúng hình mục tiêu; màu lấy từ token. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed z-40 rounded-lg ${reduced ? "" : "transition-[top,left,width,height] duration-200 ease-out"}`}
        style={
          targeted
            ? {
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: "0 0 0 9999px color-mix(in srgb, var(--foreground) 55%, transparent)",
                outline: "2px solid var(--background)",
              }
            : {
                inset: 0,
                boxShadow: "inset 0 0 0 9999px color-mix(in srgb, var(--foreground) 55%, transparent)",
              }
        }
      />

      <div role="dialog" aria-label={`Hướng dẫn: ${lesson.title}`} className={popoverClass} style={popoverStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {lesson.title}
            <span className="ml-2 normal-case tabular-nums">
              Bước {index + 1}/{lesson.steps.length}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="-m-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Thanh tiến độ: mỗi bước một đoạn, để thấy còn bao xa. */}
        <div aria-hidden="true" className="mt-2 flex gap-1">
          {lesson.steps.map((s, i) => (
            <span key={s.title} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div aria-live="polite">
          <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
          <p className="mt-1 text-sm leading-relaxed">{step.body}</p>
          {step.target && !targeted ? (
            <p className="mt-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
              Phần này hiện chưa có trên trang (ví dụ chưa có dữ liệu để hiển thị). Nội dung bước vẫn áp dụng khi nó xuất hiện.
            </p>
          ) : null}
        </div>

        {last && nextLesson ? (
          <p className="mt-3 text-sm">
            Bài tiếp theo:{" "}
            <Link
              href={lessonHref(nextLesson)}
              onClick={() => markDone(lesson.id)}
              className="cursor-pointer font-medium text-primary underline"
            >
              {nextLesson.title}
            </Link>
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-1 py-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Bỏ qua
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button type="button" onClick={goBack} className={secondaryBtn}>
                Trước
              </button>
            ) : null}
            <button ref={primaryRef} type="button" onClick={goNext} className={primaryBtn}>
              {last ? "Xong" : "Tiếp"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Nút phụ/chính của hộp thoại: chiều cao ≥ 40px để chạm được trên điện thoại. */
const secondaryBtn =
  "min-h-10 cursor-pointer rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary hover:text-on-primary";
/** Dùng `--primary`, KHÔNG dùng `--accent`: accent chỉ dành cho CTA chính của trang, và trang đang hiện đã có CTA riêng. */
const primaryBtn =
  "min-h-10 cursor-pointer rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary transition-opacity duration-150 hover:opacity-90";

/* ------------------------------------------------------------------ nút trợ giúp nổi */

/**
 * Nút nhỏ ở góc dưới phải mọi trang admin: dẫn tới bài học của TRANG ĐANG MỞ, để người dùng không phải
 * quay về hub rồi đi tìm. Một bài thì bấm là chạy; nhiều bài thì mở danh sách chọn. Trang chưa có bài nào
 * (ví dụ trang sửa) thì dẫn về hub.
 */
function HelpButton({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const lessons = lessonsForPage(pathname);

  if (pathname === "/admin/huong-dan") return null;

  const label = lessons.length > 0 ? "Hướng dẫn trang này" : "Trung tâm hướng dẫn";

  const onClick = () => {
    if (lessons.length === 0) return router.push("/admin/huong-dan");
    if (lessons.length === 1) return router.push(lessonHref(lessons[0]));
    setOpen((value) => !value);
  };

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2">
      {open ? (
        <ul className="w-72 space-y-1 rounded-xl border border-border bg-card p-2 text-sm shadow-(--shadow-md)">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={lessonHref(lesson)}
                onClick={() => setOpen(false)}
                className="block cursor-pointer rounded-lg px-3 py-2 hover:bg-muted"
              >
                <span className="font-medium">{lesson.title}</span>
                <span className="block text-xs text-muted-foreground">{lesson.summary}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/admin/huong-dan"
              onClick={() => setOpen(false)}
              className="block cursor-pointer rounded-lg px-3 py-2 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Mở trung tâm hướng dẫn
            </Link>
          </li>
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        aria-expanded={lessons.length > 1 ? open : undefined}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary bg-card px-4 text-sm font-semibold text-primary shadow-(--shadow-md) transition-colors duration-150 hover:bg-primary hover:text-on-primary"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-4">
          <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7.9 7.8a2.2 2.2 0 1 1 3.2 2c-.7.4-1.1.8-1.1 1.6M10 13.6v.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {label}
      </button>
    </div>
  );
}
