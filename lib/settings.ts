import "server-only";
import { prisma } from "./db";

export const SETTING_FIELDS = [
  { key: "businessName", label: "Business name", defaultValue: "Trifold Limited" },
  { key: "address", label: "Address", defaultValue: "", multiline: true },
  { key: "phone", label: "Phone", defaultValue: "" },
  { key: "email", label: "Email", defaultValue: "" },
  { key: "bankDetails", label: "Bank details for payment", defaultValue: "", multiline: true,
    hint: "Printed on invoices, e.g. bank name, account name and account number." },
  { key: "invoiceFooter", label: "Invoice footer", defaultValue: "Thank you for your business.", multiline: true },
] as const;

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, stored.get(f.key) ?? f.defaultValue])) as Settings;
}
