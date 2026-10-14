import Link from "next/link";
import { loadLanding } from "@/components/content/landing";
import { Md } from "@/components/landing/Md";
import { CONTACT_PLACEHOLDER } from "./config";

const LINKS = [
  { href: "/szybki-test", label: "Szybki test" },
  { href: "/sprawdz", label: "Pełny raport" },
  { href: "/przyklad", label: "Przykładowy raport" },
  { href: "/usterki", label: "Typowe usterki" },
  { href: "/blog", label: "Blog" },
  { href: "/checklista", label: "Checklista oględzin" },
  { href: "/pakiet", label: "Pakiet 5 raportów" },
];

const DEFAULT_TEXT =
  "Raport tworzy automatycznie sztuczna inteligencja na podstawie tego, co wkleisz. To pomoc w decyzji, nie ekspertyza ani gwarancja stanu auta. Przed zakupem pokaż auto mechanikowi.";
const DEFAULT_ITEMS = [
  "[Regulamin](/regulamin)",
  "[Polityka prywatności](/polityka-prywatnosci)",
  "[Co możemy, a czego nie](/zastrzezenia)",
  `Kontakt: ${CONTACT_PLACEHOLDER}`,
];

/** Stopka: nawigacja + sekcja `## stopka` z content/landing.md (disclaimer, linki prawne, kontakt). */
export async function SiteFooter() {
  const { footer } = await loadLanding();
  const items = footer.items.length ? footer.items : DEFAULT_ITEMS;
  // Linki nawigacji, które są już w lewej kolumnie, nie powtarzamy.
  const navHrefs = new Set(LINKS.map((l) => l.href));
  const legal = items.filter((i) => {
    const href = /\]\(([^)]+)\)/.exec(i)?.[1];
    return !href || !navHrefs.has(href);
  });
  return (
    <footer className="no-print mt-8 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 text-sm text-slate-700 sm:grid-cols-2">
        <nav aria-label="Stopka">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-brand-700 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-3">
          <ul className="space-y-1.5 [&_a]:underline [&_a:hover]:text-brand-700">
            {legal.map((i) => (
              <li key={i}>
                <Md text={i} />
              </li>
            ))}
          </ul>
          <Md text={footer.text ?? DEFAULT_TEXT} as="p" className="text-xs text-slate-600" />
        </div>
      </div>
    </footer>
  );
}
