import { NextResponse, after } from "next/server";
import type Stripe from "stripe";
import { markPaid } from "@/lib/db";
import { runGeneration } from "@/lib/generate";
import { constructWebhookEvent } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe. Obsługiwane zdarzenia:
 * - checkout.session.completed (gdy payment_status = paid; BLIK i karta zwykle od razu),
 * - checkout.session.async_payment_succeeded (płatności opóźnione, np. Przelewy24).
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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const reportId = session.metadata?.report_id ?? session.client_reference_id;
    if (reportId && session.payment_status === "paid") {
      markPaid(reportId);
      after(() => runGeneration(reportId));
    }
  }
  return NextResponse.json({ received: true });
}
