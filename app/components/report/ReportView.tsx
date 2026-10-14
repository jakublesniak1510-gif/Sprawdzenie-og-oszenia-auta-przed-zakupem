import Link from "next/link";
import type { Report } from "@/lib/report-schema";
import { MileageChart } from "./MileageChart";
import { Section, WagaBadge, km, pln, wagaBorder } from "./ui";

const RYZYKO: Record<Report["podsumowanie"]["ocena"], { label: string; cls: string; icon: string }> = {
  niskie: { label: "Ryzyko niskie", cls: "bg-emerald-50 border-emerald-400 text-emerald-900", icon: "●" },
  srednie: { label: "Ryzyko średnie", cls: "bg-amber-50 border-amber-400 text-amber-900", icon: "▲" },
  wysokie: { label: "Ryzyko wysokie", cls: "bg-red-50 border-red-500 text-red-900", icon: "■" },
};

const PEWNOSC = { wysoka: "wysoka", srednia: "średnia", niska: "niska" } as const;

/** Zasady ogólne pokazywane, gdy modelu nie ma w bazie (stała treść – nic nie jest zmyślane przez AI). */
const ZASADY_OGOLNE = [
  "Poproś o historię serwisową (faktury) i sprawdź, kiedy wymieniano rozrząd, olej i płyny.",
  "Zrób diagnostykę komputerową wszystkich sterowników – także błędy zapisane i skasowane.",
  "Zmierz grubość lakieru na każdym elemencie; różnice wskazują naprawy blacharskie.",
  "Zimny rozruch: posłuchaj silnika, sprawdź dym z wydechu i pracę na wolnych obrotach.",
  "Przy automacie: jazda w korku, ruszanie pod górę, płynność zmiany biegów.",
  "Sprawdź zawieszenie na nierównościach i równomierność zużycia opon.",
];

export function ReportView({ report: r, offer }: { report: Report; offer: "raport" | "raport_plus" }) {
  const ryz = RYZYKO[r.podsumowanie.ocena];
  const v = r.rozpoznany_pojazd;

  return (
    <div className="space-y-4">
      {/* 1. Podsumowanie */}
      <section className={`print-card rounded-2xl border-2 p-4 sm:p-5 ${ryz.cls}`}>
        <div className="text-sm font-semibold uppercase tracking-wide opacity-80">Podsumowanie</div>
        <div className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
          <span aria-hidden>{ryz.icon}</span> {ryz.label}
        </div>
        <p className="mt-2">{r.podsumowanie.uzasadnienie}</p>
        <p className="mt-3 font-semibold">Zalecenie: {r.podsumowanie.zalecenie}</p>
      </section>

      {/* 2. Rozpoznany pojazd */}
      <Section title="Rozpoznany pojazd">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ["Marka", v.marka],
            ["Model", v.model],
            ["Generacja", v.generacja],
            ["Silnik", v.silnik],
            ["Pewność rozpoznania", PEWNOSC[v.pewnosc]],
          ].map(([k, val]) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-semibold">{val}</dd>
            </div>
          ))}
          <div>
            <dt className="text-slate-500">W naszej bazie</dt>
            <dd className={`font-semibold ${v.w_bazie ? "text-emerald-700" : "text-amber-700"}`}>{v.w_bazie ? "tak" : "nie"}</dd>
          </div>
        </dl>
      </Section>

      {/* 3. Czerwone flagi */}
      <Section title={`Czerwone flagi (${r.czerwone_flagi.length})`}>
        {r.czerwone_flagi.length === 0 ? (
          <p className="text-sm text-slate-600">Nie znaleźliśmy w ogłoszeniu sygnałów wymagających wyjaśnienia. Nie zwalnia to z oględzin.</p>
        ) : (
          <ul className="space-y-3">
            {r.czerwone_flagi.map((f, i) => (
              <li key={i} className={`print-card print-avoid rounded-xl border border-l-4 border-slate-200 bg-white p-3 ${wagaBorder(f.waga)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold">{f.tytul}</h3>
                  <WagaBadge waga={f.waga} />
                </div>
                <p className="mt-1 text-sm text-slate-700">{f.opis}</p>
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                  <span className="font-semibold">Zapytaj: </span>„{f.pytanie_do_sprzedawcy}”
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 4. Przebieg */}
      {r.przebieg && (
        <Section title="Przebieg">
          <p className="mb-3 text-sm">
            Deklarowany przebieg: <strong>{km(r.przebieg.deklarowany_km)}</strong>
          </p>
          {r.przebieg.odczyty.length > 0 && (
            <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_auto]">
              <MileageChart readings={r.przebieg.odczyty} declaredKm={r.przebieg.deklarowany_km} />
              <table className="self-start text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pr-4 font-medium">Data badania</th>
                    <th className="text-right font-medium">Odczyt</th>
                  </tr>
                </thead>
                <tbody>
                  {r.przebieg.odczyty.map((o, i, arr) => {
                    const down = i > 0 && o.km < arr[i - 1].km;
                    return (
                      <tr key={i} className={down ? "font-semibold text-red-700" : ""}>
                        <td className="pr-4 tabular-nums">{o.data}</td>
                        <td className="text-right tabular-nums">
                          {km(o.km)} {down && <span aria-label="spadek">↓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm">{r.przebieg.wniosek}</p>
          {r.przebieg.uwagi.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {r.przebieg.uwagi.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* 5. Typowe usterki */}
      <Section title="Typowe usterki modelu i silnika">
        {!v.w_bazie ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Brak modelu w bazie, zasady ogólne. Nie podajemy usterek ani kosztów dla modeli, których nie mamy
              zweryfikowanych w naszej bazie.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ZASADY_OGOLNE.map((z) => (
                <li key={z}>{z}</li>
              ))}
            </ul>
          </div>
        ) : r.typowe_usterki.length === 0 ? (
          <p className="text-sm text-slate-600">Brak usterek do pokazania dla wybranego silnika.</p>
        ) : (
          <ul className="space-y-3">
            {r.typowe_usterki.map((u, i) => (
              <li key={i} className={`print-card print-avoid rounded-xl border border-l-4 border-slate-200 p-3 ${wagaBorder(u.waga)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-bold">{u.tytul}</h3>
                  <WagaBadge waga={u.waga} />
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold">Objawy:</span> {u.objawy}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Orientacyjny koszt naprawy:</span>{" "}
                  <span className="tabular-nums">
                    {u.koszt_pln_od.toLocaleString("pl-PL")}–{u.koszt_pln_do.toLocaleString("pl-PL")} zł
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Jak sprawdzić:</span> {u.jak_sprawdzic}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Koszty orientacyjne – warsztat niezależny, części zamienne, ceny 2026.</p>
      </Section>

      {/* 6. Zdjęcia */}
      {r.zdjecia && (
        <Section title="Zdjęcia">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.zdjecia.uwagi.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 7. Porównanie cen */}
      {r.porownanie_cen && (
        <Section title="Porównanie cen">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Źródło</th>
                  <th className="py-2 pr-3 text-right font-medium">Cena</th>
                  <th className="py-2 pr-3 text-right font-medium">Rocznik</th>
                  <th className="py-2 pr-3 text-right font-medium">Przebieg</th>
                  <th className="py-2 pr-3 font-medium">Wersja / wyposażenie</th>
                  <th className="py-2 font-medium">Uwaga</th>
                </tr>
              </thead>
              <tbody>
                {r.porownanie_cen.wiersze.map((w, i) => (
                  <tr key={i} className={`border-b border-slate-100 align-top ${i === 0 ? "bg-brand-50 font-semibold" : ""}`}>
                    <td className="whitespace-nowrap py-2 pr-3">{w.zrodlo}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{pln(w.cena)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{w.rocznik ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{km(w.przebieg_km)}</td>
                    <td className="py-2 pr-3">{w.wyposazenie}</td>
                    <td className="py-2">{w.uwaga}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">{r.porownanie_cen.wniosek}</p>
        </Section>
      )}

      {/* 8. Pytania */}
      <Section title="Pytania do sprzedawcy">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {r.pytania_do_sprzedawcy.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </Section>

      {/* 9. Checklista */}
      <Section title="Checklista oględzin">
        <div className="grid gap-4 sm:grid-cols-2">
          {r.checklista_ogledzin.map((c, i) => (
            <div key={i}>
              <h3 className="mb-1 font-semibold">{c.obszar}</h3>
              <ul className="space-y-1 text-sm">
                {c.punkty.map((p, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-slate-400" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Dokumenty */}
      <Section title="Dokumenty do sprawdzenia">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {r.dokumenty_do_sprawdzenia.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </Section>

      {offer === "raport_plus" && (
        <>
          <Section title="Wzór umowy kupna-sprzedaży" className="no-print">
            <p className="text-sm">
              W pakiecie Raport+ masz wzór umowy kupna-sprzedaży samochodu do wydruku.{" "}
              <Link href="/umowa" className="font-semibold text-brand-700 underline" target="_blank">
                Otwórz wzór umowy →
              </Link>
            </p>
          </Section>

          {/* Checklista do druku – osobna strona A4 */}
          <section className="print-card print-break-before rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold">Checklista na oględziny – do wydruku</h2>
            <p className="mb-3 text-xs text-slate-500">
              {v.marka} {v.model} {v.generacja !== "nie ustalono" ? v.generacja : ""} · zabierz na oględziny, odhaczaj na miejscu
            </p>
            {r.checklista_ogledzin.map((c, i) => (
              <div key={i} className="mb-3 break-inside-avoid">
                <h3 className="border-b border-slate-300 font-semibold">{c.obszar}</h3>
                <ul className="mt-1 space-y-1.5 text-sm">
                  {c.punkty.map((p, j) => (
                    <li key={j} className="flex gap-2">
                      <span aria-hidden className="mt-0.5 inline-block h-4 w-4 shrink-0 border-2 border-slate-700" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-4 text-sm">
              <div className="font-semibold">Notatki:</div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-7 border-b border-slate-300" />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
