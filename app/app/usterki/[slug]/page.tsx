import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WagaBadge, wagaBorder } from "@/components/report/ui";
import { getModel, loadModels, type Fault } from "@/lib/models";

export const revalidate = 3600;
export const dynamicParams = true; // nowe pliki w data/models działają bez przebudowy

export async function generateStaticParams() {
  return (await loadModels()).map((m) => ({ slug: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await getModel((await params).slug);
  if (!m) return { title: "Nie znaleziono" };
  const name = `${m.make} ${m.model} ${m.generation}`;
  return {
    title: `${name} – typowe usterki i na co uważać przy zakupie`,
    description: `Typowe usterki ${name}: silniki, koszty napraw, co sprawdzić na oględzinach. ${m.summary}`.slice(0, 300),
  };
}

const VERDICT = { polecany: "polecany", neutralny: "neutralny", ryzykowny: "ryzykowny" } as const;
const VERDICT_CLS = { polecany: "bg-emerald-100 text-emerald-800", neutralny: "bg-slate-100 text-slate-700", ryzykowny: "bg-red-100 text-red-800" } as const;

function FaultList({ faults }: { faults: Fault[] }) {
  return (
    <ul className="space-y-2">
      {faults.map((f) => (
        <li key={f.title} className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 ${wagaBorder(f.severity)}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="font-semibold">{f.title}</h4>
            <WagaBadge waga={f.severity} />
          </div>
          <p className="mt-1 text-sm text-slate-700">{f.symptoms}</p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Koszt:</span>{" "}
            <span className="tabular-nums">
              {f.cost_pln[0].toLocaleString("pl-PL")}–{f.cost_pln[1].toLocaleString("pl-PL")} zł
            </span>
            {f.mileage_km && <> · zwykle przy {f.mileage_km} km</>}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Jak sprawdzić:</span> {f.check_at_inspection}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const m = await getModel((await params).slug);
  if (!m) notFound();
  const name = `${m.make} ${m.model}`;

  const Cta = () => (
    <Link href="/sprawdz" className="block rounded-xl bg-brand-700 px-5 py-4 text-center font-bold text-white hover:bg-brand-900">
      Sprawdź konkretne ogłoszenie tego modelu →
    </Link>
  );

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-slate-500">
          <Link href="/usterki" className="underline">
            Typowe usterki
          </Link>{" "}
          / {m.make}
        </p>
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
          {name} {m.generation} – typowe usterki i na co uważać
        </h1>
        <p className="text-slate-700">{m.summary}</p>
        {m.market_note && <p className="text-sm text-slate-600">{m.market_note}</p>}
      </header>

      <Cta />

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Silniki</h2>
        {m.engines.map((e) => (
          <div key={e.code} className="space-y-2 rounded-2xl bg-slate-100 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{e.code}</h3>
              <span className="text-sm text-slate-600">
                {e.fuel}
                {e.power_hp?.length ? `, ${e.power_hp.join("/")} KM` : ""}
              </span>
              {e.verdict && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT_CLS[e.verdict]}`}>{VERDICT[e.verdict]}</span>}
            </div>
            {e.timing && (
              <p className="text-sm">
                <span className="font-semibold">Rozrząd:</span> {e.timing}
              </p>
            )}
            <FaultList faults={e.faults} />
          </div>
        ))}
      </section>

      {m.common_faults.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Usterki niezależne od silnika</h2>
          <FaultList faults={m.common_faults} />
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xl font-bold">Co sprawdzić na oględzinach</h2>
        <ul className="list-disc space-y-1 pl-5">
          {m.inspection_tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-xl font-bold">O co zapytać sprzedawcę</h2>
        <ul className="list-disc space-y-1 pl-5">
          {m.questions_for_seller.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>

      <Cta />
      <p className="text-xs text-slate-500">
        Koszty orientacyjne (warsztat niezależny, 2026). Informacje ogólne o modelu – stan konkretnego egzemplarza może się
        różnić. {m.sources_note}
      </p>
    </article>
  );
}
