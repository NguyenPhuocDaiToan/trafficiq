import { z } from "zod";

/**
 * Form liên hệ công khai. Đây là endpoint DUY NHẤT trên site nhận dữ liệu tự do
 * từ người lạ, nên mọi field đều có trần độ dài — không để một request đẩy
 * document nhiều MB vào DB (M0 chỉ có 512MB).
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(120, "Tên quá dài"),
  email: z.email("Email không hợp lệ").trim().max(200),
  subject: z
    .string()
    .trim()
    .min(3, "Tiêu đề quá ngắn")
    .max(200, "Tiêu đề quá dài"),
  message: z
    .string()
    .trim()
    .min(20, "Vui lòng viết ít nhất 20 ký tự để tôi hiểu bạn cần gì")
    .max(5000, "Nội dung quá dài — vui lòng rút gọn dưới 5000 ký tự"),
});

/**
 * Tên field bẫy bot. Trường này ẩn với người thật (CSS), nên nếu nó có giá trị
 * thì gần như chắc chắn là bot điền tự động.
 *
 * Đặt tên là "website" vì bot nhắm đúng những tên quen thuộc như thế. Đừng đặt là
 * "honeypot".
 */
export const HONEYPOT_FIELD = "website";
