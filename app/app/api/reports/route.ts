import { NextResponse, after } from "next/server";
import { track } from "@/lib/analytics";
import { anonymizeText } from "@/lib/anonymize";
import { checkCoupon, redeemCoupon } from "@/lib/coupons";
import { createReport, deleteReport, getDb, markPaid, setStripeSession } from "@/lib/db";
import { REPORTS_MAX_BODY_BYTES, readJsonLimited } from "@/lib/http";
import { dataUrlBytes, dropImages, isJpegDataUrl, putImages } from "@/lib/image-cache";
import { getModel, modelLabel } from "@/lib/models";
import { baseUrlFrom, createCheckoutSession, paymentsSkipped } from "@/lib/payments";
import { enqueueGeneration } from "@/lib/queue";
import { rateLimit } from "@/lib/rate-limit";
import { CreateReportRequestSchema } from "@/lib/report-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

export async function POST(req: Request) {
  const limited = rateLimit(req, "reports");
  if (limited) return limited;

  const body = await readJsonLimited(req, REPORTS_MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = CreateReportRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { input, zdjecia, oferta, email, coupon } = parsed.data;

  // Zdjęcia: tylko prawdziwe JPEG (magic bytes FF D8 FF), nie większe niż 1,5 MB każde.
  for (const [i, z] of zdjecia.entries()) {
    if (!isJpegDataUrl(z)) return NextResponse.json({ error: `Zdjęcie ${i + 1} nie jest prawidłowym plikiem JPEG.` }, { status: 400 });
    if (dataUrlBytes(z) > MAX_IMAGE_BYTES) return NextResponse.json({ error: `Zdjęcie ${i + 1} jest za duże (maks. 1,5 MB).` }, { status: 413 });
  }

  // Kupon: najpierw walidacja z czytelnym komunikatem, właściwe zużycie atomowo razem z utworzeniem raportu.
  let couponCode: string | null = null;
  if (coupon && coupon.trim()) {
    const c = checkCoupon(coupon, oferta);
    if (!c.ok) return NextResponse.json({ error: c.message, field: "coupon" }, { status: 400 });
    couponCode = c.code;
  }

  // RODO: anonimizujemy wszystko, co napisały osoby trzecie, ZANIM cokolwiek zapiszemy.
  const model = input.model_id ? await getModel(input.model_id) : null;
  const storedInput = {
    ...input,
    tekst_ogloszenia: anonymizeText(input.tekst_ogloszenia),
    historia_pojazdu: anonymizeText(input.historia_pojazdu),
    podobne_oferty: oferta === "raport_plus" ? input.podobne_oferty.map((o) => ({ ...o, tekst: anonymizeText(o.tekst) })) : [],
    model_id: model ? model.id : null,
    silnik_kod: model ? input.silnik_kod : null,
    model_label: model ? modelLabel(model) : null,
    liczba_zdjec: zdjecia.length,
  };

  let row;
  if (couponCode) {
    const code = couponCode;
    // Jedna transakcja: zużycie kuponu (UPDATE … WHERE uses_left > 0) + raport + status paid. Wszystko albo nic.
    row = getDb().transaction(() => {
      if (!redeemCoupon(code, oferta)) return null;
      const r = createReport({ offer: oferta, email: email ?? null, input: storedInput });
      markPaid(r.id, { couponCode: code });
      return r;
    }).immediate();
    if (!row) return NextResponse.json({ error: "Kod został właśnie wykorzystany albo wygasł.", field: "coupon" }, { status: 409 });
  } else {
    row = createReport({ offer: oferta, email: email ?? null, input: storedInput });
  }
  putImages(row.id, zdjecia);
  track("raport_utworzony", { report_id: row.id, oferta, zdjecia: zdjecia.length, model_id: model?.id ?? null, kupon: !!couponCode, email: !!email }, req);

  if (couponCode) {
    track("kupon_uzyty", { report_id: row.id, oferta });
    track("platnosc_oplacona", { rodzaj: oferta, kwota_gr: 0, zrodlo: "kupon", report_id: row.id });
    after(() => enqueueGeneration(row.id));
    return NextResponse.json({ id: row.id, redirect: `/raport/${row.id}` });
  }

  if (paymentsSkipped()) {
    console.warn("[UWAGA] DEV_SKIP_PAYMENT=1 – raport generowany bez płatności (tryb testowy).");
    markPaid(row.id);
    track("platnosc_oplacona", { rodzaj: oferta, kwota_gr: 0, zrodlo: "dev_skip", report_id: row.id });
    after(() => enqueueGeneration(row.id));
    return NextResponse.json({ id: row.id, redirect: `/raport/${row.id}` });
  }

  try {
    const session = await createCheckoutSession({ reportId: row.id, offer: oferta, baseUrl: baseUrlFrom(req), email });
    setStripeSession(row.id, session.id, session.amountGr);
    track("platnosc_rozpoczeta", { rodzaj: oferta, kwota_gr: session.amountGr, report_id: row.id }, req);
    return NextResponse.json({ id: row.id, redirect: session.url });
  } catch (e) {
    console.error("[stripe] Nie udało się utworzyć sesji płatności:", e);
    deleteReport(row.id);
    dropImages(row.id);
    return NextResponse.json({ error: "Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę." }, { status: 502 });
  }
}
