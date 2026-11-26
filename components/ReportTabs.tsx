"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReportTabs({ financials }: { financials: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/reports", label: "Daily report" },
    { href: "/reports/period", label: "Sales and stock by period" },
    ...(financials ? [{ href: "/reports/income", label: "Income statement" }, { href: "/reports/balance", label: "Balance sheet" }] : []),
  ];
  return (
    <nav className="tabs no-print" aria-label="Reports">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={pathname === t.href ? "tab active" : "tab"} aria-current={pathname === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
