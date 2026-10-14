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
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

export function matchRedFlags(text: string, flags: RedFlag[]): (RedFlag & { trafienie: string })[] {
  const lower = text.toLowerCase();
  const plain = stripPl(text);
  const hits: (RedFlag & { trafienie: string })[] = [];
  for (const f of flags) {
    for (const p of f.patterns) {
      let hit: string | null = null;
      try {
        const re = new RegExp(p, "iu");
        hit = re.exec(lower)?.[0] ?? re.exec(plain)?.[0] ?? null;
      } catch {
        const needle = stripPl(p);
        if (plain.includes(needle)) hit = p;
      }
      if (hit) {
        hits.push({ ...f, trafienie: hit });
        break;
      }
    }
  }
  return hits;
}
