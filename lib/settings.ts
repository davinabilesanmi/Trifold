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
  { key: "vatRate", label: "VAT rate (%)", defaultValue: "7.5",
    hint: "Selling prices already include VAT. Invoices and receipts show how much of each total is VAT. Use 0 to hide VAT." },
  { key: "openingCash", label: "Cash and bank balance when you started using the system (₦)", defaultValue: "0",
    hint: "The starting point for the cash figure on the balance sheet." },
] as const;

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"];
export type Settings = Record<SettingKey, string>;

/** VAT rate as a number, e.g. 7.5. */
export function vatRateOf(settings: Settings) {
  const n = Number(settings.vatRate);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : 0;
}

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, stored.get(f.key) ?? f.defaultValue])) as Settings;
}
