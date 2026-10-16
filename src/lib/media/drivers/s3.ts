import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageConfig } from "@/lib/media/storage-config";

type S3Config = Extract<StorageConfig, { driver: "s3" }>;

/**
 * Driver `s3`: mọi dịch vụ tương thích S3 (AWS S3, Cloudflare R2, MinIO, Backblaze B2…).
 * Trả URL tuyệt đối `S3_PUBLIC_URL/<khoá>`.
 *
 * Bucket PHẢI đọc được công khai (hoặc đứng sau CDN/domain công khai trỏ vào `S3_PUBLIC_URL`) —
 * người đọc landing và crawler của mạng xã hội tải ảnh thẳng từ URL này, không qua app. Code KHÔNG
 * đặt ACL cho từng object: bucket mới của AWS mặc định chặn ACL, quyền đọc công khai nằm ở bucket
 * policy / cấu hình R2 / MinIO.
 *
 * Client được cache theo cấu hình: tạo mới mỗi request là tạo lại pool kết nối. Khoá là chuỗi JSON
 * của cấu hình, nên đổi biến môi trường rồi khởi động lại sẽ tạo client mới.
 */
const clients = new Map<string, S3Client>();

function clientFor(config: S3Config): S3Client {
  const cacheKey = JSON.stringify([
    config.region,
    config.endpoint,
    config.forcePathStyle,
    config.credentials?.accessKeyId,
  ]);
  let client = clients.get(cacheKey);
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials,
      // Từ AWS SDK v3.729, mặc định là LUÔN gắn checksum CRC32 và mã hoá body kiểu `aws-chunked`.
      // AWS S3 hiểu, nhưng nhiều dịch vụ tương thích S3 (R2, B2, MinIO cũ…) từ chối với lỗi
      // `x-amz-content-sha256` / `NotImplemented`. `WHEN_REQUIRED` = hành vi cũ, chạy mọi nơi; ảnh
      // đã được kiểm toàn vẹn bằng sha256 trong tên file nên không mất gì.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    clients.set(cacheKey, client);
  }
  return client;
}

export async function saveToS3(
  config: S3Config,
  file: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const key = `${config.keyPrefix}${file}`;

  await clientFor(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      // Tên file là sha256 của nội dung nên URL không bao giờ đổi nội dung → cache vô thời hạn.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${config.publicUrl}/${key}`;
}
