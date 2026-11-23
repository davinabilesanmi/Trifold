"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requirePermission } from "@/lib/auth";
import { can, isPermission, roleFor, serializePermissions, type Permission } from "@/lib/permissions";
import { firstIssue, formToObject, isUniqueViolation, type FormState } from "@/lib/forms";

const baseUser = {
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  jobTitle: z.string().trim().max(60).optional().transform((v) => v || null),
};
const password = z.string().min(8, "Password must be at least 8 characters.");

function permissionsFrom(formData: FormData): Permission[] {
  return [...new Set(formData.getAll("perm").filter(isPermission))];
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageUsers);
  const parsed = z.object({ ...baseUser, password }).safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const perms = permissionsFrom(formData);
  if (perms.length === 0) return { error: "Tick at least one responsibility." };
  const { password: pw, ...data } = parsed.data;
  try {
    await prisma.user.create({
      data: { ...data, role: roleFor(perms), permissions: serializePermissions(perms), passwordHash: await hashPassword(pw) },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A user with email ${data.email} already exists.` };
    throw e;
  }
  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission(can.manageUsers);
  const schema = z.object({ ...baseUser, active: z.string().optional(), password: z.string().optional() });
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { name, email, jobTitle } = parsed.data;
  const active = parsed.data.active === "on";
  const perms = permissionsFrom(formData);

  if (id === me.id && (!perms.includes("manageUsers") || !active)) {
    return { error: "You can't remove your own access to staff accounts or deactivate yourself." };
  }

  let passwordHash: string | undefined;
  if (parsed.data.password) {
    const pw = password.safeParse(parsed.data.password);
    if (!pw.success) return { error: firstIssue(pw.error) };
    passwordHash = await hashPassword(pw.data);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { name, email, jobTitle, active, passwordHash, role: roleFor(perms), permissions: serializePermissions(perms) },
      });
      // Sign the user out everywhere if they were deactivated or their password was reset.
      if (!active || passwordHash) await tx.session.deleteMany({ where: { userId: id } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `A user with email ${email} already exists.` };
    throw e;
  }
  revalidatePath("/users");
  return { success: "Saved. Changes apply the next time they open a page." };
}
