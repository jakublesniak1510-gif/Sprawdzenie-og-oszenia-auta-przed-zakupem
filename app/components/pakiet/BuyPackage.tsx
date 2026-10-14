"use client";

import { useState } from "react";

export function BuyPackage({ priceLabel, skipPayment }: { priceLabel: string; skipPayment: boolean }) {
  const [email, setEmail] = useState("");
  const [zgoda, setZgoda] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (res.status === 404) throw new Error("Zakup pakietu jest chwilowo niedostępny. Spróbuj później.");
      if (!res.ok || !j.redirect) throw new Error(j.error || "Nie udało się rozpocząć płatności. Spróbuj ponownie.");
      window.location.assign(j.redirect);
    } catch (err) {
      setError(err instanceof TypeError ? "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie." : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={buy} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-900">E-mail (zalecany)</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ty@example.com"
          className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-describedby="pakiet-email-hint"
        />
        <span id="pakiet-email-hint" className="mt-1 block text-xs text-slate-600">
          Wyślemy na niego kod kuponu, żeby nie zginął. Nie wysyłamy reklam.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={zgoda} onChange={(e) => setZgoda(e.target.checked)} aria-required="true" />
        <span>
          Akceptuję{" "}
          <a href="/regulamin" target="_blank" className="font-semibold text-brand-700 underline">
            regulamin
          </a>{" "}
          i zapoznałem/am się z{" "}
          <a href="/polityka-prywatnosci" target="_blank" className="font-semibold text-brand-700 underline">
            polityką prywatności
          </a>
          .
        </span>
      </label>
      {skipPayment && (
        <p className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-2 text-xs text-fuchsia-900">
          Tryb testowy: zakup pakietu wymaga skonfigurowanego Stripe (DEV_SKIP_PAYMENT go nie pomija).
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button disabled={busy || !zgoda} className="w-full rounded-xl bg-brand-700 px-6 py-4 text-lg font-bold text-white hover:bg-brand-900 disabled:bg-slate-400">
        {busy ? "Przekierowuję do płatności…" : `Kup pakiet ${priceLabel} – BLIK`}
      </button>
      <p className="text-center text-xs text-slate-600">BLIK, Przelewy24 lub karta. Płatność obsługuje Stripe.</p>
    </form>
  );
}
