"use client";

import { useMemo, useState } from "react";
import { formatMoney, parseMoneyToCents, centsToInput } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PriceLevel } from "@/lib/money";

type Pack = { id: string; name: string; unitsPerPack: number; priceRetailCents: number; priceWholesaleCents: number };
type Product = { id: string; name: string; sku: string; unit: string; priceRetailCents: number; priceWholesaleCents: number; packs: Pack[] };
type Customer = { id: string; name: string; type: string };
type Location = { id: string; name: string; code: string };
type Line = { key: number; productId: string; packId: string; quantity: string; price: string };

type Props = {
  products: Product[];
  customers: Customer[];
  locations: Location[];
  /** stock[locationId][productId] = quantity on hand */
  stock: Record<string, Record<string, number>>;
  canOverridePrices: boolean;
  canGiveDiscounts: boolean;
  vatRate: number;
  defaultCustomerId?: string;
  defaultLocationId?: string;
};

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, productId: "", packId: "", quantity: "1", price: "" });

export function SaleFields({ products, customers, locations, stock, canOverridePrices, canGiveDiscounts, vatRate, defaultCustomerId, defaultLocationId }: Props) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const customer = customers.find((c) => c.id === customerId);
  const [walkInLevel, setWalkInLevel] = useState<PriceLevel>("RETAIL");
  const level: PriceLevel = customer ? (customer.type === "WHOLESALE" ? "WHOLESALE" : "RETAIL") : walkInLevel;
  const [locationId, setLocationId] = useState(defaultLocationId ?? (locations.length === 1 ? locations[0].id : ""));
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paid, setPaid] = useState<string | null>(null); // null = follow the total
  const [method, setMethod] = useState<string>("TRANSFER");
  const [discount, setDiscount] = useState("");

  const listPrice = (item: { priceRetailCents: number; priceWholesaleCents: number } | undefined) =>
    item ? (level === "WHOLESALE" ? item.priceWholesaleCents : item.priceRetailCents) : 0;
  const packOf = (l: Line) => byId.get(l.productId)?.packs.find((p) => p.id === l.packId);
  const itemOf = (l: Line) => packOf(l) ?? byId.get(l.productId);
  const priceOf = (l: Line) => {
    if (canOverridePrices && l.price !== "") return parseMoneyToCents(l.price) ?? 0;
    return listPrice(itemOf(l));
  };
  /** Single units of each product already asked for across all lines. */
  const unitsWanted = new Map<string, number>();
  for (const l of lines) {
    if (!l.productId) continue;
    const units = (Number.parseInt(l.quantity, 10) || 0) * (packOf(l)?.unitsPerPack ?? 1);
    unitsWanted.set(l.productId, (unitsWanted.get(l.productId) ?? 0) + units);
  }
  const subtotal = lines.reduce((s, l) => s + (Number.parseInt(l.quantity, 10) || 0) * priceOf(l), 0);
  const discountCents = canGiveDiscounts ? parseMoneyToCents(discount) ?? 0 : 0;
  const total = Math.max(0, subtotal - discountCents);
  const vat = vatRate ? Math.round((total * vatRate) / (100 + vatRate)) : 0;
  const paidCents = paid === null ? total : parseMoneyToCents(paid) ?? 0;
  const balance = total - paidCents;

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const payload = JSON.stringify(
    lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, packId: l.packId || null, quantity: l.quantity, ...(canOverridePrices && l.price !== "" ? { price: l.price } : {}) })),
  );

  return (
    <>
      <input type="hidden" name="lines" value={payload} />
      <input type="hidden" name="priceLevel" value={level} />
      <input type="hidden" name="amountPaid" value={paid === null ? centsToInput(total) : paid} />
      <input type="hidden" name="discount" value={canGiveDiscounts ? discount : ""} />

      <div className="form-row">
        <div className="field">
          <label htmlFor="customerId">Customer</label>
          <select id="customerId" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in customer (pays in full)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.type === "WHOLESALE" ? " · wholesale" : ""}</option>)}
          </select>
          <span className="hint">
            {customer ? `${customer.type === "WHOLESALE" ? "Wholesale" : "Retail"} prices apply.` : <>New customer? <a href="/customers/new" target="_blank">Add them</a>, then reload this page.</>}
          </span>
        </div>
        {!customer && (
          <div className="field">
            <label htmlFor="walkInLevel">Price list</label>
            <select id="walkInLevel" value={walkInLevel} onChange={(e) => setWalkInLevel(e.target.value as PriceLevel)}>
              <option value="RETAIL">Retail</option>
              <option value="WHOLESALE">Wholesale</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="locationId">Sell from</label>
          <select id="locationId" name="locationId" required value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table sale-lines">
          <thead>
            <tr><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th><th aria-label="Remove" /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = byId.get(l.productId);
              const pack = packOf(l);
              const available = locationId && p ? stock[locationId]?.[p.id] ?? 0 : null;
              const qty = Number.parseInt(l.quantity, 10) || 0;
              const short = available !== null && p ? (unitsWanted.get(p.id) ?? 0) > available : false;
              return (
                <tr key={l.key}>
                  <td style={{ minWidth: 220 }}>
                    <select aria-label={`Product ${i + 1}`} value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value, packId: "", price: "" })}>
                      <option value="">Choose product…</option>
                      {products.map((prod) => <option key={prod.id} value={prod.id}>{prod.name} ({prod.sku})</option>)}
                    </select>
                    {p && p.packs.length > 0 && (
                      <select aria-label={`Pack ${i + 1}`} value={l.packId} onChange={(e) => update(l.key, { packId: e.target.value, price: "" })} style={{ marginTop: 4 }}>
                        <option value="">Single {p.unit}</option>
                        {p.packs.map((pk) => <option key={pk.id} value={pk.id}>{pk.name} of {pk.unitsPerPack} {p.unit}</option>)}
                      </select>
                    )}
                    {available !== null && (
                      <div className={`small ${short ? "neg" : "muted"}`}>
                        {available} {p!.unit} in stock here{pack ? ` (${Math.floor(available / pack.unitsPerPack)} ${pack.name.toLowerCase()})` : ""}
                      </div>
                    )}
                  </td>
                  <td className="num" style={{ width: 90 }}>
                    <input aria-label={`Quantity ${i + 1}`} type="number" min={1} step={1} value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })} style={{ textAlign: "right" }} />
                    {pack && <div className="muted small">= {qty * pack.unitsPerPack} {p!.unit}</div>}
                  </td>
                  <td className="num nowrap" style={{ width: 150 }}>
                    {canOverridePrices && p ? (
                      <input aria-label={`Price ${i + 1}`} type="text" inputMode="decimal" value={l.price}
                        placeholder={centsToInput(listPrice(itemOf(l)))} onChange={(e) => update(l.key, { price: e.target.value })} style={{ textAlign: "right" }} />
                    ) : p ? formatMoney(listPrice(itemOf(l))) : "—"}
                    {pack && <div className="muted small">per {pack.name.toLowerCase()}</div>}
                  </td>
                  <td className="num nowrap">{p ? formatMoney(qty * priceOf(l)) : "—"}</td>
                  <td>
                    {lines.length > 1 && (
                      <button type="button" className="btn-link small" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3}><button type="button" className="btn btn-secondary" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add product</button></td>
              <td className="num nowrap">{discountCents > 0 ? formatMoney(subtotal) : <strong>{formatMoney(total)}</strong>}</td>
              <td />
            </tr>
            {canGiveDiscounts && (
              <tr>
                <td colSpan={3} className="num"><label htmlFor="discount">Discount (₦)</label></td>
                <td className="num" style={{ width: 150 }}>
                  <input id="discount" type="text" inputMode="decimal" value={discount} placeholder="0.00" style={{ textAlign: "right" }}
                    onChange={(e) => setDiscount(e.target.value)} />
                </td>
                <td />
              </tr>
            )}
            {discountCents > 0 && (
              <tr><td colSpan={3} className="num"><strong>Total</strong></td><td className="num nowrap"><strong>{formatMoney(total)}</strong></td><td /></tr>
            )}
            {vatRate > 0 && (
              <tr><td colSpan={3} className="num muted small">Includes VAT at {vatRate}%</td><td className="num nowrap muted small">{formatMoney(vat)}</td><td /></tr>
            )}
          </tbody>
        </table>
      </div>
      {canOverridePrices && <p className="hint muted small" style={{ margin: 0 }}>Leave a price blank to use the {level.toLowerCase()} list price.</p>}

      <div className="form-row">
        <div className="field">
          <label htmlFor="paid">Amount paid now (₦)</label>
          <input id="paid" type="text" inputMode="decimal" value={paid === null ? centsToInput(total) : paid}
            onChange={(e) => setPaid(e.target.value)} />
          <span className={`hint ${balance > 0 ? "neg" : ""}`}>
            {balance > 0 ? `${formatMoney(balance)} will be owed${customer ? ` by ${customer.name}` : " — choose a customer to allow this"}.` : "Paid in full."}
          </span>
        </div>
        <div className="field">
          <label htmlFor="method">Payment method</label>
          <select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reference">Payment reference</label>
          <input id="reference" name="reference" type="text" maxLength={100} placeholder="Transfer or POS ref (optional)" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="note">Note</label>
        <textarea id="note" name="note" maxLength={500} placeholder="Optional, e.g. vehicle or delivery details" />
      </div>
    </>
  );
}
