import type Stripe from "stripe";
import { track } from "./analytics";
import { createCoupon, getCouponBySession, type CouponRow } from "./coupons";
import { getDb, getReport, markExpired, markPaid, nowIso } from "./db";
import { sendPackageCouponEmail } from "./notifications";
import { PACKAGE, getOffer, packageOffer, retrieveCheckoutSession, type CheckoutKind } from "./payments";
import { enqueueGeneration } from "./queue";

/**
 * Wspólna logika potwierdzania płatności – używana przez webhook Stripe, stronę powrotu i endpoint kuponu.
 * Wszystko idempotentne: wielokrotne potwierdzenie tej samej sesji nic nie psuje.
 */

export type PaidOutcome =
  | { ok: true; kind: "raport"; reportId: string; newlyPaid: boolean }
  | { ok: true; kind: "pakiet5"; coupon: CouponRow; newlyCreated: boolean }
  | { ok: false; reason: string };

export function sessionKind(s: Stripe.Checkout.Session): CheckoutKind {
  return s.metadata?.kind === "pakiet5" ? "pakiet5" : "raport";
}

/** Zapis płatności (przychód). true = pierwszy zapis tej sesji. */
function recordPayment(s: Stripe.Checkout.Session, kind: CheckoutKind, reportId: string | null): boolean {
  return (
    getDb()
      .prepare(`INSERT OR IGNORE INTO payments (stripe_session_id, kind, report_id, amount_gr, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(s.id, kind, reportId, s.amount_total ?? 0, (s.currency ?? "").toLowerCase(), nowIso()).changes === 1
  );
}

/** Sprawdza kwotę i walutę sesji względem oferty. Zwraca opis rozbieżności albo null. */
export function amountMismatch(s: Stripe.Checkout.Session, expectedGr: number): string | null {
  if ((s.currency ?? "").toLowerCase() !== "pln") return `waluta ${s.currency} zamiast pln`;
  if (s.amount_total !== expectedGr) return `kwota ${s.amount_total} gr zamiast ${expectedGr} gr`;
  return null;
}

/** Obsługa opłaconej sesji Checkout (raport albo pakiet). */
export async function handlePaidSession(s: Stripe.Checkout.Session, source: "webhook" | "powrot"): Promise<PaidOutcome> {
  if (s.payment_status !== "paid") return { ok: false, reason: `payment_status=${s.payment_status}` };
  const kind = sessionKind(s);

  if (kind === "pakiet5") {
    const expected = Number(s.metadata?.amount_gr) || packageOffer().cenaGr;
    const mismatch = amountMismatch(s, expected);
    if (mismatch) {
      console.error(`[platnosc] Sesja ${s.id} (pakiet5): ${mismatch} – kupon NIE został utworzony.`);
      return { ok: false, reason: mismatch };
    }
    const existing = getCouponBySession(s.id);
    if (existing) return { ok: true, kind: "pakiet5", coupon: existing, newlyCreated: false };
    const email = s.customer_details?.email ?? s.customer_email ?? null;
    // Zapis płatności i kuponu synchronicznie (better-sqlite3) – bez await pomiędzy, więc bez wyścigu w procesie;
    // między procesami chroni UNIQUE(stripe_session_id) w obu tabelach.
    const fresh = recordPayment(s, "pakiet5", null);
    const coupon = createCoupon({ uses: PACKAGE.uses, days: PACKAGE.days, offer: PACKAGE.couponOffer, source: "pakiet5", email, stripeSessionId: s.id });
    if (fresh) {
      track("platnosc_oplacona", { rodzaj: "pakiet5", kwota_gr: s.amount_total ?? 0, zrodlo: source });
      track("pakiet_kupiony", { kwota_gr: s.amount_total ?? 0 });
      if (email) await sendPackageCouponEmail(email, coupon);
    }
    return { ok: true, kind: "pakiet5", coupon, newlyCreated: fresh };
  }

  const reportId = s.metadata?.report_id ?? s.client_reference_id;
  if (!reportId) return { ok: false, reason: "brak report_id w sesji" };
  const row = getReport(reportId);
  if (!row) return { ok: false, reason: "raport nie istnieje lub wygasł" };
  const expected = row.amount_gr ?? (Number(s.metadata?.amount_gr) || getOffer(row.offer).cenaGr);
  const mismatch = amountMismatch(s, expected);
  if (mismatch) {
    console.error(`[platnosc] Sesja ${s.id} raportu ${reportId}: ${mismatch} – raport NIE został oznaczony jako opłacony.`);
    return { ok: false, reason: mismatch };
  }
  recordPayment(s, "raport", reportId);
  const newlyPaid = markPaid(reportId);
  if (newlyPaid) track("platnosc_oplacona", { rodzaj: row.offer, kwota_gr: s.amount_total ?? 0, zrodlo: source, report_id: reportId });
  const fresh = getReport(reportId);
  if (fresh?.status === "paid") void enqueueGeneration(reportId);
  return { ok: true, kind: "raport", reportId, newlyPaid };
}

/** Sesja wygasła (klient nie zapłacił w 24 h): pending_payment → expired. */
export function handleExpiredSession(s: Stripe.Checkout.Session): boolean {
  if (sessionKind(s) !== "raport") return false;
  const reportId = s.metadata?.report_id ?? s.client_reference_id;
  return reportId ? markExpired(reportId, s.id) : false;
}

/**
 * Strona powrotu z płatności (`/raport/<id>?session_id=…`): gdy webhook jeszcze nie dotarł,
 * sprawdza sesję w Stripe, weryfikuje kwotę i uruchamia generowanie. Zwraca true, gdy raport jest opłacony.
 */
export async function confirmReportReturn(reportId: string, sessionId: string): Promise<boolean> {
  const row = getReport(reportId);
  if (!row || row.stripe_session_id !== sessionId) return false;
  if (row.status !== "pending_payment" && row.status !== "expired") return row.status !== "error";
  try {
    const s = await retrieveCheckoutSession(sessionId);
    const reportOfSession = s.metadata?.report_id ?? s.client_reference_id;
    if (reportOfSession !== reportId) return false;
    const r = await handlePaidSession(s, "powrot");
    return r.ok;
  } catch (e) {
    console.warn("[stripe] Nie udało się sprawdzić sesji:", (e as Error).message);
    return false;
  }
}

/**
 * Kod z pakietu po powrocie ze Stripe (`/pakiet/dziekujemy?session_id=…`). Weryfikuje sesję w Stripe;
 * jeśli webhook jeszcze nie utworzył kuponu – tworzy go (idempotentnie). null = sesja nieopłacona / nie pakiet.
 */
export async function getPackageCoupon(sessionId: string): Promise<CouponRow | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const existing = getCouponBySession(sessionId);
  if (existing) return existing;
  const s = await retrieveCheckoutSession(sessionId);
  if (sessionKind(s) !== "pakiet5") return null;
  const r = await handlePaidSession(s, "powrot");
  return r.ok && r.kind === "pakiet5" ? r.coupon : null;
}
