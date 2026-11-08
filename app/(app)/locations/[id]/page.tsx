import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { setLocationActive, updateLocation } from "@/lib/actions/locations";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { LocationFields } from "@/components/LocationFields";
import { ArchivedBadge } from "@/components/Badges";
import { MovementTable, movementRowInclude } from "@/components/MovementTable";

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      stock: { where: { quantity: { not: 0 } }, include: { product: true }, orderBy: { product: { name: "asc" } } },
    },
  });
  if (!location) notFound();

  const movements = await prisma.movement.findMany({
    where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: movementRowInclude,
  });
  const manage = can.manageCatalog(user.role);
  const units = location.stock.reduce((s, x) => s + x.quantity, 0);
  const value = location.stock.reduce((s, x) => s + x.quantity * x.product.costCents, 0);

  return (
    <>
      <PageHeader
        title={location.name}
        subtitle={<>{location.code} {!location.active && <ArchivedBadge />} · {formatNumber(units)} units · {formatMoney(value)}</>}
      />
      <div className={manage ? "grid-2" : undefined}>
        <section className="card">
          <h2>Stock held here</h2>
          {location.stock.length === 0 ? (
            <p className="empty">Nothing in stock at this location.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th className="num">Quantity</th></tr></thead>
                <tbody>
                  {location.stock.map((s) => (
                    <tr key={s.productId} className={s.product.active ? undefined : "row-archived"}>
                      <td><Link href={`/products/${s.productId}`}>{s.product.name}</Link></td>
                      <td>{s.product.sku}</td>
                      <td className="num">{formatNumber(s.quantity)} <span className="muted small">{s.product.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {manage && (
          <section className="card">
            <h2>Details</h2>
            <ActionForm action={updateLocation.bind(null, location.id)}>
              <LocationFields location={location} />
              <div className="form-actions"><SubmitButton>Save changes</SubmitButton></div>
            </ActionForm>
            <form action={setLocationActive.bind(null, location.id, !location.active)} style={{ marginTop: "1rem" }}>
              <button type="submit" className={location.active ? "btn btn-danger" : "btn btn-secondary"}>
                {location.active ? "Archive location" : "Restore location"}
              </button>
              {location.active && units > 0 && (
                <p className="hint muted small">This location still holds stock. Archiving excludes it from totals; transfer the stock out first if it has moved.</p>
              )}
            </form>
          </section>
        )}
      </div>
      {!manage && location.address && <p className="muted">{location.address}</p>}

      <section className="card" style={{ marginTop: "1.25rem" }}>
        <div className="section-head">
          <h2>Recent movements</h2>
          <Link href={`/movements?location=${location.id}`} className="small">View all</Link>
        </div>
        <MovementTable movements={movements} />
      </section>
    </>
  );
}
