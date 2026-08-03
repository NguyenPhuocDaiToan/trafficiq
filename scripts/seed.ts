/**
 * Seed dữ liệu demo: 1 advertiser + 2 destination + 1 campaign + 2 offer,
 * tất cả đã active để test được ngay end-to-end.
 *
 * Chạy: npm run seed
 *
 * An toàn khi chạy lại: dùng upsert theo khóa tự nhiên, không tạo bản trùng.
 * KHÔNG seed clickEvents — tự tạo click thật bằng cách gọi link /go.
 */
import { getClientPromise } from "../src/lib/db/client";
import {
  advertisers,
  campaigns,
  destinations,
  offers,
} from "../src/lib/db/collections";
import { generateToken } from "../src/lib/control-plane/token";
import { publicBaseUrl } from "../src/lib/env";

const DEMO_SLUG = "demo-campaign";
const DEMO_URLS = [
  "https://example.com/offer-a",
  "https://example.com/offer-b",
];

async function main() {
  const now = new Date();

  const advertisersCol = await advertisers();
  const advertiser = await advertisersCol.findOneAndUpdate(
    { name: "Demo Advertiser" },
    {
      $set: { status: "active", contactEmail: "demo@example.com", updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!advertiser) throw new Error("Không upsert được advertiser");
  console.log(`advertiser: ${advertiser._id}`);

  const destinationsCol = await destinations();
  const destinationIds = [];
  for (const url of DEMO_URLS) {
    const destination = await destinationsCol.findOneAndUpdate(
      { url },
      {
        $set: {
          advertiserId: advertiser._id,
          category: "demo",
          status: "active",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!destination) throw new Error(`Không upsert được destination ${url}`);
    destinationIds.push(destination._id);
    console.log(`destination: ${destination._id} ${url}`);
  }

  const campaignsCol = await campaigns();
  const existing = await campaignsCol.findOne({ slug: DEMO_SLUG });
  const campaign = await campaignsCol.findOneAndUpdate(
    { slug: DEMO_SLUG },
    {
      $set: {
        name: "Demo Campaign",
        advertiserId: advertiser._id,
        status: "active",
        landing: {
          headline: "Ưu đãi demo cho TrafficIQ",
          subheadline: "Landing này render server-side, OG tag có sẵn trong HTML đầu tiên.",
          bodyText:
            "Đây là campaign seed để test end-to-end.\nClick CTA để đi qua /go và sinh một clickEvent thật.",
          ctaLabel: "Xem ưu đãi",
        },
        og: {
          title: "Ưu đãi demo cho TrafficIQ",
          description: "Test preview OG trên Facebook, X, Telegram, Slack.",
        },
        updatedAt: now,
      },
      // Token chỉ sinh khi tạo mới — chạy lại seed không được đổi link đã share.
      $setOnInsert: { token: generateToken(), createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!campaign) throw new Error("Không upsert được campaign");
  console.log(`campaign: ${campaign._id} (${existing ? "cập nhật" : "tạo mới"})`);

  const offersCol = await offers();
  const offerNames = ["Variant A", "Variant B"];
  for (const [index, destinationId] of destinationIds.entries()) {
    await offersCol.updateOne(
      { campaignId: campaign._id, destinationId },
      {
        $set: {
          name: offerNames[index],
          weight: index === 0 ? 3 : 1, // split 75/25 để thấy weighted pick hoạt động
          status: "active",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  console.log(`offers: ${destinationIds.length}`);

  const baseUrl = publicBaseUrl();
  console.log("\nSẵn sàng test:");
  console.log(`  landing:  ${baseUrl}/c/${campaign.slug}`);
  console.log(`  redirect: ${baseUrl}/go/${campaign.token}?source=test&sub_id1=abc`);
  console.log(`  dashboard: ${baseUrl}/admin`);

  const client = await getClientPromise();
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
