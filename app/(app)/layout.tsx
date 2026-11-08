import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { NavLinks, type NavGroup } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const r = user.role;
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Dashboard" }] },
    { label: "Selling", items: [{ href: "/sales", label: "Sales" }, { href: "/customers", label: "Customers" }] },
    { label: "Stock", items: [{ href: "/products", label: "Products" }, { href: "/movements", label: "Movements" }, { href: "/locations", label: "Locations" }] },
    { label: "Buying", items: [{ href: "/purchases", label: "Purchase orders" }, { href: "/suppliers", label: "Suppliers" }] },
    {
      label: "Admin",
      items: [
        ...(can.viewReports(r) ? [{ href: "/reports", label: "Reports" }] : []),
        ...(can.manageUsers(r) ? [{ href: "/users", label: "Users" }] : []),
        ...(can.manageSettings(r) ? [{ href: "/settings", label: "Settings" }] : []),
      ],
    },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">T</span> Trifold Stock</Link>
        <NavLinks groups={groups} />
        <div className="sidebar-footer">
          <Link href="/account" className="user-chip">
            <strong>{user.name}</strong>
            <span className="muted">{ROLE_LABELS[user.role]}</span>
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
