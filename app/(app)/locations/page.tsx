import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createLocation } from "@/lib/actions/locations";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { LocationFields } from "@/components/LocationFields";
import { ArchivedBadge } from "@/components/Badges";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const user = await requireUser();
  const locations = await prisma.location.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { stock: { where: { quantity: { not: 0 } }, include: { product: { select: { costCents: true } } } } },
  });
  const manage = can.manageLocations(user);

  return (
    <>
      <PageHeader title="Locations" subtitle="Warehouses, stores and other places Trifold holds stock." />
      <div className={manage ? "grid-2" : undefined}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Location</th><th>Code</th><th className="num">Products</th><th className="num">Units</th><th className="num">Value</th></tr></thead>
            <tbody>
              {locations.length === 0 && <tr><td colSpan={5} className="empty">No locations yet.</td></tr>}
              {locations.map((l) => (
                <tr key={l.id} className={l.active ? undefined : "row-archived"}>
                  <td><Link href={`/locations/${l.id}`}>{l.name}</Link> {!l.active && <ArchivedBadge />}</td>
                  <td>{l.code}</td>
                  <td className="num">{formatNumber(l.stock.length)}</td>
                  <td className="num">{formatNumber(l.stock.reduce((s, x) => s + x.quantity, 0))}</td>
                  <td className="num">{formatMoney(l.stock.reduce((s, x) => s + x.quantity * x.product.costCents, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {manage && (
          <section className="card">
            <h2>Add location</h2>
            <ActionForm action={createLocation}>
              <LocationFields />
              <div className="form-actions"><SubmitButton>Add location</SubmitButton></div>
            </ActionForm>
          </section>
        )}
      </div>
    </>
  );
}
