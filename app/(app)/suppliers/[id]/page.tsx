import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supplierBalances } from "@/lib/balances";
import { setSupplierActive, supplierOpeningBalanceAction, updateSupplier } from "@/lib/actions/parties";
import { OpeningBalanceForm } from "@/components/OpeningBalanceForm";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { SupplierFields } from "@/components/PartyFields";
import { ArchivedBadge } from "@/components/Badges";
import { PurchaseOrdersTable, purchaseOrderRowInclude } from "@/components/PurchaseOrdersTable";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();
  const [orders, balances] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { supplierId: id }, orderBy: { createdAt: "desc" }, take: 50, include: purchaseOrderRowInclude }),
    supplierBalances([id]),
  ]);
  const balance = balances.get(id) ?? 0;
  const manage = can.managePurchasing(user);
  const showOpening = supplier.active && can.openingBalances(user) && !orders.some((o) => o.kind === "OPENING_BALANCE" && o.status !== "CANCELLED");

  return (
    <>
      <PageHeader title={supplier.name} subtitle={<>{[supplier.contactName, supplier.phone].filter(Boolean).join(" · ") || "Supplier"} {!supplier.active && <ArchivedBadge />}</>}
        actions={manage && supplier.active && <Link href={`/purchases/new?supplier=${supplier.id}`} className="btn btn-primary">New purchase order</Link>} />
      <section className="stats">
        <div className={balance > 0 ? "stat stat-warn" : "stat"}>
          <div className="stat-label">{balance < 0 ? "Supplier owes Trifold" : "Trifold owes"}</div>
          <div className="stat-value">{formatMoney(Math.abs(balance))}</div>
        </div>
      </section>
      <div className={manage || showOpening ? "grid-2" : undefined}>
        <section className="card">
          <h2>Purchase orders</h2>
          <PurchaseOrdersTable orders={orders} showSupplier={false} />
        </section>
        <div>
        {showOpening && <OpeningBalanceForm who="supplier" action={supplierOpeningBalanceAction.bind(null, supplier.id)} />}
        {manage && (
          <section className="card">
            <h2>Details</h2>
            <ActionForm action={updateSupplier.bind(null, supplier.id)}>
              <SupplierFields supplier={supplier} />
              <div className="form-actions"><SubmitButton>Save changes</SubmitButton></div>
            </ActionForm>
            <form action={setSupplierActive.bind(null, supplier.id, !supplier.active)} style={{ marginTop: "1rem" }}>
              <button type="submit" className={supplier.active ? "btn btn-danger" : "btn btn-secondary"}>
                {supplier.active ? "Archive supplier" : "Restore supplier"}
              </button>
            </form>
          </section>
        )}
        </div>
      </div>
    </>
  );
}
