import Link from "next/link";
import { MobileMenu } from "./MobileMenu";
import { NAV, NAV_CTA } from "./nav";

export function SiteHeader() {
  return (
    <header className="no-print relative border-b border-slate-200 bg-white">
      <nav aria-label="Główna nawigacja" className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="truncate py-2 text-lg font-extrabold text-brand-900" aria-label="SprawdźOgłoszenie – strona główna">
          Sprawdź<span className="text-brand-600">Ogłoszenie</span>
        </Link>
        <ul className="hidden items-center gap-1 whitespace-nowrap text-sm sm:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-700">
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href={NAV_CTA.href} className="ml-1 rounded-lg bg-brand-700 px-3 py-2 font-semibold text-white hover:bg-brand-900">
              {NAV_CTA.label}
            </Link>
          </li>
        </ul>
        <div className="flex items-center gap-1 sm:hidden">
          <Link href="/szybki-test" className="whitespace-nowrap rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900">
            Szybki test
          </Link>
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}
