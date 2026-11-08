"use client";

import { useMemo, useState } from "react";
import { formatMoney, parseMoneyToCents, centsToInput } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PriceLevel } from "@/lib/money";

type Product = { id: string; name: string; sku: string; unit: string; priceRetailCents: number; priceWholesaleCents: number };
type Customer = { id: string; name: string; type: string };
type Location = { id: string; name: string; code: string };
type Line = { key: number; productId: string; quantity: string; price: string };

type Props = {
  products: Product[];
  customers: Customer[];
  locations: Location[];
  /** stock[locationId][productId] = quantity on hand */
  stock: Record<string, Record<string, number>>;
  canOverridePrices: boolean;
  defaultCustomerId?: string;
  defaultLocationId?: string;
};

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, productId: "", quantity: "1", price: "" });

export function SaleFields({ products, customers, locations, stock, canOverridePrices, defaultCustomerId, defaultLocationId }: Props) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const customer = customers.find((c) => c.id === customerId);
  const [walkInLevel, setWalkInLevel] = useState<PriceLevel>("RETAIL");
  const level: PriceLevel = customer ? (customer.type === "WHOLESALE" ? "WHOLESALE" : "RETAIL") : walkInLevel;
  const [locationId, setLocationId] = useState(defaultLocationId ?? (locations.length === 1 ? locations[0].id : ""));
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paid, setPaid] = useState<string | null>(null); // null = follow the total
  const [method, setMethod] = useState<string>("CASH");

  const listPrice = (p: Product | undefined, lvl = level) => (p ? (lvl === "WHOLESALE" ? p.priceWholesaleCents : p.priceRetailCents) : 0);
  const priceOf = (l: Line) => {
    if (canOverridePrices && l.price !== "") return parseMoneyToCents(l.price) ?? 0;
    return listPrice(byId.get(l.productId));
  };
  const total = lines.reduce((s, l) => s + (Number.parseInt(l.quantity, 10) || 0) * priceOf(l), 0);
  const paidCents = paid === null ? total : parseMoneyToCents(paid) ?? 0;
  const balance = total - paidCents;

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const used = new Set(lines.map((l) => l.productId));

  const payload = JSON.stringify(
    lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: l.quantity, ...(canOverridePrices && l.price !== "" ? { price: l.price } : {}) })),
  );

  return (
    <>
      <input type="hidden" name="lines" value={payload} />
      <input type="hidden" name="priceLevel" value={level} />
      <input type="hidden" name="amountPaid" value={paid === null ? centsToInput(total) : paid} />

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
              const available = locationId && p ? stock[locationId]?.[p.id] ?? 0 : null;
              const qty = Number.parseInt(l.quantity, 10) || 0;
              return (
                <tr key={l.key}>
                  <td style={{ minWidth: 220 }}>
                    <select aria-label={`Product ${i + 1}`} value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value, price: "" })}>
                      <option value="">Choose product…</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id} disabled={used.has(prod.id) && prod.id !== l.productId}>
                          {prod.name} ({prod.sku})
                        </option>
                      ))}
                    </select>
                    {available !== null && (
                      <div className={`small ${qty > available ? "neg" : "muted"}`}>{available} {p!.unit} in stock here</div>
                    )}
                  </td>
                  <td className="num" style={{ width: 90 }}>
                    <input aria-label={`Quantity ${i + 1}`} type="number" min={1} step={1} value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })} style={{ textAlign: "right" }} />
                  </td>
                  <td className="num nowrap" style={{ width: 150 }}>
                    {canOverridePrices && p ? (
                      <input aria-label={`Price ${i + 1}`} type="text" inputMode="decimal" value={l.price}
                        placeholder={centsToInput(listPrice(p))} onChange={(e) => update(l.key, { price: e.target.value })} style={{ textAlign: "right" }} />
                    ) : p ? formatMoney(listPrice(p)) : "—"}
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
              <td className="num nowrap"><strong>{formatMoney(total)}</strong></td>
              <td />
            </tr>
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
