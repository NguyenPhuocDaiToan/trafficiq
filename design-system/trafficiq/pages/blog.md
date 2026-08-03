# Page Override — Website nội dung công khai

**Áp dụng cho:** `/` (trang chủ), `/blog`, `/blog/[slug]`, `/chuyen-muc/[slug]`,
`/gioi-thieu`, `/lien-he`, `/dieu-khoan`, `/chinh-sach-bao-mat`,
`/tiet-lo-lien-ket`

> Luật trong file này **override MASTER.md** cho các route trên.
> `/admin/**` vẫn theo `pages/dashboard.md`. `/c/[slug]` vẫn theo
> `pages/campaign-landing.md`. Ba surface, ba bộ luật.

---

## Vì sao cần override

MASTER.md sinh ra cho category **Analytics Dashboard**: density 8/10, row height
36px, mọi thứ nén chặt để nhìn được nhiều số. Surface này ngược hẳn — người đọc ở
đây đang **đọc văn bản dài**, không quét số liệu. Dùng density 8/10 cho một bài
2000 chữ thì chữ chật và không ai đọc hết.

---

## Dials

| Dial | MASTER | Ở đây | Lý do |
|---|---|---|---|
| Style | Data-Dense Dashboard | **Editorial Grid / Magazine** | xem mục dưới |
| Pattern | Real-Time / Operations Landing | **Content-First Index** | không có "live status" để show; trang chủ là cửa vào nội dung |
| Density | 8/10 | **3/10** | văn bản dài cần khoảng trắng; 68ch/dòng, leading 1.75 |
| Motion | 3/10 | **2/10** | chỉ hover và focus. Không reveal-on-scroll, không parallax |
| Variance | 4/10 | **4/10** | giữ nguyên — vẫn là cùng một brand |

### Chốt style: lấy `--domain style`, không lấy `--design-system`

Hai lệnh của skill trả về hai kết quả khác nhau cho cùng surface này:

```bash
# (1) theo độ liên quan của query
python .claude/skills/ui-ux-pro-max/scripts/search.py \
  "blog content website with article list, post detail, long-form reading, SEO, about and contact pages" \
  --domain style -n 5
# -> #1 Editorial Grid / Magazine
#    "Best For: News sites, blogs, magazines, editorial content, long-form articles, journalism"
#    WCAG AAA | Tailwind 10/10 | Complexity Low | Dark ✓ Full

# (2) theo dial --variance
python .claude/skills/ui-ux-pro-max/scripts/search.py \
  "Vietnamese blog content website: article list, post detail long-form reading, about, contact, privacy policy" \
  --design-system --stack nextjs -p TrafficIQ --format markdown
# -> Swiss Modernism 2.0 + pattern "Newsletter / Content First"
```

Theo luật trong `AGENTS.md` ("nếu hai kết quả lệch nhau, lấy theo `--domain style`"):
**dùng Editorial Grid / Magazine.**

Hai thứ trong output `--design-system` bị **bỏ hẳn**, ghi lại để sau không ai
tưởng là quên:

1. **Pattern "Newsletter / Content First"** — toàn bộ conversion focus của nó là
   thu email (`Single field form (Email only)`, `Show 'Join X,000 readers'`,
   `Sticky header form`). Dự án **không có** hệ thống gửi mail, không có
   subscriber. Dựng form email không xử lý được là lừa người đọc. Dùng pattern
   **Content-First Index** thay thế: trang chủ = bài nổi bật + danh sách mới nhất
   + chuyên mục, CTA là "đọc bài", không phải "đăng ký".
2. **Palette riêng** (`--primary #18181B`, `--accent #EC4899`, background
   `#FAFAFA`) — bỏ. Dự án có **một** tầng token duy nhất trong `globals.css`.
   Thêm accent hồng nghĩa là có hai màu accent trong cùng codebase, phá luật
   "`--accent` là màu duy nhất cho CTA chính" của MASTER và làm
   `npm run check:contrast` phải gác thêm một bộ cặp màu thứ hai.

### KHÔNG override

- **Colors** — dùng nguyên token MASTER. Blog và admin là cùng một sản phẩm.
- **Typography** — dùng nguyên Be Vietnam Pro / JetBrains Mono của MASTER.
  (Editorial Grid gợi ý `--body-font: Georgia/Merriweather`, tức serif cho thân
  bài. **Bỏ**: thêm một họ font thứ ba tốn bandwidth mà AGENTS.md đã ràng
  ~100GB/tháng của Hobby. Độ dễ đọc lấy lại bằng size 17px + measure 68ch +
  leading 1.75, không cần đổi họ chữ.)
- **Shadow / radius** — nguyên MASTER.

---

## Layout

```
Header  sticky, h-14, border-b, bg-card/blur
        logo + MAIN_NAV + link Quản trị
Main    max-width theo ngữ cảnh:
          - trang chủ / danh sách:  max-w-6xl  (grid 12 cột)
          - thân bài viết:          max-w-none nhưng .prose tự giới hạn 68ch
Footer  3 cột (Nội dung / Về site / Pháp lý) + dòng bản quyền + tiết lộ affiliate
```

Grid: `repeat(12, 1fr)`, `gap: 1rem` (Editorial Grid). Bài nổi bật chiếm 12 cột,
bài thường 4 cột ở desktop → 6 ở tablet → 12 ở mobile.

### Thứ tự section trang chủ

1. Hero — tên site + một câu nói rõ site này viết về gì (KHÔNG form email)
2. Bài nổi bật — 1 bài, ô lớn, có nhãn chuyên mục
3. Bài mới nhất — grid
4. Chuyên mục — dải link
5. Ghi chú affiliate — một dòng, dẫn tới `/tiet-lo-lien-ket`

---

## Ràng buộc riêng của surface này

- **Ảnh: không có.** Bandwidth Hobby ~100GB/tháng và AGENTS.md đã ràng ảnh
  ≤200KB. Thẻ bài dùng **cover kiểu chữ** (nhãn chuyên mục + tiêu đề lớn trên nền
  tint token). Không `<img>`, không Image Optimization, 0 byte ảnh. Đây cũng đúng
  chất Editorial Grid: "typography editorial, article hierarchy".
- **Không drop cap** dù Editorial Grid gợi ý `::first-letter { font-size: 4em }`.
  Chữ hoa tiếng Việt có dấu ("Ở", "Ế", "Ộ") phóng 4em sẽ bị cắt dấu hoặc đè dòng
  trên. Lý do ghi trong `globals.css` ngay chỗ bỏ.
- **Trang này ĐƯỢC index** — ngược với `/admin/**` và `/c/[slug]` preview.
  Mỗi bài phải có: `alternates.canonical`, OG đầy đủ, JSON-LD `BlogPosting`.
- **Mọi link ra ngoài có tính chất affiliate phải `rel="nofollow sponsored"`** và
  bài đó phải hiện nhãn tiết lộ. Không có ngoại lệ — đây là yêu cầu pháp lý, không
  phải lựa chọn design.
- **Không có nội dung nào chỉ hiện khi có JS.** Blog phải đọc được với JS tắt và
  crawler phải thấy toàn văn trong HTML đầu tiên.

---

## Pre-Delivery Checklist (kế thừa MASTER + thêm)

- [ ] Không emoji làm icon — SVG (Heroicons/Lucide)
- [ ] `cursor-pointer` trên mọi thứ click được
- [ ] Transition 150–300ms
- [ ] Focus visible khi tab
- [ ] `prefers-reduced-motion` được tôn trọng
- [ ] Responsive 375 / 768 / 1024 / 1440
- [ ] Không horizontal scroll ở mobile; bảng/code scroll trong khung
- [ ] **Thân bài ≤ 68ch/dòng**
- [ ] **Mỗi bài có canonical + OG + JSON-LD BlogPosting**
- [ ] **Link affiliate có `rel="nofollow sponsored"` + nhãn tiết lộ**
- [ ] **Tắt JS vẫn đọc được toàn bộ bài**
- [ ] **Heading dùng `font-sans`, không phải `font-mono`** (xem MASTER § Typography)
