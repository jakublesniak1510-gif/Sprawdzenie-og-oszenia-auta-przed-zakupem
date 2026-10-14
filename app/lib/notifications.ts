import { appUrl, sendEmail } from "./email";
import { formatDatePl, renderEmail } from "./email-templates";
import { formatCouponCode, type CouponRow } from "./coupons";
import { getDb, getReport, markEmailSent, nowIso, type ReportRow } from "./db";

/**
 * E-maile wysyłane w odpowiedzi na zdarzenia (raport gotowy, kupon z pakietu) i z crona (scripts/followup.ts).
 * Każdy e-mail do raportu wysyłamy najwyżej raz (kolumny *_sent_at w `reports`).
 */

export const PAYMENT_FOLLOWUP_AFTER_H = 2;
export const FEEDBACK_FOLLOWUP_AFTER_D = 7;

export function reportUrl(id: string): string {
  return `${appUrl()}/raport/${id}`;
}

/** Link „dokończ płatność” – endpoint tworzy (lub wznawia) sesję Stripe i przekierowuje. */
export function resumePaymentUrl(id: string): string {
  return `${appUrl()}/api/reports/${id}/zaplac`;
}

/** Link jednego kliknięcia z e-maila „Kupiłeś to auto?” – zapisuje odpowiedź i przekierowuje do opinii. */
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

/** Nieopłacone zamówienia z e-mailem, utworzone ponad 2 h temu (i nie dawniej niż 48 h – potem zdjęcia są usuwane). */
export function reportsNeedingPaymentFollowup(now = Date.now()): ReportRow[] {
  const olderThan = new Date(now - PAYMENT_FOLLOWUP_AFTER_H * 3600_000).toISOString();
  const newerThan = new Date(now - 48 * 3600_000).toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM reports WHERE status IN ('pending_payment','expired') AND email IS NOT NULL
       AND payment_followup_sent_at IS NULL AND created_at < ? AND created_at > ? AND expires_at > ?`,
    )
    .all(olderThan, newerThan, nowIso()) as ReportRow[];
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

export async function runFollowups(now = Date.now()): Promise<{ payment: number; feedback: number; failed: number }> {
  let payment = 0;
  let feedback = 0;
  let failed = 0;
  for (const row of reportsNeedingPaymentFollowup(now)) {
    const mail = renderEmail("platnosc_niedokonczona", { link: resumePaymentUrl(row.id), data_waznosci: formatDatePl(row.expires_at), model: modelName(row) });
    if ((await sendEmail({ to: row.email!, ...mail })).ok) {
      markEmailSent(row.id, "payment_followup");
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
  return { payment, feedback, failed };
}
