import type { Metadata } from "next";
import { QuickTestForm } from "@/components/quick-test/QuickTestForm";

export const metadata: Metadata = {
  title: "Darmowy szybki test ogłoszenia auta",
  description:
    "Wklej ogłoszenie używanego auta i od razu, za darmo, zobacz: rozpoznany model, sygnały do wyjaśnienia ze sprzedawcą, 3 najważniejsze typowe usterki i ocenę ceny.",
  alternates: { canonical: "/szybki-test" },
};

export default async function SzybkiTestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const model = typeof sp.model === "string" ? sp.model.slice(0, 120) : "";
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Za darmo · wynik od razu</p>
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Szybki test ogłoszenia</h1>
        <p className="text-slate-700">
          Wklej treść ogłoszenia. Pokażemy rozpoznany model, sygnały do wyjaśnienia ze sprzedawcą, 3 najważniejsze typowe usterki i
          pozycję ceny na tle rynku.
        </p>
      </header>
      <QuickTestForm initialText={model ? `${model} ` : ""} />
      <p className="text-xs text-slate-600">
        Szybki test to wskazówka, nie ocena konkretnego auta. Przed zakupem zawsze zrób oględziny u niezależnego mechanika.
      </p>
    </div>
  );
}
