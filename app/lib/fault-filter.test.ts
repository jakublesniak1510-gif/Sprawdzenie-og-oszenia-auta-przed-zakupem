import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTOMAT_NOTE, detectGearbox, faultGearbox, filterCommonFaults, isDieselOnlyFault, modelForListing } from "./fault-filter";
import { CarModelSchema, detectModels, type CarModel, type Fault } from "./models";
import { topFaults } from "./quick-test";

const GOLF_FILE = path.resolve(import.meta.dirname, "..", "..", "data", "models", "vw-golf-7.json");
const FIXTURE = path.resolve(import.meta.dirname, "..", "fixtures", "example-model.json");
const golf: CarModel = CarModelSchema.parse(JSON.parse(fs.readFileSync(fs.existsSync(GOLF_FILE) ? GOLF_FILE : FIXTURE, "utf8")));
const isDsg = (f: Fault) => /dsg/i.test(f.title);
const engineFor = (text: string) => detectModels(text, [golf])[0]?.engineCode ?? null;

const fault = (title: string, symptoms = ""): Fault => ({ title, symptoms, severity: "srednia", cost_pln: [100, 200], check_at_inspection: "" });

describe("detectGearbox", () => {
  it.each([
    ["Golf 1.4 TSI, skrzynia manualna 6-biegowa", "manual"],
    ["skrzynia ręczna, hamulec ręczny sprawny", "manual"],
    ["6-biegowa skrzynia DSG", "automat"],
    ["automat, S tronic", "automat"],
    ["Mercedes 9G-Tronic", "automat"],
    ["klimatyzacja automatyczna, manual", "manual"],
    ["klimatyzacja automatyczna, hamulec ręczny", null],
    ["Sprzedam auto w dobrym stanie", null],
    ["skrzynia biegów automatyczna", "automat"],
  ] as const)("%s → %s", (t, exp) => expect(detectGearbox(t)).toBe(exp));
});

describe("klasyfikacja usterek", () => {
  it("automat / manual / paliwo", () => {
    expect(faultGearbox(fault("Skrzynia DSG DQ200 – mechatronika"))).toBe("automat");
    expect(faultGearbox(fault("Skrzynia Easytronic (zautomatyzowana manualna)"))).toBe("automat");
    expect(faultGearbox(fault("Skrzynia manualna M32 (6-biegowa) – łożyska"))).toBe("manual");
    expect(faultGearbox(fault("Koło dwumasowe i sprzęgło"))).toBeNull(); // sprzęgło bez wzmianki o manualu – dotyczy obu
    expect(isDieselOnlyFault(fault("Zapchany filtr DPF"))).toBe(true);
    expect(isDieselOnlyFault(fault("Aktywny układ", "Integral Active Steering"))).toBe(false); // „egr” w środku słowa
  });

  it("filtr: manual odrzuca automat, automat odrzuca manual, benzyna odrzuca DPF/EGR, nieznane = wszystko z dopiskiem", () => {
    const list = [fault("Skrzynia DSG"), fault("Skrzynia manualna – łożyska"), fault("Zawór EGR"), fault("Zawieszenie")];
    const titles = (g: "manual" | "automat" | null, fuel: "benzyna" | "diesel" | null) => filterCommonFaults(list, { gearbox: g, fuel }).map((x) => x.fault.title);
    expect(titles("manual", null)).toEqual(["Skrzynia manualna – łożyska", "Zawór EGR", "Zawieszenie"]);
    expect(titles("automat", null)).toEqual(["Skrzynia DSG", "Zawór EGR", "Zawieszenie"]);
    expect(titles(null, "benzyna")).toEqual(["Skrzynia DSG", "Skrzynia manualna – łożyska", "Zawieszenie"]);
    expect(titles(null, "diesel")).toHaveLength(4);
    expect(filterCommonFaults(list, { gearbox: null, fuel: null }).find((x) => x.fault.title === "Skrzynia DSG")?.tylkoAutomat).toBe(true);
  });
});

describe("Golf VII – szybki test i prompt", () => {
  const MANUAL = "Sprzedam VW Golf VII 1.4 TSI 2016, skrzynia manualna 6-biegowa, serwisowany, stan dobry.";
  const DSG = "Sprzedam VW Golf VII 1.6 TDI 2015, skrzynia DSG, serwisowany, stan dobry.";
  const UNKNOWN = "Sprzedam VW Golf VII 1.6 TDI 2015, serwisowany, stan dobry.";

  it("1.4 TSI manual – brak usterek DSG (szybki test i usterki wspólne do promptu)", () => {
    const code = engineFor(MANUAL);
    expect(code).toMatch(/1\.4 TSI/);
    expect(topFaults(golf, code, 50, MANUAL).some(isDsg)).toBe(false);
    expect(modelForListing(golf, MANUAL, code).common_faults.some(isDsg)).toBe(false);
  });

  it("1.6 TDI DSG – usterki DSG są, bez dopisku", () => {
    const code = engineFor(DSG);
    expect(code).toMatch(/1\.6 TDI/);
    const all = topFaults(golf, code, 50, DSG);
    expect(all.some(isDsg)).toBe(true);
    expect(all.some((f) => f.title.includes(AUTOMAT_NOTE))).toBe(false);
    expect(modelForListing(golf, DSG, code).common_faults.some(isDsg)).toBe(true);
  });

  it("skrzynia nieznana – usterki DSG zostają z dopiskiem „(dotyczy wersji z automatem)”", () => {
    const all = topFaults(golf, engineFor(UNKNOWN), 50, UNKNOWN);
    const dsg = all.filter(isDsg);
    expect(dsg.length).toBeGreaterThan(0);
    for (const f of dsg) expect(f.title.endsWith(AUTOMAT_NOTE)).toBe(true);
    // w modelu do promptu tytuły bez zmian (postProcess dopasowuje usterki po tytule z bazy)
    expect(modelForListing(golf, UNKNOWN, null).common_faults.filter(isDsg).every((f) => !f.title.includes(AUTOMAT_NOTE))).toBe(true);
  });
});
