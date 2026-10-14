import fs from "node:fs/promises";
import { marked } from "marked";
import { ReportSchema, type Report } from "@/lib/report-schema";
import { PRZYKLAD_META, PRZYKLAD_RAPORT } from "@/components/fixtures/przyklad";
import { contentPath } from "./paths";

export interface ExampleReport {
  report: Report;
  meta: { tytul: string; cena_pln: number | null; przebieg_km: number | null; ogloszenieHtml: string | null };
  source: "content" | "fixture";
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Fikcyjne ogłoszenie (`content/przyklad-ogloszenie.md`): tytuł z H1, cena z „**Cena:** …”, treść jako HTML. */
async function loadExampleAd(): Promise<{ tytul: string | null; cena: number | null; html: string } | null> {
  try {
    const md = (await fs.readFile(contentPath("przyklad-ogloszenie.md"), "utf8")).replace(/<!--[\s\S]*?-->/g, "").trim();
    const h1 = /^#\s+(.+)$/m.exec(md)?.[1]?.trim() ?? null;
    const cenaTxt = /cena:?\**:?\s*([\d\s ]+)\s*zł/i.exec(md)?.[1];
    const cena = cenaTxt ? Number(cenaTxt.replace(/\D/g, "")) || null : null;
    const body = md.replace(/^#\s+.+\r?\n/m, "");
    return { tytul: h1, cena, html: await marked.parse(body, { gfm: true }) };
  } catch {
    return null;
  }
}

/**
 * Przykładowy raport: `content/przyklad-raport.json` (schemat `Report`; dopuszczalne też `{ "raport": {...}, "meta": {...} }`)
 * + `content/przyklad-ogloszenie.md`. Gdy ich brak lub JSON jest niezgodny – fixture z components/fixtures.
 */
export async function loadExampleReport(): Promise<ExampleReport> {
  try {
    const raw = JSON.parse(await fs.readFile(contentPath("przyklad-raport.json"), "utf8")) as Record<string, unknown>;
    const parsed = ReportSchema.safeParse(raw.raport ?? raw.report ?? raw);
    if (parsed.success) {
      const r = parsed.data;
      const ad = await loadExampleAd();
      const v = r.rozpoznany_pojazd;
      const engine = v.silnik.split(" (")[0].replace(/\s+\d+–\d+\s*KM$/, "");
      return {
        report: r,
        meta: {
          tytul: ad?.tytul ?? `${v.marka} ${v.model} ${v.generacja.replace(/\s*\(.*?\)/, "")} ${engine}`.trim(),
          cena_pln: ad?.cena ?? r.porownanie_cen?.wiersze[0]?.cena ?? null,
          przebieg_km: r.przebieg?.deklarowany_km ?? null,
          ogloszenieHtml: ad?.html ?? null,
        },
        source: "content",
      };
    }
    console.warn(`[przyklad] content/przyklad-raport.json niezgodny ze schematem: ${parsed.error.issues[0]?.path.join(".")} – używam fixture`);
  } catch {
    /* brak pliku – fixture */
  }
  return {
    report: PRZYKLAD_RAPORT,
    meta: {
      tytul: PRZYKLAD_META.tytul,
      cena_pln: PRZYKLAD_META.cena_pln,
      przebieg_km: PRZYKLAD_META.przebieg_km,
      ogloszenieHtml: `<p>${escapeHtml(PRZYKLAD_META.ogloszenie)}</p>`,
    },
    source: "fixture",
  };
}
