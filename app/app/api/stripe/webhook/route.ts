import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/payments";
import { processStripeEvent } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe – idempotentny (tabela stripe_events: duplikat → 200 bez działania). Obsługiwane zdarzenia:
 * - checkout.session.completed (gdy payment_status = paid; BLIK i karta zwykle od razu),
 * - checkout.session.async_payment_succeeded (płatności opóźnione, np. Przelewy24),
 * - checkout.session.expired → raport w statusie `expired` (klient może wrócić do płatności z linku).
 * Kwota i waluta sesji są weryfikowane z ofertą (lib/payment-flow.ts). Pakiet 5 raportów → kupon + e-mail.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(raw, req.headers.get("stripe-signature"));
  } catch (e) {
    console.warn("[stripe] Odrzucony webhook:", (e as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    return NextResponse.json(await processStripeEvent(event));
  } catch (e) {
    console.error(`[stripe] Błąd obsługi zdarzenia ${event.id} (${event.type}):`, e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
