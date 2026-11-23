import type { Product, ProductPack } from "@prisma/client";
import { centsToInput, formatMoney } from "@/lib/format";
import { createPack, setPackActive, updatePack } from "@/lib/actions/products";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

function PackInputs({ pack, unit }: { pack?: ProductPack; unit: string }) {
  return (
    <div className="pack-row">
      <div className="field">
        <label>Pack name</label>
        <input name="name" type="text" required maxLength={40} defaultValue={pack?.name} placeholder="e.g. Carton, Drum" />
      </div>
      <div className="field">
        <label>Holds ({unit})</label>
        <input name="unitsPerPack" type="number" min={2} step={1} required defaultValue={pack?.unitsPerPack} placeholder="12" />
      </div>
      <div className="field">
        <label>Retail price (₦)</label>
        <input name="priceRetail" type="text" inputMode="decimal" defaultValue={pack ? centsToInput(pack.priceRetailCents) : ""} placeholder="0.00" />
      </div>
      <div className="field">
        <label>Wholesale price (₦)</label>
        <input name="priceWholesale" type="text" inputMode="decimal" defaultValue={pack ? centsToInput(pack.priceWholesaleCents) : ""} placeholder="0.00" />
      </div>
    </div>
  );
}

export function PackSizes({ product, packs, canEdit }: { product: Product; packs: ProductPack[]; canEdit: boolean }) {
  const active = packs.filter((p) => p.active);
  const archived = packs.filter((p) => !p.active);
  return (
    <section className="card">
      <h2>Pack sizes</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Sell or buy this product in bulk, e.g. a carton of 12 or a drum of 200. Stock is always counted in single {product.unit}s,
        so selling one carton of 12 takes 12 {product.unit}s out of stock.
      </p>
      {!canEdit ? (
        active.length === 0 ? <p className="empty">Sold in single {product.unit}s only.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pack</th><th className="num">Holds</th><th className="num">Retail</th><th className="num">Wholesale</th></tr></thead>
              <tbody>
                {active.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="num">{p.unitsPerPack} {product.unit}</td>
                    <td className="num nowrap">{formatMoney(p.priceRetailCents)}</td><td className="num nowrap">{formatMoney(p.priceWholesaleCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="stack">
          {active.map((p) => (
            <div key={p.id} className="pack-edit">
              <ActionForm action={updatePack.bind(null, p.id)}>
                <PackInputs pack={p} unit={product.unit} />
                <div className="form-actions">
                  <SubmitButton variant="secondary">Save {p.name}</SubmitButton>
                  {p.priceRetailCents > 0 && product.priceRetailCents > 0 && (
                    <span className="muted small">
                      {formatMoney(p.priceRetailCents / p.unitsPerPack)} per {product.unit} retail vs {formatMoney(product.priceRetailCents)} single
                    </span>
                  )}
                </div>
              </ActionForm>
              <form action={setPackActive.bind(null, p.id, false)}>
                <button type="submit" className="btn-link small">Stop using {p.name}</button>
              </form>
            </div>
          ))}
          <div className="pack-edit pack-new">
            <div className="field-label">Add a pack size</div>
            <ActionForm action={createPack.bind(null, product.id)} resetOnSuccess>
              <PackInputs unit={product.unit} />
              <div className="form-actions"><SubmitButton>Add pack size</SubmitButton></div>
            </ActionForm>
          </div>
          {archived.length > 0 && (
            <div className="muted small">
              Not in use:{" "}
              {archived.map((p) => (
                <form key={p.id} action={setPackActive.bind(null, p.id, true)} style={{ display: "inline" }}>
                  {p.name} ({p.unitsPerPack}) <button type="submit" className="btn-link small">restore</button>{" "}
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
