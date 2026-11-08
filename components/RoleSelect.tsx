import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";

export function RoleSelect({ defaultValue = "STAFF" }: { defaultValue?: Role }) {
  return (
    <div className="field">
      <label htmlFor="role">Role</label>
      <select id="role" name="role" defaultValue={defaultValue}>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>)}
      </select>
    </div>
  );
}
