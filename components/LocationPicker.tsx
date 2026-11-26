type Loc = { id: string; name: string; code: string };

/** Ticks for the locations a person works at. None ticked means all locations. */
export function LocationPicker({ locations, selected = [] }: { locations: Loc[]; selected?: string[] }) {
  return (
    <fieldset className="perm-picker">
      <legend className="field-label">Works at</legend>
      <p className="muted small" style={{ margin: 0 }}>
        Tick an outlet to tie this person to it: they can then only sell, move stock and see reports for the ticked locations.
        Leave all unticked for people who work across the whole company (owner, GM, head-office staff).
      </p>
      <div className="perm-groups">
        {locations.map((l) => (
          <label key={l.id} className="checkbox">
            <input type="checkbox" name="loc" value={l.id} defaultChecked={selected.includes(l.id)} /> {l.name} <span className="muted small">{l.code}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
