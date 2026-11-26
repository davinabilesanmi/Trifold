"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, type FormState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/money";
import { cancelSale, createSale, recordSalePayment } from "@/lib/sales";
import { StockError } from "@/lib/stock";
import { canSeeSale, canUseLocation } from "@/lib/scope";

const lineSchema = z.object({
  productId: z.string().min(1, "Choose a product on every line."),
  packId: z.string().nullish(),
  quantity: z.coerce.number().int("Quantities must be whole numbers.").positive("Quantities must be above zero."),
  price: z.string().optional(),
});

const saleSchema = z.object({
  customerId: z.string().optional(),
  locationId: z.string().min(1, "Choose the location the stock is sold from."),
  priceLevel: z.enum(["RETAIL", "WHOLESALE"]),
  lines: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid sale lines." });
      return z.NEVER;
    }
  }).pipe(z.array(lineSchema).min(1, "Add at least one product to the sale.")),
  amountPaid: z.string().default(""),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  discount: z.string().optional().default(""),
});

export async function createSaleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.sell);
  const parsed = saleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  if (!canUseLocation(user, d.locationId)) return { error: "You can only sell from the outlets you work at." };

  const discountCents = parseMoneyToCents(d.discount);
  if (discountCents === null) return { error: "Discount must be an amount like 5000." };
  const amountPaid = parseMoneyToCents(d.amountPaid);
  if (amountPaid === null) return { error: "Amount paid must be an amount like 15000 or 15,000.00." };
  const lines = [];
  for (const l of d.lines) {
    const price = l.price ? parseMoneyToCents(l.price) : null;
    if (l.price && price === null) return { error: "Each price must be an amount like 15000." };
    lines.push({ productId: l.productId, packId: l.packId || null, quantity: l.quantity, unitPriceCents: price });
  }

  let saleId: string;
  try {
    const sale = await createSale(prisma, {
      customerId: d.customerId || null,
      locationId: d.locationId,
      priceLevel: d.priceLevel,
      lines,
      note: d.note,
      payment: { amountCents: amountPaid, method: d.method, reference: d.reference },
      allowPriceOverride: can.overridePrices(user),
      discountCents,
      allowDiscount: can.giveDiscounts(user),
    }, user.id);
    saleId = sale.id;
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/sales/${saleId}?created=1`);
}

const paymentSchema = z.object({
  amount: z.string(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(100).optional(),
});

export async function recordPaymentAction(saleId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.takePayments);
  const parsed = paymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const amountCents = parseMoneyToCents(parsed.data.amount);
  if (!amountCents) return { error: "Enter an amount above zero, like 15000." };
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { userId: true, locationId: true } });
  if (!sale || !canSeeSale(user, sale)) return { error: "Sale not found." };
  try {
    await recordSalePayment(prisma, saleId, { amountCents, method: parsed.data.method, reference: parsed.data.reference }, user.id);
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { success: "Payment recorded." };
}

export async function cancelSaleAction(saleId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.cancelSales);
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { userId: true, locationId: true } });
  if (!sale || !canSeeSale(user, sale)) return { error: "Sale not found." };
  try {
    await cancelSale(prisma, saleId, String(formData.get("reason") ?? ""), user.id);
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { success: "Sale cancelled. Stock has been returned and payments refunded." };
}
