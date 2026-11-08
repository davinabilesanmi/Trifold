"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, isUniqueViolation, type FormState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/format";

const productSchema = z.object({
  sku: z.string().trim().toUpperCase().min(1, "SKU is required.").max(40, "SKU is too long."),
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().max(60).optional().default(""),
  unit: z.string().trim().max(20).optional().default("pcs"),
  cost: z.string().optional().default(""),
  priceRetail: z.string().optional().default(""),
  priceWholesale: z.string().optional().default(""),
  reorderLevel: z.coerce
    .number({ message: "Reorder level must be a number." })
    .int("Reorder level must be a whole number.")
    .min(0, "Reorder level cannot be negative."),
});

function toData(formData: FormData) {
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) } as const;
  const costCents = parseMoneyToCents(parsed.data.cost);
  const priceRetailCents = parseMoneyToCents(parsed.data.priceRetail);
  const priceWholesaleCents = parseMoneyToCents(parsed.data.priceWholesale);
  if (costCents === null) return { error: "Unit cost must be an amount like 6500 or 6,500.00." } as const;
  if (priceRetailCents === null) return { error: "Retail price must be an amount like 8500 or 8,500.00." } as const;
  if (priceWholesaleCents === null) return { error: "Wholesale price must be an amount like 8000 or 8,000.00." } as const;
  const d = parsed.data;
  return {
    data: {
      sku: d.sku,
      name: d.name,
      description: d.description || null,
      category: d.category || null,
      unit: d.unit || "pcs",
      costCents,
      priceRetailCents,
      priceWholesaleCents,
      reorderLevel: d.reorderLevel,
    },
  } as const;
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCatalog);
  const result = toData(formData);
  if ("error" in result) return { error: result.error };
  let id: string;
  try {
    ({ id } = await prisma.product.create({ data: result.data }));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A product with SKU ${result.data.sku} already exists.` };
    throw e;
  }
  revalidatePath("/products");
  redirect(`/products/${id}`);
}

export async function updateProduct(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCatalog);
  const result = toData(formData);
  if ("error" in result) return { error: result.error };
  try {
    await prisma.product.update({ where: { id }, data: result.data });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A product with SKU ${result.data.sku} already exists.` };
    throw e;
  }
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: "Product saved." };
}

export async function setProductActive(id: string, active: boolean) {
  await requirePermission(can.manageCatalog);
  await prisma.product.update({ where: { id }, data: { active } });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}
