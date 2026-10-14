import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { formatPln } from "@/lib/offers";
import { offers } from "@/lib/payments";

export const dynamic = "force-dynamic";

const STEPS = [
  { t: "Wklej ogłoszenie", d: "Tekst i do 8 zrzutów ekranu. Nie pobieramy niczego z portali – wklejasz sam." },
  { t: "Dodaj historię (opcjonalnie)", d: "Wynik z bezpłatnej „Historii Pojazdu” na gov.pl i podobne oferty do porównania ceny." },
  { t: "Zapłać BLIK-iem", d: "Raport w kilka minut w przeglądarce, z wersją do druku / PDF." },
];

const WHAT = [
  "Czerwone flagi: sprzeczności, zwroty typowe dla handlarzy, brak VIN, cena odstająca od rynku",
  "Przebiegi z badań technicznych (CEPiK) zestawione z deklaracją sprzedawcy – z wykresem",
  "Typowe usterki tego modelu i silnika z orientacyjnym kosztem naprawy – z naszej bazy",
  "Gotowa lista pytań do sprzedawcy i checklista na oględziny",
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-2">
        <h1 className="text-3xl font-extrabold leading-tight text-brand-900 sm:text-4xl">
          Sprawdź ogłoszenie auta, zanim pojedziesz je oglądać
        </h1>
        <p className="text-lg text-slate-700">
          Wklejasz ogłoszenie, a w kilka minut dostajesz raport: co budzi wątpliwości, jakie usterki są typowe dla tego
          modelu, o co zapytać sprzedawcę i na co patrzeć przy oględzinach.
        </p>
        <Link
          href="/sprawdz"
          className="inline-block w-full rounded-xl bg-brand-700 px-6 py-4 text-center text-lg font-bold text-white shadow hover:bg-brand-900 sm:w-auto"
        >
          Sprawdź ogłoszenie →
        </Link>
        <p className="text-sm text-slate-500">
          Od {formatPln(Math.min(...offers().map((o) => o.cenaGr)))} · BLIK, Przelewy24, karta
        </p>
      </section>

      <Disclaimer />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-bold">Co jest w raporcie</h2>
        <ul className="space-y-2">
          {WHAT.map((w) => (
            <li key={w} className="flex gap-2">
              <span aria-hidden className="text-brand-600">✓</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Jak to działa</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-1 text-sm font-bold text-brand-600">Krok {i + 1}</div>
              <div className="font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {offers().map((o) => (
          <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold">{o.nazwa}</h3>
              <span className="text-2xl font-extrabold text-brand-700">{formatPln(o.cenaGr)}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {o.zawiera.map((z) => (
                <li key={z}>• {z}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-slate-900">Prywatność</h2>
        <p>
          Zanim tekst ogłoszenia trafi do analizy, automatycznie usuwamy z niego telefony, e-maile, numery rejestracyjne i
          dane kontaktowe. Zdjęć nie zapisujemy na dysku. Raport i dane wejściowe kasujemy po 30 dniach.
        </p>
      </section>
    </div>
  );
}
