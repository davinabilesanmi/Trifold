import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recordMovement } from "../lib/stock";
import { createSale } from "../lib/sales";
import { createPurchaseOrder, paySupplier, receivePurchaseOrder } from "../lib/purchasing";
import { ROLE_PRESETS, serializePermissions } from "../lib/permissions";

const prisma = new PrismaClient();
const N = (naira: number) => naira * 100; // naira -> kobo

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@trifold.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email, name: "Trifold Admin", jobTitle: "Managing Director", role: "OWNER",
      permissions: serializePermissions(ROLE_PRESETS.OWNER), passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`Admin account: ${email}`);

  if (process.env.SEED_DEMO_DATA === "false" || (await prisma.product.count()) > 0) return;

  const warehouse = await prisma.location.create({ data: { code: "WH-MAIN", name: "Main Warehouse" } });
  const shop = await prisma.location.create({ data: { code: "SHOP-01", name: "Shop" } });

  const catalogue = [
    { sku: "EO-2050-4L", name: "Engine Oil 20W-50, 4 litres", category: "Engine oil", unit: "gallon", cost: 17000, retail: 22000, wholesale: 20000, reorder: 20 },
    { sku: "EO-2050-1L", name: "Engine Oil 20W-50, 1 litre", category: "Engine oil", unit: "bottle", cost: 4600, retail: 6000, wholesale: 5400, reorder: 48 },
    { sku: "EO-1540-4L", name: "Engine Oil 15W-40 Diesel, 4 litres", category: "Engine oil", unit: "gallon", cost: 19500, retail: 25000, wholesale: 23000, reorder: 12 },
    { sku: "EO-530-4L", name: "Engine Oil 5W-30 Synthetic, 4 litres", category: "Engine oil", unit: "gallon", cost: 31000, retail: 39000, wholesale: 36000, reorder: 10 },
    { sku: "ATF-1L", name: "Automatic Transmission Fluid, 1 litre", category: "Transmission", unit: "bottle", cost: 5200, retail: 7000, wholesale: 6300, reorder: 24 },
    { sku: "BF-500", name: "Brake Fluid DOT 4, 500 ml", category: "Brake fluid", unit: "bottle", cost: 2800, retail: 4000, wholesale: 3500, reorder: 24 },
    { sku: "HYD-25L", name: "Hydraulic Oil 68, 25 litres", category: "Industrial", unit: "keg", cost: 78000, retail: 95000, wholesale: 88000, reorder: 4 },
    { sku: "GR-500", name: "Multipurpose Grease, 500 g", category: "Grease", unit: "tin", cost: 2500, retail: 3500, wholesale: 3100, reorder: 30 },
  ];
  const products: Record<string, string> = {};
  for (const p of catalogue) {
    const created = await prisma.product.create({
      data: { sku: p.sku, name: p.name, category: p.category, unit: p.unit, costCents: N(p.cost),
        priceRetailCents: N(p.retail), priceWholesaleCents: N(p.wholesale), reorderLevel: p.reorder },
    });
    products[p.sku] = created.id;
  }

  // Bulk pack sizes: cartons of 1-litre bottles and gallons.
  await prisma.productPack.create({ data: { productId: products["EO-2050-1L"], name: "Carton", unitsPerPack: 12, priceRetailCents: N(69000), priceWholesaleCents: N(62000) } });
  await prisma.productPack.create({ data: { productId: products["EO-2050-4L"], name: "Carton", unitsPerPack: 4, priceRetailCents: N(86000), priceWholesaleCents: N(78000) } });
  await prisma.productPack.create({ data: { productId: products["ATF-1L"], name: "Carton", unitsPerPack: 12, priceRetailCents: N(80000), priceWholesaleCents: N(72000) } });

  const supplier = await prisma.supplier.create({ data: { name: "Apex Lubricants Distribution Ltd", contactName: "Mr. Okafor", phone: "0803 000 0001" } });
  await prisma.supplier.create({ data: { name: "Delta Industrial Oils", contactName: "Mrs. Bello", phone: "0805 000 0002" } });

  // A delivered and part-paid purchase order brings in the opening stock.
  const opening: [string, number][] = [["EO-2050-4L", 80], ["EO-2050-1L", 240], ["EO-1540-4L", 40], ["EO-530-4L", 8], ["ATF-1L", 60], ["BF-500", 60], ["HYD-25L", 6], ["GR-500", 20]];
  const po = await createPurchaseOrder(prisma, {
    supplierId: supplier.id, locationId: warehouse.id, note: "Opening stock",
    lines: opening.map(([sku, quantity]) => ({ productId: products[sku], quantity, unitCostCents: N(catalogue.find((c) => c.sku === sku)!.cost) })),
  }, admin.id);
  const lines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
  await receivePurchaseOrder(prisma, po.id, lines.map((l) => ({ lineId: l.id, quantity: l.quantity })), admin.id);
  await paySupplier(prisma, po.id, { amountCents: N(3_000_000), method: "TRANSFER", reference: "Opening payment" }, admin.id);

  // Move some stock to the shop.
  for (const [sku, quantity] of [["EO-2050-4L", 24], ["EO-2050-1L", 96], ["ATF-1L", 24], ["BF-500", 24]] as const) {
    await recordMovement(prisma, { type: "TRANSFER", productId: products[sku], fromLocationId: warehouse.id, toLocationId: shop.id, quantity }, admin.id);
  }

  const mechanic = await prisma.customer.create({ data: { name: "Chukwu Auto Repairs", type: "WHOLESALE", phone: "0806 000 0003", address: "Ladipo Market, Lagos" } });
  await prisma.customer.create({ data: { name: "Mrs. Adeyemi", type: "RETAIL", phone: "0807 000 0004" } });

  await createSale(prisma, { locationId: shop.id, priceLevel: "RETAIL", lines: [{ productId: products["EO-2050-4L"], quantity: 1 }, { productId: products["BF-500"], quantity: 1 }],
    payment: { amountCents: N(26000), method: "CASH" } }, admin.id);
  await createSale(prisma, { customerId: mechanic.id, locationId: warehouse.id, priceLevel: "WHOLESALE",
    lines: [{ productId: products["EO-2050-4L"], quantity: 12 }, { productId: products["EO-1540-4L"], quantity: 6 }],
    payment: { amountCents: N(200000), method: "TRANSFER", reference: "Part payment" } }, admin.id);
  console.log("Demo engine-oil catalogue, suppliers, customers, a purchase order and sales created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
