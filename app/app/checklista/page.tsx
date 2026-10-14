import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/report/PrintButton";
import { readRepoMarkdown } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Checklista oględzin auta i pytania do sprzedawcy – do druku (PDF)",
  description:
    "Darmowa checklista oględzin samochodu używanego i lista pytań do sprzedawcy do wydrukowania: lakier, silnik, zawieszenie, dokumenty, jazda próbna.",
  alternates: { canonical: "/checklista" },
};
export const revalidate = 3600;

export default async function ChecklistaPage() {
  const [ogledziny, pytania] = await Promise.all([
    readRepoMarkdown("data/checklists/ogledziny.md"),
    readRepoMarkdown("data/checklists/pytania-do-sprzedawcy.md"),
  ]);
  return (
    <div className="checklist-print space-y-5">
      <header className="no-print space-y-3">
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Checklista oględzin i pytania do sprzedawcy</h1>
        <p className="text-slate-700">
          Za darmo, do wydruku. Najważniejsze pytania zadaj telefonicznie przed wyjazdem, a checklistę zabierz na oględziny. W raporcie
          dostajesz wersję dopasowaną do konkretnego modelu i silnika.
        </p>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Drukuj / zapisz PDF" />
          <Link href="/szybki-test" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">
            Sprawdź ogłoszenie za darmo
          </Link>
        </div>
        <nav aria-label="Na tej stronie" className="flex flex-wrap gap-2 text-sm">
          <a href="#ogledziny" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold">
            Checklista oględzin
          </a>
          <a href="#pytania" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold">
            Pytania do sprzedawcy
          </a>
        </nav>
      </header>

      {[
        { id: "ogledziny", html: ogledziny, title: "Checklista oględzin" },
        { id: "pytania", html: pytania, title: "Pytania do sprzedawcy" },
      ].map((s, i) => (
        <section key={s.id} id={s.id} className={`scroll-mt-16 ${i > 0 ? "print-break-before" : ""}`}>
          {s.html ? (
            <div className="prose-md print-card overflow-x-auto rounded-2xl bg-white p-4 shadow-sm sm:p-6" dangerouslySetInnerHTML={{ __html: s.html }} />
          ) : (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{s.title} – w przygotowaniu.</p>
          )}
        </section>
      ))}

      <p className="hidden text-center text-[9pt] text-slate-600 print:block">
        Lista pomocnicza – nie zastępuje przeglądu u mechanika. SprawdźOgłoszenie – szybki test ogłoszenia za darmo.
      </p>
    </div>
  );
}
