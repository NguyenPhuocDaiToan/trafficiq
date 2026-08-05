import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingView } from "@/components/landing-view";
import { publicBaseUrl } from "@/lib/env";
import { getLandingCampaign } from "@/lib/landing/get-campaign";
import { buildOgCard, ogCardMetadata } from "@/lib/landing/og-card";
import { SUB_ID_PARAMS } from "@/lib/tracking/request-context";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * OG metadata render SERVER-SIDE theo từng campaign.
 *
 * Đây là điểm mạnh nhất của Next trên Vercel cho use case này: crawler của
 * FB/X/Telegram/Slack không chạy JS, nên OG tag phải có sẵn trong HTML đầu tiên.
 * Ảnh OG dùng absolute URL — crawler không hiểu đường dẫn tương đối.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getLandingCampaign(slug);

  if (!campaign) {
    return { title: "Không tìm thấy", robots: { index: false, follow: false } };
  }

  // Thẻ card dựng ở lib/landing/og-card.ts — dùng chung với `/go/[token]`, nơi
  // cùng card đó được trả bằng HTML thô. Đừng dựng thẻ trực tiếp ở đây.
  return ogCardMetadata(
    buildOgCard({
      og: campaign.og,
      slug: campaign.slug,
      baseUrl: publicBaseUrl(),
      // Campaign chưa active = bản preview, không cho index.
      index: campaign.status === "active",
    }),
  );
}

/**
 * Trang này KHÔNG dùng shell của website công khai (route group `(site)`): landing
 * phải sạch, không nav, không footer nhiều link — mọi link khác đều là chỗ để
 * click rò rỉ ra ngoài thay vì vào CTA.
 *
 * Phần render nằm ở `<LandingView>` vì `/admin/campaigns/[id]/preview` dùng lại
 * đúng component đó — preview và trang thật phải là một code path. Route này chỉ
 * còn lo ba việc: lấy campaign, dựng CTA href kèm param tracking, và OG metadata.
 */
export default async function LandingPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = await getLandingCampaign(slug);
  if (!campaign) notFound();

  // Chuyển tiếp tham số tracking từ landing sang /go, nếu không thì click từ
  // landing sẽ mất source/sub_id và mọi báo cáo attribution thành "direct".
  const forwarded = new URLSearchParams();
  for (const key of ["source", "utm_source", ...SUB_ID_PARAMS]) {
    const value = query[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) forwarded.set(key, single);
  }
  const queryString = forwarded.toString();
  const ctaHref = `/go/${campaign.token}${queryString ? `?${queryString}` : ""}`;

  return <LandingView landing={campaign.landing} ctaHref={ctaHref} />;
}
