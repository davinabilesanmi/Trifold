import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings, SETTING_FIELDS } from "@/lib/settings";
import { saveSettings } from "@/lib/actions/settings";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission(can.manageSettings);
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" subtitle="Business details printed on invoices and receipts." />
      <div className="card" style={{ maxWidth: 640 }}>
        <ActionForm action={saveSettings}>
          {SETTING_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              {"multiline" in f && f.multiline ? (
                <textarea id={f.key} name={f.key} defaultValue={settings[f.key]} maxLength={1000} />
              ) : (
                <input id={f.key} name={f.key} type="text" defaultValue={settings[f.key]} maxLength={200} required={f.key === "businessName"} />
              )}
              {"hint" in f && <span className="hint">{f.hint}</span>}
            </div>
          ))}
          <div className="form-actions"><SubmitButton>Save settings</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  );
}
