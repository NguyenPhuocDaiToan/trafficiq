/**
 * Gắn `id` vào mọi `<h2>`/`<h3>` của thân bài và trả về mục lục tương ứng.
 *
 * VÌ SAO LÀM BẰNG CÁCH ĐI CÂY JSX chứ không bắt người viết tự đặt `id`:
 * thân bài là module TSX (bất biến #9 trong AGENTS.md), nên `id` viết tay là thứ
 * sẽ bị quên ở bài thứ mười ba — lúc đó mục lục thiếu mục mà build vẫn xanh. Ở đây
 * anchor và mục lục sinh từ CÙNG một lần đi cây, nên hai thứ đó không thể lệch:
 * không có mục lục nào trỏ tới anchor không tồn tại.
 *
 * Chạy lúc build (trang bài là static), không phải mỗi lượt xem.
 *
 * Dùng lại `slugify()` của `lib/slug.ts` thay vì viết hàm bỏ dấu thứ hai — cùng lý
 * do như slug chiến dịch: hai bản bỏ dấu khác nhau thì cho ra hai anchor khác nhau
 * cho cùng một tiêu đề, và link đã chia sẻ sẽ trỏ vào chỗ trống.
 */

import { Children, Fragment, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { slugify } from "@/lib/slug";

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

type AnyElement = ReactElement<{ children?: ReactNode; id?: string }>;

/**
 * Lấy phần chữ của một nhánh JSX. Cần vì tiêu đề bài hay chứa thẻ con
 * (`<strong>`, `&ldquo;…&rdquo;`) nên `props.children` không phải chuỗi thuần.
 */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node as AnyElement).props.children);
  }
  // null / undefined / boolean: JSX không render, cũng không góp chữ nào.
  return "";
}

/**
 * Anchor phải là duy nhất trong một trang. Hai `<h3>` cùng tên ("Cách kiểm") là
 * chuyện có thật trong bài hướng dẫn, nên trùng thì thêm hậu tố số.
 */
function uniqueId(base: string, used: Set<string>): string {
  const seed = base || "muc";
  let candidate = seed;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${seed}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function walk(node: ReactNode, toc: TocEntry[], used: Set<string>): ReactNode {
  if (Array.isArray(node)) {
    return Children.map(node, (child) => walk(child, toc, used));
  }
  if (!isValidElement(node)) return node;

  const element = node as AnyElement;

  if (element.type === "h2" || element.type === "h3") {
    const text = textOf(element.props.children);
    const id = uniqueId(slugify(text), used);
    toc.push({ id, text, level: element.type === "h2" ? 2 : 3 });
    return cloneElement(element, { id });
  }

  /*
   * Chỉ đi sâu vào Fragment và thẻ HTML thường (`type` là chuỗi). KHÔNG đi vào
   * component (`Callout`, `CriteriaTable`, `PromoBox`): children của chúng là
   * props chưa render, và tiêu đề mục không bao giờ nằm trong đó — mục lục phải
   * phản ánh cấu trúc bài, không phải chữ in đậm bên trong một khung ghi chú.
   */
  if (element.type === Fragment || typeof element.type === "string") {
    const children = element.props.children;
    if (children === undefined) return element;
    return cloneElement(element, undefined, walk(children, toc, used));
  }

  return element;
}

/**
 * Trả về thân bài đã có anchor + mục lục của nó.
 * Gọi đúng một lần cho mỗi bài, ở `/blog/[slug]`.
 */
export function withHeadingAnchors(body: ReactNode): {
  content: ReactNode;
  toc: TocEntry[];
} {
  const toc: TocEntry[] = [];
  const content = walk(body, toc, new Set<string>());
  return { content, toc };
}
