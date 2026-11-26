import "server-only";
import { prisma } from "./db";

export const SETTING_FIELDS = [
  { key: "businessName", label: "Business name", defaultValue: "Trifold Global" },
  { key: "tagline", label: "Tagline", defaultValue: "Distribution Solutions" },
  { key: "address", label: "Address", defaultValue: "1st floor, Bank of Agric building,\nTotal Garden, Ibadan, Oyo State", multiline: true },
  { key: "phone", label: "Phone", defaultValue: "08033390608" },
  { key: "email", label: "Email", defaultValue: "info@trifoldglobal.com" },
  { key: "website", label: "Website", defaultValue: "www.trifoldglobal.com" },
  { key: "bankDetails", label: "Bank details for payment", defaultValue: "", multiline: true,
    hint: "Printed on invoices, e.g. bank name, account name and account number." },
  { key: "invoiceFooter", label: "Invoice footer", defaultValue: "Thank you for your business.", multiline: true },
  { key: "vatNote", label: "VAT note on invoices and receipts", defaultValue: "All prices include VAT.",
    hint: "VAT is charged by the manufacturers (Lafarge, Dangote) and included in prices; Trifold doesn't add or file VAT itself." },
  { key: "openingCash", label: "Cash and bank balance when you started using the system (₦)", defaultValue: "0",
    hint: "The starting point for the cash figure on the balance sheet." },
] as const;

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, stored.get(f.key) ?? f.defaultValue])) as Settings;
}
