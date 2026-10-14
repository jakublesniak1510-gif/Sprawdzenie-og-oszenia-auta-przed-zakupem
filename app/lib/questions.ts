import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Uniwersalne pytania do sprzedawcy wg kategorii flag (`data/questions-by-category.json`).
 * Do promptu trafiają pytania z kategorii trafionych flag, bez tych, które już padły
 * (question_for_seller flag, questions_for_seller modelu) – porównanie po znormalizowanym tekście.
 */

const FileSchema = z.object({
  kategorie: z.record(z.string(), z.object({ etykieta: z.string(), pytania: z.array(z.string()) })),
});
export type QuestionsByCategory = z.infer<typeof FileSchema>["kategorie"];

export interface CategoryQuestions {
  kategoria: string;
  etykieta: string;
  pytania: string[];
}

export function questionsPath(): string {
  return process.env.QUESTIONS_PATH
    ? path.resolve(process.env.QUESTIONS_PATH)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "data", "questions-by-category.json");
}

export async function loadQuestionsByCategory(): Promise<QuestionsByCategory> {
  try {
    const p = FileSchema.safeParse(JSON.parse(await fs.readFile(questionsPath(), "utf8")));
    return p.success ? p.data.kategorie : {};
  } catch {
    return {};
  }
}

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Pytania dla kategorii (w kolejności pierwszego wystąpienia), najwyżej `perCategory` na kategorię,
 * z pominięciem pytań z `exclude` (np. pytań z flag i z bazy modelu).
 */
export function questionsForCategories(all: QuestionsByCategory, categories: string[], exclude: string[] = [], perCategory = 3): CategoryQuestions[] {
  const seen = new Set(exclude.map(normalizeQuestion));
  const out: CategoryQuestions[] = [];
  for (const kat of [...new Set(categories)]) {
    const entry = all[kat];
    if (!entry) continue;
    const pytania: string[] = [];
    for (const q of entry.pytania) {
      const n = normalizeQuestion(q);
      if (seen.has(n)) continue;
      seen.add(n);
      pytania.push(q);
      if (pytania.length >= perCategory) break;
    }
    if (pytania.length) out.push({ kategoria: kat, etykieta: entry.etykieta, pytania });
  }
  return out;
}
