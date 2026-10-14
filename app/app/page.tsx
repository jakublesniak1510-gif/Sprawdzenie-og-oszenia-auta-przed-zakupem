import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { loadExampleReport } from "@/components/content/example-report";
import { plainText } from "@/components/content/landing-parse";
import { loadLanding } from "@/components/content/landing";
import { Comparison } from "@/components/landing/Comparison";
import { Md } from "@/components/landing/Md";
import { WagaBadge, wagaBorder } from "@/components/report/ui";
import { SITE_NAME, baseUrl } from "@/components/site/config";
import { Icon, type IconName } from "@/components/ui/icons";
import { formatPln } from "@/lib/offers";
import { loadModels } from "@/lib/models";
import { offers, packageOffer } from "@/lib/payments";

export const dynamic = "force-dynamic"; // ceny z env + treści z content/ czytane przy żądaniu
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Ikona sekcji raportu dobrana po treści tytułu (kolejność w content/landing.md może się zmieniać). */
function featureIcon(title: string): IconName {
  const t = title.toLowerCase();
  if (/usterk|napraw/.test(t)) return "wrench";
  if (/przebieg|cepik|bada/.test(t)) return "gauge";
  if (/pytan/.test(t)) return "chat";
  if (/checklist|oględzin/.test(t)) return "clipboard";
  if (/cen|porówn/.test(t)) return "tag";
  if (/flag|wyjaśni|sygnał|ogłoszeni/.test(t)) return "flag";
  return "document";
}
const RYZYKO = { niskie: "Ryzyko niskie", srednie: "Ryzyko średnie", wysokie: "Ryzyko wysokie" } as const;

export default async function Home() {
  const [c, example, models] = await Promise.all([loadLanding(), loadExampleReport(), loadModels()]);
  const o = offers();
  const prices = [o.find((x) => x.id === "raport")?.cenaGr ?? 1900, o.find((x) => x.id === "raport_plus")?.cenaGr ?? 2900, packageOffer().cenaGr];
  const planHrefs = ["/sprawdz?oferta=raport", "/sprawdz?oferta=raport_plus", "/pakiet"];
  const ex = example.report;

  return (
    <div className="space-y-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: c.faq.map((f) => ({ "@type": "Question", name: plainText(f.q), acceptedAnswer: { "@type": "Answer", text: plainText(f.a) } })),
          },
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: baseUrl(), inLanguage: "pl-PL" },
        ]}
      />

      {/* HERO */}
      <section className="space-y-5 pt-2" aria-labelledby="hero-h">
        <h1 id="hero-h" className="text-3xl font-extrabold leading-tight text-brand-900 sm:text-4xl">
          <Md text={c.hero.headline} />
        </h1>
        <Md text={c.hero.sub} as="p" className="text-lg text-slate-700" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/szybki-test"
            className="rounded-xl bg-brand-700 px-6 py-4 text-center text-lg font-bold text-white shadow hover:bg-brand-900"
          >
            {c.hero.ctaFree}
          </Link>
          <Link
            href="/sprawdz"
            className="rounded-xl border-2 border-brand-700 bg-white px-6 py-4 text-center text-lg font-bold text-brand-700 hover:bg-brand-50"
          >
            Pełny raport {formatPln(prices[0])}
          </Link>
        </div>
        {c.hero.ctaExample && (
          <Link href="/przyklad" className="inline-flex items-center gap-1 font-semibold text-brand-700 underline">
            {c.hero.ctaExample} <Icon name="arrow" className="h-4 w-4" />
          </Link>
        )}
        <ul className="space-y-1.5">
          {c.hero.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-slate-800">
              <Icon name="check" className="mt-0.5 h-5 w-5 text-emerald-700" strokeWidth={2.5} />
              <Md text={b} />
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">
          {models.length > 0 && <>{models.length} modeli w bazie usterek · </>}BLIK, Przelewy24, karta · raport w 1–3 minuty
        </p>
      </section>

      {/* JAK TO DZIAŁA */}
      <section aria-labelledby="jak-h" className="space-y-4">
        <h2 id="jak-h" className="text-2xl font-extrabold text-slate-900">
          Jak to działa
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {c.steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 font-bold text-white" aria-hidden>
                {i + 1}
              </div>
              <h3 className="font-bold">
                <span className="sr-only">Krok {i + 1}: </span>
                <Md text={s.title} />
              </h3>
              <Md text={s.text} as="p" className="mt-1 text-sm text-slate-700" />
            </li>
          ))}
        </ol>
      </section>

      {/* CO DOSTAJESZ */}
      <section aria-labelledby="co-h" className="space-y-4">
        <h2 id="co-h" className="text-2xl font-extrabold text-slate-900">
          Co dostajesz w raporcie
        </h2>
        {c.featuresIntro && <Md text={c.featuresIntro} as="p" className="text-slate-700" />}
        <ul className="grid gap-3 sm:grid-cols-2">
          {c.features.map((f) => (
            <li key={f.title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={featureIcon(f.title)} className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-bold">
                  <Md text={f.title} />
                </h3>
                {f.text && <Md text={f.text} as="p" className="mt-0.5 text-sm text-slate-700" />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* PRZYKŁADOWY RAPORT */}
      <section aria-labelledby="przyklad-h" className="space-y-4">
        <h2 id="przyklad-h" className="text-2xl font-extrabold text-slate-900">
          Tak wygląda raport
        </h2>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Fragment · fikcyjne ogłoszenie: {example.meta.tytul}</p>
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-red-500 bg-red-50 p-3 text-red-900">
              <div className="flex items-center gap-2 text-lg font-extrabold">
                <Icon name={ex.podsumowanie.ocena === "niskie" ? "shield" : ex.podsumowanie.ocena === "srednie" ? "alert" : "octagon"} className="h-6 w-6" />
                {RYZYKO[ex.podsumowanie.ocena]}
              </div>
              <p className="mt-1 text-sm">{ex.podsumowanie.uzasadnienie}</p>
            </div>
            {ex.czerwone_flagi.slice(0, 2).map((f) => (
              <div key={f.tytul} className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 ${wagaBorder(f.waga)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold">{f.tytul}</h3>
                  <WagaBadge waga={f.waga} />
                </div>
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                  <span className="font-semibold">Zapytaj: </span>„{f.pytanie_do_sprzedawcy}”
                </p>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-100 to-transparent" aria-hidden />
        </div>
        <Link href="/przyklad" className="inline-flex items-center gap-2 font-bold text-brand-700 underline">
          Zobacz cały przykładowy raport <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </section>

      {/* PORÓWNANIE */}
      <section aria-labelledby="por-h" className="space-y-4">
        <h2 id="por-h" className="text-2xl font-extrabold text-slate-900">
          Czym różnimy się od raportu historii pojazdu i mechanika
        </h2>
        <Comparison head={c.comparison.head} rows={c.comparison.rows} note={c.comparison.note} />
      </section>

      {/* CENNIK */}
      <section aria-labelledby="cennik-h" className="space-y-4" id="cennik">
        <h2 id="cennik-h" className="text-2xl font-extrabold text-slate-900">
          Cennik
        </h2>
        {c.pricingIntro && <Md text={c.pricingIntro} as="p" className="text-slate-700" />}
        <p className="text-sm text-slate-700">
          Szybki test jest zawsze <strong>za darmo</strong>. Płacisz tylko za pełny raport.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {c.pricing.map((p, i) => (
            <li key={p.name} className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm ${i === 0 ? "border-brand-600" : "border-slate-200"}`}>
              {i === 0 && <span className="mb-1 self-start rounded-full bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">Najczęściej wybierany</span>}
              <h3 className="text-lg font-bold">
                <Md text={p.name} />
              </h3>
              <p className="text-3xl font-extrabold text-brand-700">{formatPln(prices[i] ?? prices[0])}</p>
              {p.text && <Md text={p.text} as="p" className="mt-1 text-sm text-slate-700" />}
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-700" strokeWidth={2.5} />
                    <Md text={b} />
                  </li>
                ))}
              </ul>
              <Link
                href={planHrefs[i] ?? "/sprawdz"}
                className={`mt-4 rounded-xl px-4 py-3 text-center font-bold ${i === 0 ? "bg-brand-700 text-white hover:bg-brand-900" : "border-2 border-brand-600 text-brand-700 hover:bg-brand-50"}`}
              >
                {p.cta ?? "Wybieram"}
                {!p.cta && <span className="sr-only">: {plainText(p.name)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="space-y-4">
        <h2 id="faq-h" className="text-2xl font-extrabold text-slate-900">
          Najczęstsze pytania
        </h2>
        <div className="divide-y divide-slate-200 rounded-2xl bg-white shadow-sm">
          {c.faq.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                <Md text={f.q} />
                <Icon name="arrow" className="mt-0.5 h-5 w-5 rotate-90 text-brand-700 transition-transform group-open:-rotate-90" />
              </summary>
              <Md text={f.a} as="p" className="mt-2 text-slate-700" />
            </details>
          ))}
        </div>
      </section>

      {/* KOŃCOWE CTA */}
      <section className="space-y-3 rounded-2xl bg-brand-900 p-5 text-white sm:p-6">
        <h2 className="text-2xl font-extrabold">Masz ogłoszenie na oku?</h2>
        <p className="text-brand-100">Wklej je teraz – szybki test zajmie mniej czasu niż telefon do sprzedawcy.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/szybki-test" className="rounded-xl bg-white px-5 py-3.5 text-center font-bold text-brand-900 hover:bg-brand-50">
            Darmowy szybki test
          </Link>
          <Link href="/sprawdz" className="rounded-xl border-2 border-white px-5 py-3.5 text-center font-bold text-white hover:bg-white/10">
            Pełny raport {formatPln(prices[0])}
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="note">
        <strong>Ważne:</strong> raport jest pomocą, nie ekspertyzą. Nie oceniamy sprzedawców – wskazujemy, co warto wyjaśnić. Przed zakupem
        zawsze zrób oględziny auta u niezależnego mechanika. Z tekstu ogłoszenia automatycznie usuwamy telefony, e-maile i numery
        rejestracyjne; raporty kasujemy po 30 dniach.
      </section>
    </div>
  );
}
