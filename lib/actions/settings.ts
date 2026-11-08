"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SETTING_FIELDS } from "@/lib/settings";
import type { FormState } from "@/lib/forms";

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageSettings);
  const name = String(formData.get("businessName") ?? "").trim();
  if (!name) return { error: "Business name is required." };
  await prisma.$transaction(
    SETTING_FIELDS.map((f) => {
      const value = String(formData.get(f.key) ?? "").trim().slice(0, 1000);
      return prisma.setting.upsert({ where: { key: f.key }, create: { key: f.key, value }, update: { value } });
    }),
  );
  revalidatePath("/", "layout");
  return { success: "Settings saved." };
}
