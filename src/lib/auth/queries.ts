import { adminUsers } from "@/lib/db/collections";
import type { AdminRole } from "@/lib/types";

/** View model của danh sách thành viên. KHÔNG chứa `passwordHash`/`tokenVersion` — không bao giờ ra khỏi server. */
export interface MemberView {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  locked: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export async function listMembers(): Promise<MemberView[]> {
  const docs = await (await adminUsers())
    .find({}, { projection: { passwordHash: 0, tokenVersion: 0 } })
    .sort({ createdAt: 1 })
    .limit(200)
    .toArray();
  const now = Date.now();
  return docs.map((u) => ({
    id: u._id!.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    locked: !!u.lockedUntil && u.lockedUntil.getTime() > now,
    lastLoginAt: u.lastLoginAt?.toISOString(),
    createdAt: u.createdAt.toISOString(),
  }));
}
