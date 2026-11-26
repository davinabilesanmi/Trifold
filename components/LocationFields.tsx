import type { Location } from "@prisma/client";

export function LocationFields({ location }: { location?: Location }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="code">Code</label>
          <input id="code" name="code" type="text" required maxLength={20} placeholder="WH-01" defaultValue={location?.code} />
          <span className="hint">Short unique code, e.g. WH-LAGOS</span>
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={100} defaultValue={location?.name} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="address">Address</label>
        <textarea id="address" name="address" maxLength={300} defaultValue={location?.address ?? ""} />
      </div>
    </>
  );
}
