/**
 * Chọn nơi lưu ảnh admin tải lên, bằng MỘT biến môi trường: `STORAGE_DRIVER`.
 *
 *   disk    Ghi ra đĩa của máy chạy app (VM). Cần `UPLOAD_DIR`.
 *   vercel  Vercel Blob. Cần `BLOB_READ_WRITE_TOKEN` (store phải PUBLIC).
 *   s3      Bất kỳ dịch vụ tương thích S3: AWS S3, Cloudflare R2, MinIO, Backblaze B2…
 *           Cần `S3_BUCKET`, `S3_PUBLIC_URL` và thông tin xác thực (xem dưới).
 *
 * Thuần túy (đọc `env` truyền vào, không chạm đĩa/mạng) để test được mọi tổ hợp cấu hình.
 *
 * Để trống `STORAGE_DRIVER` = `vercel`: dự án deploy bằng CI/CD lên Vercel, nơi đĩa không bền nên
 * `disk` sẽ mất ảnh âm thầm — mặc định phải là thứ chạy được ở môi trường production. Chạy local
 * mà không có `BLOB_READ_WRITE_TOKEN` thì nhận lỗi rõ ràng; đặt `STORAGE_DRIVER=disk` để ghi ra
 * thư mục `uploads/` khi phát triển, hoặc `s3` khi lên VM/CDN riêng.
 *
 * Mọi driver trả về một chuỗi để lưu vào field ảnh của campaign: `disk` trả đường dẫn tương đối
 * `/uploads/<tên>` (đổi domain không hỏng), `vercel`/`s3` trả URL tuyệt đối. Schema nhận cả hai
 * nên chuyển driver giữa chừng không làm hỏng campaign cũ.
 */

export type StorageDriverName = "disk" | "vercel" | "s3";

export const STORAGE_DRIVERS: readonly StorageDriverName[] = ["disk", "vercel", "s3"];

export type StorageConfig =
  | { driver: "disk"; dir: string }
  | { driver: "vercel"; token: string }
  | {
      driver: "s3";
      bucket: string;
      region: string;
      /** Có = dịch vụ không phải AWS (R2, MinIO…). */
      endpoint?: string;
      /** Thiếu cả hai khoá = dùng chuỗi xác thực mặc định của AWS SDK (IAM role, profile…). */
      credentials?: { accessKeyId: string; secretAccessKey: string };
      /** MinIO và một số dịch vụ tự dựng cần `endpoint/bucket/key` thay vì `bucket.endpoint/key`. */
      forcePathStyle: boolean;
      /** Gốc URL công khai của object, không có `/` cuối — ví dụ domain CDN hoặc `https://<bucket>.s3.<region>.amazonaws.com`. */
      publicUrl: string;
      /** Tiền tố khoá, có `/` cuối (hoặc rỗng). */
      keyPrefix: string;
    };

/** Thiếu hoặc sai cấu hình — lỗi của người vận hành, không phải của file admin vừa chọn. */
export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function readStorageConfig(env: Env = process.env): StorageConfig {
  const requested = clean(env.STORAGE_DRIVER)?.toLowerCase();

  const defaulted = !requested;

  switch (requested ?? "vercel") {
    case "disk": {
      // Đĩa trên Vercel là chỉ-đọc/tạm thời: chọn tường minh `disk` ở đó là cấu hình sai, và để nó
      // chạy thì ảnh biến mất sau mỗi lần cold start mà không ai thấy lỗi nào.
      if (env.VERCEL) {
        throw new StorageNotConfiguredError(
          "STORAGE_DRIVER=disk không dùng được trên Vercel (đĩa không bền). Dùng vercel hoặc s3.",
        );
      }
      return diskConfig(env);
    }
    case "vercel": {
      const token = clean(env.BLOB_READ_WRITE_TOKEN);
      if (!token) {
        throw new StorageNotConfiguredError(
          (defaulted
            ? "Nơi lưu ảnh mặc định là Vercel Blob nhưng thiếu BLOB_READ_WRITE_TOKEN"
            : "STORAGE_DRIVER=vercel cần BLOB_READ_WRITE_TOKEN") +
            " (tạo Blob store PUBLIC trong Vercel dashboard rồi Connect Project). Hoặc đặt STORAGE_DRIVER=disk|s3, hoặc dán link ảnh.",
        );
      }
      return { driver: "vercel", token };
    }
    case "s3":
      return s3Config(env);
    default:
      throw new StorageNotConfiguredError(
        `STORAGE_DRIVER="${requested}" không hợp lệ. Giá trị hợp lệ: ${STORAGE_DRIVERS.join(", ")}.`,
      );
  }
}

function diskConfig(env: Env): StorageConfig {
  // Mặc định là chuỗi TƯƠNG ĐỐI thay vì `path.join(process.cwd(), …)` / `path.resolve(…)`:
  // Turbopack thấy hai lời gọi đó là "đường dẫn có thể trỏ tới bất cứ đâu trong dự án" và theo dấu
  // cả repo vào bundle. `fs` tự resolve đường dẫn tương đối theo cwd. Hệ quả: trên VM nên đặt
  // `UPLOAD_DIR` là đường dẫn TUYỆT ĐỐI, ngoài thư mục deploy.
  return { driver: "disk", dir: clean(env.UPLOAD_DIR) ?? "uploads" };
}

function s3Config(env: Env): StorageConfig {
  const bucket = clean(env.S3_BUCKET);
  const publicUrl = clean(env.S3_PUBLIC_URL)?.replace(/\/+$/, "");
  const endpoint = clean(env.S3_ENDPOINT);
  const region = clean(env.S3_REGION) ?? (endpoint ? "auto" : undefined);
  const accessKeyId = clean(env.S3_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.S3_SECRET_ACCESS_KEY);

  const missing = [
    !bucket && "S3_BUCKET",
    !publicUrl && "S3_PUBLIC_URL",
    !region && "S3_REGION",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new StorageNotConfiguredError(`STORAGE_DRIVER=s3 thiếu: ${missing.join(", ")}.`);
  }
  // Chỉ một nửa cặp khoá gần như chắc chắn là nhập thiếu; đừng im lặng rơi về chuỗi mặc định.
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new StorageNotConfiguredError(
      "S3_ACCESS_KEY_ID và S3_SECRET_ACCESS_KEY phải đi cùng nhau (hoặc bỏ trống cả hai để dùng IAM role).",
    );
  }
  if (!/^https?:\/\//i.test(publicUrl!)) {
    throw new StorageNotConfiguredError("S3_PUBLIC_URL phải bắt đầu bằng http:// hoặc https://.");
  }
  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    throw new StorageNotConfiguredError("S3_ENDPOINT phải bắt đầu bằng http:// hoặc https://.");
  }

  const prefix = (clean(env.S3_KEY_PREFIX) ?? "campaign-images/").replace(/^\/+/, "");
  return {
    driver: "s3",
    bucket: bucket!,
    region: region!,
    endpoint,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    forcePathStyle: clean(env.S3_FORCE_PATH_STYLE)?.toLowerCase() === "true",
    publicUrl: publicUrl!,
    keyPrefix: prefix === "" || prefix.endsWith("/") ? prefix : `${prefix}/`,
  };
}
