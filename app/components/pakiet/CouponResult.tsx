"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";

interface Paid {
  status: "oplacono";
  kod: string;
  uzycia: number;
  wazny_do: string;
  email_wyslany_na: string | null;
}

/** Strona po zakupie pakietu: odpytuje GET /api/coupons/<sessionId> (202 = czekamy na płatność). */
export function CouponResult({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Paid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  // Odpytywanie z rosnącym odstępem (3 s → 60 s) – API ma limit 10 zapytań / 10 min; przy 429 czekamy Retry-After.
  const [waitMs, setWaitMs] = useState(0);

  useEffect(() => {
    if (data || error) return;
    let cancelled = false;
    const t = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/coupons/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
          const j = (await res.json().catch(() => ({}))) as Partial<Paid> & { error?: string };
          if (cancelled) return;
          const next = Math.min(60_000, 3000 * 2 ** tries);
          if (res.status === 200 && j.kod) setData(j as Paid);
          else if (res.status === 202) {
            setWaitMs(next);
            setTries((n) => n + 1);
          } else if (res.status === 429) {
            setWaitMs(Math.max(next, Number(res.headers.get("Retry-After") || 60) * 1000));
            setTries((n) => n + 1);
          } else setError(j.error ?? "Nie udało się sprawdzić płatności.");
        } catch {
          if (!cancelled) {
            setWaitMs(Math.min(60_000, 3000 * 2 ** tries));
            setTries((n) => n + 1);
          }
        }
      },
      tries === 0 ? 0 : waitMs,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sessionId, tries, data, error, waitMs]);

  if (error)
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        {error} Jeśli płatność została pobrana, napisz do nas – podaj datę i kwotę.
      </p>
    );
  if (!data)
    return (
      <div className="space-y-3 py-6 text-center" aria-live="polite">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden />
        <p className="font-semibold">Czekamy na potwierdzenie płatności…</p>
        {tries > 5 && <p className="text-sm text-slate-600">To trwa dłużej niż zwykle (np. Przelewy24). Strona sprawdza dalej – nie zamykaj jej.</p>}
      </div>
    );

  const until = new Date(data.wazny_do).toLocaleDateString("pl-PL");
  return (
    <div className="space-y-4 rounded-2xl border-2 border-emerald-500 bg-white p-5 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Płatność przyjęta</p>
      <p className="text-slate-700">Twój kod na {data.uzycia} raportów (ważny do {until}):</p>
      <p className="select-all font-mono text-3xl font-extrabold tracking-widest text-brand-900">{data.kod}</p>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <CopyButton text={data.kod} label="Kopiuj kod" />
        <Link href={`/sprawdz?kupon=${encodeURIComponent(data.kod)}`} className="rounded-xl bg-brand-700 px-5 py-2.5 font-bold text-white hover:bg-brand-900">
          Użyj kodu teraz →
        </Link>
      </div>
      {data.email_wyslany_na && <p className="text-sm text-slate-600">Kod wysłaliśmy też na {data.email_wyslany_na}.</p>}
      <p className="text-xs text-slate-600">Zapisz kod. Wpisujesz go w formularzu „Pełny raport” w polu „Kod kuponu”.</p>
    </div>
  );
}
