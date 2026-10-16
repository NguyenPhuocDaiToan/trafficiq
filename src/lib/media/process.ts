import sharp from "sharp";

/**
 * Xử lý ảnh admin tải lên TRƯỚC khi lưu. Thuần túy (không chạm DB) để test được.
 *
 * Không bao giờ lưu nguyên byte người dùng gửi. Mọi ảnh được giải mã rồi mã hóa
 * lại, vì vậy:
 *  - Định dạng do **sharp đọc từ nội dung** quyết định, không phải `Content-Type`
 *    hay đuôi file (cả hai đều do client tự khai). Chỉ jpeg/png/webp được nhận.
 *    SVG bị từ chối: nó là tài liệu có thể chứa script, và link ảnh này được
 *    mở trực tiếp trong tab trình duyệt của người đọc.
 *  - Metadata (EXIF, GPS, ICC…) bị bỏ: sharp mặc định không ghi lại chúng. Ảnh chụp
 *    từ điện thoại mang theo toạ độ — không có lý do để phát tán nó ra trang công khai.
 *  - Kích thước và dung lượng bị chặn: AGENTS.md đặt trần ≤ 200KB cho ảnh hero/OG vì
 *    băng thông và dung lượng đĩa đều có hạn.
 */

export type MediaKind = "hero" | "og";

export interface ProcessedImage {
  data: Buffer;
  contentType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
}

/** Lỗi do đầu vào của người dùng — `message` hiển thị thẳng cho admin. */
export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

/**
 * Trần của file GỬI LÊN. Vercel cắt body request ở 4.5MB, nên 4MB là con số lớn nhất
 * còn trả được lỗi tiếng Việt thay vì lỗi 413 trần của nền tảng.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Chống "decompression bomb": file PNG vài chục KB có thể khai báo 60000×60000 px
 * và ăn hết bộ nhớ của lambda khi giải mã. 40 megapixel đủ cho ảnh chụp điện thoại.
 */
const MAX_INPUT_PIXELS = 40_000_000;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

/**
 * Hero: card landing rộng tối đa 672px (`max-w-2xl`) → 1400px là gấp đôi cho màn
 * retina. WebP vì mọi trình duyệt hiện hành đều hiển thị được và nhỏ hơn JPEG.
 *
 * OG: 1200px là cỡ Facebook khuyến nghị. JPEG chứ không phải WebP vì crawler của
 * các mạng xã hội/chat app (Zalo, Telegram, iMessage…) hỗ trợ JPEG chắc chắn nhất, và
 * ảnh này là thứ DUY NHẤT trong card mà không có cách dự phòng khi crawler không đọc được.
 */
const PROFILE = {
  hero: { maxWidth: 1400, contentType: "image/webp" as const },
  og: { maxWidth: 1200, contentType: "image/jpeg" as const },
};

/** Dung lượng mục tiêu sau khi nén (AGENTS.md: ≤ 200KB). */
const TARGET_BYTES = 200 * 1024;
/** Trần cứng: vượt cả khi đã hạ chất lượng tới sàn và thu nhỏ thì từ chối thay vì lưu. */
const HARD_MAX_BYTES = 600 * 1024;

/**
 * Nấc chất lượng, từ cao xuống thấp; lấy nấc CAO NHẤT mà file còn nằm trong ngân sách.
 *
 * GIỮ NGUYÊN BỀ RỘNG, hạ chất lượng — KHÔNG thu nhỏ ảnh để lọt ngân sách. Đây là kết quả đo
 * chứ không phải cảm tính. Ảnh dày chi tiết nhất (ghép 9 ảnh blog thật thành 3000×2001, WebP
 * ngân sách 200KB; "cạnh" = năng lượng gradient so với bản chuẩn cùng cỡ):
 *
 *     1400px q50  196KB  PSNR 32,7 dB  giữ 98,1% cạnh
 *     1190px q80  225KB  PSNR 23,4 dB  giữ 87,4% cạnh   (q72–40 cũng chỉ ~87%)
 *      980px q88  204KB  PSNR 22,1 dB  giữ 77,9% cạnh
 *
 * Với JPEG ảnh chia sẻ (1200px) cùng quy luật: q60 giữ 94,3% cạnh, còn thu nhỏ xuống 1000px
 * ở q82 chỉ giữ 84,8%. Lỗi nén (khối, nhiễu hạt) khó thấy hơn nhiều so với mất độ phân giải,
 * nên hết nấc thì ĐỨNG Ở SÀN chất lượng và chấp nhận file lớn hơn 200KB (tới `HARD_MAX_BYTES`),
 * chỉ thu nhỏ khi ngay cả sàn cũng vượt trần cứng.
 *
 * Sàn khác nhau theo định dạng: WebP q50 vẫn sạch; JPEG q50 đã lộ khối 8×8 nên sàn là 60.
 *
 * Bản đầu của hàm này thu nhỏ bề rộng trước khi hạ dưới q72 (giả thuyết "mất độ phân giải
 * ít hại hơn nén mạnh") — số đo ở trên bác bỏ giả thuyết đó.
 */
const QUALITY_LADDER = {
  "image/webp": [88, 84, 80, 76, 72, 66, 60, 55, 50],
  "image/jpeg": [88, 84, 80, 76, 72, 66, 60],
} as const;

/**
 * Chỉ dùng khi ảnh vẫn vượt `HARD_MAX_BYTES` ở bề rộng đầy đủ và chất lượng sàn (ảnh nhiễu
 * hạt cực dày). Lúc đó không còn lựa chọn nào khác ngoài mất độ phân giải.
 */
const SHRINK_STEPS = [0.85, 0.7];

type Candidate = { data: Buffer; width: number; height: number };

async function encode(
  image: sharp.Sharp,
  contentType: ProcessedImage["contentType"],
  quality: number,
  opts: { graphic: boolean },
): Promise<Candidate> {
  // `.clone()` vì một pipeline sharp chỉ chạy được một lần.
  const clone = image.clone();
  const out =
    contentType === "image/webp"
      ? clone.webp({ quality })
      : // Ảnh đồ hoạ (PNG: chữ, ảnh chụp màn hình): 4:2:0 làm nhoè viền màu quanh nét chữ,
        // nên giữ đủ độ phân giải màu — tốn thêm ~25% dung lượng nhưng chữ không bị viền.
        // Ảnh chụp thì không phân biệt được nên không trả giá đó.
        clone.jpeg({ quality, mozjpeg: true, chromaSubsampling: opts.graphic ? "4:4:4" : "4:2:0" });
  const { data, info } = await out.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function processImage(
  input: Buffer,
  kind: MediaKind,
): Promise<ProcessedImage> {
  if (input.length === 0) throw new MediaError("File rỗng.");
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new MediaError(
      `File quá lớn (tối đa ${MAX_UPLOAD_BYTES / 1024 / 1024}MB). Hãy thu nhỏ ảnh trước khi tải lên.`,
    );
  }

  const profile = PROFILE[kind];

  let base: sharp.Sharp;
  let format: string;
  let sourceWidth: number;
  try {
    base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await base.metadata();

    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
      throw new MediaError("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
    }
    if (!meta.width || !meta.height) {
      throw new MediaError("Không đọc được kích thước ảnh.");
    }
    format = meta.format;
    // EXIF Orientation 5–8 là xoay 90° nên bề rộng hiển thị là chiều cao lưu trong file.
    sourceWidth = meta.orientation && meta.orientation >= 5 ? meta.height : meta.width;
  } catch (err) {
    if (err instanceof MediaError) throw err;
    // sharp ném cho file hỏng, vượt limitInputPixels, hoặc không phải ảnh.
    throw new MediaError("File không phải ảnh hợp lệ hoặc quá lớn về số điểm ảnh.");
  }

  // PNG gần như luôn là đồ hoạ/ảnh chụp màn hình; ảnh chụp thì là JPEG. Đủ để chọn cách nén.
  const graphic = format === "png";

  // Màu: KHÔNG cần gọi gì thêm. sharp/libvips tự chuyển ảnh có ICC (Display P3 của iPhone,
  // AdobeRGB, CMYK) sang sRGB khi nạp rồi mới bỏ profile — đã kiểm bằng test (ảnh P3 quay về
  // đúng màu gốc). Bỏ profile mà không chuyển mới làm màu nhạt đi; ở đây không xảy ra.
  const build = (width: number) => {
    // `.rotate()` không tham số = xoay theo EXIF Orientation rồi bỏ tag đó. Phải làm TRƯỚC
    // khi metadata bị loại, nếu không ảnh chụp dọc từ điện thoại bị nằm ngang.
    let p = base
      .clone()
      .rotate()
      // `fastShrinkOnLoad: false`: mặc định libvips thu nhỏ JPEG bằng DCT lúc giải mã, nhanh
      // nhưng kém chính xác hơn Lanczos đầy đủ — đánh đổi này không đáng cho ảnh chỉ tải lên một lần.
      .resize({ width, withoutEnlargement: true, kernel: "lanczos3", fastShrinkOnLoad: false });
    // JPEG không có kênh alpha — PNG trong suốt sẽ thành nền đen nếu không flatten.
    if (profile.contentType === "image/jpeg") {
      p = p.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    return p;
  };

  let best: Candidate | undefined;

  try {
    // Đồ hoạ → WebP lossless trước: ở mẫu chữ + nét mảnh nó vừa NHỎ hơn lossy q86 (42KB so với
    // 69KB) vừa giữ nguyên từng điểm ảnh. Chỉ dùng được khi đầu ra là WebP (hero); JPEG thì không.
    if (graphic && profile.contentType === "image/webp") {
      const { data, info } = await build(profile.maxWidth)
        .webp({ lossless: true })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= TARGET_BYTES) {
        return { data, contentType: profile.contentType, width: info.width, height: info.height };
      }
    }

    const ladder = QUALITY_LADDER[profile.contentType];
    const floorQuality = ladder[ladder.length - 1];

    /**
     * Nấc cao nhất ở bề rộng `width` mà file ≤ ngân sách; nếu không nấc nào vừa thì trả kết quả
     * ở SÀN (nhỏ nhất có thể ở bề rộng đó).
     *
     * Thử SÀN TRƯỚC: nếu sàn đã vượt ngân sách thì mọi nấc cao hơn còn lớn hơn, đi hết dãy chỉ
     * tốn CPU vô ích. Đây là chỗ chặn ảnh nhiễu hạt cực dày (thử nghiệm: nhiễu trắng 1000×4000
     * mất ~15 giây nếu đi hết 7 nấc × 3 bề rộng, còn ~2 giây khi thử sàn trước) — endpoint upload
     * không được là công cụ đốt CPU. Ảnh bình thường vẫn đi từ nấc cao xuống và dừng ở nấc đầu vừa.
     */
    const fit = async (width: number): Promise<Candidate> => {
      const floor = await encode(build(width), profile.contentType, floorQuality, { graphic });
      if (floor.data.length > TARGET_BYTES) return floor;
      for (const quality of ladder.slice(0, -1)) {
        const candidate = await encode(build(width), profile.contentType, quality, { graphic });
        if (candidate.data.length <= TARGET_BYTES) return candidate;
      }
      return floor;
    };

    // Bậc 1: bề rộng đầy đủ.
    const fullWidth = Math.min(profile.maxWidth, sourceWidth);
    best = await fit(fullWidth);

    // Bậc 2 (hiếm): sàn vẫn vượt trần cứng → thu nhỏ dần. Mỗi bậc chỉ tốn một lần encode nếu
    // vẫn quá nặng, nên tổng chi phí xấu nhất là vài lần encode chứ không phải cả dãy nấc.
    if (best.data.length > HARD_MAX_BYTES) {
      for (const step of SHRINK_STEPS) {
        const candidate = await fit(Math.round(fullWidth * step));
        if (candidate.data.length < best.data.length) best = candidate;
        if (best.data.length <= HARD_MAX_BYTES) break;
      }
    }
  } catch {
    throw new MediaError("Không xử lý được ảnh này. Thử xuất lại ảnh từ phần mềm chỉnh sửa.");
  }

  // `best` là nấc cao nhất vừa ngân sách, hoặc (nếu không có) kết quả nhỏ nhất đã thử.
  if (!best || best.data.length > HARD_MAX_BYTES) {
    throw new MediaError(
      "Ảnh vẫn quá nặng sau khi nén. Hãy chọn ảnh ít chi tiết hơn hoặc thu nhỏ trước.",
    );
  }

  return {
    data: best.data,
    contentType: profile.contentType,
    width: best.width,
    height: best.height,
  };
}
