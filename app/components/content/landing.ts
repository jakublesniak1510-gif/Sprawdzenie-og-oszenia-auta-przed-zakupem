import fs from "node:fs/promises";
import { findSection, labeled, parseLandingMarkdown, type LandingSection } from "./landing-parse";
import { contentPath } from "./paths";

/** Treść landingu: z `content/landing.md` (gdy jest), w przeciwnym razie domyślne teksty poniżej. Teksty = markdown inline. */
export interface LandingContent {
  hero: { headline: string; sub: string; bullets: string[]; ctaFree: string; ctaExample: string | null };
  steps: { title: string; text: string }[];
  features: { title: string; text: string }[];
  featuresIntro: string | null;
  comparison: { head: string[]; rows: string[][]; note: string | null };
  faq: { q: string; a: string }[];
  pricingIntro: string | null;
  pricing: { name: string; text: string; bullets: string[]; cta: string | null }[]; // dopasowanie do cen po kolejności: Raport, Raport+, Pakiet
  footer: { text: string | null; items: string[] };
  source: "content" | "default";
}

export const DEFAULT_LANDING: LandingContent = {
  hero: {
    headline: "Sprawdź ogłoszenie auta, zanim pojedziesz je oglądać",
    sub: "Wklej ogłoszenie z dowolnego portalu. Zobaczysz, co budzi wątpliwości, jakie usterki są typowe dla tego modelu i silnika oraz o co zapytać sprzedawcę – zanim stracisz dzień na dojazd.",
    bullets: [
      "Szybki test za darmo – bez rejestracji i bez VIN",
      "Usterki i koszty napraw z naszej bazy modeli, nie „z głowy” AI",
      "Neutralnie: nie oceniamy sprzedawcy, podpowiadamy pytania",
    ],
    ctaFree: "Darmowy szybki test",
    ctaExample: "Zobacz przykładowy raport",
  },
  steps: [
    { title: "Wklej ogłoszenie", text: "Tekst z portalu i, jeśli chcesz, zrzuty ekranu. Darmowy szybki test pokaże wynik od razu." },
    { title: "Dodaj Historię Pojazdu", text: "Opcjonalnie wklej bezpłatny wynik z gov.pl – zestawimy przebiegi z badań technicznych z deklaracją sprzedawcy." },
    { title: "Odbierz raport", text: "W 1–3 minuty: czerwone flagi, usterki modelu z kosztami, pytania do sprzedawcy i checklista oględzin. Link wyślemy też e-mailem." },
  ],
  featuresIntro: null,
  features: [
    { title: "Czerwone flagi w ogłoszeniu", text: "Sprzeczności w opisie, zwroty typowe dla handlu, brak VIN, cena odstająca od rynku – każda z pytaniem do sprzedawcy." },
    { title: "Przebiegi z badań technicznych", text: "Odczyty licznika z CEPiK na wykresie, zestawione z przebiegiem z ogłoszenia." },
    { title: "Typowe usterki modelu i silnika", text: "Z kuratorowanej bazy, z orientacyjnym kosztem naprawy i podpowiedzią, jak to sprawdzić." },
    { title: "Cena na tle rynku", text: "Porównanie z podobnymi ofertami w tabeli (Raport+) – widać, czy cena odstaje i dlaczego może." },
    { title: "Pytania do sprzedawcy", text: "Gotowa lista do skopiowania jednym kliknięciem do SMS-a lub Messengera." },
    { title: "Checklista oględzin", text: "Co sprawdzić na miejscu, dopasowane do modelu – także w wersji do druku." },
  ],
  comparison: {
    head: ["", "SprawdźOgłoszenie", "Raport historii pojazdu (np. autoDNA, carVertical)", "Mechanik na oględzinach"],
    rows: [
      ["Analiza treści ogłoszenia (sprzeczności, brak VIN, cena)", "tak", "nie", "nie"],
      ["Typowe usterki modelu i silnika z kosztami", "tak", "nie", "częściowo – zależy od doświadczenia"],
      ["Pytania do sprzedawcy i checklista oględzin", "tak", "nie", "nie"],
      ["Przebiegi z badań technicznych w Polsce", "tak – z wklejonej Historii Pojazdu", "tak", "nie"],
      ["Historia z zagranicy: szkody, przebiegi sprzed importu", "nie", "tak", "nie"],
      ["Stan techniczny konkretnego egzemplarza", "nie", "nie", "tak"],
      ["Kiedy", "przed wyjazdem, bez VIN", "gdy znasz VIN", "na miejscu"],
      ["Koszt", "od 19 zł (szybki test 0 zł)", "płatny raport", "płatna usługa warsztatu"],
    ],
    note: "To się uzupełnia: nasz raport przed wyjazdem, historia pojazdu po otrzymaniu VIN, a przed zakupem zawsze mechanik – on jako jedyny widzi auto.",
  },
  faq: [
    {
      q: "Czym to się różni od autoDNA czy carVertical?",
      a: "Tamte serwisy sprzedają historię pojazdu po numerze VIN (np. szkody i przebiegi z zagranicy). My analizujemy treść konkretnego ogłoszenia, dokładamy typowe usterki modelu i silnika z kosztami oraz gotowe pytania i checklistę. To się uzupełnia – jeśli auto jest sprowadzone, raport historii warto kupić dodatkowo.",
    },
    {
      q: "Czy potrzebuję numeru VIN?",
      a: "Nie. Szybki test i raport działają na samym tekście ogłoszenia. Gdy dostaniesz od sprzedawcy VIN, numer rejestracyjny i datę pierwszej rejestracji, sprawdzisz bezpłatnie Historię Pojazdu na gov.pl – wklej wynik, a porównamy przebiegi.",
    },
    { q: "Ile trwa przygotowanie raportu?", a: "Zwykle 1–3 minuty od płatności. Raport otwiera się w przeglądarce, ma wersję do druku i jest dostępny pod linkiem przez 30 dni." },
    {
      q: "Czy raport zastępuje mechanika?",
      a: "Nie. Raport pomaga zdecydować, czy w ogóle jechać i o co pytać. Stan techniczny konkretnego auta oceni tylko mechanik lub stacja diagnostyczna – przed zakupem zawsze to zrób.",
    },
    {
      q: "Skąd bierzecie usterki i koszty napraw?",
      a: "Z naszej bazy modeli popularnych w Polsce, uzupełnianej ręcznie. Jeśli modelu w niej nie ma, raport mówi to wprost i pokazuje zasady ogólne – nie wymyślamy usterek.",
    },
    {
      q: "Co z danymi sprzedawcy i moimi?",
      a: "Telefony, e-maile, numery rejestracyjne i linki usuwamy z tekstu automatycznie przed analizą. Raport i dane wejściowe kasujemy po 30 dniach. Szczegóły w polityce prywatności.",
    },
    { q: "Jak mogę zapłacić?", a: "BLIK-iem, przez Przelewy24 albo kartą (płatności obsługuje Stripe). Pakiet 5 raportów to kupon ważny 30 dni – wpisujesz go w formularzu." },
    {
      q: "Czy mogę odstąpić od umowy?",
      a: "Raport to treść cyfrowa dostarczana od razu. Przed płatnością potwierdzasz, że żądasz natychmiastowego dostarczenia – po dostarczeniu prawo odstąpienia wygasa. Jeśli raport nie powstanie z naszej winy, zwracamy pieniądze.",
    },
  ],
  pricingIntro: null,
  pricing: [
    { name: "Raport", text: "Jedno ogłoszenie, pełna analiza.", cta: null, bullets: ["Czerwone flagi w ogłoszeniu", "Przebiegi z CEPiK vs deklaracja", "Typowe usterki modelu i koszty", "Pytania do sprzedawcy i checklista oględzin"] },
    { name: "Raport+", text: "Gdy chcesz wiedzieć, czy cena jest uczciwa.", cta: null, bullets: ["Wszystko z Raportu", "Porównanie z maks. 5 podobnymi ofertami", "Wzór umowy kupna-sprzedaży", "Checklista oględzin do druku"] },
    { name: "Pakiet 5 raportów", text: "Kupon na 5 raportów – dla szukających kilku aut.", cta: null, bullets: ["5 × Raport w cenie niecałych 10 zł za sztukę", "Kod do wpisania w formularzu"] },
  ],
  footer: { text: null, items: [] },
  source: "default",
};

/** Linia „klucz: wartość” (klucz to jedno słowo, np. tytul, cta1). */
const LABEL_LINE = /^\**\s*[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9_-]{2,20}\s*\**\s*:\s*\S/;
const lines = (ps: string[]) => ps.flatMap((p) => p.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);

function itemsToPairs(s: LandingSection | null): { title: string; text: string }[] {
  if (!s) return [];
  if (s.items.length) return s.items.map((i) => ({ title: i.title, text: [...i.paragraphs, ...i.bullets].join(" ") }));
  // lista „**Tytuł** – opis” albo „Tytuł: opis”
  return s.bullets.map((b) => {
    const m = /^\*\*(.+?)\*\*\s*[–—:-]?\s*(.*)$/s.exec(b) ?? /^([^:–—]{3,60})\s*[:–—]\s*(.+)$/s.exec(b);
    return m ? { title: m[1].trim(), text: m[2].trim() } : { title: b, text: "" };
  });
}

export function mapLanding(sections: Record<string, LandingSection>): LandingContent {
  const d = DEFAULT_LANDING;
  const hero = findSection(sections, "hero");
  const heroLines = hero ? lines([...hero.intro, ...hero.bullets, ...hero.items.flatMap((i) => [i.title, ...i.paragraphs])]) : [];
  const unlabeled = heroLines.filter((l) => !LABEL_LINE.test(l));
  const headline =
    labeled(heroLines, ["nagłówek", "naglowek", "h1", "tytuł", "tytul", "headline"]) ?? hero?.items[0]?.title ?? unlabeled[0] ?? d.hero.headline;
  const sub =
    labeled(heroLines, ["podtytuł", "podtytul", "lead", "sub", "opis"]) ?? hero?.items[0]?.paragraphs[0] ?? (hero?.items.length ? null : unlabeled[1]) ?? d.hero.sub;
  const heroBullets = (hero?.items[0]?.bullets.length ? hero.items[0].bullets : hero?.bullets ?? []).filter((b) => !LABEL_LINE.test(b));

  const steps = itemsToPairs(findSection(sections, "jak-to-dziala"));
  const featSec = findSection(sections, "co-dostajesz");
  const features = itemsToPairs(featSec);
  const cmp = findSection(sections, "porownanie");
  const faqSec = findSection(sections, "faq");
  const faq = faqSec?.items.map((i) => ({ q: i.title, a: [...i.paragraphs, ...i.bullets.map((b) => `• ${b}`)].join(" ") })).filter((x) => x.a) ?? [];
  const priceSec = findSection(sections, "cennik");
  const pricing =
    priceSec?.items.map((i) => {
      const ls = lines(i.paragraphs);
      return {
        name: i.title,
        text: labeled(ls, ["opis", "description"]) ?? ls.filter((l) => !LABEL_LINE.test(l)).join(" "),
        cta: labeled(ls, ["cta", "przycisk"]),
        bullets: i.bullets,
      };
    }) ?? [];

  const anyContent = !!(hero || steps.length || features.length || cmp || faq.length || pricing.length);
  return {
    hero: {
      headline,
      sub,
      // Gdy hero pochodzi z content/landing.md, pokazujemy tylko jego punkty (bez domyślnych).
      bullets: hero ? heroBullets.slice(0, 4) : d.hero.bullets,
      ctaFree: labeled(heroLines, ["cta1", "cta", "przycisk1"]) ?? d.hero.ctaFree,
      ctaExample: labeled(heroLines, ["cta2", "przycisk2"]) ?? d.hero.ctaExample,
    },
    steps: steps.length >= 3 ? steps.slice(0, 3) : d.steps,
    features: features.length >= 6 ? features.slice(0, 6) : d.features,
    featuresIntro: featSec?.intro[0] ?? null,
    comparison: cmp?.table && cmp.table.rows.length >= 3 ? { head: cmp.table.head, rows: cmp.table.rows, note: cmp.intro.at(-1) ?? cmp.bullets.at(-1) ?? d.comparison.note } : d.comparison,
    faq: faq.length >= 4 ? faq : d.faq,
    pricingIntro: priceSec?.intro[0] ?? null,
    pricing: pricing.length >= 3 ? pricing.slice(0, 3) : d.pricing,
    footer: (() => {
      const f = findSection(sections, "stopka");
      return { text: f?.intro.join(" ") || null, items: f?.bullets ?? [] };
    })(),
    source: anyContent ? "content" : "default",
  };
}

export async function loadLanding(): Promise<LandingContent> {
  try {
    const md = await fs.readFile(contentPath("landing.md"), "utf8");
    return mapLanding(parseLandingMarkdown(md));
  } catch {
    return DEFAULT_LANDING;
  }
}
