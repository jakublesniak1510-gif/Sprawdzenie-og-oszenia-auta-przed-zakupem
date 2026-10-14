import { NextResponse } from "next/server";
import { track } from "@/lib/analytics";
import { getReport, setBought } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { baseUrlFrom } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Link z e-maila „Kupiłeś to auto?” (?odp=tak|nie): zapisuje pierwszą odpowiedź (kolumna reports.kupil,
 * zdarzenie `feedback`) i przekierowuje na stronę raportu do formularza opinii (`?kupil=tak|nie#opinia`).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const base = process.env.APP_URL ? appUrl() : baseUrlFrom(req);
  const odp = new URL(req.url).searchParams.get("odp");
  if (!UUID_RE.test(id) || (odp !== "tak" && odp !== "nie")) return NextResponse.redirect(`${base}/`, 303);
  if (!getReport(id)) return NextResponse.redirect(`${base}/`, 303);
  if (setBought(id, odp === "tak")) track("feedback", { report_id: id, kupil: odp === "tak", zrodlo: "email" });
  return NextResponse.redirect(`${base}/raport/${id}?kupil=${odp}#opinia`, 303);
}
