"use client";

import { useState } from "react";
import { EXPENSE_KINDS, EXPENSE_KIND_LABELS, type ExpenseKind } from "@/lib/expenses";

const PLACEHOLDER: Record<ExpenseKind, string> = {
  EXPENSE: "e.g. Truck hire (haulage)",
  REBATE: "e.g. Lafarge Africa Plc",
  OTHER_INCOME: "e.g. Sale of empty bags",
  CAPITAL: "e.g. Owner",
  DRAWING: "e.g. Owner",
};

/** Entry type plus a category box whose suggestions fit the type (supplier names for rebates). */
export function ExpenseKindFields({ categories, suppliers }: { categories: string[]; suppliers: string[] }) {
  const [kind, setKind] = useState<ExpenseKind>("EXPENSE");
  const suggestions = kind === "REBATE" ? suppliers : kind === "EXPENSE" ? categories : [];
  return (
    <div className="form-row">
      <div className="field">
        <label htmlFor="kind">Type</label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind)}>
          {EXPENSE_KINDS.map((k) => <option key={k} value={k}>{EXPENSE_KIND_LABELS[k]}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="category">{kind === "REBATE" ? "From" : "Category"}</label>
        <input id="category" name="category" list="expense-categories" required maxLength={60} placeholder={PLACEHOLDER[kind]} key={kind} />
        <datalist id="expense-categories">{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
        {kind === "REBATE" && <span className="hint">Record each rebate when it is paid into the bank.</span>}
      </div>
    </div>
  );
}
