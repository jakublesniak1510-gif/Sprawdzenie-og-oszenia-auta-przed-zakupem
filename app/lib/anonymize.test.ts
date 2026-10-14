import { describe, expect, it } from "vitest";
import { anonymize, anonymizeText } from "./anonymize";

describe("anonymize – telefony", () => {
  it.each([
    ["Dzwoń: 600 700 800", "Dzwoń: [telefon]"],
    ["tel. 600-700-800 po 16", "tel. [telefon] po 16"],
    ["Tel:600700800", "Tel:[telefon]"],
    ["+48 600 700 800", "[telefon]"],
    ["+48600700800 tylko sms", "[telefon] tylko sms"],
    ["0048 512-345-678", "[telefon]"],
    ["(+48) 512 345 678", "[telefon]"],
    ["stacjonarny (22) 123-45-67", "stacjonarny [telefon]"],
    ["22 123 45 67 w godzinach pracy", "[telefon] w godzinach pracy"],
    ["kom. 601 12 34 56", "kom. [telefon]"],
  ])("%s", (input, expected) => {
    expect(anonymizeText(input)).toBe(expected);
  });

  it("nie rusza przebiegu, ceny, rocznika ani pojemności", () => {
    const t = "Rocznik 2015, przebieg 185 000 km, cena 32 900 zł, silnik 1968 cm3, 150 KM";
    expect(anonymizeText(t)).toBe(t);
  });

  it("nie rusza 9-cyfrowego przebiegu z jednostką", () => {
    expect(anonymizeText("licznik 123456789 km")).toBe("licznik 123456789 km");
  });
});

describe("anonymize – e-mail i linki", () => {
  it("e-mail", () => {
    expect(anonymizeText("Pisz na jan.kowalski@gmail.com lub dzwoń")).toBe("Pisz na [email] lub dzwoń");
  });
  it("e-mail zapisany z (at)", () => {
    expect(anonymizeText("kontakt mailowy: auto.sprzedam(at)wp.pl")).toContain("[email]");
  });
  it("linki http i www oraz gołe domeny", () => {
    const out = anonymizeText("Więcej zdjęć: https://example.com/a?b=1 oraz www.foo.pl i otomoto.pl/oferta/123");
    expect(out).toBe("Więcej zdjęć: [link] oraz [link] i [link]");
  });
});

describe("anonymize – numery rejestracyjne", () => {
  it.each([
    ["Nr rej. WX 12345", "Nr rej. [nr rej]"],
    ["tablice KR1234A", "tablice [nr rej]"],
    ["auto na blachach PO 5A123 jeszcze", "auto na blachach [nr rej] jeszcze"],
    ["rejestracja WPI 1234", "rejestracja [nr rej]"],
    ["zarejestrowany GD-12345", "zarejestrowany [nr rej]"],
  ])("%s", (input, expected) => {
    expect(anonymizeText(input)).toBe(expected);
  });

  it("nie rusza oznaczeń silników i modeli", () => {
    const t = "BMW 320D, silnik TDI 2015, skrzynia DSG, VW Golf VII 1.6 TDI";
    expect(anonymizeText(t)).toBe(t);
  });
});

describe("anonymize – VIN zostaje", () => {
  it("nie wycina VIN", () => {
    const t = "VIN: WVWZZZAUZFW123456, pierwsza rejestracja 2015";
    expect(anonymizeText(t)).toBe(t);
  });
});

describe("anonymize – dane kontaktowe", () => {
  it("linia Kontakt: Jan Kowalski", () => {
    expect(anonymizeText("Stan bardzo dobry.\nKontakt: Jan Kowalski\nZapraszam")).toBe(
      "Stan bardzo dobry.\nKontakt: [kontakt]\nZapraszam",
    );
  });
  it("Osoba kontaktowa z telefonem", () => {
    expect(anonymizeText("Osoba kontaktowa: Anna Nowak, 600 700 800")).toBe("Osoba kontaktowa: [kontakt]");
  });
  it("linia Kontakt z samym telefonem zostaje z placeholderem", () => {
    expect(anonymizeText("Kontakt: 600 700 800")).toBe("Kontakt: [telefon]");
  });
  it("„Sprzedawca: osoba prywatna” zostaje (to informacja, nie nazwisko)", () => {
    expect(anonymizeText("Sprzedawca: Osoba prywatna")).toBe("Sprzedawca: Osoba prywatna");
  });
  it("Sprzedający: Marek Wiśniewski", () => {
    expect(anonymizeText("Sprzedający: Marek Wiśniewski")).toBe("Sprzedający: [kontakt]");
  });
  it("Pan/Pani + imię w zdaniu", () => {
    expect(anonymizeText("Proszę dzwonić i pytać o Pana Marka.")).toBe("Proszę dzwonić i pytać o [kontakt].");
  });
  it("podpis „Pozdrawiam, Tomek”", () => {
    expect(anonymizeText("Zapraszam na jazdę próbną.\nPozdrawiam,\nTomek")).toBe(
      "Zapraszam na jazdę próbną.\nPozdrawiam,\n[kontakt]",
    );
  });
});

describe("anonymize – statystyki i pełne ogłoszenie", () => {
  it("liczy trafienia", () => {
    const r = anonymize(
      "Sprzedam Golfa. Tel 600 700 800, mail a@b.pl, WX 12345, www.auto.pl\nKontakt: Jan Kowalski",
    );
    expect(r.stats).toEqual({ telefon: 1, email: 1, nrRej: 1, link: 1, kontakt: 1 });
    expect(r.text).not.toMatch(/600|a@b|12345|Kowalski/);
  });
});
