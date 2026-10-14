import type { Report } from "../report-schema";
import { normalize, type Fault } from "../models";
import { ClaudeProvider } from "./claude";
import { MockProvider } from "./mock";
import type { AiProvider, AiReportRequest } from "./types";

export type { AiReportRequest } from "./types";

export function getProvider(): AiProvider {
  return process.env.AI_MOCK === "1" ? new MockProvider() : new ClaudeProvider();
}

const SEVERITY_ORDER: Record<Fault["severity"], number> = { wysoka: 0, srednia: 1, niska: 2 };

function faultsFor(req: AiReportRequest): Fault[] {
  if (!req.model) return [];
  const engine = req.silnikKod ? req.model.engines.find((e) => e.code === req.silnikKod) : undefined;
  const engineFaults = engine ? engine.faults : req.model.engines.flatMap((e) => e.faults);
  return [...engineFaults, ...req.model.common_faults];
}

/**
 * Twarde reguły nałożone na odpowiedź modelu (nie ufamy, że prompt zawsze zadziała):
 * - usterki tylko z bazy (dopasowanie po tytule; koszty i waga zawsze z bazy),
 * - brak wpisu w bazie → brak usterek modelu,
 * - odczyty przebiegu z naszego parsera, nie z modelu,
 * - sekcje zależne od pakietu / zdjęć.
 */
export function postProcess(report: Report, req: AiReportRequest): Report {
  const r: Report = structuredClone(report);
  r.rozpoznany_pojazd.w_bazie = !!req.model;

  if (!req.model) {
    r.typowe_usterki = [];
  } else {
    const db = faultsFor(req);
    const byTitle = new Map(db.map((f) => [normalize(f.title), f]));
    const kept: Report["typowe_usterki"] = [];
    const seen = new Set<string>();
    for (const u of r.typowe_usterki) {
      const key = normalize(u.tytul);
      const f = byTitle.get(key);
      if (!f || seen.has(key)) continue;
      seen.add(key);
      kept.push({ ...u, tytul: f.title, koszt_pln_od: f.cost_pln[0], koszt_pln_do: f.cost_pln[1], waga: f.severity });
    }
    r.typowe_usterki =
      kept.length > 0
        ? kept
        : [...db]
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
            .slice(0, 8)
            .map((f) => ({
              tytul: f.title,
              objawy: f.symptoms,
              koszt_pln_od: f.cost_pln[0],
              koszt_pln_do: f.cost_pln[1],
              waga: f.severity,
              jak_sprawdzic: f.check_at_inspection,
            }));
  }

  if (req.zdjecia.length === 0) r.zdjecia = null;
  if (req.oferta !== "raport_plus" || req.podobneOferty.length === 0) r.porownanie_cen = null;

  if (req.odczyty.length > 0 || req.deklaracje.przebieg_km !== null) {
    if (r.przebieg) {
      if (req.odczyty.length > 0) r.przebieg.odczyty = req.odczyty;
      if (req.deklaracje.przebieg_km !== null) r.przebieg.deklarowany_km = req.deklaracje.przebieg_km;
    } else {
      r.przebieg = {
        deklarowany_km: req.deklaracje.przebieg_km,
        odczyty: req.odczyty,
        wniosek: "Porównaj odczyty z badań technicznych z przebiegiem deklarowanym w ogłoszeniu.",
        uwagi: [],
      };
    }
  }
  return r;
}

export async function generateReport(req: AiReportRequest): Promise<Report> {
  const provider = getProvider();
  const raw = await provider.generate(req);
  return postProcess(raw, req);
}
