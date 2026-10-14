import { NextResponse } from "next/server";
import { SMALL_JSON_MAX_BYTES, readJsonLimited } from "@/lib/http";
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
  const body = await readJsonLimited(req, SMALL_JSON_MAX_BYTES);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.data ?? {});
  if (!parsed.success) return NextResponse.json({ valid: false, message: "Podaj kod." }, { status: 400 });
  const r = checkCoupon(parsed.data.code, parsed.data.oferta ?? null);
  return NextResponse.json(r.ok ? { valid: true, message: "Kod jest ważny – raport bez płatności.", oferta: r.offer } : { valid: false, message: r.message });
}
