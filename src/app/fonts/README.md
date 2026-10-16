# Font chữ Ả Rập tự host

| File | Họ chữ | Dùng cho | Nguồn |
|---|---|---|---|
| `noto-sans-arabic-arabic-wght-normal.woff2` | Noto Sans Arabic (variable, wght 100–900) | body + giao diện (`--font-sans`) | Fontsource `@fontsource-variable/noto-sans-arabic` 5.3.0, subset `arabic` |
| `noto-naskh-arabic-arabic-wght-normal.woff2` | Noto Naskh Arabic (variable, wght 400–700) | nhan đề công khai (`--font-display`) | Fontsource `@fontsource-variable/noto-naskh-arabic` 5.3.0, subset `arabic` |

Giấy phép: SIL Open Font License 1.1 (`OFL-*.txt` cùng thư mục) — cho phép tự host và phân phối lại.

**Vì sao không dùng `next/font/google` như ba font còn lại:** xem khối chú thích ở đầu `src/app/globals.css`.
Tóm tắt: CSS của next/font phủ mọi dải ký tự của font (`subsets` chỉ điều khiển preload) và luôn thêm một font dự
phòng `local("Arial")` không tắt được trên Turbopack. Hai điều đó khiến không thể ghép font Ả Rập đúng thứ tự.
Ở đây `@font-face` tự khai `unicode-range` chỉ gồm khối chữ Ả Rập nên ghép được.

**Cập nhật:** `npm i -D @fontsource-variable/noto-sans-arabic @fontsource-variable/noto-naskh-arabic`, chép lại file
`files/*-arabic-wght-normal.woff2`, đối chiếu `unicode.json` (subset `arabic`) với `unicode-range` trong globals.css,
rồi gỡ gói. Chạy `npm run check:fonts`.
