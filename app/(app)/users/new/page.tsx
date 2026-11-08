import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createUser } from "@/lib/actions/users";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { RoleSelect } from "@/components/RoleSelect";

export const metadata = { title: "Add user" };

export default async function NewUserPage() {
  await requirePermission(can.manageUsers);
  return (
    <>
      <PageHeader title="Add user" subtitle="Share the temporary password with them securely; they can change it from their account page." />
      <div className="card" style={{ maxWidth: 560 }}>
        <ActionForm action={createUser}>
          <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" type="text" required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
          <RoleSelect />
          <div className="field">
            <label htmlFor="password">Temporary password</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            <span className="hint">At least 8 characters.</span>
          </div>
          <div className="form-actions">
            <SubmitButton>Create user</SubmitButton>
            <Link href="/users" className="btn btn-secondary">Cancel</Link>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
