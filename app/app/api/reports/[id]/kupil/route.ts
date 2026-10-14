import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getReport, setBought } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { baseUrlFrom } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Odpowiedź z e-maila „Kupiłeś to auto?”.
 * GET (link z e-maila) NICZEGO nie zapisuje – skanery poczty otwierają linki automatycznie. Pokazuje prostą stronę
 * z dwoma przyciskami (formularz POST). Zapis w POST: kolumna reports.kupil (tylko pierwsza odpowiedź) + zdarzenie
 * `feedback`, potem przekierowanie do formularza opinii (`/raport/<id>?kupil=tak|nie#opinia`).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const base = process.env.APP_URL ? appUrl() : baseUrlFrom(req);
  if (!UUID_RE.test(id) || !getReport(id)) return NextResponse.redirect(`${base}/`, 303);
  const odp = new URL(req.url).searchParams.get("odp");
  const btn = (value: "tak" | "nie", label: string) =>
    `<button type="submit" name="odp" value="${value}" style="display:block;width:100%;margin:8px 0;padding:14px;border-radius:12px;border:2px solid #1e40af;font:600 16px system-ui,sans-serif;cursor:pointer;${
      odp === value ? "background:#1e40af;color:#fff" : "background:#fff;color:#1e40af"
    }">${label}</button>`;
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Kupiłeś to auto?</title></head>
<body style="margin:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
<main style="max-width:420px;margin:40px auto;padding:24px 16px;background:#fff;border-radius:16px">
<h1 style="font-size:22px;margin:0 0 8px">Kupiłeś to auto?</h1>
<p style="margin:0 0 16px;color:#475569">Jedno kliknięcie – to pomaga nam ulepszać raporty. Odpowiedź zapisujemy bez danych osobowych.</p>
<form method="post" action="/api/reports/${id}/kupil">${btn("tak", "Tak, kupiłem")}${btn("nie", "Nie, szukam dalej")}</form>
<p style="margin:16px 0 0;font-size:14px"><a href="/raport/${id}" style="color:#1e40af">Wróć do raportu</a></p>
</main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "boughtAnswer");
  if (limited) return limited;
  const { id } = await ctx.params;
  const base = process.env.APP_URL ? appUrl() : baseUrlFrom(req);
  const form = await req.formData().catch(() => null);
  const odp = form?.get("odp");
  if (!UUID_RE.test(id) || (odp !== "tak" && odp !== "nie") || !getReport(id)) return NextResponse.redirect(`${base}/`, 303);
  if (setBought(id, odp === "tak")) track("feedback", { report_id: id, kupil: odp === "tak", zrodlo: "email" });
  return NextResponse.redirect(`${base}/raport/${id}?kupil=${odp}#opinia`, 303);
}
