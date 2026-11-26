import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can, parsePermissions } from "@/lib/permissions";
import { updateUser } from "@/lib/actions/users";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PermissionPicker } from "@/components/PermissionPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { parseIds } from "@/lib/auth";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission(can.manageUsers);
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();
  const self = user.id === me.id;
  const locations = await prisma.location.findMany({ where: { OR: [{ active: true }, { id: { in: parseIds(user.locationIds) } }] }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title={user.name} subtitle={[user.jobTitle, user.email].filter(Boolean).join(" · ")} />
      <div className="card" style={{ maxWidth: 820 }}>
        <ActionForm action={updateUser.bind(null, user.id)}>
          <div className="form-row">
            <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required defaultValue={user.name} /></div>
            <div className="field">
              <label htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" name="jobTitle" type="text" maxLength={60} defaultValue={user.jobTitle ?? ""} placeholder="e.g. Sales rep, Storekeeper, MD" />
            </div>
          </div>
          <div className="field"><label htmlFor="email">Email (used to sign in)</label><input id="email" name="email" type="email" required defaultValue={user.email} /></div>
          <PermissionPicker initial={parsePermissions(user.permissions)} lockedForSelf={self ? ["manageUsers"] : []} />
          <LocationPicker locations={locations} selected={parseIds(user.locationIds)} />
          <label className="checkbox">
            {self ? (
              <><input type="checkbox" checked disabled /><input type="hidden" name="active" value="on" /></>
            ) : (
              <input type="checkbox" name="active" defaultChecked={user.active} />
            )}
            Account active (untick to stop this person signing in)
          </label>
          <div className="field">
            <label htmlFor="password">Reset password</label>
            <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to keep current password" />
            <span className="hint">Resetting a password or deactivating the account signs the person out everywhere.</span>
          </div>
          <div className="form-actions">
            <SubmitButton>Save</SubmitButton>
            <Link href="/users" className="btn btn-secondary">Back to staff</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
