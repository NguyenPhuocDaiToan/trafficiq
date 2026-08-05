/**
 * Sinh thumbnail 160×90 cho ảnh bìa bài viết. Chạy: `npm run gen:thumbs`.
 *
 * PHẢI CHẠY LẠI khi thêm bài có ảnh bìa mới, hoặc khi thay ảnh bìa của bài cũ.
 * `npm run check:content` gác việc này (thiếu file hoặc file sai cỡ là fail), nên
 * quên chạy sẽ bị bắt ở gate chứ không âm thầm ra một ô trống trên trang chủ.
 *
 * Cùng dòng lý luận với `gen:icons`: file sinh ra được commit vào repo, không sinh
 * lúc build. Vercel build từ git nên sinh lúc build cũng được, nhưng như vậy thì
 * `sharp` thành phụ thuộc của bước build production để đổi lấy 12 file 6KB — và ảnh
 * bìa thì đổi vài tháng một lần.
 *
 * Đọc danh sách qua `allPosts()` chứ không quét thư mục `public/images/blog`: chỉ
 * ảnh nào ĐANG được một bài khai trong `cover` mới cần thumbnail. Quét thư mục sẽ
 * sinh cả thumbnail cho ảnh đã bỏ dùng và không ai biết để xoá.
 */

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { allPosts } from "../src/content";
import { THUMB_HEIGHT, THUMB_WIDTH, thumbSrc } from "../src/lib/thumb";

/**
 * Chất lượng WebP. 72 là mức mà ở cỡ 160×90 mắt không phân biệt được với 90 nhưng
 * file nhỏ hơn khoảng một phần ba. Đổi số này thì chạy lại và xem lại output size.
 */
const QUALITY = 72;

/** Trần cho một thumbnail. Cùng con số với luật trong `check:content`. */
const MAX_BYTES = 20 * 1024;

async function main(): Promise<void> {
  const posts = allPosts().filter((post) => post.cover);
  let total = 0;
  let sourceTotal = 0;
  let oversized = 0;

  for (const post of posts) {
    const cover = post.cover!;
    const out = thumbSrc(cover.src);

    if (!out) {
      console.log(`  bỏ qua  ${post.slug}: ảnh bìa không nằm trong /images/blog`);
      continue;
    }

    const input = path.join("public", cover.src);
    const output = path.join("public", out);
    await mkdir(path.dirname(output), { recursive: true });

    /*
     * `fit: "inside"` chứ không `"cover"`: ảnh gốc đã đúng 16:9 (1200×675) nên đây
     * là thu nhỏ thuần. Dùng `"cover"` sẽ crop nếu về sau có ảnh gốc lệch tỉ lệ —
     * và crop im lặng ở cỡ 160px thường cắt mất đúng chủ thể. Lệch tỉ lệ thì thà ra
     * file không đúng 160×90 để `check:content` báo, rồi sửa ảnh gốc.
     */
    await sharp(input)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "inside" })
      .webp({ quality: QUALITY })
      .toFile(output);

    const { size } = await stat(output);
    total += size;
    sourceTotal += (await stat(input)).size;
    const kb = (size / 1024).toFixed(1);
    const flag = size > MAX_BYTES ? "  ⚠ vượt trần 20KB" : "";
    if (size > MAX_BYTES) oversized += 1;
    console.log(`  ${kb.padStart(6)} KB  ${out}${flag}`);
  }

  console.log(
    `\n${posts.length} thumbnail, tổng ${(total / 1024).toFixed(1)} KB — ` +
      `cùng số ảnh ở bản gốc là ${(sourceTotal / 1024).toFixed(1)} KB.`,
  );

  if (oversized > 0) {
    console.log(
      `\n${oversized} file vượt trần ${MAX_BYTES / 1024}KB — hạ QUALITY hoặc kiểm lại ảnh gốc.`,
    );
    process.exit(1);
  }
}

/* Cùng kiểu gọi với `scripts/seed.ts`: `tsx` biên dịch ra CJS nên top-level await là
   lỗi transform, không phải lỗi lúc chạy. */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
