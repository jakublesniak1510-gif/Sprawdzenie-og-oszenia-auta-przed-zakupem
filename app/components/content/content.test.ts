import { describe, expect, it } from "vitest";
import { parseFrontmatter, asList } from "./frontmatter";
import { mapLanding, DEFAULT_LANDING } from "./landing";
import { parseLandingMarkdown } from "./landing-parse";
import { normalizePriceRanges } from "./model-extras";

const LANDING = `<!-- komentarz -->

## hero

tytul: Sprawdź ogłoszenie, zanim pojedziesz
podtytul: Wklej ogłoszenie i wiesz, o co zapytać.
cta1: Sprawdź za darmo
cta2: Zobacz przykładowy raport

## jak-to-dziala

- **Wklejasz ogłoszenie** – tekst albo zrzuty.
- **Szybki test** – od razu.
- **Pełny raport** – za 19 zł.

## co-dostajesz

- **A** – a
- **B** – b
- **C** – c
- **D** – d
- **E** – e
- **F** – f

## porownanie

| Cecha | My | Historia | Mechanik |
|---|---|---|---|
| Bez VIN | Tak | Nie | Tak |
| Usterki | Tak, z bazy | Nie | Czasem |
| Stan auta | Nie | Nie | Tak |

Uczciwie: mechanik zawsze.

## faq

### Pytanie 1?

Odpowiedź 1.

### Pytanie 2?

Odpowiedź 2.

### Pytanie 3?

Odpowiedź 3.

### Pytanie 4?

Odpowiedź 4.

## cennik

### Raport

cena: 19 zł
opis: Jedno auto.
cta: Kup raport

- punkt 1

### Raport+

cena: 29 zł
opis: Z ceną.
cta: Kup Raport+

- punkt 2

### Pakiet 5 raportów

cena: 49 zł
opis: Dłużej.
cta: Kup pakiet

- punkt 3

## stopka

Disclaimer stopki.

- [Regulamin](/regulamin)
- Kontakt: [DO UZUPEŁNIENIA]
`;

describe("landing.md → sekcje", () => {
  const c = mapLanding(parseLandingMarkdown(LANDING));
  it("hero z linii klucz: wartość, bez domyślnych punktów", () => {
    expect(c.hero.headline).toBe("Sprawdź ogłoszenie, zanim pojedziesz");
    expect(c.hero.sub).toBe("Wklej ogłoszenie i wiesz, o co zapytać.");
    expect(c.hero.ctaFree).toBe("Sprawdź za darmo");
    expect(c.hero.ctaExample).toBe("Zobacz przykładowy raport");
    expect(c.hero.bullets).toEqual([]);
  });
  it("kroki, korzyści, porównanie, FAQ, cennik, stopka", () => {
    expect(c.steps.map((s) => s.title)).toEqual(["Wklejasz ogłoszenie", "Szybki test", "Pełny raport"]);
    expect(c.features).toHaveLength(6);
    expect(c.comparison.head).toEqual(["Cecha", "My", "Historia", "Mechanik"]);
    expect(c.comparison.rows).toHaveLength(3);
    expect(c.comparison.note).toBe("Uczciwie: mechanik zawsze.");
    expect(c.faq).toHaveLength(4);
    expect(c.faq[0]).toEqual({ q: "Pytanie 1?", a: "Odpowiedź 1." });
    expect(c.pricing.map((p) => [p.name, p.text, p.cta, p.bullets])).toEqual([
      ["Raport", "Jedno auto.", "Kup raport", ["punkt 1"]],
      ["Raport+", "Z ceną.", "Kup Raport+", ["punkt 2"]],
      ["Pakiet 5 raportów", "Dłużej.", "Kup pakiet", ["punkt 3"]],
    ]);
    expect(c.footer.text).toBe("Disclaimer stopki.");
    expect(c.footer.items).toHaveLength(2);
    expect(c.source).toBe("content");
  });
  it("pusty plik → treści domyślne", () => {
    const d = mapLanding(parseLandingMarkdown(""));
    expect(d.faq).toEqual(DEFAULT_LANDING.faq);
    expect(d.faq).toHaveLength(8);
    expect(d.hero.bullets.length).toBeGreaterThan(0);
  });
});

describe("frontmatter", () => {
  it("czyta pola, listy w [] i listy blokowe", () => {
    const { data, body } = parseFrontmatter(`---
title: "Tytuł: z dwukropkiem"
date: 2026-10-01
models: ["vw-golf-7", "skoda-octavia-3"]
keywords:
  - a
  - b
---

Treść`);
    expect(data.title).toBe("Tytuł: z dwukropkiem");
    expect(data.date).toBe("2026-10-01");
    expect(asList(data.models)).toEqual(["vw-golf-7", "skoda-octavia-3"]);
    expect(asList(data.keywords)).toEqual(["a", "b"]);
    expect(body.trim()).toBe("Treść");
  });
  it("brak frontmattera → całe body", () => {
    expect(parseFrontmatter("# X").body).toBe("# X");
  });
});

describe("widełki cen", () => {
  it("format bazy (years, km_max, price_pln)", () => {
    expect(normalizePriceRanges([{ years: [2013, 2016], km_max: 200000, price_pln: [30000, 42000] }])).toEqual([
      { label: "2013–2016, przebieg do 200 tys. km", min: 30000, max: 42000, note: null },
    ]);
  });
  it("obiekt i błędne wpisy", () => {
    expect(normalizePriceRanges({ "2015_2017": { min: 1, max: 2 }, zle: [5, 1] })).toEqual([{ label: "2015 2017", min: 1, max: 2, note: null }]);
    expect(normalizePriceRanges(undefined)).toEqual([]);
  });
});
