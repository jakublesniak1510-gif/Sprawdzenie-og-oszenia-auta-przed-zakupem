"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { QUICK_PREFILL_KEY } from "@/components/site/config";
import { MIN_QUICK_TEXT, QuickTestError, runQuickTest, toInt, type QuickTestResult } from "./api";
import { QuickTestResultView } from "./QuickTestResultView";

const inputCls =
  "w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function QuickTestForm({ initialText = "" }: { initialText?: string }) {
  const router = useRouter();
  const [tekst, setTekst] = useState(initialText);
  const [cena, setCena] = useState("");
  const [przebieg, setPrzebieg] = useState("");
  const [rocznik, setRocznik] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickTestResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const len = tekst.trim().length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (len < MIN_QUICK_TEXT) {
      setError(`Wklej więcej tekstu ogłoszenia (min. ${MIN_QUICK_TEXT} znaków) – im więcej, tym dokładniejszy wynik.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await runQuickTest({ tekst, cena: toInt(cena), przebieg: toInt(przebieg), rocznik: toInt(rocznik) });
      setResult(r);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: "start" }));
    } catch (err) {
      setError(err instanceof QuickTestError ? err.message : "Coś poszło nie tak. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  function goFullReport() {
    try {
      sessionStorage.setItem(QUICK_PREFILL_KEY, JSON.stringify({ tekst, cena, przebieg, rocznik }));
    } catch {
      /* brak storage – formularz będzie pusty */
    }
    router.push("/sprawdz?z=szybki-test");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5" noValidate>
        <label className="block">
          <span className="mb-1 block font-semibold text-slate-900">Tekst ogłoszenia</span>
          <textarea
            className={`${inputCls} min-h-44`}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Skopiuj opis z portalu i wklej tutaj, np. „Sprzedam VW Golf VII 1.6 TDI, 2015 r., przebieg 148 000 km…”"
            aria-describedby="qt-tekst-hint"
            maxLength={30000}
            required
          />
          <span id="qt-tekst-hint" className="mt-1 flex justify-between gap-2 text-xs text-slate-600">
            <span>Telefonów i danych sprzedawcy nie zapisujemy.</span>
            <span className={`tabular-nums ${len > 0 && len < MIN_QUICK_TEXT ? "font-semibold text-amber-800" : ""}`}>{len} znaków</span>
          </span>
        </label>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-slate-800">Opcjonalnie – dokładniejsza ocena ceny</legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Cena (zł)</span>
              <input className={inputCls} inputMode="numeric" value={cena} onChange={(e) => setCena(e.target.value)} placeholder="36900" />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Przebieg (km)</span>
              <input className={inputCls} inputMode="numeric" value={przebieg} onChange={(e) => setPrzebieg(e.target.value)} placeholder="148000" />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Rocznik</span>
              <input className={inputCls} inputMode="numeric" maxLength={4} value={rocznik} onChange={(e) => setRocznik(e.target.value)} placeholder="2015" />
            </label>
          </div>
        </fieldset>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand-700 px-6 py-4 text-lg font-bold text-white hover:bg-brand-900 disabled:cursor-wait disabled:bg-slate-400"
        >
          {busy ? "Sprawdzam…" : "Sprawdź za darmo"}
        </button>
        <p className="text-center text-xs text-slate-600">Bez płatności i rejestracji. Wynik od razu, na podstawie naszej bazy – bez AI.</p>
      </form>

      <div ref={resultRef} className="scroll-mt-4" aria-live="polite">
        {result && <QuickTestResultView result={result} onFullReport={goFullReport} />}
      </div>
    </div>
  );
}
