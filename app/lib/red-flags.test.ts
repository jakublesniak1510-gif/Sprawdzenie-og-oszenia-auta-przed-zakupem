import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchRedFlags, type RedFlag } from "./red-flags";

// Prawdziwa baza pracownika B – łapie regresje formatu wzorców.
const FILE = path.resolve(import.meta.dirname, "..", "..", "data", "red-flags.json");
const flags: RedFlag[] = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
const VIN = "WVWZZZAUZFW123456";
const ids = (text: string) => matchRedFlags(text, flags).map((h) => h.id);

describe.skipIf(flags.length === 0)("matchRedFlags na data/red-flags.json", () => {
  it("baza zawiera regexy w formie /…/flagi", () => {
    expect(flags.some((f) => f.patterns.some((p) => /^\/.+\/[a-z]*$/.test(p)))).toBe(true);
  });

  it("regex z bazy trafia: „auto z usa”", () => {
    expect(ids(`Auto z usa, ładne. VIN ${VIN}`)).toContain("import-usa");
    // tylko regex /\busa\b/iu (żadna fraza nie pasuje do „Import: USA”)
    const hit = matchRedFlags(`Import: USA, VIN ${VIN}`, flags).find((h) => h.id === "import-usa");
    expect(hit?.trafienie).toBe("usa");
  });

  it("regex z zaprzeczeniem trafia bez zaprzeczenia: „silnik dymi”", () => {
    expect(ids(`Silnik lekko dymi na zimnym. VIN ${VIN}`)).toContain("dymi-stuki");
    expect(ids(`Samochód zalany w powodzi. VIN ${VIN}`)).toContain("po-szkodzie-zalany");
    expect(ids(`Samochód nie zalany, nie uszkodzony. VIN ${VIN}`)).not.toContain("po-szkodzie-zalany");
  });

  it("zaprzeczenia nie trafiają: „nie dymi, nie stuka”", () => {
    const hits = ids(`Silnik nie dymi, nie stuka, nie bierze oleju. VIN ${VIN}`);
    expect(hits).not.toContain("dymi-stuki");
    expect(hits).toEqual([]);
  });

  it("fraza z kropką/znakami regex trafia literalnie, a nie jako regex", () => {
    const withDot = flags.flatMap((f) => f.patterns.filter((p) => !p.startsWith("/") && /[.()?+*]/.test(p)).map((p) => ({ id: f.id, p })));
    expect(withDot.length).toBeGreaterThan(0);
    for (const { id, p } of withDot) expect(ids(`xx ${p} xx`)).toContain(id);
    // kropka nie działa jak „dowolny znak”
    const sample = withDot.find(({ p }) => p.includes("."));
    if (sample) expect(ids(`xx ${sample.p.replace(".", "X")} xx VIN ${VIN}`)).not.toContain(sample.id);
  });

  it("brak VIN → flaga brak-vin (jedna, bez duplikatu)", () => {
    const hits = ids("Sprzedam auto, VIN na prośbę.");
    expect(hits.filter((i) => i === "brak-vin")).toHaveLength(1);
    expect(ids("Sprzedam auto w dobrym stanie.")).toContain("brak-vin");
  });

  it("obecny VIN → brak flagi brak-vin", () => {
    expect(ids(`Sprzedam auto. VIN: ${VIN}`)).not.toContain("brak-vin");
  });

  it("flagi z pustym patterns nie są zgłaszane mechanicznie", () => {
    const empty = new Set(flags.filter((f) => f.patterns.length === 0).map((f) => f.id));
    expect(empty.size).toBeGreaterThan(0);
    expect(ids("Dowolny tekst bez VIN, przebieg 50 000 km, stan idealny").some((i) => empty.has(i))).toBe(false);
  });

  it("wszystkie regexy z bazy się kompilują", () => {
    for (const f of flags) for (const p of f.patterns) {
      const m = /^\/(.+)\/([a-z]*)$/s.exec(p);
      if (m) expect(() => new RegExp(m[1], m[2])).not.toThrow();
    }
  });
});

describe("matchRedFlags – zły regex nie wywraca dopasowania", () => {
  it("pomija błędny wzorzec", () => {
    const f: RedFlag = { id: "x", category: "inne", patterns: ["/([/i", "okazja"], explanation: "", severity: "niska", neutral_wording: "" };
    expect(matchRedFlags("super okazja", [f]).map((h) => h.id)).toEqual(["x"]);
  });
});
