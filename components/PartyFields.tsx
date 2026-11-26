import type { Customer, Supplier } from "@prisma/client";

export function CustomerFields({ customer }: { customer?: Customer }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={120} defaultValue={customer?.name} placeholder="Person or business name" />
        </div>
        <div className="field">
          <label htmlFor="type">Customer type</label>
          <select id="type" name="type" defaultValue={customer?.type ?? "RETAIL"}>
            <option value="RETAIL">Retail (pays retail price)</option>
            <option value="WHOLESALE">Wholesale (pays wholesale price)</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="text" inputMode="tel" maxLength={40} defaultValue={customer?.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" maxLength={120} defaultValue={customer?.email ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="address">Address</label>
        <textarea id="address" name="address" maxLength={300} defaultValue={customer?.address ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" maxLength={1000} defaultValue={customer?.notes ?? ""} />
      </div>
    </>
  );
}

export function SupplierFields({ supplier }: { supplier?: Supplier }) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Supplier name</label>
          <input id="name" name="name" type="text" required maxLength={120} defaultValue={supplier?.name} />
        </div>
        <div className="field">
          <label htmlFor="contactName">Contact person</label>
          <input id="contactName" name="contactName" type="text" maxLength={120} defaultValue={supplier?.contactName ?? ""} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="text" inputMode="tel" maxLength={40} defaultValue={supplier?.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" maxLength={120} defaultValue={supplier?.email ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="address">Address</label>
        <textarea id="address" name="address" maxLength={300} defaultValue={supplier?.address ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" maxLength={1000} defaultValue={supplier?.notes ?? ""} />
      </div>
    </>
  );
}
