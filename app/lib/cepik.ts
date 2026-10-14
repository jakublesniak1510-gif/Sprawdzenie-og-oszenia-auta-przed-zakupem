/**
 * Tolerancyjny parser wklejonego wyniku z gov.pl „Historia Pojazdu”.
 * Format strony się zmienia, więc nie zakładamy struktury – szukamy par (data, „N km”).
 * Zawsze jest fallback: ręczna tabela odczytów w formularzu.
 */

export interface MileageReading {
  data: string; // RRRR-MM-DD
  km: number;
}

// Bez \b – tekst wklejony z telefonu bywa zlepiony („techniczne12/03/2018Wynik”, „15.03.2021r.”).
const DATE_RE = /(?<!\d)(?:(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2}))(?!\d)/g;
// „km”/„KM”; za jednostką nie może być mała litera („kmh”), ale wielka może – tekst zlepiony („41.250 kmBadanie”).
const KM_RE = /(\d{1,3}(?:[\u00a0 .]\d{3})+|\d{1,7})\s*(?:km|KM|Km)(?![a-ząćęłńóśźż])/g;

function iso(y: number, m: number, d: number): string | null {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Normalizuje datę z formularza (RRRR-MM-DD, DD.MM.RRRR) do RRRR-MM-DD. */
export function normalizeDate(s: string): string | null {
  DATE_RE.lastIndex = 0;
  const m = DATE_RE.exec(s.trim());
  DATE_RE.lastIndex = 0; // matchAll kopiuje lastIndex – nie zostawiamy stanu
  if (!m) return null;
  return m[3] ? iso(+m[3], +m[2], +m[1]) : iso(+m[4], +m[5], +m[6]);
}

export function parseHistoriaPojazdu(text: string, maxDistance = 400): MileageReading[] {
  if (!text.trim()) return [];
  const dates: { idx: number; iso: string }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const v = m[3] ? iso(+m[3], +m[2], +m[1]) : iso(+m[4], +m[5], +m[6]);
    if (v) dates.push({ idx: m.index ?? 0, iso: v });
  }
  const out: MileageReading[] = [];
  for (const m of text.matchAll(KM_RE)) {
    const km = Number(m[1].replace(/[  .]/g, ""));
    if (!Number.isFinite(km) || km > 2_000_000) continue;
    const idx = m.index ?? 0;
    // „110 kW (150 KM)” – to moc (konie mechaniczne), nie przebieg.
    if (/\bkw\b|\bmoc\b/i.test(text.slice(Math.max(0, idx - 30), idx))) continue;
    // 1) data w tym samym wierszu (najpierw przed liczbą, potem za nią), 2) najbliższa data przed liczbą.
    const lineStart = text.lastIndexOf("\n", idx) + 1;
    const nl = text.indexOf("\n", idx);
    const lineEnd = nl === -1 ? text.length : nl;
    const before = dates.filter((d) => d.idx < idx);
    const sameLine =
      before.filter((d) => d.idx >= lineStart).at(-1) ?? dates.find((d) => d.idx > idx && d.idx < lineEnd) ?? null;
    const best = sameLine ?? before.at(-1) ?? null;
    const bestDist = best ? Math.abs(idx - best.idx) : Infinity;
    if (best && bestDist <= maxDistance) out.push({ data: best.iso, km });
  }
  return dedupeSort(out);
}

export interface CepikParseResult {
  odczyty: MileageReading[];
  /** Data pierwszej rejestracji (najwcześniejsza – przy imporcie zwykle za granicą), RRRR-MM-DD. */
  pierwszaRejestracja: string | null;
  /** Data pierwszej rejestracji w Polsce, RRRR-MM-DD (null, gdy tekst nie wskazuje kraju). */
  pierwszaRejestracjaPl: string | null;
  /** Kody sygnałów (np. `import`, `cofniecie_przebiegu`, `kradziez_w_historii`) – do testów i logiki. */
  sygnaly: string[];
  /** Istotne informacje z historii (status rejestracji, kradzież, import, przerwy…) – neutralnie, po polsku, do promptu. */
  uwagi: string[];
}

const FIRST_REG_RE = /pierwsz\p{L}*\s+rejestracj\p{L}*/iu;
/** Zaprzeczenie w całej linii („pojazd nie figuruje jako kradziony”, „brak informacji o kradzieży”). */
const LINE_NEGATION_RE = /\bnie\s+(figuruje|był\p{L}*|jest|odnotowano|zgłoszono|stwierdzono|dotyczy)\b|\bbrak\s+(informacji|wpisów|zgłoszeń|danych|adnotacji)\b/iu;
/** Zaprzeczenie tuż przed słowem kluczowym (do 3 słów): „nie był kradziony”, „bez szkody całkowitej”. */
const BEFORE_NEGATION_RE = /(^|[^\p{L}])(nie|brak|bez)\s+(\p{L}+\s+){0,3}$/iu;
/** Zaprzeczenie zaraz po: „Wyrejestrowany: NIE”, „Kradzież: brak”. */
const AFTER_NEGATION_RE = /^\p{L}*\s*:\s*(nie|brak|-)(?!\p{L})/iu;

interface SignalRule {
  code: string;
  re: RegExp;
  text: string | ((m: RegExpExecArray) => string);
  /** true = pomiń trafienie z zaprzeczeniem („nie figuruje jako kradziony”). */
  negatable?: boolean;
}

const SIGNAL_RULES: SignalRule[] = [
  { code: "kradziez_w_historii", re: /kradzie\p{L}*|kradzion\p{L}*|poszukiwan\p{L}*/iu, negatable: true, text: "W historii pojazdu jest informacja o kradzieży lub poszukiwaniu pojazdu – sprawdź zgodność numerów VIN (nadwozie, szyby, tabliczki) i dokumenty z odzyskania." },
  { code: "wyrejestrowany", re: /wyrejestrowan\p{L}*|wyrejestrowani\p{L}*/iu, negatable: true, text: "Historia zawiera informację o wyrejestrowaniu pojazdu – sprawdź aktualny status rejestracji, powód wyrejestrowania i możliwość ponownej rejestracji." },
  { code: "wycofany_z_ruchu", re: /czasowo\s+wycofan\p{L}*|wycofan\p{L}*\s+z\s+ruchu/iu, negatable: true, text: "Pojazd był czasowo wycofany z ruchu – zapytaj sprzedawcę o powód." },
  { code: "szkoda_calkowita", re: /szkod\p{L}*\s+całkowit\p{L}*/iu, negatable: true, text: "W historii jest informacja o szkodzie całkowitej – auto po poważnym wypadku." },
  { code: "import", re: /sprowadzon\p{L}*|import\p{L}*|rejestracj\p{L}*[^\n]{0,20}za\s+granic\p{L}*|zarejestrowan\p{L}*\s+za\s+granic\p{L}*/iu, negatable: true, text: "Pojazd sprowadzony z zagranicy – przebieg i historia sprzed rejestracji w Polsce nie są widoczne w CEPiK." },
  { code: "brak_historii_przed_importem", re: /(sprzed|przed)\s+(pierwsz\p{L}*\s+)?rejestracj\p{L}*\s+w\s+(polsce|kraju)[^\n]{0,30}nie\s+(są|jest)\s+dostępn/iu, text: "Historia sprzed rejestracji w Polsce jest niedostępna – poproś o dokumenty z kraju pochodzenia (poprzedni dowód rejestracyjny, historia serwisowa)." },
  { code: "zmiana_wlasciciela", re: /zmian\p{L}*\s+właściciel\p{L}*/iu, negatable: true, text: "W historii są zmiany właściciela – zapytaj, od kiedy sprzedający ma auto." },
  { code: "wlasciciel_firma", re: /osoba\s+prawna|leasing\p{L}*|\bfirm[aąy]\b/iu, negatable: true, text: "Auto należało do firmy (osoba prawna/leasing) – zwykle duże roczne przebiegi i wielu kierowców." },
  { code: "badanie_negatywne", re: /(wynik\p{L}*[^\n]{0,25}(?<!brak\s)(?<!bez\s)negatywn|(?<!brak\s)(?<!bez\s)negatywn\p{L}*\s+(wynik|badani))/iu, text: "W historii jest negatywny wynik badania technicznego – zapytaj, co było przyczyną i czy usterkę usunięto." },
  { code: "badanie_dodatkowe", re: /badani\p{L}*\s+(techniczn\p{L}*\s+)?dodatkow\p{L}*/iu, text: "W historii jest dodatkowe badanie techniczne (np. po wypadku, odzyskaniu lub zmianach konstrukcyjnych) – zapytaj o powód." },
  { code: "szczegolne_uzycie", re: /(?<!\p{L})(taxi|taksówk\p{L}*|nauk\p{L}*\s+jazdy|wypożyczaln\p{L}*|uprzywilejowan\p{L}*)/iu, negatable: true, text: (m) => `Pojazd mógł być używany w szczególnym celu (${m[1].toLowerCase()}) – zwykle oznacza to intensywną eksploatację.` },
  { code: "zatrzymany_dowod", re: /zatrzyman\p{L}*\s+dow\p{L}*\s+rejestracyjn\p{L}*/iu, negatable: true, text: "Historia zawiera zatrzymanie dowodu rejestracyjnego – zapytaj o powód i czy dowód został zwrócony." },
  { code: "brak_aktualnego_oc", re: /brak\s+(ważnego\s+|aktualnego\s+)?(ubezpieczenia|polisy|OC)\b|\bOC\s*:\s*(brak|nieaktualn\p{L}*)/iu, text: "Brak aktualnego ubezpieczenia OC według CEPiK – auto nie może legalnie poruszać się po drogach (jazda próbna!)." },
  { code: "brak_oc_w_okresie", re: /okres\p{L}*\s+bez\s+([\p{L}]+\s+){0,2}(polisy|ubezpieczenia|OC)/iu, text: "W historii jest okres bez polisy OC – auto mogło stać lub być wycofane z ruchu; do wyjaśnienia ze sprzedawcą." },
  { code: "brak_aktualnego_badania", re: /badanie\s+techniczne\s*:\s*(nieaktualn\p{L}*|nieważn\p{L}*|brak)|brak\s+(ważnego\s+|aktualnego\s+)badani\p{L}*/iu, text: "Brak aktualnego badania technicznego według CEPiK." },
];

/** Minimalna przerwa między odczytami (dni), uznawana za „przerwę w badaniach” (schemat 3–2–1 daje ≤ 2 lata). */
const INSPECTION_GAP_DAYS = 790;

function isNegated(line: string, m: RegExpExecArray): boolean {
  const before = line.slice(Math.max(0, m.index - 40), m.index);
  const after = line.slice(m.index, m.index + m[0].length + 15);
  return LINE_NEGATION_RE.test(line) || BEFORE_NEGATION_RE.test(before) || AFTER_NEGATION_RE.test(after);
}

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const plDate = (iso: string) => iso.split("-").reverse().join(".");

/** Daty pierwszej rejestracji z linii zawierających „pierwsza rejestracja” (data przed albo po frazie). */
function firstRegistrations(lines: string[]): { pl: string | null; abroad: string[]; generic: string[] } {
  const out = { pl: null as string | null, abroad: [] as string[], generic: [] as string[] };
  for (const line of lines) {
    const ph = FIRST_REG_RE.exec(line);
    if (!ph || /przed\s+pierwsz/iu.test(line)) continue;
    const phEnd = ph.index + ph[0].length;
    const dates = [...line.matchAll(DATE_RE)].map((m) => ({ idx: m.index ?? 0, end: (m.index ?? 0) + m[0].length, iso: normalizeDate(m[0]) }));
    const after = dates.find((d) => d.idx >= phEnd && d.idx - phEnd <= 60 && d.iso);
    const before = [...dates].reverse().find((d) => d.end <= ph.index && ph.index - d.end <= 15 && d.iso);
    const d = after ?? before;
    if (!d?.iso) continue;
    const ctx = (after ? line.slice(ph.index, after.idx) : line.slice(ph.index, phEnd + 30)).toLowerCase();
    if (/w\s+polsce|w\s+kraju/u.test(ctx)) out.pl ??= d.iso;
    else if (/za\s+granic/u.test(ctx)) out.abroad.push(d.iso);
    else out.generic.push(d.iso);
  }
  return out;
}

/**
 * Pełny parser wklejonej historii z CEPiK: odczyty przebiegu, daty pierwszej rejestracji, sygnały i uwagi
 * (status rejestracji, kradzież, import, przerwy w badaniach…). Uwagi trafiają do promptu jako fakty do oceny przez model.
 */
export function parseCepik(text: string): CepikParseResult {
  const out: CepikParseResult = { odczyty: [], pierwszaRejestracja: null, pierwszaRejestracjaPl: null, sygnaly: [], uwagi: [] };
  if (!text?.trim()) return out;
  out.odczyty = parseHistoriaPojazdu(text);
  const lines = text.split(/\r?\n/);

  const reg = firstRegistrations(lines);
  out.pierwszaRejestracjaPl = reg.pl;
  const all = [...reg.abroad, ...reg.generic, ...(reg.pl ? [reg.pl] : [])].sort();
  out.pierwszaRejestracja = all[0] ?? null;

  const add = (code: string, uwaga: string) => {
    if (!out.sygnaly.includes(code)) {
      out.sygnaly.push(code);
      out.uwagi.push(uwaga);
    }
  };

  for (const rule of SIGNAL_RULES) {
    for (const line of lines) {
      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
      let hit: RegExpExecArray | null = null;
      for (let m = re.exec(line); m; m = re.exec(line)) {
        if (!rule.negatable || !isNegated(line, m)) {
          hit = m;
          break;
        }
      }
      if (hit) {
        add(rule.code, typeof rule.text === "string" ? rule.text : rule.text(hit));
        break;
      }
    }
  }

  // Sygnały wyliczane z odczytów.
  const cof = analyzeMileage(out.odczyty, null).cofniecia;
  if (cof.length) {
    const c = cof[0];
    add("cofniecie_przebiegu", `Spadek przebiegu między badaniami ${plDate(c.z.data)} (${c.z.km.toLocaleString("pl-PL")} km) i ${plDate(c.na.data)} (${c.na.km.toLocaleString("pl-PL")} km) – do wyjaśnienia ze sprzedawcą.`);
  }
  for (let i = 1; i < out.odczyty.length; i++) {
    const a = out.odczyty[i - 1];
    const b = out.odczyty[i];
    if (daysBetween(a.data, b.data) > INSPECTION_GAP_DAYS) {
      add("przerwa_w_badaniach", `Przerwa w badaniach technicznych między ${plDate(a.data)} a ${plDate(b.data)} (ok. ${Math.round(daysBetween(a.data, b.data) / 30.4)} mies.) – auto mogło stać lub być wycofane z ruchu.`);
      break;
    }
  }

  const owners = /liczba\s+(właścicieli|współwłaścicieli)\s*:?\s*(\d{1,2})/iu.exec(text);
  if (owners) out.uwagi.push(`Liczba właścicieli wg CEPiK: ${owners[2]}.`);
  if (out.pierwszaRejestracjaPl && out.pierwszaRejestracja && out.pierwszaRejestracja < out.pierwszaRejestracjaPl) {
    out.uwagi.push(`Pierwsza rejestracja: ${plDate(out.pierwszaRejestracja)}, w Polsce: ${plDate(out.pierwszaRejestracjaPl)}.`);
  }
  return out;
}

export function dedupeSort(rs: MileageReading[]): MileageReading[] {
  const seen = new Set<string>();
  return rs
    .filter((r) => {
      const k = `${r.data}|${r.km}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km);
}

export interface MileageAnalysis {
  cofniecia: { z: MileageReading; na: MileageReading }[];
  /** Ostatni odczyt wyższy od deklarowanego przebiegu. */
  deklarowanyNizszyOdOstatniego: boolean;
  ostatni: MileageReading | null;
}

/** Deterministyczna analiza – przekazywana modelowi jako fakt, żeby nie liczył „na oko”. */
export function analyzeMileage(readings: MileageReading[], declaredKm: number | null): MileageAnalysis {
  const sorted = dedupeSort(readings);
  const cofniecia: MileageAnalysis["cofniecia"] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].km < sorted[i - 1].km) cofniecia.push({ z: sorted[i - 1], na: sorted[i] });
  }
  const ostatni = sorted.at(-1) ?? null;
  return {
    cofniecia,
    deklarowanyNizszyOdOstatniego: !!(ostatni && declaredKm !== null && declaredKm < ostatni.km),
    ostatni,
  };
}
