import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createPurchaseOrderAction } from "@/lib/actions/purchases";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PurchaseOrderFields } from "@/components/PurchaseOrderFields";

export const metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requirePermission(can.managePurchasing);
  const { supplier } = await searchParams;
  const [products, suppliers, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, unit: true, costCents: true } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  return (
    <>
      <PageHeader title="New purchase order" subtitle="Stock is added when the delivery is received, not when the order is placed." />
      {suppliers.length === 0 ? (
        <p className="alert alert-warn">Add a supplier first. <Link href="/suppliers/new">Add supplier</Link></p>
      ) : (
        <div className="card" style={{ maxWidth: 960 }}>
          <ActionForm action={createPurchaseOrderAction}>
            <PurchaseOrderFields products={products} suppliers={suppliers} locations={locations}
              defaultSupplierId={suppliers.some((s) => s.id === supplier) ? supplier : undefined} />
            <div className="form-actions">
              <SubmitButton>Create purchase order</SubmitButton>
              <Link href="/purchases" className="btn btn-secondary">Cancel</Link>
            </div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
