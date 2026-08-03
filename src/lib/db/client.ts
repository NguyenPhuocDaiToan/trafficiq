import { MongoClient, type Db } from "mongodb";
import { mongodbDb, mongodbUri } from "@/lib/env";

/**
 * GOTCHA 4.2 — MongoClient PHẢI được cache toàn cục.
 *
 * Mỗi serverless invocation mở client mới => Atlas M0 (~500 connection) cạn
 * trong vài phút và app sập. Giữ promise trên `globalThis` để sống qua các
 * invocation trên cùng một warm instance, và để HMR trong dev không tạo
 * client mới mỗi lần save file.
 *
 * Không bao giờ gọi client.close() trong request handler.
 */

const globalForMongo = globalThis as unknown as {
  __tiqMongoClientPromise?: Promise<MongoClient>;
};

export function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo.__tiqMongoClientPromise) {
    const client = new MongoClient(mongodbUri(), {
      // Pool nhỏ: nhiều instance × pool lớn = cạn connection M0.
      maxPoolSize: 5,
      minPoolSize: 0,
      // Đóng connection rảnh để instance ngủ không giữ slot.
      maxIdleTimeMS: 60_000,
      // Fail nhanh thay vì treo request 30s mặc định.
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      retryWrites: true,
    });

    globalForMongo.__tiqMongoClientPromise = client.connect().catch((err) => {
      // Xóa cache khi connect fail, nếu không mọi request sau đều nhận lại
      // đúng promise đã reject và không bao giờ retry được.
      globalForMongo.__tiqMongoClientPromise = undefined;
      throw err;
    });
  }
  return globalForMongo.__tiqMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(mongodbDb());
}
