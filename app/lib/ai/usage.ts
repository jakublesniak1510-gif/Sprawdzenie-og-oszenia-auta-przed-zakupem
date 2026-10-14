import { getDb, nowIso } from "../db";
import { estimateCostUsd } from "./pricing";
import type { AiUsage } from "./types";

/** Zapisuje zużycie tokenów do tabeli `ai_usage`. Nie rzuca wyjątków. */
export function recordAiUsage(reportId: string | null, u: AiUsage): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO ai_usage (report_id, model, input_tokens, cached_tokens, cache_write_tokens, output_tokens, cost_usd_est, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(reportId, u.model, u.input_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens, u.output_tokens, estimateCostUsd(u), nowIso());
    console.log(
      `[ai] usage ${u.model}: input=${u.input_tokens} cache_read=${u.cache_read_input_tokens} cache_write=${u.cache_creation_input_tokens} output=${u.output_tokens}`,
    );
  } catch (e) {
    console.warn("[ai] Nie zapisano zużycia tokenów:", (e as Error).message);
  }
}
