import type { FormState } from "@/lib/forms";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

export function OpeningBalanceForm({ action, who }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  who: "customer" | "supplier";
}) {
  return (
    <section className="card">
      <h2>Opening balance</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {who === "customer"
          ? "If this customer already owed Trifold money before you started using the system, enter it once here. It then appears as an unpaid statement you can record payments against."
          : "If Trifold already owed this supplier money before you started using the system, enter it once here. You can then record payments against it."}
      </p>
      <ActionForm action={action}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="ob-amount">Amount owed (₦)</label>
            <input id="ob-amount" name="amount" type="text" inputMode="decimal" required placeholder="0.00" />
          </div>
          <div className="field">
            <label htmlFor="ob-note">Note</label>
            <input id="ob-note" name="note" type="text" maxLength={300} placeholder="e.g. Balance from old ledger, 31 Oct" />
          </div>
        </div>
        <div className="form-actions"><SubmitButton>Save opening balance</SubmitButton></div>
      </ActionForm>
    </section>
  );
}
