import Link from "next/link";
import { FOOTER_NAV, MAIN_NAV, SITE } from "@/lib/site";
import { categoryName, getAuthor } from "@/content/taxonomy";
import { formatDate } from "@/lib/labels";
import type { TocEntry } from "@/content/headings";
import type { Post } from "@/content/types";
/* Chỉ lấy KIỂU từ `lib/seo`: file đó đọc env qua `publicBaseUrl()`, và import giá
   trị từ nó sẽ kéo cả nhánh đó vào mọi chỗ dùng component này. */
import type { Crumb } from "@/lib/seo";

/*
 * Primitive cho surface công khai — theo design-system/trafficiq/pages/blog.md
 * (Editorial Grid / Magazine, density 3/10).
 *
 * Tách riêng khỏi `components/ui.tsx` (dashboard, density 8/10) vì hai surface có
 * hai bộ luật khác nhau: bên kia nén chặt để nhìn nhiều số, bên này thoáng để đọc
 * chữ dài. Trộn vào một file là đường ngắn nhất tới việc dùng lẫn spacing.
 *
 * Luật token vẫn tuyệt đối: không hex, không `neutral-*`.
 */

/** Heroicons (outline) — không dùng emoji làm icon (anti-pattern MASTER.md). */
function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.5 4.5 21 12l-7.5 7.5M21 12H3" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    /*
     * Masthead kiểu editorial: hàng 1 = wordmark + CTA, hàng 2 = dải chuyên mục.
     *
     * Vì sao hai hàng ở MỌI breakpoint thay vì gộp một hàng rồi wrap ở mobile:
     * gộp một hàng thì thứ tự DOM (logo → nav → CTA) và thứ tự nhìn thấy ở mobile
     * (logo → CTA → nav) lệch nhau, tức focus order khi tab không khớp thứ tự trên
     * màn hình. Giữ hai hàng thì DOM và mắt trùng nhau ở mọi kích thước, và dải
     * chuyên mục cũng đúng chất báo/magazine hơn.
     *
     * Vì sao đây là masthead duy nhất, kể cả ở trang chủ: báo in in tên báo cỡ lớn
     * ở trang nhất và cỡ nhỏ ở trang trong, nhưng web thì header sticky đã mang tên
     * site trên MỌI trang — in thêm một khối tên nữa ở đầu trang chủ là cùng một
     * chữ hai lần trong 100px. Trang chủ thay khối đó bằng `Dateline`: dải thông
     * tin số báo, không lặp lại tên.
     */
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-4">
          {/*
            Wordmark = font display (serif). Đây là chỗ họ chữ thứ ba đáng giá
            nhất: tên site là thứ duy nhất trên trang phải trông như một logo, và
            site không có ảnh nào để làm việc đó thay.
          */}
          <Link
            href="/"
            className="cursor-pointer font-display text-2xl font-bold tracking-tight hover:text-accent sm:text-3xl"
          >
            {SITE.name}
          </Link>

          <Link
            href="/lien-he"
            className="shrink-0 cursor-pointer border border-primary px-3.5 py-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase hover:bg-primary hover:text-on-primary"
          >
            Liên hệ
          </Link>
        </div>

        {/*
          Dải chuyên mục. `overflow-x-auto` + `-mx-4 px-4` để ở 375px nó tự cuộn
          trong khung mà không đẩy cả trang scroll ngang (checklist MASTER.md).

          Chữ nhỏ + uppercase + tracking rộng: đây là *nhãn mục* của một tờ báo,
          không phải link điều hướng app. Cùng một mô-típ với nhãn chuyên mục trên
          thẻ bài và nhãn section — ba chỗ dùng chung một kiểu chữ nhãn.
        */}
        <nav
          aria-label="Điều hướng chính"
          className="-mx-4 overflow-x-auto border-t border-border px-4 sm:mx-0 sm:px-0"
        >
          <ul className="flex items-center gap-x-6 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] whitespace-nowrap uppercase">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="cursor-pointer border-b-2 border-transparent pb-0.5 text-muted-foreground hover:border-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    /* Gạch đậm `--rule` phía trên footer: cách kết thúc trang của một tờ báo,
       và là thứ tách chân trang khỏi nội dung mà không cần đổi nền. */
    <footer className="mt-24 border-t-[3px] border-rule bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-xl font-bold tracking-tight">
              {SITE.name}
            </p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              {SITE.tagline}. Ba mảng: công nghệ &amp; thiết bị, tiền bạc &amp; chi
              tiêu, đời sống &amp; kỹ năng.
            </p>
          </div>

          {FOOTER_NAV.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {column.heading}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          {/*
            ⚠️ Ở ĐÂY TRƯỚC CÓ DÒNG TIẾT LỘ AFFILIATE — chủ dự án cho bỏ, và bỏ được
            vì hiện KHÔNG bài nào chứa link tài trợ.

            Đừng hiểu thành "site này không cần tiết lộ nữa". Thứ mang tính pháp lý
            là nhãn **tại chỗ, ngay cạnh link** — `PromoBox` trong
            `components/content.tsx` đã gánh (`rel="nofollow sponsored"` + nhãn
            "Liên kết tài trợ" + link tới `/tiet-lo-lien-ket`). Một dòng ở chân
            trang vốn không đủ để thay việc đó.

            Vì vậy: khi bài đầu tiên có link tài trợ, KHÔNG được gỡ nhãn của
            `PromoBox`, và nên cân nhắc đưa lại dòng này. Trang
            `/tiet-lo-lien-ket` vẫn còn, vẫn được link từ `/gioi-thieu`.
          */}
          <p className="max-w-3xl">
            © {year} {SITE.legal.entityName ?? SITE.name}. Nội dung mang tính tham
            khảo, không phải tư vấn tài chính, y tế hay pháp lý.
          </p>
        </div>
      </div>
    </footer>
  );
}

/*
 * ---------------------------------------------------------------------------
 * ẢNH BÌA BÀI VIẾT
 *
 * Site này KHÔNG dùng ảnh bitmap (ràng buộc bandwidth trong AGENTS.md: Hobby
 * ~100GB/tháng, ảnh ≤200KB và không đi qua Image Optimization). Nhưng một trang
 * mục lục toàn chữ thì mắt không có chỗ nghỉ, nên chỗ của ảnh được thay bằng
 * **art SVG vẽ tại chỗ**:
 *
 *   - 0 byte tải thêm: SVG nằm trong HTML đã render, không có request nào.
 *   - Không bao giờ lệch theme: mọi nét là `currentColor` + token, nên nó tự đúng
 *     ở cả light và dark. Ảnh chụp thì không làm được điều đó.
 *   - Không bao giờ sai nội dung: một ảnh stock "người cầm điện thoại" không nói
 *     gì về bài viết; hình khắc theo chuyên mục thì ít nhất nói đúng mục.
 *
 * Kiểu vẽ: nét mảnh, không tô, một chi tiết màu accent — bản khắc đầu mục của báo
 * in, không phải minh hoạ phẳng nhiều màu.
 *
 * NẾU SAU NÀY CÓ ẢNH THẬT: thêm field `cover?: { src: string; alt: string }` vào
 * `Post`, và trong `PostCover` ưu tiên nó, giữ SVG làm fallback cho bài không có
 * ảnh. Ảnh thật phải là WebP ≤200KB, có `width`/`height` để không gây layout
 * shift, và `loading="lazy"` cho mọi ảnh dưới màn hình đầu.
 * ---------------------------------------------------------------------------
 */

/**
 * Hình khắc của từng chuyên mục. Toạ độ theo viewBox 320×180.
 *
 * Thêm chuyên mục trong `CategorySlug` thì phải thêm một entry ở đây —
 * `Record<CategorySlug, …>` nên TypeScript báo lỗi build nếu thiếu, không cần nhớ.
 */
const COVER_MOTIF: Record<Post["category"], React.ReactNode> = {
  /* Thiết bị: hai khung lồng nhau + sóng phát ra. */
  "cong-nghe": (
    <>
      <rect x="118" y="38" width="84" height="104" />
      <rect x="132" y="54" width="56" height="72" />
      <path d="M160 150v14" />
      <path d="M40 90h58M222 90h58" />
      <g className="text-accent">
        <path d="M96 62c-14 10-14 46 0 56" strokeWidth={2.5} />
        <path d="M224 62c14 10 14 46 0 56" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Chi tiêu: cột số liệu, một cột accent — cột bị bỏ quên. */
  "tai-chinh": (
    <>
      <path d="M40 142h240" />
      <rect x="62" y="112" width="26" height="30" />
      <rect x="106" y="92" width="26" height="50" />
      <rect x="150" y="102" width="26" height="40" />
      <rect x="238" y="72" width="26" height="70" />
      <g className="text-accent">
        <rect x="194" y="46" width="26" height="96" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Thói quen: vòng lặp ngày — các cung đồng tâm, một điểm bắt đầu. */
  "doi-song": (
    <>
      <circle cx="160" cy="90" r="58" />
      <circle cx="160" cy="90" r="38" />
      <path d="M160 32v20M160 128v20M102 90h20M198 90h20" />
      <g className="text-accent">
        <circle cx="160" cy="52" r="7" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Nhà: mái + ô cửa, một ô sáng. */
  "nha-cua": (
    <>
      <path d="M60 86 160 32l100 54" />
      <path d="M78 86v62h164V86" />
      <path d="M40 148h240" />
      <rect x="100" y="104" width="34" height="30" />
      <rect x="186" y="104" width="34" height="30" />
      <g className="text-accent">
        <rect x="143" y="104" width="34" height="44" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Bếp: bếp nhìn từ trên — bốn vòng, một vòng đang bật. */
  bep: (
    <>
      <rect x="70" y="34" width="180" height="112" />
      <circle cx="115" cy="66" r="18" />
      <circle cx="205" cy="66" r="18" />
      <circle cx="205" cy="114" r="18" />
      <path d="M70 146h180" />
      <g className="text-accent">
        <circle cx="115" cy="114" r="18" strokeWidth={2.5} />
        <circle cx="115" cy="114" r="8" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Đi lại: đường thu về xa + hai bánh. */
  "di-chuyen": (
    <>
      <path d="M40 148 130 46M280 148 190 46" />
      <path d="M160 60v12M160 88v14M160 118v16" />
      <circle cx="86" cy="120" r="16" />
      <circle cx="234" cy="120" r="16" />
      <g className="text-accent">
        <path d="M40 148h240" strokeWidth={2.5} />
      </g>
    </>
  ),

  /* Làm việc: mặt bàn + tệp xếp lớp, một tệp được lấy ra. */
  "lam-viec": (
    <>
      <path d="M46 132h228M74 132v22M246 132v22" />
      <rect x="90" y="52" width="76" height="60" />
      <path d="M104 66h48M104 82h48M104 98h30" />
      <rect x="186" y="70" width="60" height="42" />
      <g className="text-accent">
        <path d="M196 42h60l-8 22h-60z" strokeWidth={2.5} />
      </g>
    </>
  ),
};

/**
 * Hình khắc nét riêng cho TỪNG BÀI VIẾT cụ thể theo slug.
 * Giúp mỗi bài có một diện mạo visual signature độc bản, sắc nét, khớp đúng chủ đề bài.
 */
const POST_MOTIF: Record<string, React.ReactNode> = {
  /* 1. Khi nào nên đổi điện thoại */
  "khi-nao-nen-doi-dien-thoai": (
    <>
      <rect x="130" y="28" width="60" height="114" rx="4" />
      <rect x="138" y="42" width="44" height="74" />
      <circle cx="160" cy="128" r="3" />
      <rect x="148" y="52" width="24" height="12" rx="1" />
      <path d="M172 56v4" />
      <path d="M152 58h6" className="text-accent" strokeWidth={2.5} />
      <g className="text-accent">
        <path d="M92 70a44 44 0 0 1 30-32" strokeWidth={2.5} />
        <path d="M122 32h-10M122 32v10" strokeWidth={2.5} />
        <path d="M228 100a44 44 0 0 1-30 32" strokeWidth={2.5} />
        <path d="M198 132h10M198 132v-10" strokeWidth={2.5} />
      </g>
      <path d="M50 152h220" />
    </>
  ),

  /* 2. Quy tắc sao lưu 3-2-1 */
  "sao-luu-du-lieu-quy-tac-3-2-1": (
    <>
      <rect x="44" y="74" width="52" height="34" />
      <path d="M38 108h64" />
      <text x="70" y="96" fill="currentColor" fontSize="13" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">1</text>

      <rect x="138" y="76" width="44" height="32" rx="2" />
      <circle cx="148" cy="92" r="3" />
      <path d="M156 92h18" />
      <text x="160" y="68" fill="currentColor" fontSize="13" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">2</text>

      <path d="M220 94a18 18 0 0 1 30-12 14 14 0 0 1 18 14 12 12 0 0 1-8 12h-40a14 14 0 0 1 0-14z" />
      <text x="242" y="94" fill="currentColor" fontSize="13" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">3</text>

      <g className="text-accent">
        <path d="M102 91h30" strokeWidth={2.5} />
        <path d="M126 86l6 5-6 5" strokeWidth={2.5} />
        <path d="M186 91h28" strokeWidth={2.5} />
        <path d="M208 86l6 5-6 5" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 3. Dọn thư mục máy tính */
  "dung-lai-thu-muc-may-tinh": (
    <>
      <path d="M60 40h40l10 12h70v34H60z" />
      <path d="M85 86v60M85 106h40M85 136h40" />
      <path d="M125 94h30l8 10h52v26h-90z" />
      <path d="M125 124h30l8 10h52v26h-90z" />
      <g className="text-accent">
        <path d="M170 60h65v18h-65z" strokeWidth={2.5} />
        <path d="M180 69h45" strokeWidth={2.5} />
      </g>
      <path d="M40 156h240" />
    </>
  ),

  /* 4. Chọn ổ cứng di động SSD vs HDD */
  "chon-o-cung-di-dong": (
    <>
      <rect x="50" y="48" width="84" height="84" rx="3" />
      <rect x="64" y="62" width="24" height="16" />
      <rect x="96" y="62" width="24" height="16" />
      <g className="text-accent">
        <path d="M96 90l-10 18h12l-6 16 16-20h-12z" strokeWidth={2} fill="currentColor" />
      </g>

      <path d="M160 40v100" strokeDasharray="4 4" />

      <rect x="186" y="48" width="84" height="84" rx="3" />
      <circle cx="228" cy="90" r="26" />
      <circle cx="228" cy="90" r="8" />
      <path d="M228 90l16-16" />
      <circle cx="244" cy="74" r="3" />
      <path d="M40 152h240" />
    </>
  ),

  /* 5. Phí âm thầm trong hoá đơn hằng tháng */
  "phi-am-tham-trong-hoa-don-hang-thang": (
    <>
      <path d="M90 32h105l30 30v88H90z" />
      <path d="M195 32v30h30" />
      <path d="M110 54h70M110 72h90M110 90h45" />
      <g className="text-accent">
        <path d="M110 108h95" strokeDasharray="3 3" strokeWidth={2} />
        <circle cx="205" cy="100" r="6" strokeWidth={2} />
        <circle cx="205" cy="116" r="6" strokeWidth={2} />
        <path d="M200 103l-16 5M200 113l-16-5" strokeWidth={2} />
      </g>
      <circle cx="118" cy="132" r="6" />
      <circle cx="140" cy="138" r="6" />
      <path d="M40 152h240" />
    </>
  ),

  /* 6. Mua đồ cũ hay đồ mới */
  "mua-do-cu-hay-do-moi": (
    <>
      <path d="M160 40v84M120 124h80" />
      <path d="M160 40l-70 20M160 40l70 20" />
      <path d="M70 100l20 20h-40z" />
      <rect x="60" y="70" width="40" height="30" />
      <path d="M80 70v30M60 85h40" />
      <path d="M250 100l20 20h-40z" />
      <g className="text-accent">
        <circle cx="230" cy="80" r="16" strokeWidth={2.5} />
        <path d="M222 80a8 8 0 0 1 14-5" strokeWidth={2.5} />
        <path d="M236 75v4h-4" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 7. Đi chợ một lần cho cả tuần */
  "di-cho-mot-lan-cho-ca-tuan": (
    <>
      <path d="M45 75h70l-10 45H55z" />
      <path d="M60 75l20-30 20 30" />
      <path d="M65 90v15M80 90v15M95 90v15" />
      <rect x="145" y="45" width="125" height="85" />
      <path d="M145 65h125" />
      <path d="M163 65v65M181 65v65M199 65v65M217 65v65M235 65v65M253 65v65" />
      <g className="text-accent">
        <circle cx="172" cy="85" r="4" strokeWidth={2} />
        <circle cx="208" cy="85" r="4" strokeWidth={2} />
        <circle cx="244" cy="85" r="4" strokeWidth={2} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 8. Cách chọn nồi cơm điện */
  "chon-noi-com-dien": (
    <>
      <path d="M90 65c0-15 30-22 70-22s70 7 70 22v50c0 15-30 22-70 22s-70-7-70-22z" />
      <path d="M90 85h140" />
      <rect x="140" y="95" width="40" height="24" rx="2" />
      <circle cx="150" cy="107" r="3" />
      <circle cx="170" cy="107" r="3" />
      <g className="text-accent">
        <path d="M135 32c-4-6 0-10-4-16" strokeWidth={2.5} />
        <path d="M160 28c-4-6 0-10-4-16" strokeWidth={2.5} />
        <path d="M185 32c-4-6 0-10-4-16" strokeWidth={2.5} />
      </g>
      <path d="M50 152h220" />
    </>
  ),

  /* 9. Máy hút bụi cầm tay */
  "may-hut-bui-cam-tay-co-dang-mua": (
    <>
      <path d="M60 70h60l40 20v30H60z" />
      <path d="M70 70c-10-20-30-20-40 0" />
      <rect x="160" y="95" width="70" height="16" />
      <path d="M230 95l30 25h-20z" />
      <g className="text-accent">
        <circle cx="255" cy="132" r="3" strokeWidth={2} />
        <circle cx="270" cy="126" r="2" strokeWidth={2} />
        <circle cx="242" cy="136" r="2.5" strokeWidth={2} />
        <path d="M235 110l20 10" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 10. Xử lý ẩm mốc trong nhà */
  "xu-ly-am-moc-trong-nha": (
    <>
      <path d="M160 30l70 30v45c0 40-70 60-70 60s-70-20-70-60V60z" />
      <path d="M160 55c-16 22-22 34-22 46a22 22 0 0 0 44 0c0-12-6-24-22-46z" />
      <g className="text-accent">
        <path d="M70 80c15-10 25 10 40 0" strokeWidth={2.5} />
        <path d="M70 105c15-10 25 10 40 0" strokeWidth={2.5} />
        <path d="M210 80c15-10 25 10 40 0" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 11. Giữ giấy tờ quan trọng trong nhà */
  "giu-giay-to-quan-trong-trong-nha": (
    <>
      <rect x="75" y="45" width="170" height="95" rx="4" />
      <path d="M75 75h170" />
      <path d="M95 45v-10h30l5 10" />
      <path d="M140 45v-10h30l5 10" />
      <path d="M185 45v-10h30l5 10" />
      <g className="text-accent">
        <circle cx="160" cy="105" r="14" strokeWidth={2.5} />
        <circle cx="160" cy="101" r="3" fill="currentColor" />
        <path d="M160 104v6" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),

  /* 12. Tự kiểm tra xe trước chuyến đi xa */
  "tu-kiem-xe-truoc-chuyen-di-xa": (
    <>
      <circle cx="110" cy="90" r="48" />
      <circle cx="110" cy="90" r="30" />
      <circle cx="110" cy="90" r="12" />
      <path d="M110 42v18M110 120v18M62 90h18M140 90h18" />
      <circle cx="215" cy="80" r="28" />
      <path d="M215 80l14-14" />
      <g className="text-accent">
        <path d="M205 125l10 10 20-20" strokeWidth={2.5} />
      </g>
      <path d="M40 152h240" />
    </>
  ),
};

/**
 * Ảnh bìa của một bài.
 * Ưu tiên `post.cover` (ảnh thật) nếu có; nếu không, tự render art SVG theo `post.slug`
 * hoặc fallback theo `category`.
 *
 * `size` chỉ đổi độ dày nét SVG, không đổi hình.
 */
export function PostCover({
  post,
  category,
  size = "md",
}: {
  post?: Post;
  category?: Post["category"];
  size?: "lg" | "md";
}) {
  const cat = post?.category ?? category ?? "cong-nghe";

  if (post?.cover) {
    return (
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.cover.src}
          alt={post.cover.alt}
          className="h-full w-full object-cover"
          loading={size === "lg" ? "eager" : "lazy"}
        />
      </div>
    );
  }

  const motif = (post && POST_MOTIF[post.slug]) || COVER_MOTIF[cat];

  return (
    <div className="aspect-video w-full overflow-hidden bg-muted">
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full text-rule/45"
        fill="none"
        stroke="currentColor"
        strokeWidth={size === "lg" ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        role="presentation"
        vectorEffect="non-scaling-stroke"
      >
        {motif}
      </svg>
    </div>
  );
}

/** Nhãn chuyên mục, dẫn tới trang chuyên mục. */
export function CategoryTag({ category }: { category: Post["category"] }) {
  return (
    <Link
      href={`/chuyen-muc/${category}`}
      className="cursor-pointer text-[0.6875rem] font-semibold tracking-[0.16em] text-accent uppercase hover:underline"
    >
      {categoryName(category)}
    </Link>
  );
}

/**
 * Dòng thông tin dưới tiêu đề bài: (tên người viết) + ngày + thời gian đọc.
 * Số phút dùng `font-mono tabular-nums` — đúng luật AGENTS.md: mono chỉ cho số.
 *
 * `withByline` chỉ bật ở bài dẫn trang nhất và ở đầu bài viết: site chạy dưới
 * thương hiệu cá nhân nên byline là tín hiệu tin cậy, nhưng in tên người viết cạnh
 * mọi tiêu đề trong một danh sách bốn bài của cùng một người thì chỉ là nhiễu.
 *
 * `withUpdated` chỉ bật ở trang bài, và nó KHÔNG phải chi tiết trang trí:
 * `/gioi-thieu` hứa với người đọc là "bài sẽ được sửa và ghi rõ ngày cập nhật, không
 * sửa lặng lẽ". Đặt `updatedAt` trong `src/content` mà không in ra là biến câu đó
 * thành câu nói suông. Không bật ở thẻ trong danh sách: ở đó ngày là mốc để quét
 * theo thời gian, hai ngày cạnh nhau chỉ làm rối.
 */
export function PostMetaLine({
  post,
  withByline = false,
  withUpdated = false,
}: {
  post: Post;
  withByline?: boolean;
  withUpdated?: boolean;
}) {
  const author = withByline ? getAuthor(post.authorId) : undefined;
  /* Chỉ hiện khi khác ngày đăng: bài chưa sửa lần nào mà in "Cập nhật <ngày đăng>"
     là nói rằng có một lần sửa không hề xảy ra. */
  const updated =
    withUpdated && post.updatedAt && post.updatedAt !== post.publishedAt
      ? post.updatedAt
      : undefined;

  return (
    <p className="text-sm text-muted-foreground">
      {author ? (
        <>
          <span className="font-medium text-foreground">{author.name}</span>
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      <span aria-hidden="true"> · </span>
      <span>
        <span className="font-mono tabular-nums">{post.readingMinutes}</span> phút đọc
      </span>
      {updated ? (
        <>
          <span aria-hidden="true"> · </span>
          <span>
            Cập nhật <time dateTime={updated}>{formatDate(updated)}</time>
          </span>
        </>
      ) : null}
    </p>
  );
}

/**
 * Nhãn "Chọn mua" cho bài `kind: "review"`.
 *
 * Vì sao là nhãn riêng chứ không phải một chuyên mục: dạng bài cắt NGANG chuyên
 * mục — có bài chọn mua ở Công nghệ, ở Bếp, ở Nhà cửa. Người đang cần quyết định
 * mua gì tìm theo dạng bài, không theo mục.
 */
export function KindTag({ kind }: { kind: Post["kind"] }) {
  if (kind !== "review") return null;

  return (
    <span className="border border-primary px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-[0.14em] text-primary uppercase">
      Chọn mua
    </span>
  );
}

/**
 * Thẻ bài viết trong GRID (`/blog`, `/chuyen-muc/[slug]`, dải chọn mua ở trang chủ).
 *
 * VÌ SAO KHÔNG PHẢI "Ô CÓ VIỀN" (bản đời đầu: `rounded-xl border bg-card`):
 * Editorial Grid tạo thứ bậc bằng **gạch kẻ + cỡ chữ**, không bằng hộp. Bản cũ đặt
 * tiêu đề lên khối nền xám nên tiêu đề — thứ quan trọng nhất của một bài — trông
 * như nhãn bị vô hiệu hoá, và cả trang chủ thành 8 hình chữ nhật bo góc giống nhau,
 * tức trông như một trang admin. Giờ mỗi bài là một **cột báo**: gạch đậm
 * `--rule` phía trên, nhãn chuyên mục, rồi tiêu đề trên chính nền trang.
 *
 * `withCover` mặc định bật. Tắt nó ở những chỗ đã có bìa lớn ngay bên cạnh (dải
 * chọn mua nằm dưới bài dẫn chẳng hạn) — ba bìa cùng cỡ xếp hàng cạnh một bìa lớn
 * thì hình lấn hết chữ.
 *
 * Grid chứa nó phải để `gap-x` rộng (≥2.5rem) — gạch trên của hai cột sát nhau sẽ
 * đọc thành một đường liền nếu khe hẹp.
 */
export function PostCard({
  post,
  withCover = true,
}: {
  post: Post;
  withCover?: boolean;
}) {
  return (
    <article className="group flex h-full flex-col border-t-2 border-rule pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CategoryTag category={post.category} />
        <KindTag kind={post.kind} />
      </div>

      {withCover ? (
        <Link
          href={`/blog/${post.slug}`}
          className="mt-3 block cursor-pointer"
          tabIndex={-1}
          /* `tabIndex={-1}` + `aria-hidden`: bìa là link thứ hai tới đúng bài mà
             tiêu đề ngay dưới đã trỏ tới. Cho nó vào thứ tự tab nghĩa là người dùng
             bàn phím phải Tab hai lần cho mỗi bài, và screen reader đọc hai link
             trùng đích — chuột thì vẫn bấm được vào hình như mong đợi. */
          aria-hidden="true"
        >
          <PostCover post={post} />
        </Link>
      ) : null}

      {/*
        hover đổi sang --accent, KHÔNG dùng --primary: ở palette editorial black
        thì --primary gần trùng --foreground nên hover sẽ không thấy gì.
        Ghi chú đầy đủ ở --primary trong globals.css.
      */}
      <h3 className="mt-3 font-display text-xl leading-snug font-bold tracking-tight">
        <Link
          href={`/blog/${post.slug}`}
          className="cursor-pointer hover:text-accent"
        >
          {post.title}
        </Link>
      </h3>

      <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.description}</p>

      <div className="mt-4">
        <PostMetaLine post={post} />
      </div>
    </article>
  );
}

/**
 * Dải thông tin đầu trang nhất — thay cho hero kiểu marketing.
 *
 * Đây là "dateline" của báo in: một dải kẹp giữa hai đường kẻ, mang đúng những
 * thứ người mới vào cần biết trong một giây (site này viết về gì, có bao nhiêu
 * bài, còn cập nhật không) mà không chiếm nửa màn hình như một khối hero.
 *
 * Vì sao KHÔNG in lại tên site ở đây: header sticky ngay phía trên đã có wordmark
 * cỡ 3xl. Xem ghi chú ở `SiteHeader`.
 *
 * Số dùng `font-mono tabular-nums` (luật AGENTS.md: mono chỉ cho cột số). NGÀY
 * THÁNG không dùng mono — nó là chữ ("30 tháng 7, 2026"), không phải cột số.
 */
export function Dateline({
  postCount,
  categoryCount,
  updatedAt,
}: {
  postCount: number;
  categoryCount: number;
  /** ISO date của bài mới nhất. Bỏ trống khi chưa có bài nào. */
  updatedAt?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-y border-border py-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {/* Tagline đứng đầu dải và là thứ duy nhất mang màu accent ở đây: nó là câu
          định vị của site, ba mục còn lại chỉ là số liệu. */}
      <span className="text-accent">{SITE.tagline}</span>

      <span>
        <span className="font-mono tabular-nums">{postCount}</span> bài
      </span>

      <span>
        <span className="font-mono tabular-nums">{categoryCount}</span> chuyên mục
      </span>

      {updatedAt ? (
        <span>
          Cập nhật <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Bài dẫn của trang nhất ("lead story") — cột rộng 7/12.
 *
 * Tiêu đề bài này là `<h1>` của trang chủ, CỐ Ý: trang nhất một tờ báo không có
 * khẩu hiệu cỡ lớn, nó có một tin dẫn. Câu định vị của site đã nằm ở `Dateline`
 * phía trên và ở `/gioi-thieu`; nhồi thêm một H1 kiểu "Hướng dẫn dùng được ngay…"
 * chỉ để có H1 sẽ tạo hai thứ cùng đòi to nhất trên một màn hình.
 *
 * Đây là chỗ duy nhất trên trang chủ được dùng CTA màu `--accent` — luật MASTER.md:
 * một view chỉ một CTA accent.
 */
export function LeadStory({ post }: { post: Post }) {
  return (
    <article>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CategoryTag category={post.category} />
        <KindTag kind={post.kind} />
      </div>

      {/* Bìa lớn: đây là hình duy nhất trên màn hình đầu, nên nó được nét mảnh
          (`size="lg"`) để không thành một khối đậm cạnh tiêu đề cỡ display. */}
      <Link
        href={`/blog/${post.slug}`}
        className="mt-4 block cursor-pointer"
        tabIndex={-1}
        aria-hidden="true"
      >
        <PostCover post={post} size="lg" />
      </Link>

      {/*
        leading 1.1 ở cỡ display: tiêu đề tiếng Việt có dấu ở cả hai phía (mũ/móc
        trên, dấu nặng dưới) nên hai dòng sát nhau sẽ chạm nhau. Fraunces có
        x-height cao nên 1.1 là mức chặt nhất còn an toàn ở cỡ này — chặt hơn thì
        dấu ngã của dòng dưới ăn vào dấu nặng của dòng trên.
      */}
      <h1 className="mt-4 font-display text-[1.875rem] leading-[1.1] font-bold tracking-[-0.02em] sm:text-[2.5rem] lg:text-[3.25rem]">
        <Link
          href={`/blog/${post.slug}`}
          className="cursor-pointer hover:text-accent"
        >
          {post.title}
        </Link>
      </h1>

      <p className="mt-5 max-w-[46ch] text-lg text-muted-foreground">
        {post.description}
      </p>

      <div className="mt-5">
        <PostMetaLine post={post} withByline />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex cursor-pointer items-center gap-2 bg-accent px-5 py-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-on-accent uppercase transition-opacity duration-200 hover:opacity-90"
        >
          Đọc bài này
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>

        <Link
          href="/gioi-thieu"
          className="cursor-pointer text-sm text-muted-foreground underline decoration-1 underline-offset-4 hover:text-accent"
        >
          Site này là gì
        </Link>
      </div>
    </article>
  );
}

/**
 * Bài phụ ở cột hẹp 5/12 của trang nhất.
 *
 * Nhỏ hơn bài dẫn bằng CỠ CHỮ, không bằng nền hay viền — cùng một luật với
 * `PostCard`. Không tự vẽ đường kẻ: `divide-y` do container cấp.
 */
export function SidePost({ post }: { post: Post }) {
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <CategoryTag category={post.category} />
        <KindTag kind={post.kind} />
      </div>

      <h2 className="mt-2.5 font-display text-lg leading-snug font-bold tracking-tight sm:text-xl">
        <Link
          href={`/blog/${post.slug}`}
          className="cursor-pointer hover:text-accent"
        >
          {post.title}
        </Link>
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>

      <div className="mt-2.5">
        <PostMetaLine post={post} />
      </div>
    </article>
  );
}

/**
 * Danh sách bài mới nhất theo thứ tự thời gian — dải giữa trang nhất.
 *
 * Vì sao có cả dải này VÀ dải chuyên mục bên dưới, dù một số bài xuất hiện hai
 * lần: hai dải trả lời hai câu khác nhau. Dải này trả lời "có gì mới" (người quay
 * lại lần thứ hai cần đúng câu đó), dải chuyên mục trả lời "site này có những
 * mảng gì" (người vào lần đầu). Báo in cũng in mục lục hai cách như vậy.
 *
 * Ngày đứng thành một rail bên trái để mắt quét được cột ngày mà không phải đọc
 * hết tiêu đề. Ngày KHÔNG dùng `font-mono` — nó là chữ, không phải cột số.
 */
export function LatestList({ posts }: { posts: Post[] }) {
  return (
    <ul className="divide-y divide-border">
      {posts.map((post) => (
        <li key={post.slug} className="py-4 sm:grid sm:grid-cols-12 sm:gap-x-6">
          <p className="text-sm text-muted-foreground sm:col-span-3">
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          </p>

          <div className="mt-1.5 sm:col-span-9 sm:mt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <CategoryTag category={post.category} />
              <KindTag kind={post.kind} />
            </div>

            <h3 className="mt-2 font-display text-lg leading-snug font-bold tracking-tight sm:text-xl">
              <Link
                href={`/blog/${post.slug}`}
                className="cursor-pointer hover:text-accent"
              >
                {post.title}
              </Link>
            </h3>

            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {post.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Một cột chuyên mục ở dải dưới trang nhất.
 *
 * Vì sao trang chủ có dải chuyên mục chứ không chỉ một danh sách phẳng: một danh
 * sách phẳng nói được "có gì mới" nhưng không nói được site này gồm những mảng
 * nào — mà đó chính là điều một site tổng hợp phải nói ngay. Bảy cột có nhan đề
 * cũng lấp kín chiều rộng, nên trang không lộ ra là mỗi mục còn ít bài.
 *
 * Khi số bài lên vài chục thì cắt `limit` ở chỗ gọi, không đổi bố cục.
 *
 * Nhan đề cột dùng font-sans uppercase, KHÔNG dùng font display: nó là nhãn mục,
 * cùng một mô-típ với nhãn chuyên mục trên thẻ bài và với `SectionHeading`.
 */
export function CategoryColumn({
  slug,
  name,
  description,
  posts,
  totalCount,
}: {
  slug: string;
  name: string;
  description: string;
  posts: Post[];
  /** Tổng số bài của chuyên mục — có thể lớn hơn `posts.length` vì danh sách bị cắt. */
  totalCount: number;
}) {
  return (
    <section aria-labelledby={`chuyen-muc-${slug}`}>
      <h3
        id={`chuyen-muc-${slug}`}
        className="flex items-baseline justify-between gap-2 border-b border-border pb-2 text-[0.6875rem] font-bold tracking-[0.18em] uppercase"
      >
        {name}
        {/* Số bài dùng mono tabular-nums: đây là cột số, đúng luật typography. */}
        <span className="shrink-0 font-mono text-[0.6875rem] font-normal tabular-nums text-muted-foreground">
          {totalCount}
        </span>
      </h3>

      {posts.length > 0 ? (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <li key={post.slug} className="py-3.5">
              <h4 className="font-display text-base leading-snug font-bold tracking-tight">
                <Link
                  href={`/blog/${post.slug}`}
                  className="cursor-pointer hover:text-accent"
                >
                  {post.title}
                </Link>
              </h4>
              <div className="mt-1.5">
                <PostMetaLine post={post} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-b border-border py-3.5 text-sm text-muted-foreground">
          Chưa có bài nào trong mục này.
        </p>
      )}

      {/* Mô tả chuyên mục đặt SAU danh sách, không trước: người quét trang chủ tìm
          tiêu đề bài, không tìm định nghĩa chuyên mục. Nó ở đây để cột nào chỉ có
          một bài vẫn không trông như bị bỏ dở, và để có chữ cho search engine. */}
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>

      <Link
        href={`/chuyen-muc/${slug}`}
        className="group mt-3 inline-flex cursor-pointer items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase hover:text-accent"
      >
        Cả chuyên mục
        {/* Chuyển động duy nhất trên surface này (motion 2/10);
            `prefers-reduced-motion` ở globals.css tắt nó. */}
        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </section>
  );
}

/**
 * Nhãn section trên trang danh sách — "section rule" kiểu báo in.
 *
 * Vì sao nhãn nhỏ chứ không phải `text-2xl font-bold` như bản trước: trên một trang
 * mục lục, thứ phải to nhất là **tiêu đề bài**, không phải chữ "Bài mới nhất". Bản
 * cũ để hai thứ gần bằng nhau (section 24px, tiêu đề bài 18px) nên không có thứ bậc
 * nào cả. Giờ nhãn thu về cỡ nhãn + gạch kẻ hết chiều rộng, tiêu đề bài phóng lên.
 * Vẫn là `<h2>` nên cấu trúc heading không đổi.
 */
export function SectionHeading({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border pb-2">
      <h2
        id={id}
        className="text-[0.6875rem] font-bold tracking-[0.18em] uppercase"
      >
        {title}
      </h2>

      {action ? (
        <Link
          href={action.href}
          className="cursor-pointer text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase underline decoration-1 underline-offset-4 hover:text-accent"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/*
 * ⚠️ `AffiliateNote` (dòng tiết lộ affiliate cuối trang chủ) ĐÃ BỎ theo yêu cầu
 * của chủ dự án, cùng lúc với dòng ở footer. Bỏ được vì hiện không bài nào chứa
 * link tài trợ. Lấy lại được từ git nếu cần.
 *
 * Thứ KHÔNG được bỏ khi có link tài trợ: nhãn tại chỗ của `PromoBox`
 * (`components/content.tsx`) — xem ghi chú trong `SiteFooter`.
 */

/**
 * Breadcrumb — dùng ở `/blog`, `/chuyen-muc/[slug]` và `/blog/[slug]`.
 *
 * Hai vai cùng lúc, và đó là lý do nó là component dùng chung chứ không phải markup
 * viết tại từng trang:
 *   1. Người tới từ Google rơi thẳng vào một bài, cần biết mình đang ở đâu.
 *   2. Cùng mảng `trail` này được `breadcrumbNode()` (`lib/seo.ts`) dịch sang
 *      `BreadcrumbList`. Google chỉ in đường dẫn thay cho URL trong kết quả tìm
 *      kiếm khi structured data KHỚP với breadcrumb thấy trên trang — viết tay hai
 *      chỗ là cách chắc chắn để hai chỗ lệch nhau.
 *
 * Mục cuối là trang đang mở: in chữ thường + `aria-current`, không phải link — link
 * trỏ về chính trang đang đứng chỉ làm người dùng bàn phím tab qua một đích vô nghĩa.
 */
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="cursor-pointer transition-colors duration-150 hover:text-foreground"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Số mục tối thiểu để hiện mục lục. Dưới ngưỡng này thì mục lục chỉ lặp lại thứ
 * người đọc thấy hết trong một lần cuộn — thêm một khối phải bỏ qua trước khi tới
 * chữ đầu tiên của bài.
 */
const TOC_MIN_ENTRIES = 4;

/**
 * Mục lục trong bài. `entries` do `withHeadingAnchors()` (`content/headings.tsx`)
 * sinh cùng lúc với `id` của các heading, nên không có mục nào trỏ vào anchor chết.
 *
 * Vì sao có nó trên một blog 12 bài: bài dài ở đây là dạng "làm theo từng bước", và
 * người tới từ tìm kiếm thường chỉ cần đúng một mục ("cách kiểm pin"). Đây cũng là
 * thứ cho Google đủ dữ liệu để hiện link tới từng mục ngay dưới kết quả — nhưng nó
 * chỉ hoạt động khi heading có `id` thật, không phải khi mục lục là danh sách chữ.
 *
 * Dùng `<a>` thay vì `<Link>`: đích là anchor trong chính trang này, không có gì để
 * prefetch, và `<Link>` sẽ đẩy thêm một entry vào history cho mỗi lần bấm.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length < TOC_MIN_ENTRIES) return null;

  return (
    <nav
      aria-labelledby="trong-bai-nay"
      className="max-w-2xl border-t-2 border-rule pt-3"
    >
      <h2
        id="trong-bai-nay"
        className="text-[0.6875rem] font-bold tracking-[0.18em] uppercase"
      >
        Trong bài này
      </h2>

      <ol className="mt-3 space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            /* h3 thụt vào + cỡ nhỏ hơn: thứ bậc của bài phải đọc được ngay trong
               mục lục, nếu không thì nó chỉ là một danh sách phẳng dài. */
            className={entry.level === 3 ? "pl-5 text-sm" : "text-[0.9375rem]"}
          >
            <a
              href={`#${entry.id}`}
              className={`cursor-pointer underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-accent ${
                entry.level === 3 ? "text-muted-foreground" : "text-primary"
              }`}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Khối "người viết" ở cuối bài.
 *
 * Đây là tín hiệu E-E-A-T rẻ nhất mà site đang bỏ trống: byline ở đầu bài chỉ có
 * một cái tên, còn ai đứng sau cái tên đó thì người đọc phải tự đi tìm. Khối này
 * lấy `bio`/`role` từ `AUTHORS` (`content/taxonomy.ts`) — cùng nguồn với
 * `personNode()` trong `lib/seo.ts` và với mục "Ai viết" ở `/gioi-thieu`, nên ba
 * chỗ không thể nói ba điều khác nhau về cùng một người.
 *
 * KHÔNG thêm ảnh chân dung hay các link mạng xã hội không tồn tại vào đây: bịa
 * hồ sơ tác giả là đúng thứ nó đang cố chứng minh là không có.
 */
export function AuthorCard({ authorId }: { authorId: string }) {
  const author = getAuthor(authorId);
  if (!author) return null;

  return (
    <aside
      aria-labelledby="nguoi-viet"
      className="max-w-2xl border-t-2 border-rule pt-6"
    >
      <h2
        id="nguoi-viet"
        className="text-[0.6875rem] font-bold tracking-[0.18em] uppercase"
      >
        Người viết
      </h2>

      <p className="mt-3 font-display text-xl font-bold">{author.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{author.role}</p>
      <p className="mt-3 text-muted-foreground">{author.bio}</p>

      <Link
        href="/gioi-thieu"
        className="group mt-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-accent"
      >
        Site này là gì, và kiếm tiền bằng cách nào
        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </aside>
  );
}

/**
 * Tiêu đề trang cho các trang không phải bài viết.
 * `eyebrow` để trang biết mình thuộc nhóm nào (ví dụ "Pháp lý") — chuẩn editorial.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="border-b border-border pb-8">
      {eyebrow ? (
        <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-accent uppercase">
          {eyebrow}
        </p>
      ) : null}

      <h1 className="mt-4 font-display text-3xl leading-[1.15] font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h1>

      {intro ? (
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {intro}
        </p>
      ) : null}
    </header>
  );
}

/*
 * ⚠️ `LegalGapNotice` (banner "Bản nháp — chưa dùng được cho pháp lý" ở đầu
 * /dieu-khoan và /chinh-sach-bao-mat) ĐÃ BỎ theo yêu cầu của chủ dự án: site
 * hiện chạy như blog cá nhân, chưa có pháp nhân nào để khai.
 *
 * Hai trang đó VẪN CÒN và vẫn phải đúng sự thật — chúng chỉ rơi về
 * `SITE.legal.entityName ?? SITE.name`, tức nói "InsightDaily vận hành" thay vì
 * bịa tên công ty. Điền `NEXT_PUBLIC_LEGAL_*` là chúng tự dùng tên pháp nhân.
 * Lấy banner lại được từ git nếu về sau chạy traffic trả tiền và cần nhắc.
 */

/**
 * Bọc văn bản dài. Style thật nằm ở `.prose` trong globals.css.
 * `max-w` do .prose tự lo (68ch) — đừng thêm max-w ở đây, sẽ chồng nhau.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose">{children}</div>;
}
