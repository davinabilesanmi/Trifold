export const EXPENSE_KINDS = ["EXPENSE", "REBATE", "OTHER_INCOME", "CAPITAL", "DRAWING"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  EXPENSE: "Expense (money out)",
  REBATE: "Rebate from Lafarge / Dangote (money in)",
  OTHER_INCOME: "Other income (money in)",
  CAPITAL: "Owner puts money in (capital)",
  DRAWING: "Owner takes money out (drawings)",
};

/** Whether the entry adds to or takes from the cash/bank balance. */
export const MONEY_IN: Record<string, boolean> = {
  EXPENSE: false, REBATE: true, OTHER_INCOME: true, CAPITAL: true, DRAWING: false,
  VAT_REMITTANCE: false, // not offered while Trifold isn't VAT-registered
};

export const EXPENSE_CATEGORIES = [
  "Truck hire (haulage)",
  "Loading and offloading",
  "Diesel and fuel",
  "Salaries and wages",
  "Sales commission",
  "Rent",
  "Electricity and utilities",
  "Repairs and maintenance",
  "Bank charges",
  "Marketing",
  "Security",
  "Levies and permits",
  "Office and admin",
  "Other",
];

export function isExpenseKind(v: unknown): v is ExpenseKind {
  return typeof v === "string" && (EXPENSE_KINDS as readonly string[]).includes(v);
}

export function kindLabel(kind: string) {
  return isExpenseKind(kind) ? EXPENSE_KIND_LABELS[kind] : kind === "VAT_REMITTANCE" ? "VAT paid to FIRS" : kind;
}
