import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPUTED_FLAG_IDS, computeFlags, makeFromVin, normalizeMake, type ComputedFlagsInput } from "./computed-flags";
import { CarModelSchema, type CarModel } from "./models";
import type { RedFlag } from "./red-flags";

const FLAGS_FILE = path.resolve(import.meta.dirname, "..", "..", "data", "red-flags.json");
const realFlags: RedFlag[] = fs.existsSync(FLAGS_FILE) ? JSON.parse(fs.readFileSync(FLAGS_FILE, "utf8")) : [];
const stub = (id: string, category: string): RedFlag => ({ id, category, patterns: [], explanation: "", severity: "srednia", neutral_wording: `NW ${id}`, question_for_seller: `Q ${id}?` });
const flags: RedFlag[] = [...COMPUTED_FLAG_IDS.map((id) => stub(id, "cena")), stub("stan-idealny", "cena")];

const golf: CarModel = {
  ...CarModelSchema.parse(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "..", "fixtures", "example-model.json"), "utf8"))),
  price_ranges: [{ years: [2015, 2016], km_max: 200000, price_pln: [41000, 54000] }],
};
const base: ComputedFlagsInput = { tekst: "Sprzedam Golfa", cena: 45000, przebieg: 150000, rocznik: 2015, model: golf, trafione: [], rokBiezacy: 2026 };
const ids = (i: Partial<ComputedFlagsInput>, f = flags) => computeFlags({ ...base, ...i }, f).map((h) => h.id);

describe("cena-ponizej-widelek / opis-idealny-cena-niska", () => {
  it("cena > 15% poniżej dolnej granicy → flaga; w normie lub tuż poniżej → brak", () => {
    expect(ids({ cena: 30000 })).toContain("cena-ponizej-widelek");
    expect(ids({ cena: 45000 })).not.toContain("cena-ponizej-widelek");
    expect(ids({ cena: 38000 })).not.toContain("cena-ponizej-widelek"); // ok. 7% poniżej – w granicy tolerancji
  });
  it("przebieg powyżej km_max → niska cena uzasadniona, brak flagi; brak widełek/rocznika/ceny → brak oceny", () => {
    expect(ids({ cena: 30000, przebieg: 260000 })).not.toContain("cena-ponizej-widelek");
    expect(ids({ cena: 30000, rocznik: 2019 })).not.toContain("cena-ponizej-widelek");
    expect(ids({ cena: 30000, model: { ...golf, price_ranges: undefined } })).toEqual([]);
    expect(ids({ cena: null })).toEqual([]);
  });
  it("„stan idealny” + niska cena → także opis-idealny-cena-niska", () => {
    expect(ids({ cena: 30000, trafione: [{ id: "stan-idealny" }] })).toEqual(["cena-ponizej-widelek", "opis-idealny-cena-niska"]);
    expect(ids({ cena: 45000, trafione: [{ id: "stan-idealny" }] })).not.toContain("opis-idealny-cena-niska");
  });
});

describe("przebieg-roczny-nietypowy", () => {
  it("< 6 tys. lub > 40 tys. km/rok", () => {
    expect(ids({ przebieg: 30000 })).toContain("przebieg-roczny-nietypowy"); // 11 lat → 2,7 tys./rok
    expect(ids({ przebieg: 500000 })).toContain("przebieg-roczny-nietypowy"); // 45 tys./rok
    expect(ids({ przebieg: 150000 })).not.toContain("przebieg-roczny-nietypowy");
    expect(ids({ przebieg: 3000, rocznik: 2025 })).not.toContain("przebieg-roczny-nietypowy"); // nowe auto
    expect(ids({ przebieg: null })).not.toContain("przebieg-roczny-nietypowy");
  });
  it("opis trafienia podaje średnią roczną", () => {
    expect(computeFlags({ ...base, przebieg: 500000 }, flags)[0].trafienie).toMatch(/rocznie/);
  });
});

describe("vin-vs-model", () => {
  it("jawny konflikt WMI ↔ marka → flaga", () => {
    expect(ids({ tekst: "VIN WBA3A5C51DF123456" })).toContain("vin-vs-model");
  });
  it("zgodny WMI, nieznany WMI (np. z USA) lub brak modelu → brak flagi", () => {
    expect(ids({ tekst: "VIN WVWZZZAUZFW123456" })).not.toContain("vin-vs-model");
    expect(ids({ tekst: "VIN 3VWD17AJ5FM123456" })).not.toContain("vin-vs-model");
    expect(ids({ tekst: "VIN WBA3A5C51DF123456", model: null })).not.toContain("vin-vs-model");
  });
  it("słownik WMI i normalizacja marek", () => {
    expect(makeFromVin("JTDKB20U793123456")).toBe("toyota");
    expect(makeFromVin("TMBJJ7NE5F0123456")).toBe("skoda");
    expect(makeFromVin("1FADP3F20EL123456")).toBeNull();
    expect(normalizeMake("Škoda")).toBe("skoda");
    expect(normalizeMake("Mercedes-Benz")).toBe("mercedes");
    expect(normalizeMake("VW")).toBe("volkswagen");
  });
});

describe.skipIf(realFlags.length === 0)("z prawdziwą bazą data/red-flags.json", () => {
  it("wszystkie 4 flagi istnieją w bazie i treść jest brana 1:1", () => {
    for (const id of COMPUTED_FLAG_IDS) expect(realFlags.some((f) => f.id === id)).toBe(true);
    const hits = [
      ...computeFlags({ ...base, cena: 30000, przebieg: 30000, tekst: "VIN WBA3A5C51DF123456", trafione: [{ id: "stan-idealny" }] }, realFlags),
    ];
    expect(hits.map((h) => h.id).sort()).toEqual([...COMPUTED_FLAG_IDS].sort());
    for (const h of hits) {
      const src = realFlags.find((f) => f.id === h.id)!;
      expect(h.neutral_wording).toBe(src.neutral_wording);
      expect(h.question_for_seller).toBe(src.question_for_seller);
    }
  });
});
