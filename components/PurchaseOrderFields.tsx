"use client";

import { useMemo, useState } from "react";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/format";

type Pack = { id: string; name: string; unitsPerPack: number };
type Product = { id: string; name: string; sku: string; unit: string; costCents: number; packs: Pack[] };
type Option = { id: string; name: string };
type Line = { key: number; productId: string; packId: string; quantity: string; cost: string };

let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, productId: "", packId: "", quantity: "1", cost: "" });

export function PurchaseOrderFields({ products, suppliers, locations, defaultSupplierId }: {
  products: Product[]; suppliers: Option[]; locations: (Option & { code: string })[]; defaultSupplierId?: string;
}) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const defaultCost = (p: Product | undefined, units: number) => (p && p.costCents ? centsToInput(p.costCents * units) : "");
  const lineTotal = (l: Line) => (Number.parseInt(l.quantity, 10) || 0) * (parseMoneyToCents(l.cost) ?? 0);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const payload = JSON.stringify(lines.filter((l) => l.productId).map(({ productId, packId, quantity, cost }) => ({ productId, packId: packId || null, quantity, cost })));

  return (
    <>
      <input type="hidden" name="lines" value={payload} />
      <div className="form-row">
        <div className="field">
          <label htmlFor="supplierId">Supplier</label>
          <select id="supplierId" name="supplierId" required defaultValue={defaultSupplierId ?? ""}>
            <option value="" disabled>Choose…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="locationId">Deliver to</label>
          <select id="locationId" name="locationId" required defaultValue={locations.length === 1 ? locations[0].id : ""}>
            <option value="" disabled>Choose…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table sale-lines">
          <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Cost each (₦)</th><th className="num">Amount</th><th aria-label="Remove" /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td style={{ minWidth: 220 }}>
                  <select aria-label={`Product ${i + 1}`} value={l.productId} onChange={(e) => {
                    const p = byId.get(e.target.value);
                    update(l.key, { productId: e.target.value, packId: "", cost: defaultCost(p, 1) });
                  }}>
                    <option value="">Choose product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  {byId.get(l.productId)?.packs.length ? (
                    <select aria-label={`Pack ${i + 1}`} value={l.packId} style={{ marginTop: 4 }} onChange={(e) => {
                      const p = byId.get(l.productId)!;
                      const pack = p.packs.find((x) => x.id === e.target.value);
                      update(l.key, { packId: e.target.value, cost: defaultCost(p, pack?.unitsPerPack ?? 1) });
                    }}>
                      <option value="">Single {byId.get(l.productId)!.unit}</option>
                      {byId.get(l.productId)!.packs.map((pk) => <option key={pk.id} value={pk.id}>{pk.name} of {pk.unitsPerPack}</option>)}
                    </select>
                  ) : null}
                </td>
                <td className="num" style={{ width: 90 }}>
                  <input aria-label={`Quantity ${i + 1}`} type="number" min={1} step={1} value={l.quantity} style={{ textAlign: "right" }}
                    onChange={(e) => update(l.key, { quantity: e.target.value })} />
                </td>
                <td className="num" style={{ width: 150 }}>
                  <input aria-label={`Unit cost ${i + 1}`} type="text" inputMode="decimal" value={l.cost} placeholder="0.00" style={{ textAlign: "right" }}
                    onChange={(e) => update(l.key, { cost: e.target.value })} />
                </td>
                <td className="num nowrap">{formatMoney(lineTotal(l))}</td>
                <td>{lines.length > 1 && <button type="button" className="btn-link small" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}><button type="button" className="btn btn-secondary" onClick={() => setLines((ls) => [...ls, blank()])}>+ Add product</button></td>
              <td className="num nowrap"><strong>{formatMoney(total)}</strong></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="field">
        <label htmlFor="note">Note</label>
        <textarea id="note" name="note" maxLength={500} placeholder="Optional, e.g. supplier's invoice number or delivery date" />
      </div>
    </>
  );
}
