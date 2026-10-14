import { NextResponse, after } from "next/server";
import { anonymizeText } from "@/lib/anonymize";
import { createReport, markPaid, setStripeSession, saveReportError } from "@/lib/db";
import { runGeneration } from "@/lib/generate";
import { putImages } from "@/lib/image-cache";
import { getModel, modelLabel } from "@/lib/models";
import { baseUrlFrom, createCheckoutSession, paymentsSkipped } from "@/lib/payments";
import { CreateReportRequestSchema } from "@/lib/report-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CreateReportRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { input, zdjecia, oferta, email } = parsed.data;

  // RODO: anonimizujemy wszystko, co napisały osoby trzecie, ZANIM cokolwiek zapiszemy.
  const model = input.model_id ? await getModel(input.model_id) : null;
  const row = createReport({
    offer: oferta,
    email: email ?? null,
    input: {
      ...input,
      tekst_ogloszenia: anonymizeText(input.tekst_ogloszenia),
      historia_pojazdu: anonymizeText(input.historia_pojazdu),
      podobne_oferty: oferta === "raport_plus" ? input.podobne_oferty.map((o) => ({ ...o, tekst: anonymizeText(o.tekst) })) : [],
      model_id: model ? model.id : null,
      silnik_kod: model ? input.silnik_kod : null,
      model_label: model ? modelLabel(model) : null,
      liczba_zdjec: zdjecia.length,
    },
  });
  putImages(row.id, zdjecia);

  if (paymentsSkipped()) {
    if (process.env.NODE_ENV === "production") console.warn("[UWAGA] DEV_SKIP_PAYMENT=1 w produkcji – raporty są generowane bez płatności!");
    markPaid(row.id);
    after(() => runGeneration(row.id));
    return NextResponse.json({ id: row.id, redirect: `/raport/${row.id}` });
  }

  try {
    const session = await createCheckoutSession({ reportId: row.id, offer: oferta, baseUrl: baseUrlFrom(req), email });
    setStripeSession(row.id, session.id);
    return NextResponse.json({ id: row.id, redirect: session.url });
  } catch (e) {
    console.error("[stripe] Nie udało się utworzyć sesji płatności:", e);
    saveReportError(row.id, "Nie udało się rozpocząć płatności.");
    return NextResponse.json({ error: "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę." }, { status: 502 });
  }
}
