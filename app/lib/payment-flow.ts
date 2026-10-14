import type Stripe from "stripe";
import { track } from "./analytics";
import { createCoupon, getCouponBySession, type CouponRow } from "./coupons";
import { clearPaymentPending, getDb, getReport, markExpired, markPaid, markPaymentPending, nowIso } from "./db";
import { sendPackageCouponEmail } from "./notifications";
import { PACKAGE, getOffer, packageOffer, refundCheckoutSession, retrieveCheckoutSession, type CheckoutKind } from "./payments";
import { enqueueGeneration } from "./queue";

/**
 * Wspólna logika potwierdzania płatności – używana przez webhook Stripe, stronę powrotu i endpoint kuponu.
 * Wszystko idempotentne: wielokrotne potwierdzenie tej samej sesji nic nie psuje.
 */

export type PaidOutcome =
  | { ok: true; kind: "raport"; reportId: string; newlyPaid: boolean; duplicate?: boolean }
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
  const fresh = recordPayment(s, "raport", reportId);
  if (fresh) {
    // Druga opłacona sesja tego samego raportu (np. klient zapłacił w starej i nowej sesji, albo raport był już z kuponu).
    const others = getDb()
      .prepare(`SELECT stripe_session_id FROM payments WHERE report_id = ? AND stripe_session_id <> ?`)
      .all(reportId, s.id) as { stripe_session_id: string }[];
    if (others.length > 0 || row.coupon_code) {
      await handleDuplicatePayment(s, reportId, others.map((o) => o.stripe_session_id));
      return { ok: true, kind: "raport", reportId, newlyPaid: false, duplicate: true };
    }
  }
  const newlyPaid = markPaid(reportId);
  if (newlyPaid) track("platnosc_oplacona", { rodzaj: row.offer, kwota_gr: s.amount_total ?? 0, zrodlo: source, report_id: reportId });
  if (getReport(reportId)?.status === "paid") void enqueueGeneration(reportId);
  return { ok: true, kind: "raport", reportId, newlyPaid };
}

/**
 * Podwójna płatność za ten sam raport: alert w logu, zdarzenie `podwojna_platnosc` i – gdy AUTO_REFUND_DUPLICATE
 * nie jest „0” (domyślnie włączone) – automatyczny zwrot drugiej płatności przez Stripe.
 */
async function handleDuplicatePayment(s: Stripe.Checkout.Session, reportId: string, otherSessions: string[]) {
  console.error(
    `[ALERT][platnosc] Podwójna płatność za raport ${reportId}: sesja ${s.id} (${s.amount_total} gr), wcześniej: ${otherSessions.join(", ") || "kupon"}.`,
  );
  const auto = process.env.AUTO_REFUND_DUPLICATE !== "0";
  let zwrot = "wylaczony";
  if (auto) {
    try {
      const r = await refundCheckoutSession(s, `Podwójna płatność za raport ${reportId}`);
      zwrot = r ? "zlecony" : "brak_payment_intent";
    } catch (e) {
      zwrot = "blad";
      console.error(`[ALERT][platnosc] Zwrot sesji ${s.id} nie powiódł się – zrób go ręcznie w Stripe:`, (e as Error).message);
    }
  }
  track("podwojna_platnosc", { report_id: reportId, sesja: s.id, kwota_gr: s.amount_total ?? 0, zwrot });
}

/** checkout.session.completed z payment_status=unpaid (np. Przelewy24) – płatność w toku, bez przypomnień i nowych sesji. */
export function handlePendingSession(s: Stripe.Checkout.Session): boolean {
  if (sessionKind(s) !== "raport" || s.payment_status === "paid") return false;
  const reportId = s.metadata?.report_id ?? s.client_reference_id;
  if (!reportId) return false;
  markPaymentPending(reportId);
  return true;
}

/** checkout.session.async_payment_failed – płatność odrzucona, klient może zapłacić ponownie. */
export function handleFailedAsyncSession(s: Stripe.Checkout.Session): boolean {
  if (sessionKind(s) !== "raport") return false;
  const reportId = s.metadata?.report_id ?? s.client_reference_id;
  if (!reportId) return false;
  clearPaymentPending(reportId);
  return true;
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

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzCouponMiss: Map<string, number> | undefined;
}
/** Krótki cache „nie znaleziono” (60 s) – ogranicza odpytywanie Stripe o nieistniejące/obce sesje. */
const missCache = () => (globalThis.__sprawdzCouponMiss ??= new Map());
export const COUPON_MISS_TTL_MS = 60_000;

/**
 * Kod z pakietu po powrocie ze Stripe (`/pakiet/dziekujemy?session_id=…`). Weryfikuje sesję w Stripe;
 * jeśli webhook jeszcze nie utworzył kuponu – tworzy go (idempotentnie). null = sesja nieopłacona / nie pakiet.
 * Sesje nieistniejące lub niebędące pakietem są zapamiętywane na 60 s (bez kolejnych zapytań do Stripe).
 */
export async function getPackageCoupon(sessionId: string, retrieve = retrieveCheckoutSession): Promise<CouponRow | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const existing = getCouponBySession(sessionId);
  if (existing) return existing;
  const miss = missCache().get(sessionId);
  if (miss && miss > Date.now()) return null;
  let s: Stripe.Checkout.Session;
  try {
    s = await retrieve(sessionId);
  } catch (e) {
    const code = (e as { code?: string; statusCode?: number }).code ?? "";
    if (code === "resource_missing" || (e as { statusCode?: number }).statusCode === 404) {
      missCache().set(sessionId, Date.now() + COUPON_MISS_TTL_MS);
      return null;
    }
    throw e;
  }
  if (sessionKind(s) !== "pakiet5") {
    missCache().set(sessionId, Date.now() + COUPON_MISS_TTL_MS);
    return null;
  }
  const r = await handlePaidSession(s, "powrot");
  return r.ok && r.kind === "pakiet5" ? r.coupon : null;
}
