import type Stripe from "stripe";
import { getDb, nowIso } from "./db";
import { handleExpiredSession, handlePaidSession } from "./payment-flow";

/** Rejestruje zdarzenie Stripe. false = duplikat (już obsłużone). */
export function claimStripeEvent(id: string): boolean {
  return getDb().prepare(`INSERT OR IGNORE INTO stripe_events (id, received_at) VALUES (?, ?)`).run(id, nowIso()).changes === 1;
}

function releaseStripeEvent(id: string) {
  getDb().prepare(`DELETE FROM stripe_events WHERE id = ?`).run(id);
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
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const r = await handlePaidSession(event.data.object as Stripe.Checkout.Session, "webhook");
        return { received: true, result: r.ok ? "ok" : r.reason };
      }
      case "checkout.session.expired":
        return { received: true, result: handleExpiredSession(event.data.object as Stripe.Checkout.Session) ? "expired" : "ignored" };
      default:
        return { received: true, result: "ignored" };
    }
  } catch (e) {
    releaseStripeEvent(event.id);
    throw e;
  }
}
