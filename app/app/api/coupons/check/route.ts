import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCoupon } from "@/lib/coupons";
import { rateLimit } from "@/lib/rate-limit";
import { OfferId } from "@/lib/report-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(40), oferta: OfferId.optional() });

/** Walidacja kodu z formularza. Nie ujawnia liczby pozostałych użyć. Odpowiedź: { valid, message, oferta? }. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "couponCheck");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ valid: false, message: "Podaj kod." }, { status: 400 });
  const r = checkCoupon(parsed.data.code, parsed.data.oferta ?? null);
  return NextResponse.json(r.ok ? { valid: true, message: "Kod jest ważny – raport bez płatności.", oferta: r.offer } : { valid: false, message: r.message });
}
