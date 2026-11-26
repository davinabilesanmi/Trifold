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
import { closePurchaseOrder, createPurchaseOrder, paySupplier, receivePurchaseOrder } from "@/lib/purchasing";
import { StockError } from "@/lib/stock";
import { canUseLocation } from "@/lib/scope";

const poSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier."),
  locationId: z.string().min(1, "Choose where the goods will be delivered."),
  note: z.string().trim().max(500).optional(),
  lines: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid order lines." });
      return z.NEVER;
    }
  }).pipe(z.array(z.object({
    productId: z.string().min(1, "Choose a product on every line."),
    packId: z.string().nullish(),
    quantity: z.coerce.number().int("Quantities must be whole numbers.").positive("Quantities must be above zero."),
    cost: z.string(),
  })).min(1, "Add at least one product to the order.")),
});

function handle(e: unknown): FormState {
  if (e instanceof StockError) return { error: e.message };
  throw e;
}

export async function createPurchaseOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.managePurchasing);
  const parsed = poSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const lines = [];
  for (const l of parsed.data.lines) {
    const unitCostCents = parseMoneyToCents(l.cost);
    if (unitCostCents === null) return { error: "Each unit cost must be an amount like 6500." };
    lines.push({ productId: l.productId, packId: l.packId || null, quantity: l.quantity, unitCostCents });
  }
  let id: string;
  try {
    ({ id } = await createPurchaseOrder(prisma, { ...parsed.data, lines }, user.id));
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/purchases");
  redirect(`/purchases/${id}`);
}

export async function receivePurchaseOrderAction(poId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.receivePurchases);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { locationId: true } });
  if (!po || !canUseLocation(user, po.locationId)) return { error: "You can only receive deliveries at the locations you work at." };
  const receipts: { lineId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("receive:") || typeof value !== "string" || value.trim() === "") continue;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) return { error: "Received quantities must be whole numbers." };
    receipts.push({ lineId: key.slice("receive:".length), quantity });
  }
  try {
    await receivePurchaseOrder(prisma, poId, receipts, user.id);
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/", "layout");
  return { success: "Delivery received and stock updated." };
}

export async function paySupplierAction(poId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.managePurchasing);
  const method = z.enum(PAYMENT_METHODS).safeParse(formData.get("method"));
  if (!method.success) return { error: "Choose a payment method." };
  const amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  if (!amountCents) return { error: "Enter an amount above zero, like 150000." };
  try {
    await paySupplier(prisma, poId, { amountCents, method: method.data, reference: String(formData.get("reference") ?? "") }, user.id);
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/", "layout");
  return { success: "Payment recorded." };
}

export async function closePurchaseOrderAction(poId: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requirePermission(can.managePurchasing);
  try {
    await closePurchaseOrder(prisma, poId);
  } catch (e) {
    return handle(e);
  }
  revalidatePath("/", "layout");
  return { success: "Order updated." };
}
