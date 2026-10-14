import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { readJsonLimited } from "@/lib/http";
import { QuickTestInputSchema, runQuickTest } from "@/lib/quick-test";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Darmowy szybki test ogłoszenia (bez AI).
 * Wejście: { tekst, cena?, przebieg?, rocznik? }. Wyjście: QuickTestResult (lib/quick-test.ts).
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "szybkiTest");
  if (limited) return limited;
  const body = await readJsonLimited(req, 200 * 1024);
  if (!body.ok) return body.response;
  const parsed = QuickTestInputSchema.safeParse(body.data ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const result = await runQuickTest(parsed.data);
  track(
    "szybki_test",
    {
      model_id: result.rozpoznany?.model_id ?? null,
      flagi: result.flagi.length,
      cena: result.cena.pozycja,
      brak_vin: result.brak_vin,
    },
    req,
  );
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
