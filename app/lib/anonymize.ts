/**
 * Anonimizacja tekstu ogłoszenia PRZED wysłaniem do modelu i przed zapisem w bazie.
 *
 * Wycinamy: e-maile, linki, numery telefonów (PL), numery rejestracyjne (PL),
 * dane kontaktowe (linie „Kontakt: Jan Kowalski”, „Pan Marek”, podpisy).
 * Zostawiamy: VIN (17 znaków) – jest potrzebny do raportu.
 *
 * To heurystyka – celowo raczej wytnie za dużo niż za mało.
 */

export const PLACEHOLDERS = {
  telefon: "[telefon]",
  email: "[email]",
  nrRej: "[nr rej]",
  link: "[link]",
  kontakt: "[kontakt]",
} as const;

export interface AnonymizeStats {
  telefon: number;
  email: number;
  nrRej: number;
  link: number;
  kontakt: number;
}

export interface AnonymizeResult {
  text: string;
  stats: AnonymizeStats;
}

// Granica „słowa” uwzględniająca polskie litery.
const NB = "(?<![\\p{L}\\d])"; // nie poprzedzone literą/cyfrą
const NA = "(?![\\p{L}\\d])"; // nie następuje litera/cyfra

/* ---------- e-mail ---------- */
const EMAIL_RE = new RegExp(
  String.raw`[\p{L}\d._%+-]+\s?(?:@|\(at\)|\[at\]|\(małpa\)|\[małpa\])\s?[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.[a-z]{2,}`,
  "giu",
);

/* ---------- linki ---------- */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/giu;
const BARE_DOMAIN_RE = new RegExp(
  `${NB}[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:pl|com|eu|net|org|de|info|biz|io)(?:\\/[^\\s<>"')\\]]*)?${NA}`,
  "giu",
);

/* ---------- telefony ---------- */
const SEP = "[ \\t.\\-]?";
const PREFIX = String.raw`(?:(?:\+|00)[ \t]?48[ \t.\-]?|\([ \t]?(?:\+|00)?48[ \t]?\)[ \t]?)`;
const PHONE_BODIES = [
  `\\d{3}${SEP}\\d{3}${SEP}\\d{3}`, // 600 700 800 / 600-700-800 / 600700800
  `\\d{3}${SEP}\\d{2}${SEP}\\d{2}${SEP}\\d{2}`, // 600 12 34 56
  `\\d{2}${SEP}\\d{3}${SEP}\\d{2}${SEP}\\d{2}`, // 22 123 45 67
  `\\(\\d{2}\\)[ \\t]?\\d{3}${SEP}\\d{2}${SEP}\\d{2}`, // (22) 123-45-67
];
// Nie traktujemy jako telefon liczb, po których stoi jednostka (km, zł…).
const NOT_UNIT = String.raw`(?![ \t]*(?:km|tys|zł|zl|pln|eur|€|cm3|ccm|kg|r\.|rok))`;
const PHONE_RE = new RegExp(
  `(?<![\\p{L}\\d+(])(?:${PREFIX})?(?:${PHONE_BODIES.join("|")})${NA}${NOT_UNIT}`,
  "giu",
);

/* ---------- numery rejestracyjne ---------- */
// Pierwsza litera = wyróżnik województwa. Wielkie litery (tak piszą je ludzie w ogłoszeniach).
const PLATE_RE = /(?<![\p{L}\d])([BCDEFGKLNOPRSTWZ][A-Z]{1,2})[ \t-]?(\d[A-Z0-9]{3,4})(?![\p{L}\d])/gu;
// Skróty motoryzacyjne i słowa, które wyglądają jak wyróżnik powiatu.
const PLATE_STOPLIST = new Set([
  "BMW", "TDI", "TSI", "TFSI", "FSI", "CDI", "CRD", "HDI", "DCI", "CDTI", "TDCI", "DSG", "CVT", "GTI", "GTD",
  "ABS", "ESP", "LPG", "CNG", "KM", "KW", "PLN", "EUR", "SUV", "TCE", "MPI", "GDI", "CRDI", "VTEC", "TDDI",
  "SDI", "PDC", "LED", "NAVI", "SE", "SR", "ST", "RS", "GT", "TT", "DS", "CC", "GL", "GLE", "GLC", "CLA",
  "CLS", "SL", "SLK", "EV", "PHEV", "ECO", "OC", "NR", "ROK", "TEL", "GAZ", "DPF", "FAP", "EGR", "BLUE", "CD",
  "TD", "D", "E", "BOSE", "LCI", "FL", "FR", "ED", "EDC", "DKG", "SMG", "CR",
]);

/* ---------- dane kontaktowe ---------- */
const NAME = String.raw`\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?(?:[ \t]+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?)?`;
const ALWAYS_CONTACT_LABELS = String.raw`(?:osoba do kontaktu|osoba kontaktowa|kontakt|imię i nazwisko|imie i nazwisko|nazwisko|dzwonić do|dzwonic do|proszę pytać o|prosze pytac o|pytać o|pytac o)`;
const NAME_ONLY_LABELS = String.raw`(?:sprzedający|sprzedajacy|sprzedawca|właściciel|wlasciciel|imię|imie)`;
const SPACE_LABELS = String.raw`(?:dzwonić do|dzwonic do|proszę pytać o|prosze pytac o|pytać o|pytac o)`;
const CONTACT_LINE_RE = new RegExp(
  String.raw`^([ \t]*${ALWAYS_CONTACT_LABELS}[ \t]*[:\-–][ \t]*|[ \t]*${SPACE_LABELS}[ \t]+)(.+)$`,
  "gimu",
);
const NAME_LABEL_LINE_RE = new RegExp(
  String.raw`^([ \t]*${NAME_ONLY_LABELS}[ \t]*[:\-–][ \t]*)((?:pan|pani)[ \t]+)?(${NAME})[ \t]*$`,
  "gimu",
);
const PAN_NAME_RE = new RegExp(String.raw`(?<![\p{L}])(Pan|Pani|Pana|Panią|Panem)[ \t]+(?!Państw)(${NAME})`, "gu");
const SIGNATURE_RE = new RegExp(String.raw`((?:pozdrawiam|z poważaniem|z powazaniem)[ \t]*[,!.]?\s+)(${NAME})[ \t]*$`, "gimu");

// Słowa, które po „Sprzedawca:” są informacją, a nie nazwiskiem.
const NOT_A_NAME = /^(osoba|firma|komis|prywatn|dealer|diler|salon|autoryzowan|faktura|handlarz)/iu;

function countingReplace(text: string, re: RegExp, fn: (whole: string, ...groups: string[]) => string, onHit: () => void): string {
  return text.replace(re, (...args: unknown[]) => {
    // args = [dopasowanie, ...grupy (string|undefined), offset (number), cały tekst, grupy nazwane?]
    const offsetIdx = args.findIndex((a, i) => i > 0 && typeof a === "number");
    const whole = args[0] as string;
    const groups = args.slice(1, offsetIdx).map((g) => (typeof g === "string" ? g : ""));
    const out = fn(whole, ...groups);
    if (out !== whole) onHit();
    return out;
  });
}

export function anonymize(input: string): AnonymizeResult {
  const stats: AnonymizeStats = { telefon: 0, email: 0, nrRej: 0, link: 0, kontakt: 0 };
  let t = input.normalize("NFC");

  // 1. e-maile (przed linkami – inaczej domena zostałaby linkiem)
  t = countingReplace(t, EMAIL_RE, () => PLACEHOLDERS.email, () => stats.email++);

  // 2. linki
  t = countingReplace(t, URL_RE, () => PLACEHOLDERS.link, () => stats.link++);
  t = countingReplace(t, BARE_DOMAIN_RE, () => PLACEHOLDERS.link, () => stats.link++);

  // 3. telefony
  t = countingReplace(t, PHONE_RE, () => PLACEHOLDERS.telefon, () => stats.telefon++);

  // 4. numery rejestracyjne
  t = countingReplace(
    t,
    PLATE_RE,
    (whole, letters) => (PLATE_STOPLIST.has(letters) ? whole : PLACEHOLDERS.nrRej),
    () => stats.nrRej++,
  );

  // 5. dane kontaktowe
  t = countingReplace(
    t,
    CONTACT_LINE_RE,
    (whole, label, rest) => {
      const stripped = rest.replace(/\[(telefon|email|link|nr rej|kontakt)\]/g, "").replace(/[\s,;:.\-–/|]+/g, "");
      if (stripped.length === 0) return whole; // w linii były już tylko placeholdery
      return `${label}${PLACEHOLDERS.kontakt}`;
    },
    () => stats.kontakt++,
  );
  t = countingReplace(
    t,
    NAME_LABEL_LINE_RE,
    (whole, label, _pan, name) => (NOT_A_NAME.test(name ?? "") ? whole : `${label}${PLACEHOLDERS.kontakt}`),
    () => stats.kontakt++,
  );
  t = countingReplace(t, PAN_NAME_RE, () => PLACEHOLDERS.kontakt, () => stats.kontakt++);
  t = countingReplace(t, SIGNATURE_RE, (_w, greeting) => `${greeting}${PLACEHOLDERS.kontakt}`, () => stats.kontakt++);

  return { text: t, stats };
}

/** Skrót: tylko tekst. */
export function anonymizeText(input: string): string {
  return anonymize(input).text;
}
