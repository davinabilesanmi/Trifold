import { requireUser } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/actions/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid-2">
        <section className="card">
          <h2>Profile</h2>
          <dl className="details">
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd>{ROLE_LABELS[user.role]} <div className="muted small">{ROLE_DESCRIPTIONS[user.role]}</div></dd>
          </dl>
        </section>
        <section className="card">
          <h2>Change password</h2>
          <ActionForm action={changeOwnPassword} resetOnSuccess>
            <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" /></div>
            <div className="field"><label htmlFor="next">New password</label><input id="next" name="next" type="password" minLength={8} required autoComplete="new-password" /></div>
            <div className="field"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" /></div>
            <div className="form-actions"><SubmitButton>Update password</SubmitButton></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
