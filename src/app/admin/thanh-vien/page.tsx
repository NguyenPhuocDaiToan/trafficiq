import { ActionForm, FieldsButton } from "@/components/action-form";
import {
  Card,
  EmptyRow,
  Field,
  Table,
  TableWrap,
  Th,
  Tr,
  inputClass,
} from "@/components/ui";
import {
  createMember,
  resetMemberPassword,
  setMemberActive,
  setMemberRole,
} from "@/lib/auth/actions";
import { requireOwner } from "@/lib/auth/current-user";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { listMembers } from "@/lib/auth/queries";
import { formatDateTime } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Thành viên" };

/**
 * Chỉ owner. `requireOwner()` ở đây là lớp CHẶN thật (member gõ thẳng đường dẫn cũng bị đưa đi); nút trong
 * thanh điều hướng bị ẩn với member chỉ là tiện. Mỗi action bên dưới tự kiểm lại bằng DB.
 */
export default async function MembersPage() {
  const me = await requireOwner();
  const members = await listMembers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Thành viên</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mỗi người có tài khoản riêng. <strong>Owner</strong> quản lý thành viên và tên miền;{" "}
          <strong>thành viên</strong> làm việc với chiến dịch, đối tác và URL đích. Mọi tài khoản đều
          thấy toàn bộ dữ liệu — chiến dịch ghi lại ai tạo và ai sửa gần nhất.
        </p>
      </div>

      <Card
        title="Thêm thành viên"
        description={`Đặt mật khẩu ban đầu (tối thiểu ${PASSWORD_MIN} ký tự) rồi gửi cho họ qua kênh riêng; họ tự đổi ở mục tên của mình trên thanh trên cùng.`}
      >
        <ActionForm action={createMember} submitLabel="Tạo tài khoản" className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input type="email" name="email" required autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Tên hiển thị">
            <input name="name" required minLength={2} maxLength={80} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Vai trò">
            <select name="role" defaultValue="member" className={inputClass}>
              <option value="member">Thành viên</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
          <Field label="Mật khẩu ban đầu">
            <input
              type="text"
              name="password"
              required
              minLength={PASSWORD_MIN}
              maxLength={200}
              autoComplete="off"
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </Card>

      <Card title={`Tài khoản (${members.length})`}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Người dùng</Th>
                <Th>Vai trò</Th>
                <Th>Trạng thái</Th>
                <Th>Đăng nhập gần nhất</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <EmptyRow colSpan={5}>Chưa có tài khoản nào.</EmptyRow>
              ) : (
                members.map((m) => (
                  <Tr key={m.id}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">
                        {m.name}
                        {m.id === me.id ? <span className="ml-1 text-xs text-muted-foreground">(bạn)</span> : null}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="px-3 py-2 align-top">{m.role === "owner" ? "Owner" : "Thành viên"}</td>
                    <td className="px-3 py-2 align-top">
                      {!m.active ? (
                        <span className="text-destructive">Đã tắt</span>
                      ) : m.locked ? (
                        <span className="text-warning">Khoá tạm (nhập sai nhiều lần)</span>
                      ) : (
                        <span className="text-success">Hoạt động</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{formatDateTime(m.lastLoginAt)}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        {m.active ? (
                          <FieldsButton action={setMemberActive} fields={{ id: m.id, active: "false" }} label="Tắt" />
                        ) : (
                          <FieldsButton action={setMemberActive} fields={{ id: m.id, active: "true" }} label="Bật lại" />
                        )}
                        {m.role === "owner" ? (
                          <FieldsButton action={setMemberRole} fields={{ id: m.id, role: "member" }} label="Hạ xuống thành viên" />
                        ) : (
                          <FieldsButton action={setMemberRole} fields={{ id: m.id, role: "owner" }} label="Nâng lên owner" />
                        )}
                      </div>
                      <div className="mt-2">
                        <details>
                          <summary className="cursor-pointer text-xs text-primary">Đặt lại mật khẩu</summary>
                          <ActionForm
                            action={resetMemberPassword}
                            submitLabel="Đặt lại"
                            submitVariant="secondary"
                            className="mt-2 flex flex-col gap-2"
                          >
                            <input type="hidden" name="id" value={m.id} />
                            <input
                              type="text"
                              name="password"
                              required
                              minLength={PASSWORD_MIN}
                              maxLength={200}
                              autoComplete="off"
                              placeholder="Mật khẩu mới"
                              className={inputClass}
                            />
                          </ActionForm>
                        </details>
                      </div>
                    </td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
        <p className="mt-3 text-xs text-muted-foreground">
          Tắt tài khoản, đổi vai trò hoặc đặt lại mật khẩu đều đăng xuất mọi thiết bị của người đó: họ không
          thao tác được nữa ngay lập tức, và trang đang mở của họ chuyển về đăng nhập ở lần tải lại kế tiếp.
          Không thể tắt hoặc hạ owner cuối cùng.
        </p>
      </Card>
    </div>
  );
}
