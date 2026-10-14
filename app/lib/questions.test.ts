import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getGlossary } from "./glossary";
import { loadQuestionsByCategory, normalizeQuestion, questionsForCategories, type QuestionsByCategory } from "./questions";
import { buildUserText } from "./ai/prompt";
import type { AiReportRequest } from "./ai/types";

const all: QuestionsByCategory = {
  cena: { etykieta: "Cena", pytania: ["Dlaczego tak tanio?", "Czy cena jest do negocjacji?", "Czy auto ma szkody?", "Czwarte?"] },
  historia: { etykieta: "Historia", pytania: ["Czy auto miało szkody?"] },
};

describe("pytania wg kategorii", () => {
  it("dobiera ≤ 3 pytania na kategorię, pomija już zadane (po normalizacji) i duplikaty między kategoriami", () => {
    const r = questionsForCategories(all, ["cena", "historia", "cena", "nieznana"], ["dlaczego TAK tanio"]);
    expect(r).toEqual([{ kategoria: "cena", etykieta: "Cena", pytania: ["Czy cena jest do negocjacji?", "Czy auto ma szkody?", "Czwarte?"] }, { kategoria: "historia", etykieta: "Historia", pytania: ["Czy auto miało szkody?"] }]);
    expect(normalizeQuestion("Czy auto miało szkody?")).toBe("czy auto mialo szkody");
  });

  it("wczytuje data/questions-by-category.json (jeśli jest)", async () => {
    const q = await loadQuestionsByCategory();
    const file = path.resolve(process.cwd(), "..", "data", "questions-by-category.json");
    if (fs.existsSync(file)) expect(Object.keys(q).length).toBeGreaterThan(0);
  });

  it("trafiają do promptu w <pytania_uzupelniajace>", () => {
    const req = {
      oferta: "raport", tekstOgloszenia: "x", deklaracje: { cena_pln: null, przebieg_km: null, rocznik: null }, historiaPojazduTekst: "",
      odczyty: [], analizaPrzebiegu: { cofniecia: [], deklarowanyNizszyOdOstatniego: false, ostatni: null }, podobneOferty: [],
      model: null, silnikKod: null, flagi: [], zdjecia: [], pytaniaKategorii: [{ kategoria: "cena", etykieta: "Cena", pytania: ["Czy cena jest do negocjacji?"] }],
    } as AiReportRequest;
    const t = buildUserText(req);
    expect(t).toContain("<pytania_uzupelniajace>");
    expect(t).toContain("Czy cena jest do negocjacji?");
    expect(buildUserText({ ...req, pytaniaKategorii: [] })).not.toContain("<pytania_uzupelniajace>");
  });
});

describe("słowniczek", () => {
  it("getGlossary zwraca wpisy z data/glossary.json albo [] przy braku pliku", async () => {
    const file = path.resolve(process.cwd(), "..", "data", "glossary.json");
    const g = await getGlossary();
    if (fs.existsSync(file)) {
      expect(g.length).toBeGreaterThan(10);
      expect(g[0]).toEqual(expect.objectContaining({ term: expect.any(String), short: expect.any(String), aliases: expect.any(Array) }));
    }
    process.env.GLOSSARY_PATH = "/nonexistent/glossary.json";
    expect(await getGlossary()).toEqual([]);
    delete process.env.GLOSSARY_PATH;
  });
});
