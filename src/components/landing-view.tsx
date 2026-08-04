import { AutoRedirectBar } from "@/components/auto-redirect-bar";
import { splitLegacyParagraphs } from "@/lib/landing/legacy-body";
import type { CampaignLanding } from "@/lib/types";

/**
 * Thân trang landing, DÙNG CHUNG giữa `/c/[slug]` (trang thật) và
 * `/admin/campaigns/[id]/preview` (xem trước trong admin).
 *
 * Vì sao phải dùng chung một component thay vì viết hai bản: preview lệch với
 * trang thật còn tệ hơn không có preview — admin duyệt xong một thứ rồi phát
 * hành một thứ khác. Hai bản render song song CHẮC CHẮN sẽ lệch sau vài lần sửa.
 *
 * UI theo design-system/trafficiq/pages/campaign-landing.md:
 * Hero-Centric + Conversion-Optimized, density 4/10, MỘT CTA duy nhất dùng
 * --color-accent.
 *
 * Đây là Server Component — không có "use client". Landing chịu traffic trả tiền
 * nên phải giữ 0 client JS: mỗi KB JS ở đây là LCP chậm hơn trên chính những
 * click đã tính tiền.
 */
export function LandingView({
  landing,
  ctaHref,
}: {
  landing: CampaignLanding;
  /**
   * Đích của CTA. Trang thật truyền `/go/[token]` (kèm param tracking đã
   * forward); preview truyền `undefined` để CTA render mà không điều hướng —
   * bấm thử trong preview không được tạo click giả trong báo cáo.
   */
  ctaHref?: string;
}) {
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

      {/* Heading landing dùng font-sans (Be Vietnam Pro), khác cột số liệu dashboard dùng font-mono. */}
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{landing.headline}</h1>

      {landing.subheadline ? (
        <p className="text-xl text-muted-foreground">{landing.subheadline}</p>
      ) : null}

      <LandingBody landing={landing} />

      {/*
       * CTA phải là <a href> thật, KHÔNG phải <button onClick>: redirect tracking
       * phải chạy được cả khi JS chưa load hoặc bị chặn.
       * Accent là màu duy nhất được dùng cho CTA chính.
       */}
      {ctaHref ? (
        <a
          href={ctaHref}
          rel="nofollow sponsored"
          className="w-fit cursor-pointer rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-on-accent transition-opacity duration-150 hover:opacity-90"
        >
          {landing.ctaLabel}
        </a>
      ) : (
        /*
         * Preview: giữ nguyên hình dáng và vị trí CTA nhưng không điều hướng.
         * Dùng <span> chứ không phải <a href="#"> hay <button disabled> — cả hai
         * cái sau đều cho bấm/focus được, và admin bấm thử sẽ tưởng preview hỏng.
         */
        <span
          aria-hidden="true"
          className="w-fit rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-on-accent"
        >
          {landing.ctaLabel}
        </span>
      )}

      <p className="text-xs text-muted-foreground">
        Đây là nội dung quảng cáo. Xem{" "}
        <a href="/chinh-sach-bao-mat" className="cursor-pointer underline">
          chính sách quyền riêng tư
        </a>{" "}
        và{" "}
        <a href="/tiet-lo-lien-ket" className="cursor-pointer underline">
          tiết lộ liên kết
        </a>
        .
      </p>

      {ctaHref && landing.autoRedirectSeconds && landing.autoRedirectSeconds > 0 ? (
        <AutoRedirectBar ctaHref={ctaHref} seconds={landing.autoRedirectSeconds} />
      ) : null}
    </main>
  );
}

/**
 * Thân bài. Hai đường vì dữ liệu có hai đời:
 *
 * 1. `bodyHtml` — HTML đã sanitize từ editor WYSIWYG. Đường đang dùng.
 * 2. `bodyText` — thân bài phẳng của bản đầu (@deprecated). Campaign cũ chưa mở
 *    lại trang sửa vẫn nằm ở đây, nên không được bỏ đường này.
 */
function LandingBody({ landing }: { landing: CampaignLanding }) {
  if (landing.bodyHtml) {
    return (
      /*
       * `dangerouslySetInnerHTML` ở đây an toàn vì HTML này đã qua
       * `sanitizeLandingBody` TRƯỚC KHI vào Mongo (whitelist thẻ, không attribute
       * ngoài src/alt, không scheme ngoài http(s)).
       *
       * Nếu bạn thêm một đường ghi `landing.bodyHtml` mới ở đâu đó mà không gọi
       * sanitizer, chỗ này thành stored XSS trên một trang công khai. Đừng làm vậy.
       *
       * `.prose` là style thân bài dùng chung với blog; `.prose-landing` bỏ giới
       * hạn 68ch để thân bài canh đúng khung max-w-2xl của landing.
       */
      <div
        className="prose prose-landing"
        dangerouslySetInnerHTML={{ __html: landing.bodyHtml }}
      />
    );
  }

  if (landing.bodyText) {
    return (
      <div className="prose prose-landing">
        {/*
         * `splitLegacyParagraphs` chứ không tách tại chỗ: form sửa dùng ĐÚNG hàm
         * này (qua `legacyBodyToHtml`) để nạp nội dung cũ vào editor. Hai luật tách
         * khác nhau nghĩa là mở trang sửa rồi bấm Lưu mà không sửa gì cũng làm bố
         * cục bài đổi.
         *
         * Render bằng JSX (không phải dangerouslySetInnerHTML) vì đây là text
         * phẳng chưa từng qua sanitizer — React tự escape.
         */}
        {splitLegacyParagraphs(landing.bodyText).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    );
  }

  return null;
}
