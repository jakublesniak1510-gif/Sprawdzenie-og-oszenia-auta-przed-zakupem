"use client";

import Link from "next/link";
import { WagaBadge, wagaBorder } from "@/components/report/ui";
import { Icon } from "@/components/ui/icons";
import { ShareButton } from "@/components/ui/ShareButton";
import { shareText, type QuickTestResult } from "./api";

const PRICE_CLS = {
  ponizej: "border-amber-300 bg-amber-50 text-amber-900",
  powyzej: "border-amber-300 bg-amber-50 text-amber-900",
  w_normie: "border-emerald-300 bg-emerald-50 text-emerald-900",
  brak_danych: "border-slate-300 bg-slate-50 text-slate-800",
} as const;
const PRICE_ICON = { ponizej: "tag", powyzej: "tag", w_normie: "check", brak_danych: "info" } as const;

export function QuickTestResultView({ result: r, onFullReport, shareUrl }: { result: QuickTestResult; onFullReport: () => void; shareUrl?: string }) {
  // Brak VIN pokazujemy dużym boksem – nie dublujemy go na liście flag.
  const flagi = r.brakVin ? r.flagi.filter((f) => f.id !== "brak-vin") : r.flagi;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-brand-900">Wynik szybkiego testu</h2>

      {/* Rozpoznany model */}
      <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="qt-model">
        <h3 id="qt-model" className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Rozpoznany model
        </h3>
        {r.rozpoznany ? (
          <>
            <p className="mt-1 text-lg font-bold">{r.rozpoznany.nazwa}</p>
            {r.rozpoznany.silnik && <p className="text-sm text-slate-700">Silnik: {r.rozpoznany.silnik}</p>}
            {r.rozpoznany.modelId && (
              <Link href={`/usterki/${r.rozpoznany.modelId}`} className="mt-1 inline-block text-sm font-semibold text-brand-700 underline">
                Wszystkie typowe usterki tego modelu →
              </Link>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-700">
            Nie rozpoznaliśmy modelu z naszej bazy. Dopisz markę, model i silnik (np. „Golf VII 1.6 TDI”) albo sprawdź{" "}
            <Link href="/usterki" className="font-semibold text-brand-700 underline">
              listę modeli
            </Link>
            .
          </p>
        )}
      </section>

      {/* Brak VIN – duży box */}
      {r.brakVin && (
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950" aria-labelledby="qt-vin">
          <h3 id="qt-vin" className="flex items-center gap-2 text-lg font-extrabold">
            <Icon name="alert" className="h-6 w-6" /> Brak VIN w ogłoszeniu
          </h3>
          <p className="mt-1">
            Poproś sprzedawcę o <strong>VIN, numer rejestracyjny i datę pierwszej rejestracji</strong>. Potem sprawdź auto bezpłatnie w usłudze{" "}
            <a href="https://historiapojazdu.gov.pl/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Historia Pojazdu (gov.pl)
            </a>{" "}
            – zobaczysz przebiegi z badań technicznych i ważność OC.
          </p>
        </section>
      )}

      {/* Flagi */}
      <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="qt-flagi">
        <h3 id="qt-flagi" className="font-bold">
          Do wyjaśnienia ze sprzedawcą ({flagi.length})
        </h3>
        {flagi.length === 0 ? (
          <p className="mt-1 text-sm text-slate-700">W treści ogłoszenia nie znaleźliśmy typowych sygnałów do wyjaśnienia. To nie zastępuje oględzin.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {flagi.map((f, i) => (
              <li key={i} className={`rounded-xl border border-l-4 border-slate-200 p-3 ${wagaBorder(f.waga)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {f.tytul && <h4 className="font-semibold">{f.tytul}</h4>}
                  <WagaBadge waga={f.waga} />
                </div>
                {f.opis && <p className="mt-1 text-sm text-slate-700">{f.opis}</p>}
                {f.pytanie && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                    <span className="font-semibold">Zapytaj: </span>„{f.pytanie}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Usterki top 3 */}
      {r.usterki.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="qt-usterki">
          <h3 id="qt-usterki" className="font-bold">
            3 najważniejsze typowe usterki
          </h3>
          <ol className="mt-2 space-y-2">
            {r.usterki.map((u, i) => (
              <li key={i} className={`rounded-xl border border-l-4 border-slate-200 p-3 ${wagaBorder(u.waga)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-semibold">{u.tytul}</h4>
                  <WagaBadge waga={u.waga} />
                </div>
                {u.objawy && <p className="mt-1 text-sm text-slate-700">{u.objawy}</p>}
                {u.koszt && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Orientacyjny koszt:</span>{" "}
                    <span className="tabular-nums">
                      {u.koszt[0].toLocaleString("pl-PL")}–{u.koszt[1].toLocaleString("pl-PL")} zł
                    </span>
                  </p>
                )}
                {u.jakSprawdzic && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Jak sprawdzić:</span> {u.jakSprawdzic}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Cena */}
      <section className={`rounded-2xl border p-4 ${PRICE_CLS[r.cena.pozycja]}`} aria-labelledby="qt-cena">
        <h3 id="qt-cena" className="flex items-center gap-2 font-bold">
          <Icon name={PRICE_ICON[r.cena.pozycja]} className="h-5 w-5" /> {r.cena.etykieta}
        </h3>
        {r.cena.komentarz && <p className="mt-1 text-sm">{r.cena.komentarz}</p>}
      </section>

      {r.nastepnyKrok && (
        <section className="rounded-2xl border-2 border-brand-600 bg-brand-50 p-4" aria-labelledby="qt-krok">
          <h3 id="qt-krok" className="flex items-center gap-2 font-extrabold text-brand-900">
            <Icon name="arrow" className="h-5 w-5" /> Następny krok
          </h3>
          <p className="mt-1">{r.nastepnyKrok}</p>
        </section>
      )}

      {/* CTA */}
      <section className="space-y-3 rounded-2xl bg-brand-900 p-4 text-white sm:p-5">
        <h3 className="text-lg font-extrabold">Chcesz pełny obraz przed wyjazdem?</h3>
        <p className="text-sm text-brand-100">
          Pełny raport: wszystkie flagi z pytaniami, przebiegi z CEPiK na wykresie, wszystkie usterki silnika z kosztami, analiza zdjęć,
          checklista oględzin. Tekst ogłoszenia przeniesiemy do formularza.
        </p>
        <button type="button" onClick={onFullReport} className="w-full rounded-xl bg-white px-5 py-3.5 text-lg font-extrabold text-brand-900 hover:bg-brand-50 sm:w-auto">
          Pełny raport 19 zł →
        </button>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div>
          <ShareButton title="Wynik szybkiego testu ogłoszenia" text={shareText(r)} url={shareUrl} label="Udostępnij wynik" className="w-full sm:w-auto" />
        </div>
        <Link
          href="/checklista"
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <Icon name="clipboard" className="h-4 w-4" /> Darmowa checklista oględzin do druku
        </Link>
      </div>
    </div>
  );
}
