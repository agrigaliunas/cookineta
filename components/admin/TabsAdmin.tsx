"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/horneada", label: "Horneada y zonas" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/combos", label: "Categorías y combos" },
  { href: "/admin/pedidos", label: "Pedidos y envíos" },
  { href: "/admin/configuracion", label: "Configuración" },
];

export default function TabsAdmin() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        gap: "var(--space-2)",
        flexWrap: "wrap",
      }}
    >
      {TABS.map((t) => {
        const activo =
          t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 15,
              padding: "var(--space-2) var(--space-4)",
              borderRadius: 999,
              textDecoration: "none",
              background: activo
                ? "var(--color-accent-600)"
                : "var(--color-neutral-200)",
              color: activo ? "#ffffff" : "var(--color-neutral-700)",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
