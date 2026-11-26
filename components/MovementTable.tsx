import Link from "next/link";
import type { Location, Movement, Product, User } from "@prisma/client";
import { MovementBadge } from "./Badges";
import { formatDateTime, formatNumber } from "@/lib/format";

export type MovementRow = Movement & {
  product: Pick<Product, "id" | "sku" | "name" | "unit">;
  fromLocation: Pick<Location, "id" | "code" | "name"> | null;
  toLocation: Pick<Location, "id" | "code" | "name"> | null;
  user: Pick<User, "name">;
};

export const movementRowInclude = {
  product: { select: { id: true, sku: true, name: true, unit: true } },
  fromLocation: { select: { id: true, code: true, name: true } },
  toLocation: { select: { id: true, code: true, name: true } },
  user: { select: { name: true } },
} as const;

function LocationLink({ loc }: { loc: MovementRow["fromLocation"] }) {
  if (!loc) return null;
  return <Link href={`/locations/${loc.id}`} title={loc.name}>{loc.code}</Link>;
}

function signedQuantity(m: MovementRow) {
  if (m.type === "RECEIPT") return `+${formatNumber(m.quantity)}`;
  if (m.type === "ISSUE") return `−${formatNumber(m.quantity)}`;
  if (m.type === "ADJUSTMENT") return m.quantity > 0 ? `+${formatNumber(m.quantity)}` : `−${formatNumber(-m.quantity)}`;
  return formatNumber(m.quantity);
}

export function MovementTable({ movements, showProduct = true }: { movements: MovementRow[]; showProduct?: boolean }) {
  if (movements.length === 0) return <p className="empty">No stock movements yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            {showProduct && <th>Product</th>}
            <th>Location</th>
            <th className="num">Qty</th>
            <th>Reference</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td className="nowrap">{formatDateTime(m.createdAt)}</td>
              <td><MovementBadge type={m.type} /></td>
              {showProduct && (
                <td>
                  <Link href={`/products/${m.product.id}`}>{m.product.name}</Link>
                  <div className="muted small">{m.product.sku}</div>
                </td>
              )}
              <td className="nowrap">
                {m.type === "TRANSFER" ? (
                  <><LocationLink loc={m.fromLocation} /> → <LocationLink loc={m.toLocation} /></>
                ) : (
                  <LocationLink loc={m.fromLocation ?? m.toLocation} />
                )}
              </td>
              <td className={`num nowrap ${m.type === "ISSUE" || m.quantity < 0 ? "neg" : m.type === "TRANSFER" ? "" : "pos"}`}>
                {signedQuantity(m)} <span className="muted small">{m.product.unit}</span>
              </td>
              <td>
                {m.reference}
                {m.note && <div className="muted small">{m.note}</div>}
              </td>
              <td className="nowrap">{m.user.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
