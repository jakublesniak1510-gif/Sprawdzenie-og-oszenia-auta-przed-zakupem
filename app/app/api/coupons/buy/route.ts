import { NextResponse } from "next/server";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { baseUrlFrom, createPackageCheckoutSession, packageOffer, stripeConfigured } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(200).nullable().optional() });

/**
 * Zakup pakietu 5 raportów: tworzy sesję Stripe Checkout i zwraca { redirect }.
 * Po opłaceniu Stripe wraca na /pakiet/dziekujemy?session_id=…, a kod pobiera GET /api/coupons/<sessionId>.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "couponBuy");
  if (limited) return limited;
  const parsed = Body.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowy adres e-mail." }, { status: 400 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Płatności są chwilowo niedostępne." }, { status: 503 });
  try {
    const s = await createPackageCheckoutSession({ baseUrl: baseUrlFrom(req), email: parsed.data.email ?? null });
    track("platnosc_rozpoczeta", { rodzaj: "pakiet5", kwota_gr: packageOffer().cenaGr }, req);
    return NextResponse.json({ redirect: s.url });
  } catch (e) {
    console.error("[stripe] Nie udało się utworzyć sesji pakietu:", e);
    return NextResponse.json({ error: "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę." }, { status: 502 });
  }
}
