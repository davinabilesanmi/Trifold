import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { can, labelForRole } from "@/lib/permissions";
import { NavLinks, type NavGroup } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const show = <T,>(ok: boolean, item: T) => (ok ? [item] : []);
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Dashboard" }] },
    {
      label: "Selling",
      items: [
        ...show(can.sell(user) || can.takePayments(user), { href: "/sales", label: "Sales" }),
        ...show(can.sell(user) || can.manageCustomers(user) || can.takePayments(user), { href: "/customers", label: "Customers" }),
      ],
    },
    { label: "Stock", items: [{ href: "/products", label: "Products" }, { href: "/movements", label: "Movements" }, { href: "/locations", label: "Locations" }] },
    {
      label: "Buying",
      items: [
        ...show(can.managePurchasing(user) || can.receivePurchases(user), { href: "/purchases", label: "Purchase orders" }),
        ...show(can.managePurchasing(user) || can.openingBalances(user), { href: "/suppliers", label: "Suppliers" }),
      ],
    },
    {
      label: "Money",
      items: [
        ...show(can.viewReports(user), { href: "/reports", label: "Reports" }),
        ...show(can.manageExpenses(user) || can.viewFinancials(user), { href: "/expenses", label: "Expenses" }),
      ],
    },
    {
      label: "Admin",
      items: [
        ...show(can.manageUsers(user), { href: "/users", label: "Staff" }),
        ...show(can.manageSettings(user), { href: "/settings", label: "Settings" }),
      ],
    },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trifold-mark.png" alt="" className="brand-mark" width={32} height={32} />
          <span className="brand-name">Trifold Global<small>Stock &amp; sales</small></span>
        </Link>
        <NavLinks groups={groups} />
        <div className="sidebar-footer">
          <Link href="/account" className="user-chip">
            <strong>{user.name}</strong>
            <span className="muted">{user.jobTitle ?? labelForRole(user.role)}</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="btn-link small">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
