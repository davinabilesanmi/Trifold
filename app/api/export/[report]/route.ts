import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { naira, toCsv } from "@/lib/csv";
import { parseDateRange, todayInLagos } from "@/lib/dates";
import { creditors, debtors, salesSummary, stockValuation } from "@/lib/reports";
import { saleBalance } from "@/lib/balances";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { dailyReport } from "@/lib/daily";
import { startOfDay } from "@/lib/dates";
import { isRestricted, saleWhere, type Viewer } from "@/lib/scope";
import type { CurrentUser } from "@/lib/auth";

const lagos = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16).replace("T", " ");

async function build(user: CurrentUser, report: string, from?: string, to?: string, location?: string): Promise<string | null> {
  const { createdAt } = parseDateRange(from, to);
  const viewer: Viewer = user;
  const money = can.viewFinancials(user);
  // Locations this download covers: the chosen one (if allowed), else the person's own, else everything.
  const locs = location && (!isRestricted(user) || user.locationIds.includes(location)) ? [location] : user.locationIds;
  const saleLoc = locs.length ? { locationId: { in: locs } } : {};
  switch (report) {
    case "stock": {
      const rows = await stockValuation(locs);
      return toCsv(
        ["SKU", "Product", "Category", "Unit", "On hand", "By location", "Retail price (NGN)", "Wholesale price (NGN)", "Value at retail (NGN)", "Reorder level",
          ...(money ? ["Unit cost (NGN)", "Value at cost (NGN)"] : [])],
        rows.map((r) => [r.product.sku, r.product.name, r.product.category, r.product.unit, r.quantity, r.byLocation,
          naira(r.product.priceRetailCents), naira(r.product.priceWholesaleCents), naira(r.retailValue), r.product.reorderLevel,
          ...(money ? [naira(r.product.costCents), naira(r.costValue)] : [])]),
      );
    }
    case "sales": {
      const sales = await prisma.sale.findMany({
        where: { AND: [saleWhere(viewer), saleLoc, createdAt ? { createdAt } : {}] }, orderBy: { createdAt: "asc" },
        include: { customer: true, location: true, user: true, payments: true },
      });
      return toCsv(
        ["Invoice", "Type", "Date", "Status", "Customer", "Price list", "Location", "Discount (NGN)", "Total (NGN)", "Paid (NGN)", "Balance (NGN)", "Sold by"],
        sales.map((s) => [s.number, s.kind === "OPENING_BALANCE" ? "Opening balance" : "Sale", lagos(s.createdAt), s.status, s.customer?.name ?? "Walk-in", s.priceLevel, s.location?.code ?? "Opening balance",
          naira(s.discountCents), naira(s.totalCents), naira(s.payments.reduce((t, p) => t + p.amountCents, 0)), naira(saleBalance(s)), s.user.name]),
      );
    }
    case "sales-by-product": {
      const { products } = await salesSummary(createdAt, locs);
      return toCsv(
        ["SKU", "Product", "Quantity sold", "Revenue (NGN)", ...(money ? ["Cost (NGN)", "Gross profit (NGN)"] : [])],
        products.map((p) => [p.product.sku, p.product.name, p.quantity, naira(p.revenue), ...(money ? [naira(p.cost), naira(p.revenue - p.cost)] : [])]),
      );
    }
    case "payments": {
      const payments = await prisma.payment.findMany({
        where: { ...(createdAt ? { paidAt: createdAt } : {}), sale: { AND: [saleWhere(viewer), saleLoc] } }, orderBy: { paidAt: "asc" },
        include: { sale: { include: { customer: true } }, user: true },
      });
      return toCsv(
        ["Date", "Invoice", "Customer", "Method", "Reference", "Amount (NGN)", "Recorded by"],
        payments.map((p) => [lagos(p.paidAt), p.sale.number, p.sale.customer?.name ?? "Walk-in", PAYMENT_METHOD_LABELS[p.method] ?? p.method, p.reference, naira(p.amountCents), p.user.name]),
      );
    }
    case "movements": {
      const movements = await prisma.movement.findMany({
        where: {
          ...(createdAt ? { createdAt } : {}),
          ...(locs.length ? { OR: [{ fromLocationId: { in: locs } }, { toLocationId: { in: locs } }] } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: { product: true, fromLocation: true, toLocation: true, user: true },
      });
      return toCsv(
        ["Date", "Type", "SKU", "Product", "From", "To", "Quantity", "Reference", "Note", "By"],
        movements.map((m) => [lagos(m.createdAt), m.type, m.product.sku, m.product.name, m.fromLocation?.code, m.toLocation?.code, m.quantity, m.reference, m.note, m.user.name]),
      );
    }
    case "daily-stock": {
      if (!from) return null;
      const start = startOfDay(from);
      const daily = await dailyReport(start, new Date(start.getTime() + 86_400_000), viewer, locs);
      return toCsv(
        ["Date", "Location", "SKU", "Product", "Unit", "Opening", "Delivered", "Transfer in", "Sold", "Transfer out", "Other", "Closing"],
        daily.stock.map((r) => [from, r.location.code, r.product.sku, r.product.name, r.product.unit, r.opening, r.delivered, r.transferIn, r.sold, r.transferOut, r.other, r.closing]),
      );
    }
    case "debtors": {
      if (isRestricted(user)) return null;
      const rows = await debtors();
      return toCsv(["Customer", "Phone", "Type", "Owes (NGN)"], rows.map((r) => [r.customer.name, r.customer.phone, r.customer.type, naira(r.balance)]));
    }
    case "creditors": {
      if (isRestricted(user)) return null;
      const rows = await creditors();
      return toCsv(["Supplier", "Contact", "Phone", "Trifold owes (NGN)"], rows.map((r) => [r.supplier.name, r.supplier.contactName, r.supplier.phone, naira(r.balance)]));
    }
    default:
      return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user)) return new Response("Not allowed", { status: 403 });
  const { report } = await params;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const csv = await build(user, report, from, to, url.searchParams.get("location") ?? undefined);
  if (csv === null) return new Response("Unknown report", { status: 404 });
  const range = from || to ? `_${from ?? "start"}_to_${to ?? todayInLagos()}` : `_${todayInLagos()}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trifold-${report}${range}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
