import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { locationWhere } from "@/lib/scope";
import { createSaleAction } from "@/lib/actions/sales";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { SaleFields } from "@/components/SaleFields";

export const metadata = { title: "New sale" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requirePermission(can.sell);
  const { customer } = await searchParams;
  const [products, customers, locations, levels] = await Promise.all([
    prisma.product.findMany({
      where: { active: true }, orderBy: { name: "asc" },
      select: {
        id: true, name: true, sku: true, unit: true, priceRetailCents: true, priceWholesaleCents: true,
        packs: { where: { active: true }, orderBy: { unitsPerPack: "asc" }, select: { id: true, name: true, unitsPerPack: true, priceRetailCents: true, priceWholesaleCents: true } },
      },
    }),
    prisma.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.location.findMany({ where: { active: true, ...locationWhere(user) }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.stockLevel.findMany({ where: { quantity: { not: 0 } }, select: { productId: true, locationId: true, quantity: true } }),
  ]);
  const stock: Record<string, Record<string, number>> = {};
  for (const l of levels) (stock[l.locationId] ??= {})[l.productId] = l.quantity;

  return (
    <>
      <PageHeader title="New sale" subtitle="Stock is taken from the chosen location when you save." />
      {products.length === 0 || locations.length === 0 ? (
        <p className="alert alert-warn">Add products and a location before making a sale.</p>
      ) : (
        <div className="card" style={{ maxWidth: 960 }}>
          <ActionForm action={createSaleAction}>
            <SaleFields
              products={products}
              customers={customers}
              locations={locations}
              stock={stock}
              canOverridePrices={can.overridePrices(user)}
              canGiveDiscounts={can.giveDiscounts(user)}
              defaultCustomerId={customers.some((c) => c.id === customer) ? customer : undefined}
            />
            <div className="form-actions">
              <SubmitButton pendingText="Saving sale…">Complete sale</SubmitButton>
              <Link href="/sales" className="btn btn-secondary">Cancel</Link>
            </div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
