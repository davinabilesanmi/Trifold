import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { NavLinks, type NavItem } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items: NavItem[] = [
    { href: "/", label: "Dashboard" },
    { href: "/products", label: "Products" },
    { href: "/locations", label: "Locations" },
    { href: "/movements", label: "Movements" },
  ];
  if (can.manageUsers(user.role)) items.push({ href: "/users", label: "Users" });

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">T</span> Trifold Stock</Link>
        <NavLinks items={items} />
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
