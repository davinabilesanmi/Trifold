import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can, labelForRole, parsePermissions } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Staff" };

export default async function UsersPage() {
  const me = await requirePermission(can.manageUsers);
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Staff" subtitle="People who can sign in, and what each one is responsible for."
        actions={<Link href="/users/new" className="btn btn-primary">Add staff member</Link>} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Job title</th><th>Email</th><th>Access</th><th>Status</th><th>Added</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? undefined : "row-archived"}>
                <td><Link href={`/users/${u.id}`}>{u.name}</Link>{u.id === me.id && <span className="muted small"> (you)</span>}</td>
                <td>{u.jobTitle}</td>
                <td>{u.email}</td>
                <td className="nowrap">{labelForRole(u.role)} <span className="muted small">({parsePermissions(u.permissions).length} responsibilities)</span></td>
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
