import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recordMovement } from "../lib/stock";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@trifold.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Trifold Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Admin account: ${email}`);

  if (process.env.SEED_DEMO_DATA === "false" || (await prisma.product.count()) > 0) return;

  const [warehouse, shop] = await Promise.all([
    prisma.location.create({ data: { code: "WH-MAIN", name: "Main Warehouse" } }),
    prisma.location.create({ data: { code: "SHOP-01", name: "Shop Floor" } }),
  ]);
  const demo = [
    { sku: "TF-PAPER-A4", name: "A4 Paper (500 sheets)", category: "Stationery", unit: "ream", costCents: 650000, reorderLevel: 40, qty: 120 },
    { sku: "TF-TONER-BK", name: "Black Toner Cartridge", category: "Printing", unit: "pcs", costCents: 4500000, reorderLevel: 10, qty: 8 },
    { sku: "TF-FOLDER", name: "Trifold Display Folder", category: "Display", unit: "pcs", costCents: 35000, reorderLevel: 100, qty: 600 },
    { sku: "TF-BOX-M", name: "Shipping Box (Medium)", category: "Packaging", unit: "pcs", costCents: 80000, reorderLevel: 50, qty: 0 },
  ];
  for (const { qty, ...p } of demo) {
    const product = await prisma.product.create({ data: p });
    if (qty > 0) {
      await recordMovement(prisma, { type: "RECEIPT", productId: product.id, toLocationId: warehouse.id, quantity: qty, reference: "Opening stock" }, admin.id);
    }
  }
  const folder = await prisma.product.findUniqueOrThrow({ where: { sku: "TF-FOLDER" } });
  await recordMovement(prisma, { type: "TRANSFER", productId: folder.id, fromLocationId: warehouse.id, toLocationId: shop.id, quantity: 150 }, admin.id);
  console.log("Demo locations and products created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
