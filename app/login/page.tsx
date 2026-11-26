import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/lib/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="auth-page">
      <div className="card auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trifold-logo.png" alt="Trifold Global, Distribution Solutions" className="auth-logo" width={708} height={423} />
        <h1>Sign in</h1>
        <p className="muted">Use the account your administrator gave you.</p>
        <ActionForm action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
