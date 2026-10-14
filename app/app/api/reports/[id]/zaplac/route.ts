import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getReport, markPaymentPending, reopenPayment, setStripeSession } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { baseUrlFrom, createCheckoutSession, paymentsSkipped, retrieveCheckoutSession } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * „Dokończ płatność” (link z e-maila i ze strony raportu w statusie expired): wznawia otwartą sesję Stripe
 * albo tworzy nową i przekierowuje (303). Dla raportów już opłaconych – przekierowanie na stronę raportu.
 * Sesja zakończona, ale nieopłacona (P24 w toku) → strona raportu z komunikatem „płatność w toku”, bez nowej sesji.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const base = process.env.APP_URL ? appUrl() : baseUrlFrom(req);
  if (!UUID_RE.test(id)) return NextResponse.redirect(`${base}/sprawdz`, 303);
  const row = getReport(id);
  if (!row) return NextResponse.redirect(`${base}/sprawdz?wygaslo=1`, 303);
  if (!["pending_payment", "expired"].includes(row.status) || paymentsSkipped()) return NextResponse.redirect(`${base}/raport/${id}`, 303);

  // Płatność w toku (np. Przelewy24 czeka na bank) – NIE tworzymy drugiej sesji (groziłoby podwójne obciążenie).
  if (row.payment_pending_at) return NextResponse.redirect(`${base}/raport/${id}?platnosc=w_toku`, 303);
  try {
    if (row.stripe_session_id) {
      const old = await retrieveCheckoutSession(row.stripe_session_id).catch(() => null);
      if (old?.payment_status === "paid") return NextResponse.redirect(`${base}/raport/${id}?session_id=${old.id}`, 303);
      if (old?.status === "complete") {
        markPaymentPending(id);
        return NextResponse.redirect(`${base}/raport/${id}?platnosc=w_toku`, 303);
      }
      if (old?.status === "open" && old.url) return NextResponse.redirect(old.url, 303);
    }
    const s = await createCheckoutSession({ reportId: id, offer: row.offer, baseUrl: base, email: row.email });
    setStripeSession(id, s.id, s.amountGr);
    reopenPayment(id);
    track("platnosc_rozpoczeta", { rodzaj: row.offer, kwota_gr: s.amountGr, report_id: id, wznowienie: true }, req);
    return NextResponse.redirect(s.url, 303);
  } catch (e) {
    console.error("[stripe] Wznowienie płatności nie powiodło się:", e);
    return NextResponse.redirect(`${base}/raport/${id}`, 303);
  }
}
