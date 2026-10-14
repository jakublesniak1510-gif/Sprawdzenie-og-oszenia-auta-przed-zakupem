import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CarModelSchema, type CarModel } from "./models";
import { QuickTestInputSchema, matchPriceRange, quickTest, topFaults } from "./quick-test";
import type { RedFlag } from "./red-flags";

const base = CarModelSchema.parse(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", "fixtures", "example-model.json"), "utf8")));
const withPrices: CarModel = {
  ...base,
  price_ranges: [
    { years: [2012, 2014], km_max: 200000, price_pln: [30000, 42000] },
    { years: [2012, 2014], km_max: 350000, price_pln: [22000, 33000] },
    { years: [2015, 2017], km_max: 200000, price_pln: [40000, 55000] },
  ],
};
const flags: RedFlag[] = [
  { id: "brak-vin", category: "dokumenty", patterns: [], explanation: "", severity: "srednia", neutral_wording: "Brak VIN w ogłoszeniu.", question_for_seller: "Czy poda Pan VIN?" },
  { id: "pilne", category: "presja", patterns: ["pilnie sprzedam"], explanation: "", severity: "niska", neutral_wording: "Presja czasu.", question_for_seller: undefined },
  { id: "zalany", category: "szkoda", patterns: ["/zalan\\p{L}*/iu"], explanation: "", severity: "wysoka", neutral_wording: "Możliwe zalanie.", question_for_seller: "Czy auto było zalane?" },
];
const input = (o: Record<string, unknown>) => QuickTestInputSchema.parse(o);
const TEXT = "Pilnie sprzedam VW Golf 7 1.6 TDI 2015, auto było lekko zalane, tel. 600 100 200, cena do negocjacji.";

describe("szybki test", () => {
  it("rozpoznaje model, zwraca flagi wg wagi, 3 usterki i brak VIN", () => {
    const r = quickTest(input({ tekst: TEXT, cena: "45 000", przebieg: 180000, rocznik: 2015 }), [withPrices], flags);
    expect(r.rozpoznany).toMatchObject({ model_id: "vw-golf-7", silnik: "1.6 TDI CR (CLHA/CXXB)" });
    expect(r.flagi.map((f) => f.id)).toEqual(["zalany", "brak-vin", "pilne"]);
    expect(r.usterki_top3).toHaveLength(3);
    const order = { wysoka: 0, srednia: 1, niska: 2 } as const;
    for (let i = 1; i < 3; i++) expect(order[r.usterki_top3[i].waga]).toBeGreaterThanOrEqual(order[r.usterki_top3[i - 1].waga]);
    expect(r.brak_vin).toBe(true);
    expect(r.nastepny_krok).toMatch(/VIN/);
    expect(r.cena).toMatchObject({ pozycja: "w_normie", widelki_pln: [40000, 55000] });
  });

  it("cena poniżej / powyżej widełek", () => {
    const low = quickTest(input({ tekst: TEXT, cena: 25000, przebieg: 150000, rocznik: 2015 }), [withPrices], flags);
    expect(low.cena.pozycja).toBe("ponizej");
    expect(low.cena.komentarz).toMatch(/niższa/);
    const high = quickTest(input({ tekst: TEXT, cena: 70000, rocznik: 2015 }), [withPrices], flags);
    expect(high.cena.pozycja).toBe("powyzej");
  });

  it("brak pola price_ranges / brak ceny / nierozpoznany model → brak_danych", () => {
    expect(quickTest(input({ tekst: TEXT, cena: 45000, rocznik: 2015 }), [base], flags).cena.pozycja).toBe("brak_danych");
    expect(quickTest(input({ tekst: TEXT, rocznik: 2015 }), [withPrices], flags).cena.pozycja).toBe("brak_danych");
    const r = quickTest(input({ tekst: "Sprzedam Fiat 126p, stan dobry, garażowany od lat, VIN ZFA12600000123456." }), [withPrices], flags);
    expect(r.rozpoznany).toBeNull();
    expect(r.usterki_top3).toEqual([]);
    expect(r.cena.pozycja).toBe("brak_danych");
    expect(r.brak_vin).toBe(false);
  });

  it("rocznik z tekstu, gdy nie podano w formularzu", () => {
    const r = quickTest(input({ tekst: TEXT, cena: 45000 }), [withPrices], flags);
    expect(r.cena.pozycja).toBe("w_normie");
  });

  it("dopasowanie widełek: pasmo przebiegu i fallback", () => {
    const pr = withPrices.price_ranges;
    expect(matchPriceRange(pr, 2013, 150000)).toEqual([30000, 42000]);
    expect(matchPriceRange(pr, 2013, 300000)).toEqual([22000, 33000]);
    expect(matchPriceRange(pr, 2013, 500000)).toEqual([22000, 33000]);
    expect(matchPriceRange(pr, 2013, null)).toEqual([22000, 42000]);
    expect(matchPriceRange(pr, 2020, 100000)).toBeNull();
    expect(matchPriceRange(undefined, 2013, 1)).toBeNull();
  });

  it("błędne price_ranges nie wykluczają modelu z bazy", () => {
    const parsed = CarModelSchema.safeParse({ ...base, price_ranges: [{ years: "zle" }] });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.price_ranges).toBeUndefined();
  });

  it("topFaults bez silnika = tylko usterki wspólne", () => {
    expect(topFaults(base, null).every((f) => base.common_faults.includes(f))).toBe(true);
  });

  it("walidacja wejścia", () => {
    expect(QuickTestInputSchema.safeParse({ tekst: "krótko" }).success).toBe(false);
    expect(QuickTestInputSchema.parse({ tekst: "x".repeat(40), cena: "" }).cena).toBeNull();
  });
});
