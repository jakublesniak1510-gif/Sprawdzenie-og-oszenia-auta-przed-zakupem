"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "@/app/raport/[id]/actions";

export function FeedbackForm({ reportId, alreadySent, kupil = null }: { reportId: string; alreadySent: boolean; kupil?: "tak" | "nie" | null }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {
    ok: alreadySent,
    message: alreadySent ? "Dziękujemy za opinię!" : null,
  });

  if (state.ok) return <p className="text-sm font-semibold text-emerald-800">{state.message}</p>;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={reportId} />
      <fieldset>
        <legend className="mb-2 font-semibold">Czy raport pomógł?</legend>
        <div className="flex gap-2">
          {(["tak", "nie"] as const).map((v) => (
            <label key={v} className="flex-1 cursor-pointer rounded-xl border-2 border-slate-200 px-4 py-3 text-center font-semibold has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="pomogl" value={v} className="sr-only" required />
              <span aria-hidden>{v === "tak" ? "👍" : "👎"}</span> {v === "tak" ? "Tak" : "Nie"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-700">
          {kupil === "tak"
            ? "Komentarz (opcjonalnie) – co z raportu się potwierdziło, a co nie?"
            : kupil === "nie"
              ? "Komentarz (opcjonalnie) – co przesądziło o rezygnacji?"
              : "Komentarz (opcjonalnie) – np. kupiłeś auto? co się potwierdziło?"}
        </span>
        <textarea
          name="komentarz"
          maxLength={2000}
          defaultValue={kupil === "tak" ? "Kupiłem to auto. " : kupil === "nie" ? "Nie kupiłem tego auta. " : undefined}
          className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      {state.message && <p className="text-sm text-red-700">{state.message}</p>}
      <button disabled={pending} className="rounded-xl bg-brand-700 px-5 py-3 font-bold text-white disabled:bg-slate-300">
        {pending ? "Wysyłam…" : "Wyślij"}
      </button>
    </form>
  );
}
