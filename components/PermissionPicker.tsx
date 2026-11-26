"use client";

import { useState } from "react";
import {
  PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PRESETS, ROLES, roleFor,
  type Permission, type Role,
} from "@/lib/permissions";

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

export function PermissionPicker({ initial, lockedForSelf = [] }: { initial: Permission[]; lockedForSelf?: Permission[] }) {
  const [perms, setPerms] = useState<Set<Permission>>(new Set(initial));
  const role = roleFor(perms);
  const apply = (r: Role) => setPerms(new Set([...ROLE_PRESETS[r], ...lockedForSelf]));
  const toggle = (k: Permission) =>
    setPerms((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  return (
    <fieldset className="perm-picker">
      <legend className="field-label">Responsibilities</legend>
      <div className="perm-presets">
        <span className="muted small">Start from:</span>
        {ROLES.map((r) => (
          <button key={r} type="button" className={role === r ? "btn btn-primary" : "btn btn-secondary"} onClick={() => apply(r)}>
            {ROLE_LABELS[r]}
          </button>
        ))}
        <span className="small muted">Now: <strong>{ROLE_LABELS[role]}</strong> — {ROLE_DESCRIPTIONS[role]}</span>
      </div>
      <div className="perm-groups">
        {GROUPS.map((g) => (
          <div key={g} className="perm-group">
            <div className="nav-label" style={{ padding: 0 }}>{g}</div>
            {PERMISSIONS.filter((p) => p.group === g).map((p) => {
              const locked = lockedForSelf.includes(p.key);
              return (
                <label key={p.key} className="checkbox">
                  <input type="checkbox" name="perm" value={p.key} checked={perms.has(p.key)} disabled={locked}
                    onChange={() => toggle(p.key)} />
                  {p.label}
                  {locked && <input type="hidden" name="perm" value={p.key} />}
                  {locked && <span className="muted small">(you can&apos;t remove this from yourself)</span>}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
