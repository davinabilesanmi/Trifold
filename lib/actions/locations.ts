"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstIssue, formToObject, isUniqueViolation, type FormState } from "@/lib/forms";

const locationSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Code is required.")
    .max(20, "Code must be 20 characters or fewer.")
    .regex(/^[A-Z0-9-]+$/, "Code may only contain letters, numbers and dashes."),
  name: z.string().trim().min(1, "Name is required.").max(100),
  address: z.string().trim().max(300).optional().default(""),
});

export async function createLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCatalog);
  const parsed = locationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  let id: string;
  try {
    ({ id } = await prisma.location.create({
      data: { ...parsed.data, address: parsed.data.address || null },
    }));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A location with code ${parsed.data.code} already exists.` };
    throw e;
  }
  revalidatePath("/locations");
  redirect(`/locations/${id}`);
}

export async function updateLocation(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageCatalog);
  const parsed = locationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    await prisma.location.update({
      where: { id },
      data: { ...parsed.data, address: parsed.data.address || null },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A location with code ${parsed.data.code} already exists.` };
    throw e;
  }
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  return { success: "Location saved." };
}

export async function setLocationActive(id: string, active: boolean) {
  await requirePermission(can.manageCatalog);
  await prisma.location.update({ where: { id }, data: { active } });
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
}
