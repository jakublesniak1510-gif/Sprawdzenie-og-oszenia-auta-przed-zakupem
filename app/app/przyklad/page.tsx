import type { Metadata } from "next";
import Link from "next/link";
import { loadExampleReport } from "@/components/content/example-report";
import { PrintButton } from "@/components/report/PrintButton";
import { ReportView } from "@/components/report/ReportView";
import { Icon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Przykładowy raport – Volkswagen Golf VII 1.6 TDI",
  description:
    "Zobacz, jak wygląda pełny raport z analizy ogłoszenia auta: czerwone flagi, przebiegi z CEPiK na wykresie, typowe usterki z kosztami, porównanie cen, pytania do sprzedawcy i checklista.",
  alternates: { canonical: "/przyklad" },
};
export const revalidate = 3600;

export default async function PrzykladPage() {
  const { report, meta } = await loadExampleReport();
  return (
    <article className="space-y-4">
      <div className="no-print flex items-start gap-3 rounded-2xl border-2 border-dashed border-brand-600 bg-brand-50 p-4 text-brand-900" role="note">
        <Icon name="info" className="mt-0.5 h-5 w-5" />
        <p className="text-sm">
          <strong>To przykład na fikcyjnym ogłoszeniu.</strong> Dane, przebiegi i oferty są zmyślone na potrzeby prezentacji – tak wygląda
          raport, który dostajesz po wklejeniu prawdziwego ogłoszenia.
        </p>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Przykładowy raport+</p>
          <h1 className="text-2xl font-extrabold text-brand-900">Raport: {meta.tytul}</h1>
          <p className="text-xs text-slate-600">
            {meta.cena_pln !== null && <>cena w ogłoszeniu {meta.cena_pln.toLocaleString("pl-PL")} zł</>}
            {meta.przebieg_km !== null && <> · przebieg deklarowany {meta.przebieg_km.toLocaleString("pl-PL")} km</>}
          </p>
        </div>
        <PrintButton />
      </header>

      {meta.ogloszenieHtml && (
        <details className="no-print rounded-2xl bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-semibold">
            Treść ogłoszenia <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Ogłoszenie fikcyjne</span>
          </summary>
          <div className="prose-md mt-2 overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: meta.ogloszenieHtml }} />
        </details>
      )}

      <ReportView report={report} offer="raport_plus" />

      <section className="no-print space-y-3 rounded-2xl bg-brand-900 p-5 text-white">
        <h2 className="text-xl font-extrabold">Sprawdź swoje ogłoszenie</h2>
        <p className="text-brand-100">Zacznij od darmowego szybkiego testu albo od razu zamów pełny raport.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/szybki-test" className="rounded-xl bg-white px-5 py-3 text-center font-bold text-brand-900 hover:bg-brand-50">
            Darmowy szybki test
          </Link>
          <Link href="/sprawdz" className="rounded-xl border-2 border-white px-5 py-3 text-center font-bold text-white hover:bg-white/10">
            Pełny raport 19 zł
          </Link>
        </div>
      </section>
    </article>
  );
}
