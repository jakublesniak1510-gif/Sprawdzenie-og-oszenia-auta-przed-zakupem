import Stripe from "stripe";
import { offerList, type Offer } from "./offers";
import type { OfferId } from "./report-schema";

/**
 * Płatności: Stripe Checkout (PLN; BLIK, Przelewy24, karta).
 * DEV_SKIP_PAYMENT=1 – pomija Stripe i od razu generuje raport (tylko do testów!).
 */

export function priceGr(): { raport: number; raport_plus: number } {
  return {
    raport: Number(process.env.PRICE_RAPORT_GR || 1900),
    raport_plus: Number(process.env.PRICE_RAPORT_PLUS_GR || 2900),
  };
}

export function offers(): Offer[] {
  return offerList(priceGr());
}

export function getOffer(id: OfferId): Offer {
  return offers().find((o) => o.id === id)!;
}

export function paymentsSkipped(): boolean {
  return process.env.DEV_SKIP_PAYMENT === "1";
}

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Brak STRIPE_SECRET_KEY (albo ustaw DEV_SKIP_PAYMENT=1 do testów).");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export async function createCheckoutSession(args: {
  reportId: string;
  offer: OfferId;
  baseUrl: string;
  email?: string | null;
}): Promise<{ id: string; url: string }> {
  const offer = getOffer(args.offer);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    currency: "pln",
    // stripe@23 (nowe API) zastąpiło `payment_method_types` filtrem `allowed_payment_method_types`.
    // BLIK i Przelewy24 muszą być włączone w Dashboard → Settings → Payment methods.
    allowed_payment_method_types: ["blik", "p24", "card"],
    locale: "pl",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "pln",
          unit_amount: offer.cenaGr,
          product_data: { name: `${offer.nazwa} – sprawdzenie ogłoszenia auta` },
        },
      },
    ],
    client_reference_id: args.reportId,
    metadata: { report_id: args.reportId, offer: args.offer },
    payment_intent_data: { metadata: { report_id: args.reportId } },
    ...(args.email ? { customer_email: args.email } : {}),
    success_url: `${args.baseUrl}/raport/${args.reportId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.baseUrl}/sprawdz?anulowano=1`,
  });
  if (!session.url) throw new Error("Stripe nie zwrócił adresu płatności.");
  return { id: session.id, url: session.url };
}

/** Weryfikacja podpisu webhooka. Rzuca wyjątek przy błędnym podpisie. */
export function constructWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Brak STRIPE_WEBHOOK_SECRET.");
  if (!signature) throw new Error("Brak nagłówka stripe-signature.");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Zapasowo (np. lokalnie bez webhooka): sprawdza sesję po powrocie klienta ze Stripe. */
export async function checkSessionPaid(sessionId: string): Promise<{ paid: boolean; reportId: string | null }> {
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  return { paid: s.payment_status === "paid", reportId: s.metadata?.report_id ?? s.client_reference_id ?? null };
}

/** Adres bazowy do success/cancel URL: APP_URL albo nagłówki żądania. */
export function baseUrlFrom(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
