export const EXPENSE_KINDS = ["EXPENSE", "OTHER_INCOME", "CAPITAL", "DRAWING", "VAT_REMITTANCE"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  EXPENSE: "Expense (money out)",
  OTHER_INCOME: "Other income (money in)",
  CAPITAL: "Owner puts money in (capital)",
  DRAWING: "Owner takes money out (drawings)",
  VAT_REMITTANCE: "VAT paid to FIRS",
};

/** Whether the entry adds to or takes from the cash/bank balance. */
export const MONEY_IN: Record<ExpenseKind, boolean> = {
  EXPENSE: false, OTHER_INCOME: true, CAPITAL: true, DRAWING: false, VAT_REMITTANCE: false,
};

export const EXPENSE_CATEGORIES = [
  "Haulage and transport",
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
