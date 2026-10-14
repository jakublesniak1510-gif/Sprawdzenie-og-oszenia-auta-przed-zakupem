import { describe, expect, it } from "vitest";
import { estimateCostUsd, priceFor } from "./pricing";

describe("cennik", () => {
  it("liczy koszt z cache read/write", () => {
    // Sonnet 5.5: 2 $/MTok wejście, 10 $/MTok wyjście, 0,20 $/MTok odczyt cache, zapis 1,25×
    const usd = estimateCostUsd({ model: "claude-sonnet-5-5", input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(usd).toBeCloseTo(2 + 0.2 + 2.5 + 10, 6);
  });
  it("dopasowanie po prefiksie, nieznany model → null", () => {
    expect(priceFor("claude-opus-5-5")?.input).toBe(4);
    expect(priceFor("claude-opus-5")?.input).toBe(5);
    expect(estimateCostUsd({ model: "gpt-x", input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 })).toBeNull();
  });
});
