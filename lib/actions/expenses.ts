"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, type FormState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/money";
import { EXPENSE_KINDS } from "@/lib/expenses";
import { startOfDay, todayInLagos } from "@/lib/dates";
import { canUseLocation } from "@/lib/scope";

const schema = z.object({
  kind: z.enum(EXPENSE_KINDS, { message: "Choose what kind of entry this is." }),
  category: z.string().trim().min(1, "Choose or type a category.").max(60),
  amount: z.string(),
  method: z.enum(PAYMENT_METHODS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  locationId: z.string().optional(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function createExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.manageExpenses);
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;
  const amountCents = parseMoneyToCents(d.amount);
  if (!amountCents) return { error: "Enter an amount above zero, like 45000." };
  if (d.date > todayInLagos()) return { error: "The date can't be in the future." };
  if (d.locationId && !canUseLocation(user, d.locationId)) return { error: "You can only record entries for your own locations." };
  // Midday Lagos time keeps the entry on the chosen day whatever the server's time zone.
  const date = new Date(startOfDay(d.date).getTime() + 12 * 3_600_000);
  await prisma.expense.create({
    data: {
      kind: d.kind, category: d.category, amountCents, method: d.method, date,
      locationId: d.locationId || null, reference: d.reference || null, note: d.note || null, userId: user.id,
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/reports", "layout");
  return { success: "Saved." };
}

export async function deleteExpense(id: string) {
  await requirePermission(can.manageExpenses);
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/reports", "layout");
}
