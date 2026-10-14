import type { CarModel, PriceRange } from "./models";
import { VIN_RE, type RedFlag, type RedFlagHit } from "./red-flags";

/**
 * Czerwone flagi z pustym `patterns`, które liczy APLIKACJA (nie model) – jedno miejsce dla szybkiego testu
 * i dla `buildAiRequest`. Treść (neutral_wording, question_for_seller, severity) zawsze z data/red-flags.json;
 * gdy flagi nie ma w bazie, nie jest zgłaszana.
 *
 * - `cena-ponizej-widelek` – cena < 85% dolnej granicy price_ranges dla rocznika, przy przebiegu ≤ km_max
 *   (algorytm z data/README.md; przy przebiegu powyżej km_max niska cena bywa uzasadniona – brak flagi),
 * - `opis-idealny-cena-niska` – j.w. ORAZ trafiona flaga „stan idealny”,
 * - `przebieg-roczny-nietypowy` – przebieg / wiek auta < 6 tys. lub > 40 tys. km/rok,
 * - `vin-vs-model` – WMI (3 pierwsze znaki VIN) jednoznacznie wskazuje INNĄ markę niż rozpoznany model.
 */

export const COMPUTED_FLAG_IDS = ["cena-ponizej-widelek", "opis-idealny-cena-niska", "przebieg-roczny-nietypowy", "vin-vs-model"] as const;
export type ComputedFlagId = (typeof COMPUTED_FLAG_IDS)[number];

/** Flagi uznawane za „opis idealny” (do `opis-idealny-cena-niska`). */
export const IDEAL_CONDITION_FLAG_IDS = new Set(["stan-idealny"]);

export const PRICE_MARGIN = 0.15;
export const KM_PER_YEAR_MIN = 6_000;
export const KM_PER_YEAR_MAX = 40_000;
/** Niski roczny przebieg oceniamy dopiero od 3 lat (nowe auta często stoją u dealera / jeżdżą mało). */
const MIN_AGE_FOR_LOW_MILEAGE = 3;

/**
 * Słownik WMI → marka (16 marek z bazy). Klucz: prefiks WMI (2 lub 3 znaki). Celowo krótki: brak WMI
 * w słowniku = brak oceny (auta z USA i innych fabryk mają inne kody) – flaga tylko przy jawnym konflikcie.
 */
export const WMI_MAKES: Record<string, string> = {
  WVW: "volkswagen", WVG: "volkswagen", WV1: "volkswagen", WV2: "volkswagen",
  TMB: "skoda",
  WAU: "audi", WUA: "audi",
  WBA: "bmw", WBS: "bmw", WBY: "bmw",
  WDB: "mercedes", WDD: "mercedes", WDC: "mercedes", W1K: "mercedes",
  W0L: "opel", W0V: "opel",
  WF0: "ford",
  SB1: "toyota", JT: "toyota", NMT: "toyota",
  KMH: "hyundai", TMA: "hyundai",
  KNA: "kia", KNE: "kia", U5Y: "kia",
  VF1: "renault",
  UU1: "dacia",
  VF3: "peugeot",
  SJN: "nissan", JN1: "nissan", VSK: "nissan",
  VSS: "seat",
  JMZ: "mazda", JM1: "mazda",
};

const MAKE_LABEL: Record<string, string> = {
  volkswagen: "Volkswagen", skoda: "Škoda", audi: "Audi", bmw: "BMW", mercedes: "Mercedes-Benz", opel: "Opel", ford: "Ford",
  toyota: "Toyota", hyundai: "Hyundai", kia: "Kia", renault: "Renault", dacia: "Dacia", peugeot: "Peugeot", nissan: "Nissan",
  seat: "Seat", mazda: "Mazda",
};

/** „Mercedes-Benz” → „mercedes”, „Škoda” → „skoda”, „VW” → „volkswagen”. */
export function normalizeMake(make: string): string {
  const s = make.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const first = s.split(/[\s-]+/)[0];
  return first === "vw" ? "volkswagen" : first;
}

/** Marka z WMI albo null, gdy WMI nie ma w słowniku. */
export function makeFromVin(vin: string): string | null {
  const v = vin.toUpperCase();
  return WMI_MAKES[v.slice(0, 3)] ?? WMI_MAKES[v.slice(0, 2)] ?? null;
}

export function findVin(text: string): string | null {
  return VIN_RE.exec(text)?.[0]?.toUpperCase() ?? null;
}

export interface ComputedFlagsInput {
  tekst: string;
  cena: number | null;
  przebieg: number | null;
  rocznik: number | null;
  model: CarModel | null;
  /** Flagi trafione wzorcami (do `opis-idealny-cena-niska`). */
  trafione: { id: string }[];
  /** Rok odniesienia do wieku auta (domyślnie bieżący). */
  rokBiezacy?: number;
}

/** Widełki cen pasujące do rocznika (i przebiegu, jeśli podany). Przy kilku pasujących pasmach przebiegu – najwęższe. */
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

const zl = (n: number) => `${Math.round(n).toLocaleString("pl-PL")} zł`;
const tys = (n: number) => `${Math.round(n / 1000).toLocaleString("pl-PL")} tys. km`;

/** Liczy flagi aplikacyjne. `flags` = cała baza red-flags (źródło treści). */
export function computeFlags(input: ComputedFlagsInput, flags: RedFlag[]): RedFlagHit[] {
  const byId = new Map(flags.map((f) => [f.id, f]));
  const out: RedFlagHit[] = [];
  const push = (id: ComputedFlagId, trafienie: string) => {
    const f = byId.get(id);
    if (f) out.push({ ...f, trafienie });
  };

  // 1–2. Cena poniżej widełek (tylko gdy przebieg ≤ km_max albo nieznany).
  const { cena, rocznik, przebieg, model } = input;
  if (model?.price_ranges?.length && cena && rocznik) {
    const range = matchPriceRange(model.price_ranges, rocznik, przebieg);
    const withinKm =
      przebieg === null ||
      model.price_ranges.some(
        (r) => rocznik >= Math.min(...r.years) && rocznik <= Math.max(...r.years) && (r.km_max === null || r.km_max === undefined || przebieg <= r.km_max),
      );
    if (range && withinKm && cena < range[0] * (1 - PRICE_MARGIN)) {
      const opis = `cena ${zl(cena)} to ${Math.round((1 - cena / range[0]) * 100)}% poniżej dolnej granicy typowych cen ${zl(range[0])}–${zl(range[1])} (rocznik ${rocznik})`;
      push("cena-ponizej-widelek", opis);
      if (input.trafione.some((t) => IDEAL_CONDITION_FLAG_IDS.has(t.id))) push("opis-idealny-cena-niska", `opis „stan idealny” przy cenie: ${opis}`);
    }
  }

  // 3. Nietypowy roczny przebieg.
  if (przebieg !== null && przebieg > 0 && rocznik) {
    const age = Math.max(1, (input.rokBiezacy ?? new Date().getFullYear()) - rocznik);
    const perYear = przebieg / age;
    if (perYear > KM_PER_YEAR_MAX || (perYear < KM_PER_YEAR_MIN && age >= MIN_AGE_FOR_LOW_MILEAGE)) {
      push("przebieg-roczny-nietypowy", `${tys(przebieg)} w ${age} ${age === 1 ? "rok" : age < 5 ? "lata" : "lat"} = ok. ${tys(perYear)} rocznie`);
    }
  }

  // 4. VIN vs marka – tylko jawny konflikt ze słownikiem.
  const vin = findVin(input.tekst);
  if (vin && model) {
    const vinMake = makeFromVin(vin);
    const modelMake = normalizeMake(model.make);
    if (vinMake && vinMake !== modelMake) {
      push("vin-vs-model", `VIN zaczyna się od ${vin.slice(0, 3)} (typowo ${MAKE_LABEL[vinMake] ?? vinMake}), a ogłoszenie dotyczy marki ${model.make}`);
    }
  }
  return out;
}
