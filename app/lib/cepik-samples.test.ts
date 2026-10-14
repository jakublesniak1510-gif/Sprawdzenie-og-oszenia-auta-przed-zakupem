import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeMileage, parseCepik } from "./cepik";

/**
 * Próbki formatów historii pojazdu (dane fikcyjne) od pracownika B: data/samples/cepik/<nazwa>.txt
 * + oczekiwany wynik <nazwa>.expected.json ({odczyty, pierwszaRejestracja, pierwszaRejestracjaPl, cofniecia, sygnaly}).
 * Pole `uwagi` w expected to komentarz autora próbki (nie dosłowny wynik parsera) – nie porównujemy go.
 */
const DIR = path.resolve(import.meta.dirname, "..", "..", "data", "samples", "cepik");
const samples = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".txt")).sort() : [];

describe.skipIf(samples.length === 0)("parser CEPiK na próbkach data/samples/cepik", () => {
  it.each(samples)("%s", (file) => {
    const text = fs.readFileSync(path.join(DIR, file), "utf8");
    const r = parseCepik(text);
    const expFile = path.join(DIR, file.replace(/\.txt$/, ".expected.json"));
    if (!fs.existsSync(expFile)) {
      expect(r.odczyty.length).toBeGreaterThan(0);
      return;
    }
    const exp = JSON.parse(fs.readFileSync(expFile, "utf8"));
    if (exp.odczyty) expect(r.odczyty).toEqual(exp.odczyty);
    if ("pierwszaRejestracja" in exp) expect(r.pierwszaRejestracja).toBe(exp.pierwszaRejestracja);
    if ("pierwszaRejestracjaPl" in exp) expect(r.pierwszaRejestracjaPl).toBe(exp.pierwszaRejestracjaPl);
    if (exp.cofniecia) expect(analyzeMileage(r.odczyty, null).cofniecia).toEqual(exp.cofniecia);
    if (exp.sygnaly) expect([...r.sygnaly].sort()).toEqual([...exp.sygnaly].sort());
    // Każdy sygnał ma uwagę dla modelu (po polsku).
    expect(r.uwagi.length).toBeGreaterThanOrEqual(r.sygnaly.length);
  });
});
