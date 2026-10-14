import { appUrl, sendEmail } from "./email";
import { formatDatePl, formatDateTimePl, renderEmail } from "./email-templates";
import { formatCouponCode, type CouponRow } from "./coupons";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { getDb, getReport, markEmailSent, nowIso, type ReportRow } from "./db";

/**
 * E-maile wysyłane w odpowiedzi na zdarzenia (raport gotowy, kupon z pakietu) i z crona (scripts/followup.ts).
 * Każdy e-mail do raportu wysyłamy najwyżej raz (kolumny *_sent_at w `reports`).
 */

export const PAYMENT_FOLLOWUP_AFTER_H = 2;
/** Przypomnienie najpóźniej 40 h po zamówieniu – zdjęcia są kasowane po 48 h. */
export const PAYMENT_FOLLOWUP_UNTIL_H = 40;
/** Ten sam adres dostaje najwyżej 1 przypomnienie o płatności na dobę (ochrona przed wysyłką na cudzy adres). */
export const PAYMENT_FOLLOWUP_PER_ADDRESS_24H = 1;
export const FEEDBACK_FOLLOWUP_AFTER_D = 7;

export function reportUrl(id: string): string {
  return `${appUrl()}/raport/${id}`;
}

/** Link „dokończ płatność” – endpoint tworzy (lub wznawia) sesję Stripe i przekierowuje. */
export function resumePaymentUrl(id: string): string {
  return `${appUrl()}/api/reports/${id}/zaplac`;
}

/** Link z e-maila „Kupiłeś to auto?” – strona z przyciskiem (GET nic nie zapisuje; zapis dopiero POST-em). */
export function boughtUrl(id: string, bought: boolean): string {
  return `${appUrl()}/api/reports/${id}/kupil?odp=${bought ? "tak" : "nie"}`;
}

function modelName(row: ReportRow): string | undefined {
  try {
    return (JSON.parse(row.input_json) as { model_label?: string | null }).model_label ?? undefined;
  } catch {
    return undefined;
  }
}

export async function sendReportReadyEmail(id: string): Promise<boolean> {
  const row = getReport(id);
  if (!row?.email || row.ready_email_sent_at || row.status !== "done") return false;
  const mail = renderEmail("raport_gotowy", { link: reportUrl(id), data_waznosci: formatDatePl(row.expires_at), model: modelName(row) });
  const r = await sendEmail({ to: row.email, ...mail });
  if (r.ok) markEmailSent(id, "ready");
  return r.ok;
}

export async function sendPackageCouponEmail(email: string, coupon: CouponRow): Promise<boolean> {
  const mail = renderEmail("kupon_pakiet", {
    link: `${appUrl()}/sprawdz`,
    kod: formatCouponCode(coupon.code),
    liczba_raportow: String(coupon.uses_left),
    data_waznosci: formatDatePl(coupon.expires_at),
  });
  return (await sendEmail({ to: email, ...mail })).ok;
}

/**
 * Nieopłacone zamówienia z e-mailem, utworzone 2–40 h temu (zdjęcia są kasowane po 48 h), z sesją Stripe
 * i bez płatności w toku (P24).
 */
export function reportsNeedingPaymentFollowup(now = Date.now()): ReportRow[] {
  const olderThan = new Date(now - PAYMENT_FOLLOWUP_AFTER_H * 3600_000).toISOString();
  const newerThan = new Date(now - PAYMENT_FOLLOWUP_UNTIL_H * 3600_000).toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM reports WHERE status IN ('pending_payment','expired') AND email IS NOT NULL
       AND stripe_session_id IS NOT NULL AND payment_pending_at IS NULL
       AND payment_followup_sent_at IS NULL AND created_at < ? AND created_at > ? AND expires_at > ?`,
    )
    .all(olderThan, newerThan, nowIso()) as ReportRow[];
}

export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** Czy pod ten adres wysłano już w ciągu 24 h e-mail danego rodzaju. */
export function emailRecentlySent(email: string, kind: string, now = Date.now()): boolean {
  const since = new Date(now - 24 * 3600_000).toISOString();
  const n = (getDb().prepare(`SELECT COUNT(*) AS n FROM email_log WHERE email_hash = ? AND kind = ? AND sent_at > ?`).get(emailHash(email), kind, since) as { n: number }).n;
  return n >= PAYMENT_FOLLOWUP_PER_ADDRESS_24H;
}

function logEmail(email: string, kind: string, now = Date.now()) {
  getDb().prepare(`INSERT INTO email_log (email_hash, kind, sent_at) VALUES (?, ?, ?)`).run(emailHash(email), kind, new Date(now).toISOString());
  getDb().prepare(`DELETE FROM email_log WHERE sent_at < ?`).run(new Date(now - 30 * 24 * 3600_000).toISOString());
}

/**
 * Czy wolno przypomnieć o płatności (sprawdzenie w Stripe):
 * - sesja nie jest zakończona (`complete` = płatność w toku, np. P24 – nie przypominamy, nie tworzymy drugiej),
 * - jeśli Stripe zna e-mail klienta (`customer_details.email`), musi się zgadzać z podanym w formularzu.
 */
export function paymentReminderAllowed(row: ReportRow, session: Pick<Stripe.Checkout.Session, "status" | "payment_status" | "customer_details"> | null): boolean {
  if (!session || !row.email) return false;
  if (session.status === "complete" || session.payment_status === "paid") return false;
  const stripeEmail = session.customer_details?.email;
  return !stripeEmail || stripeEmail.trim().toLowerCase() === row.email.trim().toLowerCase();
}

export interface FollowupDeps {
  retrieveSession: (id: string) => Promise<Pick<Stripe.Checkout.Session, "status" | "payment_status" | "customer_details"> | null>;
}

async function defaultRetrieve(id: string) {
  const { retrieveCheckoutSession, stripeConfigured } = await import("./payments");
  if (!stripeConfigured()) return null;
  return retrieveCheckoutSession(id).catch(() => null);
}

/** Gotowe raporty z e-mailem, bez opinii, wygenerowane ponad 7 dni temu. */
export function reportsNeedingFeedbackFollowup(now = Date.now()): ReportRow[] {
  const olderThan = new Date(now - FEEDBACK_FOLLOWUP_AFTER_D * 24 * 3600_000).toISOString();
  return getDb()
    .prepare(
      `SELECT r.* FROM reports r WHERE r.status = 'done' AND r.email IS NOT NULL AND r.feedback_followup_sent_at IS NULL
       AND COALESCE(r.done_at, r.created_at) < ? AND r.expires_at > ?
       AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.report_id = r.id)`,
    )
    .all(olderThan, nowIso()) as ReportRow[];
}

export async function runFollowups(
  now = Date.now(),
  deps: FollowupDeps = { retrieveSession: defaultRetrieve },
): Promise<{ payment: number; feedback: number; failed: number; skipped: number }> {
  let payment = 0;
  let feedback = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of reportsNeedingPaymentFollowup(now)) {
    if (emailRecentlySent(row.email!, "payment_followup", now) || !paymentReminderAllowed(row, await deps.retrieveSession(row.stripe_session_id!))) {
      // Nie przypominamy (płatność w toku, inny e-mail w Stripe, limit na adres) – i nie próbujemy ponownie.
      markEmailSent(row.id, "payment_followup");
      skipped++;
      continue;
    }
    const photosUntil = new Date(Date.parse(row.created_at) + 48 * 3600_000).toISOString();
    const mail = renderEmail("platnosc_niedokonczona", {
      link: resumePaymentUrl(row.id),
      data_waznosci: formatDatePl(row.expires_at),
      zdjecia_do: formatDateTimePl(photosUntil),
      model: modelName(row),
    });
    if ((await sendEmail({ to: row.email!, ...mail })).ok) {
      markEmailSent(row.id, "payment_followup");
      logEmail(row.email!, "payment_followup", now);
      payment++;
    } else failed++;
  }
  for (const row of reportsNeedingFeedbackFollowup(now)) {
    const mail = renderEmail("czy_kupiles", {
      link: `${reportUrl(row.id)}#opinia`,
      link_tak: boughtUrl(row.id, true),
      link_nie: boughtUrl(row.id, false),
      data_waznosci: formatDatePl(row.expires_at),
      model: modelName(row),
    });
    if ((await sendEmail({ to: row.email!, ...mail })).ok) {
      markEmailSent(row.id, "feedback_followup");
      feedback++;
    } else failed++;
  }
  return { payment, feedback, failed, skipped };
}
