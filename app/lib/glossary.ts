import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/** Słowniczek pojęć do tooltipów (`data/glossary.json`, schemat `data/schema/glossary.schema.json`). */

export const GlossaryEntrySchema = z.object({
  term: z.string(),
  aliases: z.array(z.string()),
  category: z.string(),
  short: z.string(),
  explanation: z.string(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export function glossaryPath(): string {
  return process.env.GLOSSARY_PATH
    ? path.resolve(process.env.GLOSSARY_PATH)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "data", "glossary.json");
}

/** Wszystkie poprawne wpisy słowniczka (błędne pomijane z ostrzeżeniem; brak pliku → []). */
export async function getGlossary(): Promise<GlossaryEntry[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(glossaryPath(), "utf8"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x, i) => {
    const p = GlossaryEntrySchema.safeParse(x);
    if (!p.success) console.warn(`[glossary] Pomijam wpis ${i}: ${p.error.issues[0]?.message}`);
    return p.success ? [p.data] : [];
  });
}
