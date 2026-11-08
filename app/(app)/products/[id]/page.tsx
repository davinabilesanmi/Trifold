import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { setProductActive, updateProduct } from "@/lib/actions/products";
import { stockStatus } from "@/lib/stock";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { ProductFields } from "@/components/ProductFields";
import { ArchivedBadge, StatusBadge } from "@/components/Badges";
import { MovementTable, movementRowInclude } from "@/components/MovementTable";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      stock: { include: { location: true }, orderBy: { location: { name: "asc" } } },
      movements: { orderBy: { createdAt: "desc" }, take: 25, include: movementRowInclude },
    },
  });
  if (!product) notFound();

  const activeStock = product.stock.filter((s) => s.location.active && s.quantity !== 0);
  const onHand = activeStock.reduce((sum, s) => sum + s.quantity, 0);
  const status = stockStatus(onHand, product.reorderLevel);
  const manage = can.manageCatalog(user.role);
  const back = encodeURIComponent(`/products/${product.id}`);

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={<>{product.sku} · {product.active ? <StatusBadge status={status} /> : <ArchivedBadge />}</>}
        actions={product.active && (
          <>
            <Link className="btn btn-primary" href={`/movements/new?type=RECEIPT&product=${product.id}&returnTo=${back}`}>Receive</Link>
            <Link className="btn btn-secondary" href={`/movements/new?type=ISSUE&product=${product.id}&returnTo=${back}`}>Issue</Link>
            <Link className="btn btn-secondary" href={`/movements/new?type=TRANSFER&product=${product.id}&returnTo=${back}`}>Transfer</Link>
            <Link className="btn btn-secondary" href={`/movements/new?type=ADJUSTMENT&product=${product.id}&returnTo=${back}`}>Adjust</Link>
          </>
        )}
      />

      <div className="grid-2">
        <section className="card">
          <h2>Stock by location</h2>
          {activeStock.length === 0 ? (
            <p className="empty">No stock held at any location.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Location</th><th className="num">Quantity</th><th className="num">Value</th></tr></thead>
                <tbody>
                  {activeStock.map((s) => (
                    <tr key={s.locationId}>
                      <td><Link href={`/locations/${s.locationId}`}>{s.location.name}</Link> <span className="muted small">{s.location.code}</span></td>
                      <td className="num">{formatNumber(s.quantity)} <span className="muted small">{product.unit}</span></td>
                      <td className="num">{formatMoney(s.quantity * product.costCents)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td className="num"><strong>{formatNumber(onHand)}</strong> <span className="muted small">{product.unit}</span></td>
                    <td className="num"><strong>{formatMoney(onHand * product.costCents)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Details</h2>
          {manage ? (
            <>
              <ActionForm action={updateProduct.bind(null, product.id)}>
                <ProductFields product={product} />
                <div className="form-actions"><SubmitButton>Save changes</SubmitButton></div>
              </ActionForm>
              <form action={setProductActive.bind(null, product.id, !product.active)} style={{ marginTop: "1rem" }}>
                <button type="submit" className={product.active ? "btn btn-danger" : "btn btn-secondary"}>
                  {product.active ? "Archive product" : "Restore product"}
                </button>
                {product.active && <p className="hint muted small">Archived products are hidden and can&apos;t be moved, but their history is kept.</p>}
              </form>
            </>
          ) : (
            <dl className="details">
              <dt>Category</dt><dd>{product.category ?? "—"}</dd>
              <dt>Unit</dt><dd>{product.unit}</dd>
              <dt>Unit cost</dt><dd>{formatMoney(product.costCents)}</dd>
              <dt>Reorder level</dt><dd>{formatNumber(product.reorderLevel)}</dd>
              <dt>Description</dt><dd>{product.description ?? "—"}</dd>
            </dl>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "1.25rem" }}>
        <div className="section-head">
          <h2>Movement history</h2>
          <Link href={`/movements?product=${product.id}`} className="small">View all</Link>
        </div>
        <MovementTable movements={product.movements} showProduct={false} />
      </section>
    </>
  );
}
