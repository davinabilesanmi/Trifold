import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can, isRole } from "@/lib/permissions";
import { updateUser } from "@/lib/actions/users";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { RoleSelect } from "@/components/RoleSelect";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission(can.manageUsers);
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();
  const self = user.id === me.id;

  return (
    <>
      <PageHeader title={user.name} subtitle={user.email} />
      <div className="card" style={{ maxWidth: 560 }}>
        <ActionForm action={updateUser.bind(null, user.id)}>
          <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required defaultValue={user.name} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required defaultValue={user.email} /></div>
          <RoleSelect defaultValue={isRole(user.role) ? user.role : "STAFF"} />
          <label className="checkbox">
            <input type="checkbox" name="active" defaultChecked={user.active} /> Account active
          </label>
          {self && <p className="hint muted small" style={{ margin: 0 }}>You can&apos;t remove your own admin role or deactivate yourself.</p>}
          <div className="field">
            <label htmlFor="password">Reset password</label>
            <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to keep current password" />
            <span className="hint">Resetting a password or deactivating the account signs the user out everywhere.</span>
          </div>
          <div className="form-actions">
            <SubmitButton>Save user</SubmitButton>
            <Link href="/users" className="btn btn-secondary">Back to users</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
