import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Heurystyki czerwonych flag (`data/red-flags.json` lub `data/red-flags/*.json`,
 * schemat: `data/schema/red-flags.schema.json`). Trafienia przekazujemy modelowi jako
 * wskazówki z neutralnym sformułowaniem – model nadal sam ocenia kontekst.
 */

const RedFlagSchema = z.object({
  id: z.string(),
  category: z.string(),
  patterns: z.array(z.string()),
  explanation: z.string(),
  severity: z.enum(["niska", "srednia", "wysoka"]),
  neutral_wording: z.string(),
  question_for_seller: z.string().optional(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

async function readFlagsFile(file: string): Promise<RedFlag[]> {
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.flags) ? raw.flags : [];
    return arr.flatMap((x: unknown) => {
      const p = RedFlagSchema.safeParse(x);
      return p.success ? [p.data] : [];
    });
  } catch {
    return [];
  }
}

export async function loadRedFlags(): Promise<RedFlag[]> {
  const dataDir = path.resolve(process.cwd(), "..", "data");
  const candidates = process.env.RED_FLAGS_PATH ? [path.resolve(process.env.RED_FLAGS_PATH)] : [path.join(dataDir, "red-flags.json")];
  const out: RedFlag[] = [];
  for (const c of candidates) out.push(...(await readFlagsFile(c)));
  try {
    const dir = path.join(dataDir, "red-flags");
    for (const f of (await fs.readdir(dir)).filter((f) => f.endsWith(".json"))) out.push(...(await readFlagsFile(path.join(dir, f))));
  } catch {
    /* brak katalogu – OK */
  }
  return out;
}

function stripPl(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");
}

/** Wzorzec z bazy: „/treść/flagi” = wyrażenie regularne, wszystko inne = zwykła fraza (dopasowanie literalne). */
const REGEX_LITERAL = /^\/(.+)\/([a-z]*)$/s;
/** VIN: 17 znaków bez I, O, Q (wzorzec z data/README.md). */
export const VIN_RE = /\b[a-hj-npr-z0-9]{17}\b/i;
export const BRAK_VIN_ID = "brak-vin";

const regexCache = new Map<string, RegExp | null>();
function compilePattern(p: string): RegExp | null | undefined {
  const m = REGEX_LITERAL.exec(p);
  if (!m) return undefined; // zwykła fraza
  if (!regexCache.has(p)) {
    try {
      regexCache.set(p, new RegExp(m[1], m[2]));
    } catch (e) {
      console.warn(`[red-flags] Pomijam błędny regex ${p}: ${(e as Error).message}`);
      regexCache.set(p, null);
    }
  }
  return regexCache.get(p);
}

export type RedFlagHit = RedFlag & { trafienie: string };

/**
 * Dopasowuje heurystyki do tekstu ogłoszenia:
 * - regexy z bazy („/…/iu”) – na oryginalnym tekście małymi literami (same obsługują polskie znaki i zaprzeczenia),
 * - frazy – literalnie jako fragment, po zdjęciu polskich znaków z obu stron,
 * - flaga „brak-vin” – także gdy w tekście nie ma 17-znakowego VIN-u,
 * - flagi z pustym `patterns` nie są zgłaszane mechanicznie (ocenia je model).
 */
export function matchRedFlags(text: string, flags: RedFlag[]): RedFlagHit[] {
  const lower = text.toLowerCase();
  const plain = stripPl(text);
  const hits: RedFlagHit[] = [];
  for (const f of flags) {
    for (const p of f.patterns) {
      const re = compilePattern(p);
      let hit: string | null = null;
      if (re === undefined) {
        const needle = stripPl(p);
        if (needle && plain.includes(needle)) hit = p;
      } else if (re) {
        re.lastIndex = 0;
        hit = re.exec(lower)?.[0] ?? null;
      }
      if (hit) {
        hits.push({ ...f, trafienie: hit });
        break;
      }
    }
  }
  const vinFlag = flags.find((f) => f.id === BRAK_VIN_ID);
  if (vinFlag && !VIN_RE.test(text) && !hits.some((h) => h.id === BRAK_VIN_ID)) {
    hits.push({ ...vinFlag, trafienie: "brak 17-znakowego VIN w treści ogłoszenia" });
  }
  return hits;
}
