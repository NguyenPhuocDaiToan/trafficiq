import { ObjectId } from "mongodb";
import { adminUsers } from "@/lib/db/collections";
import { isDuplicateKeyError } from "@/lib/tracking/emit";
import type { AdminUser } from "@/lib/types";
import type { UserStore } from "@/lib/auth/login";

/** Cài đặt `UserStore` trên Mongo. Logic chính sách nằm ở `login.ts`; ở đây chỉ có truy vấn. */
export const mongoUserStore: UserStore = {
  async findByEmail(email) {
    return (await adminUsers()).findOne({ email });
  },

  async countUsers() {
    return (await adminUsers()).estimatedDocumentCount();
  },

  async insertOwner(user) {
    const col = await adminUsers();
    try {
      const { insertedId } = await col.insertOne({ ...user } as AdminUser);
      return { ...user, _id: insertedId };
    } catch (err) {
      if (isDuplicateKeyError(err)) return null;
      throw err;
    }
  },

  async incrementFailures(id) {
    const col = await adminUsers();
    const doc = await col.findOneAndUpdate(
      { _id: id },
      { $inc: { failedLogins: 1 } },
      { returnDocument: "after", projection: { failedLogins: 1 } },
    );
    return doc?.failedLogins ?? 0;
  },

  async lock(id, until) {
    await (await adminUsers()).updateOne({ _id: id }, { $set: { lockedUntil: until, failedLogins: 0 } });
  },

  async markLogin(id, now, newHash) {
    await (await adminUsers()).updateOne(
      { _id: id },
      {
        $set: { failedLogins: 0, lastLoginAt: now, ...(newHash ? { passwordHash: newHash } : {}) },
        $unset: { lockedUntil: "" },
      },
    );
  },
};

export function asObjectId(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}
