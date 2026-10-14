import type { AiUsage } from "./types";

/**
 * Cennik Claude API (USD za 1 mln tokenów) – do SZACOWANIA kosztu raportu w panelu admina.
 * Źródło: skill `claude-api`, tabela modeli z dnia 2026-10-06 (ceny pierwszej strony API Anthropic).
 * Aktualizuj przy zmianie cen: https://platform.claude.com/docs/en/about-claude/pricing
 *
 * - zapis do cache (TTL 5 min) = 1,25 × cena wejścia,
 * - odczyt z cache = `cacheRead` (dla nowych modeli podany wprost; dla pozostałych ~0,1 × cena wejścia),
 * - tokeny rozumowania (thinking) są liczone jako wyjście (`output_tokens`).
 */
export const PRICING_DATE = "2026-10-06";

export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1.0 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

export const CACHE_WRITE_MULTIPLIER = 1.25;

/** Dopasowanie po najdłuższym prefiksie (np. „claude-sonnet-5-5-…”, „anthropic.claude-opus-5-5”). */
export function priceFor(model: string): ModelPrice | null {
  const m = model.replace(/^anthropic\./, "").replace(/@.*$/, "");
  let best: string | null = null;
  for (const k of Object.keys(PRICES)) if (m.startsWith(k) && (!best || k.length > best.length)) best = k;
  return best ? PRICES[best] : null;
}

/** Szacowany koszt w USD; null, gdy modelu nie ma w cenniku. */
export function estimateCostUsd(u: AiUsage): number | null {
  const p = priceFor(u.model);
  if (!p) return null;
  const usd =
    (u.input_tokens * p.input +
      u.cache_creation_input_tokens * p.input * CACHE_WRITE_MULTIPLIER +
      u.cache_read_input_tokens * p.cacheRead +
      u.output_tokens * p.output) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
