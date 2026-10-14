import fs from "node:fs/promises";
import path from "node:path";
import { modelsDir, type CarModel } from "@/lib/models";

/**
 * Pola modelu spoza schematu `CarModelSchema` (np. `price_ranges` dodawane przez bazę) – zod je obcina,
 * więc czytamy surowy JSON. Format widełek obsługujemy tolerancyjnie (tablica albo obiekt).
 */
export interface PriceRange {
  label: string;
  min: number;
  max: number;
  note: string | null;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const num = (o: Obj, keys: string[]): number | null => {
  for (const k of keys) if (typeof o[k] === "number" && Number.isFinite(o[k])) return o[k] as number;
  return null;
};
const pair = (x: unknown): [number, number] | null =>
  Array.isArray(x) && x.length === 2 && typeof x[0] === "number" && typeof x[1] === "number" ? [x[0], x[1]] : null;

function labelOf(o: Obj): string {
  const parts: string[] = [];
  const years = pair(o.years) ?? pair(o.lata) ?? pair(o.rocznik);
  for (const k of ["label", "etykieta", "wersja", "variant", "silnik", "engine", "engine_code", "nazwa", "name"]) if (typeof o[k] === "string") parts.push(o[k] as string);
  if (years) parts.push(`${years[0]}–${years[1]}`);
  else for (const k of ["years", "lata", "rocznik", "year", "rok"]) if (typeof o[k] === "string" || typeof o[k] === "number") parts.push(String(o[k]));
  if (typeof o.km_max === "number") parts.push(`przebieg do ${Math.round(o.km_max / 1000)} tys. km`);
  const mil = pair(o.mileage_km) ?? pair(o.przebieg_km);
  if (mil) parts.push(`${Math.round(mil[0] / 1000)}–${Math.round(mil[1] / 1000)} tys. km`);
  else if (typeof o.mileage_km === "string" || typeof o.przebieg === "string") parts.push(String(o.mileage_km ?? o.przebieg));
  return parts.join(", ") || "wszystkie wersje";
}

export function normalizePriceRanges(raw: unknown): PriceRange[] {
  const out: PriceRange[] = [];
  const push = (label: string, v: unknown) => {
    const p = pair(v) ?? (isObj(v) ? pair(v.pln) ?? pair(v.price_pln) ?? pair(v.cena_pln) ?? pair(v.range) : null);
    const o = isObj(v) ? v : {};
    const min = p?.[0] ?? num(o, ["min", "od", "from", "min_pln", "price_min", "cena_od", "low"]);
    const max = p?.[1] ?? num(o, ["max", "do", "to", "max_pln", "price_max", "cena_do", "high"]);
    if (min === null || max === null || max < min) return;
    const note = typeof o.note === "string" ? o.note : typeof o.uwaga === "string" ? o.uwaga : typeof o.source === "string" ? o.source : null;
    out.push({ label: label || labelOf(o), min, max, note });
  };
  if (Array.isArray(raw)) raw.forEach((r) => push(isObj(r) ? labelOf(r) : "", r));
  else if (isObj(raw)) {
    // { "2012-2016": [30000, 45000] } albo { items: [...] }
    const items = raw.items ?? raw.ranges ?? raw.widelki;
    if (Array.isArray(items)) return normalizePriceRanges(items);
    for (const [k, v] of Object.entries(raw)) if (!["note", "source", "updated", "currency", "waluta", "data"].includes(k)) push(k.replace(/_/g, " "), v);
  }
  return out;
}

export async function loadModelExtras(m: CarModel): Promise<{ priceRanges: PriceRange[]; priceNote: string | null }> {
  let raw: Obj = m as unknown as Obj;
  const fromSchema = raw.price_ranges;
  if (!(Array.isArray(fromSchema) && fromSchema.length)) {
    try {
      raw = JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ modelsDir(), `${m.id}.json`), "utf8")) as Obj;
    } catch {
      raw = {};
    }
  }
  const pr = raw.price_ranges;
  const note = isObj(pr) ? (typeof pr.note === "string" ? pr.note : typeof pr.source === "string" ? pr.source : null) : null;
  return { priceRanges: normalizePriceRanges(pr), priceNote: note };
}
