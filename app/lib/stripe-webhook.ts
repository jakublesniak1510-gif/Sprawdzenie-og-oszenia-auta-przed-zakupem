import type Stripe from "stripe";
import { getDb, nowIso } from "./db";
import { handleExpiredSession, handleFailedAsyncSession, handlePaidSession, handlePendingSession } from "./payment-flow";

/**
 * Rejestruje zdarzenie Stripe. false = duplikat, czyli zdarzenie już OBSŁUŻONE (processed_at ustawione).
 * Zdarzenie przyjęte, ale nieobsłużone do końca (np. awaria w trakcie) zostanie obsłużone ponownie – handlery są idempotentne.
 */
export function claimStripeEvent(id: string): boolean {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO stripe_events (id, received_at) VALUES (?, ?)`).run(id, nowIso());
  const row = db.prepare(`SELECT processed_at FROM stripe_events WHERE id = ?`).get(id) as { processed_at: string | null };
  return row.processed_at === null;
}

function markStripeEventProcessed(id: string) {
  getDb().prepare(`UPDATE stripe_events SET processed_at = ? WHERE id = ?`).run(nowIso(), id);
}

export interface WebhookResult {
  received: true;
  duplicate?: true;
  result?: string;
}

/**
 * Logika webhooka (po weryfikacji podpisu). Idempotentna: duplikat zdarzenia → nic nie robi.
 * Błąd przetwarzania zwalnia zdarzenie i rzuca dalej (route zwróci 500, Stripe ponowi).
 */
export async function processStripeEvent(event: Stripe.Event): Promise<WebhookResult> {
  if (!claimStripeEvent(event.id)) return { received: true, duplicate: true };
  const result = await dispatch(event); // wyjątek → processed_at zostaje puste, route zwraca 500, Stripe ponowi
  markStripeEventProcessed(event.id);
  return { received: true, result };
}

async function dispatch(event: Stripe.Event): Promise<string> {
  const s = event.data.object as Stripe.Checkout.Session;
  switch (event.type) {
    case "checkout.session.completed":
      if (s.payment_status !== "paid") return handlePendingSession(s) ? "w_toku" : "ignored";
      return resultOf(await handlePaidSession(s, "webhook"));
    case "checkout.session.async_payment_succeeded":
      return resultOf(await handlePaidSession(s, "webhook"));
    case "checkout.session.async_payment_failed":
      return handleFailedAsyncSession(s) ? "odrzucona" : "ignored";
    case "checkout.session.expired":
      return handleExpiredSession(s) ? "expired" : "ignored";
    default:
      return "ignored";
  }
}

function resultOf(r: Awaited<ReturnType<typeof handlePaidSession>>): string {
  if (!r.ok) return r.reason;
  return r.kind === "raport" && r.duplicate ? "duplikat_platnosci" : "ok";
}
