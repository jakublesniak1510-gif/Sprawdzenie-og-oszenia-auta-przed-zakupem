import { NextResponse } from "next/server";
import { formatCouponCode } from "@/lib/coupons";
import { maskEmail } from "@/lib/email";
import { getPackageCoupon } from "@/lib/payment-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kod kuponu po zakupie pakietu. Weryfikuje sesję w Stripe (opłacona, pakiet, kwota) – dopiero wtedy zwraca kod.
 * 202 = płatność jeszcze nie potwierdzona (np. Przelewy24) – odpytaj ponownie za kilka sekund.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return NextResponse.json({ error: "Nieprawidłowa sesja." }, { status: 400 });
  try {
    const c = await getPackageCoupon(sessionId);
    if (!c) return NextResponse.json({ status: "oczekuje", message: "Czekamy na potwierdzenie płatności…" }, { status: 202, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { status: "oplacono", kod: formatCouponCode(c.code), uzycia: c.uses_left, wazny_do: c.expires_at, email_wyslany_na: c.email ? maskEmail(c.email) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.warn("[coupons] Nie udało się sprawdzić sesji:", (e as Error).message);
    return NextResponse.json({ error: "Nie udało się sprawdzić płatności." }, { status: 502 });
  }
}
