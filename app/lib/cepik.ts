/**
 * Tolerancyjny parser wklejonego wyniku z gov.pl „Historia Pojazdu”.
 * Format strony się zmienia, więc nie zakładamy struktury – szukamy par (data, „N km”).
 * Zawsze jest fallback: ręczna tabela odczytów w formularzu.
 */

export interface MileageReading {
  data: string; // RRRR-MM-DD
  km: number;
}

const DATE_RE = /\b(?:(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/g;
const KM_RE = /(\d{1,3}(?:[  .]\d{3})+|\d{1,7})\s*km\b/gi;

function iso(y: number, m: number, d: number): string | null {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Normalizuje datę z formularza (RRRR-MM-DD, DD.MM.RRRR) do RRRR-MM-DD. */
export function normalizeDate(s: string): string | null {
  DATE_RE.lastIndex = 0;
  const m = DATE_RE.exec(s.trim());
  if (!m) return null;
  return m[3] ? iso(+m[3], +m[2], +m[1]) : iso(+m[4], +m[5], +m[6]);
}

export function parseHistoriaPojazdu(text: string, maxDistance = 400): MileageReading[] {
  if (!text.trim()) return [];
  const dates: { idx: number; iso: string }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const v = m[3] ? iso(+m[3], +m[2], +m[1]) : iso(+m[4], +m[5], +m[6]);
    if (v) dates.push({ idx: m.index ?? 0, iso: v });
  }
  const out: MileageReading[] = [];
  for (const m of text.matchAll(KM_RE)) {
    const km = Number(m[1].replace(/[  .]/g, ""));
    if (!Number.isFinite(km) || km > 2_000_000) continue;
    const idx = m.index ?? 0;
    // 1) data w tym samym wierszu (najpierw przed liczbą, potem za nią), 2) najbliższa data przed liczbą.
    const lineStart = text.lastIndexOf("\n", idx) + 1;
    const nl = text.indexOf("\n", idx);
    const lineEnd = nl === -1 ? text.length : nl;
    const before = dates.filter((d) => d.idx < idx);
    const sameLine =
      before.filter((d) => d.idx >= lineStart).at(-1) ?? dates.find((d) => d.idx > idx && d.idx < lineEnd) ?? null;
    const best = sameLine ?? before.at(-1) ?? null;
    const bestDist = best ? Math.abs(idx - best.idx) : Infinity;
    if (best && bestDist <= maxDistance) out.push({ data: best.iso, km });
  }
  return dedupeSort(out);
}

export function dedupeSort(rs: MileageReading[]): MileageReading[] {
  const seen = new Set<string>();
  return rs
    .filter((r) => {
      const k = `${r.data}|${r.km}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km);
}

export interface MileageAnalysis {
  cofniecia: { z: MileageReading; na: MileageReading }[];
  /** Ostatni odczyt wyższy od deklarowanego przebiegu. */
  deklarowanyNizszyOdOstatniego: boolean;
  ostatni: MileageReading | null;
}

/** Deterministyczna analiza – przekazywana modelowi jako fakt, żeby nie liczył „na oko”. */
export function analyzeMileage(readings: MileageReading[], declaredKm: number | null): MileageAnalysis {
  const sorted = dedupeSort(readings);
  const cofniecia: MileageAnalysis["cofniecia"] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].km < sorted[i - 1].km) cofniecia.push({ z: sorted[i - 1], na: sorted[i] });
  }
  const ostatni = sorted.at(-1) ?? null;
  return {
    cofniecia,
    deklarowanyNizszyOdOstatniego: !!(ostatni && declaredKm !== null && declaredKm < ostatni.km),
    ostatni,
  };
}
