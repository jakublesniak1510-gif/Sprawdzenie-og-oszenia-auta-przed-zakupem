"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { NAV, NAV_CTA } from "./nav";

/** Menu na telefon: przycisk + rozwijana lista. Zamyka się po zmianie strony i klawiszem Esc. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? "Zamknij menu" : "Otwórz menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-800 hover:bg-slate-100"
      >
        <Icon name={open ? "x" : "menu"} className="h-6 w-6" />
      </button>
      {open && (
        <div id="menu-mobile" className="absolute inset-x-0 top-full z-30 border-b border-slate-200 bg-white shadow-lg">
          <ul className="mx-auto max-w-3xl px-4 py-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                  className="block rounded-lg px-2 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 aria-[current=page]:text-brand-700"
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="pb-2 pt-1">
              <Link href={NAV_CTA.href} className="block rounded-xl bg-brand-700 px-4 py-3 text-center font-bold text-white hover:bg-brand-900">
                {NAV_CTA.label} 19 zł
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
