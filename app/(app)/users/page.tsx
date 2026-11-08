import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can, isRole, ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePermission(can.manageUsers);
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Users" subtitle="People who can sign in to Trifold Stock."
        actions={<Link href="/users/new" className="btn btn-primary">Add user</Link>} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? undefined : "row-archived"}>
                <td><Link href={`/users/${u.id}`}>{u.name}</Link>{u.id === me.id && <span className="muted small"> (you)</span>}</td>
                <td>{u.email}</td>
                <td>{isRole(u.role) ? ROLE_LABELS[u.role] : u.role}</td>
                <td>{u.active ? <span className="badge badge-ok">Active</span> : <span className="badge badge-archived">Deactivated</span>}</td>
                <td className="nowrap">{formatDateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
