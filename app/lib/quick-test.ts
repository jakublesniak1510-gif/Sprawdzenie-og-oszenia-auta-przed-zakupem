import { z } from "zod";
import { anonymizeText } from "./anonymize";
import { detectModels, loadModels, modelLabel, type CarModel, type Fault, type PriceRange } from "./models";
import { VIN_RE, loadRedFlags, matchRedFlags, type RedFlag } from "./red-flags";

/**
 * Darmowy „szybki test” ogłoszenia – bez AI, natychmiast, zero kosztu:
 * anonimizacja → czerwone flagi z bazy → rozpoznanie modelu → 3 najważniejsze usterki → cena vs widełki rynkowe.
 */

const optNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? null : Number(String(v).replace(/[\s  ]/g, "").replace(",", "."))),
  z.number().nonnegative().max(100_000_000).nullable(),
);

export const QuickTestInputSchema = z.object({
  tekst: z.string().trim().min(30, "Wklej treść ogłoszenia (co najmniej 30 znaków).").max(30000, "Tekst jest za długi (maks. 30 000 znaków)."),
  cena: optNum.optional().default(null),
  przebieg: optNum.optional().default(null),
  rocznik: optNum.optional().default(null),
});
export type QuickTestInput = z.infer<typeof QuickTestInputSchema>;

export type CenaPozycja = "ponizej" | "w_normie" | "powyzej" | "brak_danych";
type Waga = "niska" | "srednia" | "wysoka";

export interface QuickTestResult {
  rozpoznany: { model_id: string; nazwa: string; silnik: string | null; lata: [number, number] } | null;
  flagi: { id: string; kategoria: string; waga: Waga; opis: string; pytanie: string | null }[];
  usterki_top3: { tytul: string; objawy: string; waga: Waga; koszt_pln: [number, number]; jak_sprawdzic: string; przebieg_km: string | null }[];
  cena: { pozycja: CenaPozycja; komentarz: string; widelki_pln?: [number, number] };
  brak_vin: boolean;
  nastepny_krok: string;
}

const SEV: Record<Waga, number> = { wysoka: 0, srednia: 1, niska: 2 };
const zl = (n: number) => `${Math.round(n).toLocaleString("pl-PL")} zł`;

/** Usterki do pokazania: wybrany silnik (jeśli rozpoznany) + wspólne, posortowane wg wagi, potem kosztu. */
export function topFaults(model: CarModel, engineCode: string | null, n = 3): Fault[] {
  const engine = engineCode ? model.engines.find((e) => e.code === engineCode) : undefined;
  const pool = [...(engine?.faults ?? []), ...model.common_faults];
  return pool
    .map((f, i) => ({ f, i }))
    .sort((a, b) => SEV[a.f.severity] - SEV[b.f.severity] || b.f.cost_pln[1] - a.f.cost_pln[1] || a.i - b.i)
    .slice(0, n)
    .map((x) => x.f);
}

/** Widełki pasujące do rocznika (i przebiegu, jeśli podany). Przy kilku pasujących pasmach przebiegu – najwęższe. */
export function matchPriceRange(ranges: PriceRange[] | undefined, rocznik: number | null, przebieg: number | null): [number, number] | null {
  if (!ranges?.length || !rocznik) return null;
  const byYear = ranges.filter((r) => rocznik >= Math.min(...r.years) && rocznik <= Math.max(...r.years));
  if (!byYear.length) return null;
  if (przebieg !== null) {
    const fitting = byYear
      .filter((r) => r.km_max === null || r.km_max === undefined || przebieg <= r.km_max)
      .sort((a, b) => (a.km_max ?? Infinity) - (b.km_max ?? Infinity));
    if (fitting.length) return [Math.min(...fitting[0].price_pln), Math.max(...fitting[0].price_pln)];
    // przebieg większy niż każde pasmo – bierzemy pasmo o największym km_max (najtańsze)
    const last = [...byYear].sort((a, b) => (b.km_max ?? Infinity) - (a.km_max ?? Infinity))[0];
    return [Math.min(...last.price_pln), Math.max(...last.price_pln)];
  }
  return [Math.min(...byYear.map((r) => Math.min(...r.price_pln))), Math.max(...byYear.map((r) => Math.max(...r.price_pln)))];
}

export function priceVerdict(model: CarModel | null, cena: number | null, rocznik: number | null, przebieg: number | null): QuickTestResult["cena"] {
  if (!model) return { pozycja: "brak_danych", komentarz: "Nie rozpoznaliśmy modelu z naszej bazy, więc nie porównujemy ceny." };
  if (!model.price_ranges?.length) return { pozycja: "brak_danych", komentarz: `Nie mamy jeszcze widełek cenowych dla modelu ${modelLabel(model)}.` };
  if (!cena) return { pozycja: "brak_danych", komentarz: "Podaj cenę z ogłoszenia, a porównamy ją z typowymi cenami rynkowymi." };
  if (!rocznik) return { pozycja: "brak_danych", komentarz: "Podaj rocznik, a porównamy cenę z typowymi cenami dla tego rocznika." };
  const range = matchPriceRange(model.price_ranges, rocznik, przebieg);
  if (!range) return { pozycja: "brak_danych", komentarz: `Nie mamy widełek cenowych dla rocznika ${rocznik}.` };
  const [od, doo] = range;
  const kontekst = `rocznik ${rocznik}${przebieg !== null ? `, przebieg ok. ${Math.round(przebieg / 1000)} tys. km` : ""}`;
  if (cena < od) {
    return {
      pozycja: "ponizej",
      widelki_pln: range,
      komentarz: `Cena ${zl(cena)} jest niższa od typowych ${zl(od)}–${zl(doo)} (${kontekst}). Niska cena bywa okazją, ale częściej oznacza ukryte wady, cofnięty licznik albo problemy z dokumentami – sprawdź auto szczególnie dokładnie.`,
    };
  }
  if (cena > doo) {
    return {
      pozycja: "powyzej",
      widelki_pln: range,
      komentarz: `Cena ${zl(cena)} jest wyższa od typowych ${zl(od)}–${zl(doo)} (${kontekst}). Może to wynikać z bogatego wyposażenia lub bardzo dobrego stanu – poproś o dowody (faktury, historia serwisowa) i negocjuj.`,
    };
  }
  return { pozycja: "w_normie", widelki_pln: range, komentarz: `Cena ${zl(cena)} mieści się w typowych widełkach ${zl(od)}–${zl(doo)} (${kontekst}).` };
}

/** Czysta funkcja (testowalna): wynik szybkiego testu dla podanej bazy modeli i flag. */
export function quickTest(input: QuickTestInput, models: CarModel[], flags: RedFlag[]): QuickTestResult {
  const tekst = anonymizeText(input.tekst);
  const rocznik = input.rocznik ? Math.round(input.rocznik) : Number(tekst.match(/\b(19[89]\d|20[0-3]\d)\b/)?.[1]) || null;
  const przebieg = input.przebieg ?? null;
  const cena = input.cena ?? null;

  const det = detectModels(tekst, models, rocznik)[0] ?? null;
  const model = det ? models.find((m) => m.id === det.modelId) ?? null : null;

  const flagi = matchRedFlags(tekst, flags)
    .sort((a, b) => SEV[a.severity] - SEV[b.severity])
    .map((f) => ({ id: f.id, kategoria: f.category, waga: f.severity, opis: f.neutral_wording, pytanie: f.question_for_seller ?? null }));

  const usterki_top3 = model
    ? topFaults(model, det!.engineCode).map((f) => ({
        tytul: f.title,
        objawy: f.symptoms,
        waga: f.severity,
        koszt_pln: f.cost_pln,
        jak_sprawdzic: f.check_at_inspection,
        przebieg_km: f.mileage_km ?? null,
      }))
    : [];

  const brak_vin = !VIN_RE.test(tekst);
  const nastepny_krok = brak_vin
    ? "Poproś sprzedawcę o VIN, numer rejestracyjny i datę pierwszej rejestracji. Z tymi danymi sprawdzisz za darmo przebiegi w historiapojazdu.gov.pl, a pełny raport porówna je z ogłoszeniem i przygotuje pytania do sprzedawcy."
    : "Sprawdź przebiegi i status auta w historiapojazdu.gov.pl (VIN, numer rejestracyjny, data pierwszej rejestracji) i zamów pełny raport: analiza przebiegu, wszystkie czerwone flagi, koszty usterek, pytania do sprzedawcy i checklista oględzin.";

  return {
    rozpoznany: model && det ? { model_id: model.id, nazwa: modelLabel(model), silnik: det.engineCode, lata: model.years } : null,
    flagi,
    usterki_top3,
    cena: priceVerdict(model, cena, rocznik, przebieg),
    brak_vin,
    nastepny_krok,
  };
}

/** Wersja z bazą wczytaną z dysku (dla API). */
export async function runQuickTest(input: QuickTestInput): Promise<QuickTestResult> {
  const [models, flags] = await Promise.all([loadModels(), loadRedFlags()]);
  return quickTest(input, models, flags);
}
