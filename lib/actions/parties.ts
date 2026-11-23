"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, type FormState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/format";
import { createCustomerOpeningBalance } from "@/lib/sales";
import { createSupplierOpeningBalance } from "@/lib/purchasing";
import { StockError } from "@/lib/stock";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  phone: optional(40),
  email: z.string().trim().max(120).optional().transform((v) => v || null)
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address or leave it blank."),
  address: optional(300),
  notes: optional(1000),
  type: z.enum(["RETAIL", "WHOLESALE"], { message: "Choose retail or wholesale." }),
});

export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCustomers);
  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id } = await prisma.customer.create({ data: parsed.data });
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function updateCustomer(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCustomers);
  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await prisma.customer.update({ where: { id }, data: parsed.data });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: "Customer saved." };
}

export async function setCustomerActive(id: string, active: boolean) {
  await requirePermission(can.manageCustomers);
  await prisma.customer.update({ where: { id }, data: { active } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  contactName: optional(120),
  phone: optional(40),
  email: z.string().trim().max(120).optional().transform((v) => v || null)
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address or leave it blank."),
  address: optional(300),
  notes: optional(1000),
});

export async function createSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.managePurchasing);
  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id } = await prisma.supplier.create({ data: parsed.data });
  revalidatePath("/suppliers");
  redirect(`/suppliers/${id}`);
}

export async function updateSupplier(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.managePurchasing);
  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await prisma.supplier.update({ where: { id }, data: parsed.data });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { success: "Supplier saved." };
}

export async function setSupplierActive(id: string, active: boolean) {
  await requirePermission(can.managePurchasing);
  await prisma.supplier.update({ where: { id }, data: { active } });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

async function openingBalance(
  formData: FormData,
  create: (amountCents: number, note: string | null) => Promise<{ id: string }>,
): Promise<FormState | { id: string }> {
  const amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
  if (!amountCents) return { error: "Enter the amount owed, e.g. 250000." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  try {
    return await create(amountCents, note);
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
}

export async function customerOpeningBalanceAction(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.openingBalances);
  const existing = await prisma.sale.count({ where: { customerId, kind: "OPENING_BALANCE", status: "COMPLETED" } });
  if (existing > 0) return { error: "This customer already has an opening balance. Remove it first to enter a different amount." };
  const result = await openingBalance(formData, (amount, note) => createCustomerOpeningBalance(prisma, customerId, amount, note, user.id));
  if (result && "error" in result) return result;
  revalidatePath("/", "layout");
  redirect(`/sales/${(result as { id: string }).id}`);
}

export async function supplierOpeningBalanceAction(supplierId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.openingBalances);
  const existing = await prisma.purchaseOrder.count({ where: { supplierId, kind: "OPENING_BALANCE", status: { not: "CANCELLED" } } });
  if (existing > 0) return { error: "This supplier already has an opening balance." };
  const result = await openingBalance(formData, (amount, note) => createSupplierOpeningBalance(prisma, supplierId, amount, note, user.id));
  if (result && "error" in result) return result;
  revalidatePath("/", "layout");
  redirect(`/purchases/${(result as { id: string }).id}`);
}
