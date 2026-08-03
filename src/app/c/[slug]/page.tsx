import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicBaseUrl } from "@/lib/env";
import { getLandingCampaign } from "@/lib/landing/get-campaign";
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

  const baseUrl = publicBaseUrl();
  const url = `${baseUrl}/c/${campaign.slug}`;
  const images = campaign.og.imageUrl ? [{ url: campaign.og.imageUrl }] : undefined;

  return {
    title: campaign.og.title,
    description: campaign.og.description,
    alternates: { canonical: url },
    // Campaign chưa active = bản preview, không cho index.
    robots:
      campaign.status === "active"
        ? undefined
        : { index: false, follow: false },
    openGraph: {
      type: "website",
      url,
      title: campaign.og.title,
      description: campaign.og.description,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: campaign.og.title,
      description: campaign.og.description,
      images: campaign.og.imageUrl ? [campaign.og.imageUrl] : undefined,
    },
  };
}

/**
 * UI theo design-system/trafficiq/pages/campaign-landing.md:
 * Hero-Centric + Conversion-Optimized, density 4/10, MỘT CTA duy nhất dùng
 * --color-accent, heading Fira Sans (không phải Fira Code như dashboard).
 */
export default async function LandingPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = await getLandingCampaign(slug);
  if (!campaign) notFound();

  const { landing } = campaign;

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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      {landing.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh từ CDN ngoài, không qua Image Optimization để tiết kiệm hạn mức free tier
        <img
          src={landing.heroImageUrl}
          alt=""
          className="w-full rounded-xl object-cover"
          // Hero là LCP element trên traffic paid — nạp ngay, không lazy.
          loading="eager"
          fetchPriority="high"
        />
      ) : null}

      {/* Heading landing dùng font-sans (Fira Sans), khác dashboard dùng font-mono. */}
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{landing.headline}</h1>

      {landing.subheadline ? (
        <p className="text-xl text-muted-foreground">{landing.subheadline}</p>
      ) : null}

      {landing.bodyText ? (
        <div className="space-y-3">
          {landing.bodyText.split("\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {/*
       * CTA phải là <a href> thật, KHÔNG phải <button onClick>: redirect tracking
       * phải chạy được cả khi JS chưa load hoặc bị chặn.
       * Accent là màu duy nhất được dùng cho CTA chính.
       */}
      <a
        href={ctaHref}
        rel="nofollow sponsored"
        className="w-fit cursor-pointer rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-on-accent hover:opacity-90"
      >
        {landing.ctaLabel}
      </a>

      <p className="text-xs text-muted-foreground">
        Đây là nội dung quảng cáo. Xem{" "}
        <a href="/privacy" className="cursor-pointer underline">
          chính sách quyền riêng tư
        </a>
        .
      </p>
    </main>
  );
}
