import type { CarModel, Engine, Fault } from "./models";

/**
 * Filtr usterek WSPÓLNYCH modelu (common_faults) wg skrzyni i paliwa z ogłoszenia – żeby ogłoszenie z manualem
 * nie dostawało usterek DSG, a benzyna usterek DPF/EGR. Usterki konkretnego silnika nie są filtrowane.
 * Wspólne dla szybkiego testu (lib/quick-test.ts) i raportu (buildAiRequest).
 */

export type Gearbox = "manual" | "automat" | null;

const L = "(?<!\\p{L})"; // początek „słowa” z polskimi literami
const R = "(?!\\p{L})"; // koniec „słowa”

/** Automat w ogłoszeniu (bez „klimatyzacja automatyczna” itp. – tylko jednoznaczne określenia skrzyni). */
const AUTOMAT_TEXT_RE = new RegExp(
  `${L}(automat(?:em|u|y|a)?|dsg|s[\\s-]?tronic|tiptronic|multitronic|powershift|edc|cvt|steptronic|[79]g[\\s-]?tronic|at|dct|xtronic|easytronic|eat[68])${R}` +
    `|skrzyni\\p{L}*\\s+(?:biegów\\s+)?automatyczn|automatyczn\\p{L}*\\s+skrzyni`,
  "iu",
);
/** Manual w ogłoszeniu. „Ręczna” tylko w odniesieniu do skrzyni (nie klimatyzacja/hamulec). */
const MANUAL_TEXT_RE = new RegExp(
  `${L}(manual\\p{L}*|mt|[56][\\s-]?biegow\\p{L}*)${R}|skrzyni\\p{L}*\\s+(?:biegów\\s+)?ręczn|ręczn\\p{L}*\\s+skrzyni`,
  "iu",
);
/** Zwroty o wyposażeniu, które nie mówią nic o skrzyni. */
const NOT_GEARBOX_RE = /(klimatyzacj\p{L}*|klima)\s+(manualn|automatyczn|ręczn)\p{L}*|(manualn|automatyczn|ręczn)\p{L}*\s+(klimatyzacj\p{L}*|klima)|hamul\p{L}*\s+ręczn\p{L}*|ręczn\p{L}*\s+hamul\p{L}*/giu;

/** Skrzynia z treści ogłoszenia: automat ma pierwszeństwo („6-biegowa DSG”), manual tylko bez wzmianki o automacie. */
export function detectGearbox(text: string): Gearbox {
  const t = text.replace(NOT_GEARBOX_RE, " ");
  if (AUTOMAT_TEXT_RE.test(t)) return "automat";
  if (MANUAL_TEXT_RE.test(t)) return "manual";
  return null;
}

const AUTOMAT_FAULT_RE = new RegExp(
  `${L}(dsg|dq\\d{3}|dct|edc|cvt|xtronic|multitronic|tiptronic|powershift|easytronic|easy-r)${R}|mechatronik|dwusprzęgł|automat|zautomatyzowan`,
  "iu",
);
const MANUAL_FAULT_RE = /manualn\p{L}*|skrzyni\p{L}*\s+(biegów\s+)?ręczn|ręczn\p{L}*\s+skrzyni/iu;
const DIESEL_FAULT_RE = new RegExp(`${L}(dpf|fap|egr|adblue)${R}`, "iu");

/** Czego dotyczy usterka: automatu, manuala czy obu/żadnej (null). Automat ma pierwszeństwo („zautomatyzowana manualna”). */
export function faultGearbox(f: Fault): Gearbox {
  const t = `${f.title} ${f.symptoms}`;
  if (AUTOMAT_FAULT_RE.test(t)) return "automat";
  if (MANUAL_FAULT_RE.test(t)) return "manual";
  return null;
}

export function isDieselOnlyFault(f: Fault): boolean {
  return DIESEL_FAULT_RE.test(`${f.title} ${f.symptoms}`);
}

export interface FaultContext {
  gearbox: Gearbox;
  /** Paliwo rozpoznanego silnika (null = silnik nieznany → bez filtra paliwa). */
  fuel: Engine["fuel"] | null;
}

export interface FilteredFault {
  fault: Fault;
  /** true = skrzynia nieznana, a usterka dotyczy tylko automatu (szybki test dopisuje to w tytule). */
  tylkoAutomat: boolean;
}

export function filterCommonFaults(faults: Fault[], ctx: FaultContext): FilteredFault[] {
  return faults.flatMap((fault) => {
    const g = faultGearbox(fault);
    if (ctx.gearbox === "manual" && g === "automat") return [];
    if (ctx.gearbox === "automat" && g === "manual") return [];
    if (ctx.fuel && ctx.fuel !== "diesel" && isDieselOnlyFault(fault)) return [];
    return [{ fault, tylkoAutomat: ctx.gearbox === null && g === "automat" }];
  });
}

export const AUTOMAT_NOTE = "(dotyczy wersji z automatem)";

/** Kontekst z ogłoszenia i rozpoznanego silnika. */
export function faultContext(text: string, model: CarModel, engineCode: string | null): FaultContext {
  const engine = engineCode ? model.engines.find((e) => e.code === engineCode) : undefined;
  return { gearbox: detectGearbox(text), fuel: engine?.fuel ?? null };
}

/** Kopia modelu z przefiltrowanymi usterkami wspólnymi (do promptu i reguł postProcess). */
export function modelForListing(model: CarModel, text: string, engineCode: string | null): CarModel {
  const ctx = faultContext(text, model, engineCode);
  return { ...model, common_faults: filterCommonFaults(model.common_faults, ctx).map((x) => x.fault) };
}
