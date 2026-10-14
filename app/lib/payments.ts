import Stripe from "stripe";
import { offerList, type Offer } from "./offers";
import type { OfferId } from "./report-schema";

/**
 * Płatności: Stripe Checkout (PLN; BLIK, Przelewy24, karta).
 * DEV_SKIP_PAYMENT=1 – pomija Stripe i od razu generuje raport (tylko do testów!).
 */

export function priceGr(): { raport: number; raport_plus: number; pakiet5: number } {
  return {
    raport: Number(process.env.PRICE_RAPORT_GR || 1900),
    raport_plus: Number(process.env.PRICE_RAPORT_PLUS_GR || 2900),
    pakiet5: Number(process.env.PRICE_PAKIET5_GR || 4900),
  };
}

/** Pakiet 5 raportów: po opłaceniu klient dostaje kupon na 5 raportów (pakiet „Raport”), ważny 365 dni. */
export const PACKAGE = { id: "pakiet5", uses: 5, days: 365, couponOffer: "raport" } as const;

export interface PackageOffer {
  id: "pakiet5";
  nazwa: string;
  cenaGr: number;
  liczbaRaportow: number;
  waznoscDni: number;
  zawiera: string[];
}

export function packageOffer(): PackageOffer {
  return {
    id: "pakiet5",
    nazwa: "Pakiet 5 raportów",
    cenaGr: priceGr().pakiet5,
    liczbaRaportow: PACKAGE.uses,
    waznoscDni: PACKAGE.days,
    zawiera: ["5 raportów (pakiet Raport)", "Kod ważny 12 miesięcy", "Dla Ciebie lub do podzielenia się z bliskimi"],
  };
}

/** Ścieżki strony powrotu po zakupie pakietu (strona po stronie frontendu). */
export const PACKAGE_SUCCESS_PATH = "/pakiet/dziekujemy";
export const PACKAGE_CANCEL_PATH = "/pakiet";

export type CheckoutKind = "raport" | "pakiet5";

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

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createCheckoutSession(args: {
  reportId: string;
  offer: OfferId;
  baseUrl: string;
  email?: string | null;
}): Promise<{ id: string; url: string; amountGr: number }> {
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
    metadata: { kind: "raport", report_id: args.reportId, offer: args.offer, amount_gr: String(offer.cenaGr) },
    payment_intent_data: { metadata: { report_id: args.reportId } },
    ...(args.email ? { customer_email: args.email } : {}),
    success_url: `${args.baseUrl}/raport/${args.reportId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.baseUrl}/sprawdz?anulowano=1`,
  });
  if (!session.url) throw new Error("Stripe nie zwrócił adresu płatności.");
  return { id: session.id, url: session.url, amountGr: offer.cenaGr };
}

/** Sesja Stripe dla pakietu 5 raportów (bez raportu – kupon powstaje po opłaceniu). */
export async function createPackageCheckoutSession(args: { baseUrl: string; email?: string | null }): Promise<{ id: string; url: string; amountGr: number }> {
  const p = packageOffer();
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    currency: "pln",
    allowed_payment_method_types: ["blik", "p24", "card"],
    locale: "pl",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "pln", unit_amount: p.cenaGr, product_data: { name: `${p.nazwa} – sprawdzenie ogłoszeń aut` } },
      },
    ],
    metadata: { kind: "pakiet5", amount_gr: String(p.cenaGr) },
    ...(args.email ? { customer_email: args.email } : {}),
    success_url: `${args.baseUrl}${PACKAGE_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.baseUrl}${PACKAGE_CANCEL_PATH}?anulowano=1`,
  });
  if (!session.url) throw new Error("Stripe nie zwrócił adresu płatności.");
  return { id: session.id, url: session.url, amountGr: p.cenaGr };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.retrieve(sessionId);
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
