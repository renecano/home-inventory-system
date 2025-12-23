"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Inicio" },
  { href: "/products", label: "Inventario" },
  { href: "/shopping-list", label: "Súper" },
  { href: "/movements", label: "Movimientos" },
];



export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur dark:bg-black/90">
      <div className="mx-auto max-w-xl grid grid-cols-4">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`py-3 text-center text-sm font-medium ${
                active ? "text-black dark:text-white" : "text-zinc-500"
              }`}
            >
              {t.label}
              {active && <div className="mx-auto mt-1 h-1 w-10 rounded bg-black dark:bg-white" />}
            </Link>
          );
        })}
      </div>
      {/* espacio seguro iPhone */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
