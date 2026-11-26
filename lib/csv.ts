type Cell = string | number | null | undefined;

function escape(cell: Cell) {
  const s = cell == null ? "" : String(cell);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text that opens cleanly in Excel (BOM so ₦ and accents survive). */
export function toCsv(header: string[], rows: Cell[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

/** Kobo to a plain naira number for spreadsheets, e.g. 1500050 -> "15000.50". */
export function naira(cents: number) {
  return (cents / 100).toFixed(2);
}
