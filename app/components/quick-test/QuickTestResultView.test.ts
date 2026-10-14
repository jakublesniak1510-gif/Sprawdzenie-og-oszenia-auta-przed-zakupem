import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeQuickTest } from "./api";
import { QuickTestResultView } from "./QuickTestResultView";

const base = {
  rozpoznany: { model_id: "vw-golf-7", nazwa: "Volkswagen Golf VII (2012–2020)", silnik: null },
  flagi: [
    { id: "brak-vin", kategoria: "dokumenty", waga: "srednia", opis: "Brak VIN w treści.", pytanie: null },
    { id: "x", kategoria: "historia", waga: "niska", opis: "Deklaracja serwisu bez dokumentów.", pytanie: "Czy są faktury?" },
  ],
  usterki_top3: [{ tytul: "Skrzynia DSG DQ200", objawy: "Szarpanie", waga: "wysoka", koszt_pln: [3000, 9000], jak_sprawdzic: "Jazda w korku" }],
  cena: { pozycja: "brak_danych", komentarz: "Podaj cenę z ogłoszenia." },
  brak_vin: true,
  nastepny_krok: "Poproś sprzedawcę o VIN.",
};

const render = (raw: unknown) => renderToStaticMarkup(createElement(QuickTestResultView, { result: normalizeQuickTest(raw), onFullReport: () => {} }));

describe("QuickTestResultView", () => {
  it("pokazuje duży box „Brak VIN” z Historią Pojazdu i nie dubluje flagi brak-vin", () => {
    const html = render(base);
    expect(html).toContain("Brak VIN w ogłoszeniu");
    expect(html).toContain("historiapojazdu.gov.pl");
    expect(html).toContain("VIN, numer rejestracyjny i datę pierwszej rejestracji");
    expect(html).not.toContain("Brak VIN w treści.");
    expect(html).toContain("Do wyjaśnienia ze sprzedawcą (1)");
  });

  it("pokazuje model z linkiem, top usterki, pozycję ceny, CTA i udostępnianie", () => {
    const html = render(base);
    expect(html).toContain('href="/usterki/vw-golf-7"');
    expect(html).toContain("Skrzynia DSG DQ200");
    expect(html).toMatch(/3\s?000–9\s?000 zł/);
    expect(html).toContain("Brak danych do oceny ceny");
    expect(html).toContain("Pełny raport 19 zł");
    expect(html).toContain("Udostępnij wynik");
    expect(html).toContain('href="/checklista"');
  });

  it("bez braku VIN nie pokazuje boksu", () => {
    const html = render({ ...base, brak_vin: false, flagi: [] });
    expect(html).not.toContain("Brak VIN w ogłoszeniu");
    expect(html).toContain("nie znaleźliśmy typowych sygnałów");
  });
});
