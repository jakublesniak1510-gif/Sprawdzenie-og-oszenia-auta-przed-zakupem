import { describe, expect, it } from "vitest";
import { UnsafeProductionConfigError, checkProductionSafety } from "./startup";

const KEY = "d".repeat(64);

describe("blokady produkcyjne", () => {
  it("w dev nic nie blokuje", () => {
    expect(checkProductionSafety({ NODE_ENV: "development", DEV_SKIP_PAYMENT: "1", AI_MOCK: "1" } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("produkcja + DEV_SKIP_PAYMENT=1 lub AI_MOCK=1 → odmowa startu", () => {
    expect(() => checkProductionSafety({ NODE_ENV: "production", DEV_SKIP_PAYMENT: "1", IMAGE_ENCRYPTION_KEY: KEY } as NodeJS.ProcessEnv)).toThrow(UnsafeProductionConfigError);
    expect(() => checkProductionSafety({ NODE_ENV: "production", AI_MOCK: "1", IMAGE_ENCRYPTION_KEY: KEY } as NodeJS.ProcessEnv)).toThrow(/AI_MOCK/);
    expect(() => checkProductionSafety({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/IMAGE_ENCRYPTION_KEY/);
  });

  it("ALLOW_UNSAFE_PROD=1 pozwala wystartować (z ostrzeżeniem)", () => {
    const p = checkProductionSafety({ NODE_ENV: "production", AI_MOCK: "1", ALLOW_UNSAFE_PROD: "1", IMAGE_ENCRYPTION_KEY: KEY } as NodeJS.ProcessEnv);
    expect(p).toHaveLength(1);
  });

  it("poprawna konfiguracja produkcyjna przechodzi", () => {
    expect(checkProductionSafety({ NODE_ENV: "production", DEV_SKIP_PAYMENT: "0", AI_MOCK: "0", IMAGE_ENCRYPTION_KEY: KEY } as NodeJS.ProcessEnv)).toEqual([]);
  });
});
