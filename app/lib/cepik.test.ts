import { describe, expect, it } from "vitest";
import { analyzeMileage, normalizeDate, parseHistoriaPojazdu } from "./cepik";

describe("parseHistoriaPojazdu", () => {
  it("wyciąga pary data + km z luźnego tekstu", () => {
    const t = `Oś czasu
    12.03.2018 Badanie techniczne – pozytywne. Stan licznika: 98 450 km
    15.03.2019 Badanie techniczne – pozytywne. Stan licznika 121 300 km
    2020-03-20 Badanie techniczne. Odczyt: 143200 km`;
    expect(parseHistoriaPojazdu(t)).toEqual([
      { data: "2018-03-12", km: 98450 },
      { data: "2019-03-15", km: 121300 },
      { data: "2020-03-20", km: 143200 },
    ]);
  });

  it("pusty tekst = brak odczytów", () => {
    expect(parseHistoriaPojazdu("  ")).toEqual([]);
  });

  it("odrzuca liczby bez daty w pobliżu", () => {
    expect(parseHistoriaPojazdu("Przebieg 150 000 km")).toEqual([]);
  });
});

describe("normalizeDate", () => {
  it.each([
    ["2021-05-04", "2021-05-04"],
    ["4.5.2021", "2021-05-04"],
    ["04/05/2021", "2021-05-04"],
    ["bzdura", null],
  ])("%s", (i, o) => expect(normalizeDate(i)).toBe(o));
});

describe("analyzeMileage", () => {
  it("wykrywa cofnięcie i deklarowany przebieg niższy od ostatniego odczytu", () => {
    const a = analyzeMileage(
      [
        { data: "2019-01-01", km: 150000 },
        { data: "2020-01-01", km: 120000 },
        { data: "2021-01-01", km: 160000 },
      ],
      140000,
    );
    expect(a.cofniecia).toHaveLength(1);
    expect(a.deklarowanyNizszyOdOstatniego).toBe(true);
    expect(a.ostatni?.km).toBe(160000);
  });
});
