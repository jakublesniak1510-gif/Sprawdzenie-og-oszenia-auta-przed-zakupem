import { describe, expect, it } from "vitest";
import { analyzeMileage, normalizeDate, parseCepik, parseHistoriaPojazdu } from "./cepik";

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

describe("parseCepik – uwagi i pierwsza rejestracja", () => {
  it("import, data pierwszej rejestracji za granicą i w Polsce", () => {
    const t = `Dane pojazdu
Data pierwszej rejestracji za granicą: 14.06.2014
Data pierwszej rejestracji w Polsce: 02.03.2019
Pojazd sprowadzony z zagranicy
12.03.2020 Badanie techniczne – wynik pozytywny. Stan licznika: 143 200 km
10.03.2021 Badanie techniczne – wynik negatywny. Stan licznika: 158 900 km`;
    const r = parseCepik(t);
    expect(r.pierwszaRejestracja).toBe("2014-06-14");
    expect(r.pierwszaRejestracjaPl).toBe("2019-03-02");
    expect(r.odczyty.map((o) => o.km)).toEqual([143200, 158900]);
    expect(r.uwagi.join(" ")).toMatch(/sprowadzony/);
    expect(r.uwagi.join(" ")).toMatch(/negatywny wynik badania/);
  });

  it("wyrejestrowanie i kradzież – ale nie przy zaprzeczeniu", () => {
    const pos = parseCepik("Status rejestracji: pojazd wyrejestrowany\nKradzież: pojazd figuruje jako kradziony");
    expect(pos.uwagi.some((u) => /wyrejestrowaniu/.test(u))).toBe(true);
    expect(pos.uwagi.some((u) => /kradzieży/.test(u))).toBe(true);
    const neg = parseCepik("Pojazd nie figuruje jako kradziony\nCzy pojazd jest wyrejestrowany: NIE\nData pierwszej rejestracji: 2016-05-01");
    expect(neg.uwagi).toEqual([]);
    expect(neg.pierwszaRejestracja).toBe("2016-05-01");
  });

  it("pusty tekst", () => {
    expect(parseCepik("")).toEqual({ odczyty: [], pierwszaRejestracja: null, pierwszaRejestracjaPl: null, sygnaly: [], uwagi: [] });
  });
});
