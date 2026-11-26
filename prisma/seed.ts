import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recordMovement } from "../lib/stock";
import { createCustomerOpeningBalance, createSale } from "../lib/sales";
import { createPurchaseOrder, paySupplier, receivePurchaseOrder } from "../lib/purchasing";
import { ROLE_PRESETS, serializePermissions, type Role } from "../lib/permissions";

const prisma = new PrismaClient();
const N = (naira: number) => naira * 100; // naira -> kobo

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@trifold.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Trifold Owner", jobTitle: "Owner / MD", role: "OWNER", permissions: serializePermissions(ROLE_PRESETS.OWNER), passwordHash },
  });
  console.log(`Owner account: ${email}`);

  if (process.env.SEED_DEMO_DATA === "false" || (await prisma.product.count()) > 0) return;

  await prisma.setting.createMany({ data: [
    { key: "openingCash", value: "50000000" },
  ] });

  const depot = await prisma.location.create({ data: { code: "DEPOT", name: "Main Depot" } });
  const ikeja = await prisma.location.create({ data: { code: "IKJ", name: "Ikeja Outlet" } });
  const lekki = await prisma.location.create({ data: { code: "LKI", name: "Lekki Outlet" } });

  // Demo staff, one per preset, sharing the owner's demo password.
  const staff: [string, string, string, Role, string[]][] = [
    ["gm@trifold.local", "Grace Okafor", "General Manager", "GM", []],
    ["sysadmin@trifold.local", "Tunde Bakare", "Systems Admin", "SYSADMIN", []],
    ["ikeja@trifold.local", "Chidi Eze", "Ikeja Outlet Manager", "OUTLET_MANAGER", [ikeja.id]],
    ["lekki@trifold.local", "Amina Yusuf", "Lekki Outlet Manager", "OUTLET_MANAGER", [lekki.id]],
    ["rep@trifold.local", "Femi Adeyemi", "Sales Rep", "SALES_REP", []],
  ];
  const users: Record<string, string> = {};
  for (const [mail, name, jobTitle, role, locs] of staff) {
    const u = await prisma.user.create({
      data: { email: mail, name, jobTitle, role, permissions: serializePermissions(ROLE_PRESETS[role]), locationIds: locs.join(","), passwordHash },
    });
    users[role + (locs[0] === lekki.id ? "_LKI" : "")] = u.id;
  }

  // Cement in 50 kg bags. Prices and costs include the VAT charged by the manufacturers.
  // A trailer load is 600 bags (30 tonnes).
  const catalogue = [
    { sku: "DAN-3X-425", name: "Dangote 3X Cement 42.5R, 50kg", category: "Dangote", cost: 12000, retail: 13300, wholesale: 12800, reorder: 400 },
    { sku: "DAN-FAL-325", name: "Dangote Falcon Cement 32.5R, 50kg", category: "Dangote", cost: 11500, retail: 12800, wholesale: 12300, reorder: 300 },
    { sku: "LAF-ELE-425", name: "Lafarge Elephant Cement 42.5, 50kg", category: "Lafarge", cost: 12500, retail: 13800, wholesale: 13300, reorder: 400 },
    { sku: "LAF-SUP-425", name: "Lafarge Supaset Cement 42.5R, 50kg", category: "Lafarge", cost: 13000, retail: 14500, wholesale: 13900, reorder: 200 },
  ];
  const products: Record<string, string> = {};
  for (const p of catalogue) {
    const created = await prisma.product.create({
      data: { sku: p.sku, name: p.name, category: p.category, unit: "bag", costCents: N(p.cost),
        priceRetailCents: N(p.retail), priceWholesaleCents: N(p.wholesale), reorderLevel: p.reorder,
        packs: { create: { name: "Trailer", unitsPerPack: 600, priceRetailCents: N(p.wholesale * 600), priceWholesaleCents: N((p.wholesale - 150) * 600) } } },
    });
    products[p.sku] = created.id;
  }
  const cost = (sku: string) => N(catalogue.find((c) => c.sku === sku)!.cost);

  const dangote = await prisma.supplier.create({ data: { name: "Dangote Cement Plc", contactName: "Distributor desk", phone: "0700 000 0001" } });
  const lafarge = await prisma.supplier.create({ data: { name: "Lafarge Africa Plc", contactName: "Distributor desk", phone: "0700 000 0002" } });

  async function deliver(supplierId: string, lines: [string, number][], paid: number) {
    const po = await createPurchaseOrder(prisma, {
      supplierId, locationId: depot.id,
      lines: lines.map(([sku, bags]) => ({ productId: products[sku], quantity: bags, unitCostCents: cost(sku) })),
    }, owner.id);
    const poLines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
    await receivePurchaseOrder(prisma, po.id, poLines.map((l) => ({ lineId: l.id, quantity: l.quantity })), owner.id);
    await paySupplier(prisma, po.id, { amountCents: N(paid), method: "TRANSFER", reference: "Bank transfer" }, owner.id);
  }
  await deliver(dangote.id, [["DAN-3X-425", 1800], ["DAN-FAL-325", 600]], 20_000_000);
  await deliver(lafarge.id, [["LAF-ELE-425", 1200], ["LAF-SUP-425", 600]], 15_000_000);

  for (const [loc, sku, bags] of [[ikeja, "DAN-3X-425", 400], [ikeja, "LAF-ELE-425", 300], [lekki, "DAN-3X-425", 300], [lekki, "LAF-SUP-425", 200]] as const) {
    await recordMovement(prisma, { type: "TRANSFER", productId: products[sku], fromLocationId: depot.id, toLocationId: loc.id, quantity: bags, reference: "Stock to outlet" }, owner.id);
  }

  const builders = await prisma.customer.create({ data: { name: "Adebayo Builders Ltd", type: "WHOLESALE", phone: "0803 000 1001", address: "Ikorodu Road, Lagos" } });
  const blocks = await prisma.customer.create({ data: { name: "Okeke Block Industry", type: "WHOLESALE", phone: "0806 000 1002" } });
  await prisma.customer.create({ data: { name: "Mrs. Bello", type: "RETAIL", phone: "0807 000 1003" } });
  await createCustomerOpeningBalance(prisma, blocks.id, N(1_250_000), "Balance from old ledger", owner.id);

  const price = (sku: string, level: "retail" | "wholesale") => N(catalogue.find((c) => c.sku === sku)![level]);
  await createSale(prisma, { customerId: builders.id, locationId: depot.id, priceLevel: "WHOLESALE",     lines: [{ productId: products["DAN-3X-425"], packId: (await prisma.productPack.findFirstOrThrow({ where: { productId: products["DAN-3X-425"] } })).id, quantity: 1 }],
    discountCents: N(60_000), allowDiscount: true,
    payment: { amountCents: N(4_000_000), method: "TRANSFER", reference: "Part payment" } }, users.GM);
  await createSale(prisma, { customerId: blocks.id, locationId: depot.id, priceLevel: "WHOLESALE",     lines: [{ productId: products["DAN-FAL-325"], quantity: 150 }, { productId: products["LAF-ELE-425"], quantity: 100 }],
    payment: { amountCents: 150 * price("DAN-FAL-325", "wholesale") + 100 * price("LAF-ELE-425", "wholesale"), method: "TRANSFER" } }, users.SALES_REP);
  await createSale(prisma, { locationId: ikeja.id, priceLevel: "RETAIL",     lines: [{ productId: products["DAN-3X-425"], quantity: 40 }, { productId: products["LAF-ELE-425"], quantity: 20 }],
    payment: { amountCents: 40 * price("DAN-3X-425", "retail") + 20 * price("LAF-ELE-425", "retail"), method: "TRANSFER" } }, users.OUTLET_MANAGER);
  await createSale(prisma, { locationId: lekki.id, priceLevel: "RETAIL",     lines: [{ productId: products["LAF-SUP-425"], quantity: 25 }],
    payment: { amountCents: 25 * price("LAF-SUP-425", "retail"), method: "POS" } }, users.OUTLET_MANAGER_LKI);

  await prisma.expense.createMany({ data: [
    { kind: "EXPENSE", category: "Truck hire (haulage)", amountCents: N(450_000), date: new Date(), userId: owner.id, note: "Depot to outlets" },
    { kind: "REBATE", category: "Lafarge Africa Plc", amountCents: N(540_000), date: new Date(), userId: owner.id, note: "October volume rebate" },
    { kind: "EXPENSE", category: "Loading and offloading", amountCents: N(120_000), date: new Date(), userId: owner.id },
    { kind: "EXPENSE", category: "Diesel and fuel", amountCents: N(85_000), date: new Date(), userId: owner.id },
  ] });
  console.log("Demo cement depot, outlets, staff, suppliers, customers, deliveries, sales and expenses created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
