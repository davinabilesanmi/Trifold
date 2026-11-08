"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, type FormState } from "@/lib/forms";
import { recordMovement, StockError, type MovementInput } from "@/lib/stock";

const id = (label: string) => z.string().min(1, `Choose a ${label}.`);
const qty = z.coerce
  .number({ message: "Quantity must be a number." })
  .int("Quantity must be a whole number.")
  .positive("Quantity must be above zero.");
const common = {
  productId: id("product"),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
};

const movementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RECEIPT"), toLocationId: id("location"), quantity: qty, ...common }),
  z.object({ type: z.literal("ISSUE"), fromLocationId: id("location"), quantity: qty, ...common }),
  z.object({
    type: z.literal("TRANSFER"),
    fromLocationId: id("source location"),
    toLocationId: id("destination location"),
    quantity: qty,
    ...common,
  }),
  z.object({
    type: z.literal("ADJUSTMENT"),
    locationId: id("location"),
    countedQuantity: z.coerce
      .number({ message: "Counted quantity must be a number." })
      .int("Counted quantity must be a whole number.")
      .min(0, "Counted quantity cannot be negative."),
    ...common,
  }),
]);

export async function createMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(can.recordMovements);
  const parsed = movementSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await recordMovement(prisma, parsed.data as MovementInput, user.id);
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }

  revalidatePath("/", "layout");
  const returnTo = formData.get("returnTo");
  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    redirect(returnTo);
  }
  redirect("/movements?recorded=1");
}
