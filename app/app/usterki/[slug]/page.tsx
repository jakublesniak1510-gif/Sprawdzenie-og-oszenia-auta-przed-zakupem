import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { loadModelExtras } from "@/components/content/model-extras";
import { WagaBadge, wagaBorder } from "@/components/report/ui";
import { SITE_NAME, baseUrl, shortGeneration, slugify } from "@/components/site/config";
import { Icon, type IconName } from "@/components/ui/icons";
import { getModel, loadModels, type CarModel, type Engine, type Fault } from "@/lib/models";

export const revalidate = 3600;
export const dynamicParams = true; // nowe pliki w data/models działają bez przebudowy

export async function generateStaticParams() {
  return (await loadModels()).map((m) => ({ slug: m.id }));
}

const YEAR = new Date().getFullYear();
const SEV = { wysoka: 0, srednia: 1, niska: 2 } as const;
const shortName = (m: CarModel) => `${m.make} ${m.model} ${shortGeneration(m.generation)}`.trim();

/** Wszystkie usterki (silniki + wspólne), bez duplikatów, od najpoważniejszych. */
function topFaults(m: CarModel): (Fault & { where: string[] })[] {
  const map = new Map<string, Fault & { where: string[] }>();
  const add = (f: Fault, where: string) => {
    const k = f.title.toLowerCase();
    const cur = map.get(k);
    if (cur) {
      if (!cur.where.includes(where)) cur.where.push(where);
    } else map.set(k, { ...f, where: [where] });
  };
  m.engines.forEach((e) => e.faults.forEach((f) => add(f, e.code.split(" (")[0])));
  m.common_faults.forEach((f) => add(f, "wszystkie wersje"));
  return [...map.values()].sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.cost_pln[1] - a.cost_pln[1]);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await getModel((await params).slug);
  if (!m) return { title: "Nie znaleziono" };
  const name = shortName(m);
  const title = `Typowe usterki ${name} – na co uważać przy zakupie (${YEAR})`;
  const top = topFaults(m)
    .slice(0, 3)
    .map((f) => f.title.split(/\s[–(-]\s?/)[0].toLowerCase());
  const description = `Najczęstsze usterki ${name}${top.length ? `: ${top.join(", ")}` : ""}. Koszty napraw, które silniki wybrać, co sprawdzić na oględzinach i o co zapytać sprzedawcę.`;
  return {
    title: { absolute: title },
    description: description.length > 300 ? `${description.slice(0, 297)}…` : description,
    alternates: { canonical: `/usterki/${m.id}` },
    openGraph: { type: "article", title, description },
  };
}

const VERDICT: Record<NonNullable<Engine["verdict"]>, { label: string; cls: string; icon: IconName }> = {
  polecany: { label: "polecany", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: "check" },
  neutralny: { label: "neutralny", cls: "bg-slate-100 text-slate-800 border-slate-300", icon: "minus" },
  ryzykowny: { label: "ryzykowny", cls: "bg-red-100 text-red-800 border-red-300", icon: "alert" },
};

function VerdictBadge({ v }: { v: Engine["verdict"] }) {
  if (!v) return <span className="text-xs text-slate-600">brak oceny</span>;
  const d = VERDICT[v];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${d.cls}`}>
      <Icon name={d.icon} className="h-3.5 w-3.5" strokeWidth={2.5} />
      {d.label}
    </span>
  );
}

const cost = (f: Fault) => `${f.cost_pln[0].toLocaleString("pl-PL")}–${f.cost_pln[1].toLocaleString("pl-PL")} zł`;

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
            <span className="font-semibold">Koszt:</span> <span className="tabular-nums">{cost(f)}</span>
            {f.mileage_km && <> · zwykle przy {/km\s*$/i.test(f.mileage_km) ? f.mileage_km : `${f.mileage_km} km`}</>}
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
  const [all, extras] = await Promise.all([loadModels(), loadModelExtras(m)]);
  const name = shortName(m);
  const faults = topFaults(m);
  const sameMake = all.filter((x) => x.id !== m.id && x.make === m.make);
  const others = [...sameMake, ...all.filter((x) => x.id !== m.id && x.make !== m.make)].slice(0, 3);
  const quickHref = `/szybki-test?model=${encodeURIComponent(name)}`;
  const url = `${baseUrl()}/usterki/${m.id}`;

  const faq = [
    {
      q: `Jakie są typowe usterki ${name}?`,
      a: faults
        .slice(0, 5)
        .map((f) => `${f.title} (orientacyjnie ${cost(f)})`)
        .join("; ") + ".",
    },
    m.engines.some((e) => e.verdict) && {
      q: `Który silnik wybrać w ${name}?`,
      a: m.engines.map((e) => `${e.code.split(" (")[0]}: ${e.verdict ? VERDICT[e.verdict].label : "brak oceny"}`).join("; ") + ".",
    },
    { q: `O co zapytać sprzedawcę ${name}?`, a: m.questions_for_seller.join(" ") },
    m.inspection_tips.length > 0 && { q: `Co sprawdzić na oględzinach ${name}?`, a: m.inspection_tips.slice(0, 5).join(" ") },
  ].filter((x): x is { q: string; a: string } => !!x);

  const Cta = ({ secondary = false }: { secondary?: boolean }) => (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link href={quickHref} className="flex-1 rounded-xl bg-brand-700 px-5 py-4 text-center font-bold text-white hover:bg-brand-900">
        Sprawdź ogłoszenie {m.model} za darmo →
      </Link>
      {secondary && (
        <Link href="/sprawdz" className="rounded-xl border-2 border-brand-600 bg-white px-5 py-4 text-center font-bold text-brand-700 hover:bg-brand-50">
          Pełny raport 19 zł
        </Link>
      )}
    </div>
  );

  return (
    <article className="space-y-6">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `Typowe usterki ${name} – na co uważać przy zakupie`,
            description: m.summary,
            inLanguage: "pl-PL",
            mainEntityOfPage: url,
            about: { "@type": "Car", brand: { "@type": "Brand", name: m.make }, model: `${m.model} ${shortGeneration(m.generation)}` },
            publisher: { "@type": "Organization", name: SITE_NAME },
            dateModified: new Date().toISOString().slice(0, 10),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Typowe usterki", item: `${baseUrl()}/usterki` },
              { "@type": "ListItem", position: 2, name, item: url },
            ],
          },
        ]}
      />
      <header className="space-y-2">
        <nav aria-label="Ścieżka" className="text-sm text-slate-600">
          <Link href="/usterki" className="underline">
            Typowe usterki
          </Link>{" "}
          / {m.make}
        </nav>
        <h1 className="text-2xl font-extrabold leading-tight text-brand-900 sm:text-3xl">
          Typowe usterki {name} – na co uważać przy zakupie
        </h1>
        <p className="text-sm text-slate-600">
          Lata produkcji {m.years[0]}–{m.years[1]} · aktualizacja {YEAR}
        </p>
        <p className="text-slate-800">{m.summary}</p>
        {m.market_note && <p className="text-sm text-slate-700">{m.market_note}</p>}
      </header>

      <Cta />

      {/* Najczęstsze usterki wg wagi */}
      <section className="space-y-3" aria-labelledby="top-h">
        <h2 id="top-h" className="text-xl font-bold">
          Najczęstsze usterki – od najpoważniejszych
        </h2>
        <ol className="space-y-2">
          {faults.slice(0, 6).map((f) => (
            <li key={f.title} className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 ${wagaBorder(f.severity)}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{f.title}</h3>
                <WagaBadge waga={f.severity} />
              </div>
              <p className="mt-1 text-sm text-slate-700">
                <span className="tabular-nums font-semibold">{cost(f)}</span> · dotyczy: {f.where.join(", ")}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Silniki – tabela z werdyktem */}
      <section className="space-y-3" aria-labelledby="silniki-h">
        <h2 id="silniki-h" className="text-xl font-bold">
          Silniki: które wybrać
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Silnik
                </th>
                <th scope="col" className="hidden px-3 py-2 font-semibold sm:table-cell">
                  Paliwo
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Ocena
                </th>
              </tr>
            </thead>
            <tbody>
              {m.engines.map((e) => (
                <tr key={e.code} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-2">
                    <a href={`#silnik-${slugify(e.code.split(" (")[0])}`} className="font-semibold text-brand-700 underline">
                      {e.code.split(" (")[0]}
                    </a>
                    <span className="block text-xs text-slate-600 sm:hidden">{e.fuel}</span>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">{e.fuel}</td>
                  <td className="px-3 py-2">
                    <VerdictBadge v={e.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {extras.priceRanges.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="ceny-h">
          <h2 id="ceny-h" className="text-xl font-bold">
            Widełki cen rynkowych
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th scope="col" className="py-1 pr-3 font-semibold">
                  Wersja
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Cena
                </th>
              </tr>
            </thead>
            <tbody>
              {extras.priceRanges.map((p, i) => (
                <tr key={i} className="border-t border-slate-200 align-top">
                  <td className="py-1.5 pr-3">
                    {p.label}
                    {p.note && <span className="block text-xs text-slate-600">{p.note}</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right font-semibold tabular-nums">
                    {p.min.toLocaleString("pl-PL")}–{p.max.toLocaleString("pl-PL")} zł
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-600">
            Orientacyjne ceny ofertowe ({YEAR}){extras.priceNote ? ` – ${extras.priceNote}` : ""}. Cena konkretnego auta zależy od stanu, wyposażenia i
            historii.
          </p>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="szczegoly-h">
        <h2 id="szczegoly-h" className="text-xl font-bold">
          Usterki według silnika
        </h2>
        {m.engines.map((e) => (
          <div key={e.code} id={`silnik-${slugify(e.code.split(" (")[0])}`} className="scroll-mt-4 space-y-2 rounded-2xl bg-slate-100 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{e.code}</h3>
              <VerdictBadge v={e.verdict} />
            </div>
            <p className="text-sm text-slate-700">
              {e.fuel}
              {e.power_hp?.length ? `, ${e.power_hp.join("/")} KM` : ""}
            </p>
            {e.timing && (
              <p className="text-sm">
                <span className="font-semibold">Rozrząd:</span> {e.timing}
              </p>
            )}
            <FaultList faults={[...e.faults].sort((a, b) => SEV[a.severity] - SEV[b.severity])} />
          </div>
        ))}
      </section>

      {m.common_faults.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Usterki niezależne od silnika</h2>
          <FaultList faults={[...m.common_faults].sort((a, b) => SEV[a.severity] - SEV[b.severity])} />
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
        <p className="mt-3 text-sm">
          <Link href="/checklista" className="font-semibold text-brand-700 underline">
            Pełna checklista oględzin i pytań do druku →
          </Link>
        </p>
      </section>

      <Cta secondary />

      {others.length > 0 && (
        <nav aria-labelledby="inne-h" className="space-y-2">
          <h2 id="inne-h" className="text-lg font-bold">
            {sameMake.length ? `Inne modele ${m.make}` : "Inne modele"}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/usterki/${o.id}`} className="block rounded-xl bg-white p-3 shadow-sm hover:ring-2 hover:ring-brand-100">
                  <span className="font-semibold">
                    {o.make} {o.model}
                  </span>{" "}
                  <span className="text-sm text-slate-600">{shortGeneration(o.generation)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="text-xs text-slate-600">
        Koszty orientacyjne (warsztat niezależny, {YEAR}). Informacje ogólne o modelu – stan konkretnego egzemplarza może się różnić.{" "}
        {m.sources_note}
      </p>
    </article>
  );
}
