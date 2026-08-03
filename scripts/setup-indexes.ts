/**
 * Tạo toàn bộ index, gồm TTL index trên clickEvents và unique index trên
 * conversions.clickId.
 *
 * Chạy: npm run setup:indexes
 *
 * BẮT BUỘC chạy một lần sau khi tạo cluster, và chạy lại mỗi khi đổi
 * CLICK_TTL_DAYS. Không có TTL index thì Atlas M0 (512MB) sẽ đầy trong 2–4 tuần.
 */
import { getClientPromise } from "../src/lib/db/client";
import { ensureIndexes } from "../src/lib/db/indexes";
import { clickTtlDays, mongodbDb } from "../src/lib/env";

async function main() {
  console.log(`Database: ${mongodbDb()}`);
  console.log(`TTL clickEvents: ${clickTtlDays()} ngày`);

  const names = await ensureIndexes();
  console.log(`\nĐã đảm bảo ${names.length} index:`);
  for (const name of names) console.log(`  - ${name}`);

  const client = await getClientPromise();
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
