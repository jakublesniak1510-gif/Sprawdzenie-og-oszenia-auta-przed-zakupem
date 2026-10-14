import { describe, expect, it } from "vitest";
import { UnsafeProductionConfigError, checkProductionSafety } from "./startup";

const KEY = "d".repeat(64);
const OK = { NODE_ENV: "production", IMAGE_ENCRYPTION_KEY: KEY, APP_URL: "https://sprawdz.example.pl" };

describe("blokady produkcyjne", () => {
  it("w dev nic nie blokuje", () => {
    expect(checkProductionSafety({ NODE_ENV: "development", DEV_SKIP_PAYMENT: "1", AI_MOCK: "1" } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("produkcja + DEV_SKIP_PAYMENT=1 lub AI_MOCK=1 → odmowa startu", () => {
    expect(() => checkProductionSafety({ ...OK, DEV_SKIP_PAYMENT: "1" } as NodeJS.ProcessEnv)).toThrow(UnsafeProductionConfigError);
    expect(() => checkProductionSafety({ ...OK, AI_MOCK: "1" } as NodeJS.ProcessEnv)).toThrow(/AI_MOCK/);
    expect(() => checkProductionSafety({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/IMAGE_ENCRYPTION_KEY/);
    expect(() => checkProductionSafety({ ...OK, RATE_LIMIT_DISABLED: "1" } as NodeJS.ProcessEnv)).toThrow(/RATE_LIMIT_DISABLED/);
    expect(() => checkProductionSafety({ ...OK, APP_URL: "" } as NodeJS.ProcessEnv)).toThrow(/APP_URL/);
    expect(() => checkProductionSafety({ ...OK, APP_URL: "http://localhost:3000" } as NodeJS.ProcessEnv)).toThrow(/APP_URL/);
    expect(() => checkProductionSafety({ ...OK, APP_URL: "http://127.0.0.1:3000" } as NodeJS.ProcessEnv)).toThrow(/APP_URL/);
    expect(() => checkProductionSafety({ ...OK, NEXT_PUBLIC_BASE_URL: "http://localhost:3000" } as NodeJS.ProcessEnv)).toThrow(/NEXT_PUBLIC_BASE_URL/);
    expect(checkProductionSafety({ ...OK, NEXT_PUBLIC_BASE_URL: "https://sprawdz.example.pl" } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("ALLOW_UNSAFE_PROD=1 pozwala wystartować (z ostrzeżeniem)", () => {
    const p = checkProductionSafety({ ...OK, AI_MOCK: "1", ALLOW_UNSAFE_PROD: "1" } as NodeJS.ProcessEnv);
    expect(p).toHaveLength(1);
  });

  it("poprawna konfiguracja produkcyjna przechodzi", () => {
    expect(checkProductionSafety({ ...OK, DEV_SKIP_PAYMENT: "0", AI_MOCK: "0" } as NodeJS.ProcessEnv)).toEqual([]);
  });
});
