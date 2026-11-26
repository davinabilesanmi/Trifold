"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SETTING_FIELDS } from "@/lib/settings";
import type { FormState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/format";

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(can.manageSettings);
  const name = String(formData.get("businessName") ?? "").trim();
  if (!name) return { error: "Business name is required." };
  const vat = Number(String(formData.get("vatRate") ?? "").trim());
  if (!Number.isFinite(vat) || vat < 0 || vat > 50) return { error: "VAT rate must be a number between 0 and 50, e.g. 7.5." };
  if (parseMoneyToCents(String(formData.get("openingCash") ?? "")) === null) return { error: "Opening cash must be an amount like 1,500,000." };
  await prisma.$transaction(
    SETTING_FIELDS.map((f) => {
      const value = String(formData.get(f.key) ?? "").trim().slice(0, 1000);
      return prisma.setting.upsert({ where: { key: f.key }, create: { key: f.key, value }, update: { value } });
    }),
  );
  revalidatePath("/", "layout");
  return { success: "Settings saved." };
}
