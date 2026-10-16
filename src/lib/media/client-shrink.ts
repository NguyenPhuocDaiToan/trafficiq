import { CLIENT_MAX_SIDE, CLIENT_SHRINK_ABOVE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/media/limits";

/**
 * Thu nhỏ ảnh NGAY TRONG TRÌNH DUYỆT trước khi tải lên (chỉ chạy ở client).
 *
 * Vì sao cần: Vercel cắt body request ở 4,5MB và ảnh chụp từ điện thoại thường 3–12MB. Không thu
 * nhỏ ở client thì admin phải tự đi nén ảnh bằng phần mềm khác mới tải lên được.
 *
 * Không làm giảm độ nét của kết quả cuối: ảnh chỉ được đưa về cạnh dài 2800px (gấp đôi ảnh lớn nhất
 * server xuất ra) với chất lượng JPEG cao; server vẫn thu nhỏ tiếp bằng Lanczos từ bản còn dư độ
 * phân giải, nên lần nén ở đây gần như không thấy được sau bước đó.
 *
 * Mọi hàm ở đây thất bại theo hướng "không làm gì": trả `null` để nơi gọi gửi file gốc và để
 * server báo lỗi có số liệu. Thu nhỏ là tối ưu, không phải điều kiện để upload.
 */

/** Các lần thử, từ giữ chất lượng nhất tới nhỏ nhất, cho tới khi vừa `MAX_UPLOAD_BYTES`. */
export const SHRINK_ATTEMPTS: readonly { maxSide: number; quality: number }[] = [
  { maxSide: CLIENT_MAX_SIDE, quality: 0.92 },
  { maxSide: CLIENT_MAX_SIDE, quality: 0.85 },
  { maxSide: 2100, quality: 0.85 },
  { maxSide: 1600, quality: 0.8 },
];

export function needsShrink(bytes: number): boolean {
  return bytes > CLIENT_SHRINK_ABOVE_BYTES;
}

/** Chỉ thu nhỏ, không bao giờ phóng to. */
export function scaledSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/**
 * Ảnh có điểm ảnh trong suốt không? JPEG không có kênh alpha — PNG/WebP trong suốt mà ép sang JPEG
 * sẽ thành nền đen. Có alpha thì giữ PNG.
 */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  // Little-endian: byte cao nhất của mỗi Uint32 là alpha.
  const px = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
  for (let i = 0; i < px.length; i++) if (px[i] >>> 24 !== 255) return true;
  return false;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Trả file đã thu nhỏ, hoặc `null` nếu trình duyệt không làm được (không giải mã được định dạng,
 * thiếu API…). Kết quả KHÔNG đảm bảo ≤ `MAX_UPLOAD_BYTES` — nơi gọi phải kiểm và báo số liệu.
 * Nếu thử hết các mức mà vẫn quá trần thì trả bản nhỏ nhất đã tạo ra.
 */
export async function shrinkImage(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    // Mặc định trình duyệt đã xoay theo EXIF Orientation và chuyển màu về sRGB.
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    let smallest: Blob | null = null;
    let smallestType = "image/jpeg";

    for (const attempt of SHRINK_ATTEMPTS) {
      const { width, height } = scaledSize(bitmap.width, bitmap.height, attempt.maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);

      const type = file.type !== "image/jpeg" && hasTransparency(ctx, width, height) ? "image/png" : "image/jpeg";
      const blob = await toBlob(canvas, type, attempt.quality);
      if (!blob) return null;

      if (!smallest || blob.size < smallest.size) {
        smallest = blob;
        smallestType = type;
      }
      if (blob.size <= MAX_UPLOAD_BYTES) break;
    }

    if (!smallest) return null;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([smallest], `${base}.${smallestType === "image/png" ? "png" : "jpg"}`, { type: smallestType });
  } finally {
    bitmap.close();
  }
}
