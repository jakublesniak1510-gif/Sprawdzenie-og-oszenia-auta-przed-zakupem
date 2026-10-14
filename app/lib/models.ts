import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Baza modeli (`data/models/*.json`, schemat: `data/schema/model.schema.json`).
 * Ładowana dynamicznie przy każdym żądaniu (baza powstaje równolegle i może się zmieniać).
 * Niepoprawne pliki są pomijane z ostrzeżeniem w logu.
 */

const FaultSchema = z.object({
  title: z.string(),
  symptoms: z.string(),
  mileage_km: z.string().optional(),
  severity: z.enum(["niska", "srednia", "wysoka"]),
  cost_pln: z.tuple([z.number(), z.number()]),
  check_at_inspection: z.string(),
});
export type Fault = z.infer<typeof FaultSchema>;

const EngineSchema = z.object({
  code: z.string(),
  fuel: z.enum(["benzyna", "diesel", "lpg", "hybryda", "elektryk"]),
  power_hp: z.array(z.number()).optional(),
  aliases: z.array(z.string()),
  timing: z.string().optional(),
  verdict: z.enum(["polecany", "neutralny", "ryzykowny"]).optional(),
  faults: z.array(FaultSchema),
});
export type Engine = z.infer<typeof EngineSchema>;

export const CarModelSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  make: z.string(),
  model: z.string(),
  generation: z.string(),
  years: z.tuple([z.number(), z.number()]),
  aliases: z.array(z.string()),
  market_note: z.string().optional(),
  engines: z.array(EngineSchema),
  common_faults: z.array(FaultSchema),
  inspection_tips: z.array(z.string()),
  questions_for_seller: z.array(z.string()),
  summary: z.string(),
  sources_note: z.string().optional(),
});
export type CarModel = z.infer<typeof CarModelSchema>;

export function modelsDir(): string {
  return process.env.MODELS_DIR ? path.resolve(process.env.MODELS_DIR) : path.resolve(process.cwd(), "..", "data", "models");
}

const FIXTURES_DIR = () => path.resolve(process.cwd(), "fixtures");

async function readJsonDir(dir: string): Promise<CarModel[]> {
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return []; // brak katalogu = pusta baza
  }
  const out: CarModel[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
      const parsed = CarModelSchema.safeParse(raw);
      if (parsed.success) out.push(parsed.data);
      else console.warn(`[models] Pomijam ${f}: niezgodny ze schematem – ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
    } catch (e) {
      console.warn(`[models] Pomijam ${f}: ${(e as Error).message}`);
    }
  }
  return out;
}

/** Wszystkie modele z bazy. Gdy MODELS_INCLUDE_FIXTURES=1 – dokłada przykładowy model z `fixtures/`. */
export async function loadModels(): Promise<CarModel[]> {
  const models = await readJsonDir(modelsDir());
  if (process.env.MODELS_INCLUDE_FIXTURES === "1") {
    const ids = new Set(models.map((m) => m.id));
    for (const m of await readJsonDir(FIXTURES_DIR())) if (!ids.has(m.id)) models.push(m);
  }
  return models.sort((a, b) => `${a.make} ${a.model} ${a.years[0]}`.localeCompare(`${b.make} ${b.model} ${b.years[0]}`, "pl"));
}

export async function getModel(id: string): Promise<CarModel | null> {
  return (await loadModels()).find((m) => m.id === id) ?? null;
}

/* ---------- rozpoznawanie modelu i silnika z tekstu ---------- */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9.+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAlias(haystack: string, alias: string): boolean {
  const a = normalize(alias);
  if (!a) return false;
  return ` ${haystack} `.includes(` ${a} `);
}

export interface Detection {
  modelId: string;
  label: string;
  engineCode: string | null;
  score: number;
}

export function modelLabel(m: CarModel): string {
  return `${m.make} ${m.model} ${m.generation}`;
}

/**
 * Zwraca kandydatów posortowanych od najlepszego.
 * Punkty: dopasowanie aliasu modelu (dłuższy alias = pewniejszy), marka w tekście, rocznik w zakresie, alias silnika.
 */
export function detectModels(text: string, models: CarModel[], rocznik?: number | null): Detection[] {
  const hay = normalize(text);
  // Brak rocznika z formularza → spróbuj znaleźć rok w tekście.
  rocznik ??= Number(text.match(/\b(19[89]\d|20[0-3]\d)\b/)?.[1]) || null;
  const results: Detection[] = [];
  for (const m of models) {
    let score = 0;
    for (const alias of [...m.aliases, `${m.make} ${m.model}`]) {
      if (containsAlias(hay, alias)) score = Math.max(score, 10 + normalize(alias).length);
    }
    if (score === 0) continue;
    if (containsAlias(hay, m.make)) score += 5;
    if (rocznik && rocznik >= m.years[0] && rocznik <= m.years[1]) score += 8;
    else if (rocznik) score -= 6;

    let engineCode: string | null = null;
    let best = 0;
    for (const e of m.engines) {
      for (const alias of [...e.aliases, e.code]) {
        if (containsAlias(hay, alias)) {
          const s = normalize(alias).length;
          if (s > best) {
            best = s;
            engineCode = e.code;
          }
        }
      }
    }
    if (engineCode) score += 5;
    results.push({ modelId: m.id, label: modelLabel(m), engineCode, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

/** Wycinek bazy przekazywany do modelu językowego: wybrany silnik + usterki wspólne. */
export function modelContextForAi(m: CarModel, engineCode: string | null) {
  const engine = engineCode ? m.engines.find((e) => e.code === engineCode) ?? null : null;
  return {
    id: m.id,
    marka: m.make,
    model: m.model,
    generacja: m.generation,
    lata: m.years,
    uwagi_rynkowe: m.market_note ?? null,
    podsumowanie: m.summary,
    silnik_wybrany: engine,
    // Gdy silnik nieznany – przekazujemy wszystkie, model ma zaznaczyć niepewność.
    silniki_pozostale: engine ? [] : m.engines,
    usterki_wspolne: m.common_faults,
    wskazowki_ogledzin: m.inspection_tips,
    pytania_do_sprzedawcy: m.questions_for_seller,
  };
}
