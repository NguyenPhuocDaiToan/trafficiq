import { contactMessages } from "@/lib/db/collections";

/** View model đã serialize để truyền xuống component. */
export interface ContactMessageView {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  handled: boolean;
}

const MAX_ROWS = 200;

/**
 * Hộp thư admin. `onlyUnhandled` là mặc định của trang — việc thường làm là xử lý
 * thư mới, không phải đọc lại thư cũ.
 *
 * KHÔNG trả về `ipHash`/`userAgent`: chúng chỉ dùng để chống spam ở tầng server,
 * hiện lên UI không giúp gì mà lại đưa dữ liệu suy ra được về IP vào HTML.
 */
export async function listContactMessages(
  onlyUnhandled: boolean,
): Promise<ContactMessageView[]> {
  const col = await contactMessages();
  const docs = await col
    .find(onlyUnhandled ? { handled: false } : {})
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    subject: doc.subject,
    message: doc.message,
    createdAt: doc.createdAt.toISOString(),
    handled: doc.handled,
  }));
}

/** Số thư chưa xử lý — hiện trên tiêu đề để biết còn việc mà không phải mở tab. */
export async function countUnhandledMessages(): Promise<number> {
  const col = await contactMessages();
  return col.countDocuments({ handled: false });
}
