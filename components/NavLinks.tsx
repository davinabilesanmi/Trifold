"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
export type NavGroup = { label?: string; items: NavItem[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {groups.filter((g) => g.items.length > 0).map((group, i) => (
        <div className="nav-group" key={group.label ?? i}>
          {group.label && <div className="nav-label">{group.label}</div>}
          {group.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
