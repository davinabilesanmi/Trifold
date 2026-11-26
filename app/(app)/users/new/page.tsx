import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can, ROLE_PRESETS } from "@/lib/permissions";
import { createUser } from "@/lib/actions/users";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PermissionPicker } from "@/components/PermissionPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { prisma } from "@/lib/db";

export const metadata = { title: "Add staff" };

export default async function NewUserPage() {
  await requirePermission(can.manageUsers);
  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add staff member" subtitle="Share the temporary password with them privately; they can change it from their account page." />
      <div className="card" style={{ maxWidth: 820 }}>
        <ActionForm action={createUser}>
          <div className="form-row">
            <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required /></div>
            <div className="field">
              <label htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" name="jobTitle" type="text" maxLength={60} placeholder="e.g. Sales rep, Storekeeper, MD" />
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="email">Email (used to sign in)</label><input id="email" name="email" type="email" required /></div>
            <div className="field">
              <label htmlFor="password">Temporary password</label>
              <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
              <span className="hint">At least 8 characters.</span>
            </div>
          </div>
          <PermissionPicker initial={ROLE_PRESETS.SALES_REP} />
          <LocationPicker locations={locations} />
          <div className="form-actions">
            <SubmitButton>Create account</SubmitButton>
            <Link href="/users" className="btn btn-secondary">Cancel</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
