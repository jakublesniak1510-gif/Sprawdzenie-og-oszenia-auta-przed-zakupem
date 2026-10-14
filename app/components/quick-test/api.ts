import type { Waga } from "@/lib/report-schema";

/**
 * Klient `POST /api/szybki-test` (backend A1).
 * Umowa: wejście {tekst, cena?, przebieg?, rocznik?} → {rozpoznany, flagi[], usterki_top3[], cena:{pozycja, komentarz}, brak_vin, nastepny_krok}.
 * Normalizacja jest tolerancyjna na nazwy pól (pl/en), żeby UI nie pękał przy drobnych różnicach kontraktu.
 */

export interface QuickTestInput {
  tekst: string;
  cena?: number | null;
  przebieg?: number | null;
  rocznik?: number | null;
}

export interface QtVehicle {
  modelId: string | null;
  nazwa: string;
  silnik: string | null;
}
export interface QtFlag {
  id: string | null;
  tytul: string;
  opis: string;
  waga: Waga;
  pytanie: string | null;
}
export interface QtFault {
  tytul: string;
  objawy: string | null;
  waga: Waga;
  koszt: [number, number] | null;
  jakSprawdzic: string | null;
}
export type PricePosition = "ponizej" | "w_normie" | "powyzej" | "brak_danych";
export interface QuickTestResult {
  rozpoznany: QtVehicle | null;
  flagi: QtFlag[];
  usterki: QtFault[];
  cena: { pozycja: PricePosition; etykieta: string; komentarz: string };
  brakVin: boolean;
  nastepnyKrok: string;
}

export class QuickTestError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
  ) {
    super(message);
    this.name = "QuickTestError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const str = (o: Obj, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

export function toWaga(x: unknown): Waga {
  const s = String(x ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s.startsWith("wys") || s === "high") return "wysoka";
  if (s.startsWith("sred") || s === "medium") return "srednia";
  return "niska";
}

function toVehicle(x: unknown): QtVehicle | null {
  if (!x) return null;
  if (typeof x === "string") return { modelId: null, nazwa: x, silnik: null };
  if (!isObj(x)) return null;
  const nazwa =
    str(x, "nazwa", "label", "etykieta", "name") ?? ([str(x, "marka", "make"), str(x, "model"), str(x, "generacja", "generation")].filter(Boolean).join(" ") || null);
  if (!nazwa) return null;
  return { modelId: str(x, "model_id", "modelId", "id"), nazwa, silnik: str(x, "silnik", "silnik_kod", "engine", "engineCode", "engine_code") };
}

/** Kategorie flag z bazy (`data/red-flags.json`) → neutralny nagłówek. */
export const CATEGORY_LABEL: Record<string, string> = {
  cena: "Cena",
  dokumenty: "Dokumenty",
  handlarz: "Sformułowania w ogłoszeniu",
  historia: "Historia auta",
  przebieg: "Przebieg",
  sprzecznosc: "Niespójność w opisie",
  stan_techniczny: "Stan techniczny",
  zdjecia: "Zdjęcia",
  inne: "Do wyjaśnienia",
};

function toFlag(x: unknown): QtFlag | null {
  if (typeof x === "string") return { id: null, tytul: x, opis: "", waga: "niska", pytanie: null };
  if (!isObj(x)) return null;
  const opis = str(x, "opis", "neutral_wording", "tekst", "description", "explanation") ?? "";
  const id = str(x, "id");
  const kat = str(x, "kategoria", "category");
  const tytul = str(x, "tytul", "title", "nazwa") ?? (id === "brak-vin" ? "Brak VIN" : kat ? (CATEGORY_LABEL[kat] ?? kat.replace(/_/g, " ")) : "");
  if (!tytul && !opis) return null;
  return { id, tytul, opis, waga: toWaga(x.waga ?? x.severity), pytanie: str(x, "pytanie", "pytanie_do_sprzedawcy", "question_for_seller", "question") };
}

function toFault(x: unknown): QtFault | null {
  if (!isObj(x)) return typeof x === "string" ? { tytul: x, objawy: null, waga: "niska", koszt: null, jakSprawdzic: null } : null;
  const tytul = str(x, "tytul", "title", "nazwa");
  if (!tytul) return null;
  let koszt: [number, number] | null = null;
  const arr = x.koszt_pln ?? x.cost_pln ?? x.koszt;
  if (Array.isArray(arr) && arr.length === 2 && arr.every((n) => typeof n === "number")) koszt = [arr[0] as number, arr[1] as number];
  else if (typeof x.koszt_pln_od === "number" && typeof x.koszt_pln_do === "number") koszt = [x.koszt_pln_od, x.koszt_pln_do];
  else if (isObj(arr) && typeof arr.od === "number" && typeof arr.do === "number") koszt = [arr.od, arr.do];
  return {
    tytul,
    objawy: str(x, "objawy", "symptoms"),
    waga: toWaga(x.waga ?? x.severity),
    koszt,
    jakSprawdzic: str(x, "jak_sprawdzic", "check_at_inspection", "sprawdz"),
  };
}

const PRICE_LABEL: Record<PricePosition, string> = {
  ponizej: "Cena poniżej typowych ofert",
  w_normie: "Cena w typowym zakresie",
  powyzej: "Cena powyżej typowych ofert",
  brak_danych: "Brak danych do oceny ceny",
};

export function toPricePosition(x: unknown): PricePosition {
  const s = String(x ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
  if (/ponizej|nisk|below|tani|low/.test(s)) return "ponizej";
  if (/powyzej|wysok|above|drog|high/.test(s)) return "powyzej";
  if (/norm|rynk|typow|w_zakresie|zakres|ok|fair|within|srodk/.test(s)) return "w_normie";
  return "brak_danych";
}

export function normalizeQuickTest(raw: unknown): QuickTestResult {
  if (!isObj(raw)) throw new QuickTestError("Nieprawidłowa odpowiedź serwera.");
  const flagi = (Array.isArray(raw.flagi) ? raw.flagi : []).map(toFlag).filter((f): f is QtFlag => !!f);
  const usterki = (Array.isArray(raw.usterki_top3) ? raw.usterki_top3 : Array.isArray(raw.usterki) ? raw.usterki : [])
    .map(toFault)
    .filter((f): f is QtFault => !!f)
    .slice(0, 3);
  const c = isObj(raw.cena) ? raw.cena : {};
  const pozycja = toPricePosition(c.pozycja ?? raw.cena);
  return {
    rozpoznany: toVehicle(raw.rozpoznany),
    flagi,
    usterki,
    cena: { pozycja, etykieta: PRICE_LABEL[pozycja], komentarz: str(c, "komentarz", "comment", "opis") ?? "" },
    brakVin: raw.brak_vin === true || raw.brakVin === true,
    nastepnyKrok: (typeof raw.nastepny_krok === "string" && raw.nastepny_krok) || (isObj(raw.nastepny_krok) && str(raw.nastepny_krok, "tekst", "opis", "text")) || "",
  };
}

export const MIN_QUICK_TEXT = 30;

/** Wywołanie API z czytelnymi błędami. `fetchImpl` – do testów. */
export async function runQuickTest(input: QuickTestInput, fetchImpl: typeof fetch = fetch): Promise<QuickTestResult> {
  let res: Response;
  try {
    res = await fetchImpl("/api/szybki-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tekst: input.tekst, cena: input.cena ?? null, przebieg: input.przebieg ?? null, rocznik: input.rocznik ?? null }),
    });
  } catch {
    throw new QuickTestError("Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg = isObj(body) ? str(body, "error", "message", "komunikat") : null;
    if (res.status === 404) throw new QuickTestError("Szybki test jest chwilowo niedostępny. Spróbuj za chwilę albo przejdź do pełnego raportu.", 404);
    if (res.status === 429) throw new QuickTestError(msg ?? "Za dużo prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie.", 429);
    if (res.status === 400 || res.status === 422) throw new QuickTestError(msg ?? "Sprawdź wpisane dane – tekst ogłoszenia jest wymagany.", res.status);
    throw new QuickTestError(msg ?? "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.", res.status);
  }
  return normalizeQuickTest(body);
}

/** Tekst do „Udostępnij wynik”. */
export function shareText(r: QuickTestResult): string {
  const lines = [`Szybki test ogłoszenia${r.rozpoznany ? `: ${r.rozpoznany.nazwa}` : ""}`];
  if (r.flagi.length) lines.push(`Do wyjaśnienia ze sprzedawcą: ${r.flagi.length} ${r.flagi.length === 1 ? "sprawa" : r.flagi.length < 5 ? "sprawy" : "spraw"} (${[...new Set(r.flagi.map((f) => f.tytul || f.opis))].slice(0, 3).join(", ").toLowerCase()})`);
  else lines.push("Brak sygnałów do wyjaśnienia w treści ogłoszenia.");
  if (r.usterki.length) lines.push(`Typowe usterki: ${r.usterki.map((u) => u.tytul).join("; ")}`);
  if (r.cena.pozycja !== "brak_danych") lines.push(r.cena.etykieta);
  if (r.brakVin) lines.push("Brak VIN w ogłoszeniu – warto poprosić sprzedawcę.");
  return lines.join("\n");
}

/** Liczby z pól formularza: „32 900 zł” → 32900. */
export const toInt = (s: string): number | null => {
  const n = Number(s.replace(/[\s .,złkm]/gi, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : Math.round(n);
};
