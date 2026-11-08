import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { saleBalance } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { parseDateRange } from "@/lib/dates";
import { PageHeader } from "@/components/PageHeader";
import { SalesTable, saleRowInclude } from "@/components/SalesTable";

export const metadata = { title: "Sales" };

const PAGE_SIZE = 50;
type Search = { q?: string; status?: string; from?: string; to?: string; page?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission(can.sell);
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { from, to, createdAt } = parseDateRange(sp.from, sp.to);
  const term = sp.q?.trim();

  const where: Prisma.SaleWhereInput = {
    ...(createdAt ? { createdAt } : {}),
    ...(sp.status === "cancelled" ? { status: "CANCELLED" } : sp.status ? { status: "COMPLETED" } : {}),
    ...(term ? { OR: [{ number: { contains: term } }, { customer: { name: { contains: term } } }] } : {}),
  };
  let sales = await prisma.sale.findMany({ where, orderBy: { createdAt: "desc" }, include: saleRowInclude });
  if (sp.status === "unpaid") sales = sales.filter((s) => saleBalance(s) > 0);

  const completed = sales.filter((s) => s.status === "COMPLETED");
  const total = completed.reduce((s, x) => s + x.totalCents, 0);
  const outstanding = completed.reduce((s, x) => s + Math.max(0, saleBalance(x)), 0);
  const pages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const shown = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const k of ["q", "status", "from", "to"] as const) if (sp[k]) qs.set(k, sp[k]!);
    qs.set("page", String(p));
    return `/sales?${qs}`;
  };

  return (
    <>
      <PageHeader title="Sales" subtitle={`${completed.length} sales · ${formatMoney(total)} · ${formatMoney(outstanding)} unpaid`}
        actions={<Link href="/sales/new" className="btn btn-primary">New sale</Link>} />
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Invoice number or customer" defaultValue={sp.q} aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">All sales</option>
          <option value="unpaid">Unpaid or part paid</option>
          <option value="completed">Completed only</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label className="small">From <input type="date" name="from" defaultValue={from} /></label>
        <label className="small">To <input type="date" name="to" defaultValue={to} /></label>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      <SalesTable sales={shown} />
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
