import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, isMovementType } from "@/lib/stock";
import { PageHeader } from "@/components/PageHeader";
import { MovementTable, movementRowInclude } from "@/components/MovementTable";

export const metadata = { title: "Movements" };

const PAGE_SIZE = 50;
type Search = { type?: string; product?: string; location?: string; page?: string; recorded?: string };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.MovementWhereInput = {
    ...(isMovementType(sp.type) ? { type: sp.type } : {}),
    ...(sp.product ? { productId: sp.product } : {}),
    ...(sp.location ? { OR: [{ fromLocationId: sp.location }, { toLocationId: sp.location }] } : {}),
  };

  const [movements, total, products, locations] = await Promise.all([
    prisma.movement.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: movementRowInclude,
    }),
    prisma.movement.count({ where }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    prisma.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const k of ["type", "product", "location"] as const) if (sp[k]) qs.set(k, sp[k]!);
    qs.set("page", String(p));
    return `/movements?${qs}`;
  };

  return (
    <>
      <PageHeader
        title="Stock movements"
        subtitle={`${total} recorded`}
        actions={<Link href="/movements/new" className="btn btn-primary">Record movement</Link>}
      />
      {sp.recorded && <p className="alert alert-success page-alert" role="status">Movement recorded.</p>}

      <form className="filters" method="get">
        <select name="type" defaultValue={sp.type ?? ""} aria-label="Type">
          <option value="">All types</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
        </select>
        <select name="product" defaultValue={sp.product ?? ""} aria-label="Product">
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
        <select name="location" defaultValue={sp.location ?? ""} aria-label="Location">
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
        {(sp.type || sp.product || sp.location) && <Link href="/movements" className="small">Clear</Link>}
      </form>

      <MovementTable movements={movements} />

      {pages > 1 && (
        <div className="form-actions" style={{ marginTop: "1rem" }}>
          {page > 1 && <Link className="btn btn-secondary" href={pageHref(page - 1)}>Previous</Link>}
          <span className="muted small">Page {page} of {pages}</span>
          {page < pages && <Link className="btn btn-secondary" href={pageHref(page + 1)}>Next</Link>}
        </div>
      )}
    </>
  );
}
