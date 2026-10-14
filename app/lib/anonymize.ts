/**
 * Anonimizacja tekstu ogłoszenia PRZED wysłaniem do modelu i przed zapisem w bazie.
 *
 * Wycinamy: e-maile (też „(at)/(dot)/[kropka]”), linki i profile (@nick, fb.me/…), numery telefonów (PL i zagraniczne),
 * numery rejestracyjne (PL; małymi literami tylko w kontekście „nr rej./tablice/blachy”), adresy (ul./al./os. + kod),
 * dane kontaktowe („Kontakt: …” także w środku linii i w następnej linii, „pan Marek”, podpisy, „(Tomek)”,
 * imię obok telefonu, bloki z OLX „Marek Nowak / Osoba prywatna”).
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
  adres: "[adres]",
} as const;

export interface AnonymizeStats {
  telefon: number;
  email: number;
  nrRej: number;
  link: number;
  kontakt: number;
  adres: number;
}

export interface AnonymizeResult {
  text: string;
  stats: AnonymizeStats;
}

// Granica „słowa” uwzględniająca polskie litery.
const NB = "(?<![\\p{L}\\d])"; // nie poprzedzone literą/cyfrą
const NA = "(?![\\p{L}\\d])"; // nie następuje litera/cyfra

/* ---------- e-mail ---------- */
const AT = String.raw`\s?(?:@|[(\[]\s?(?:at|małpa|malpa)\s?[)\]])\s?`;
const DOT = String.raw`(?:\.|\s?[(\[]\s?(?:dot|kropka)\s?[)\]]\s?)`;
const EMAIL_RE = new RegExp(String.raw`[\p{L}\d._%+-]+${AT}[\p{L}\d-]+(?:${DOT}[\p{L}\d-]+)*${DOT}[a-z]{2,}(?![\p{L}\d])`, "giu");

/* ---------- profile społecznościowe (@nick) ---------- */
const HANDLE_RE = /(?<![\p{L}\d.@])@[A-Za-z0-9_.]{3,30}(?![A-Za-z0-9_])/gu;

/* ---------- linki ---------- */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/giu;
const BARE_DOMAIN_RE = new RegExp(
  `${NB}[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:pl|com|eu|net|org|de|info|biz|io|me|ly|gl|co|tv|uk|ru|ua|cz|lt|sk|be|nl|fr|it|es|ch|se)(?:\\/[^\\s<>"')\\]]*)?${NA}`,
  "giu",
);

/* ---------- telefony ---------- */
const SEP = "[ \\t.\\-/_]?";
const PREFIX = String.raw`(?:(?:\+|00)[ \t]?48[ \t.\-]?|\([ \t]?(?:\+|00)?48[ \t]?\)[ \t]?)`;
const PHONE_BODIES = [
  `\\d{3}${SEP}\\d{3}${SEP}\\d{3}`, // 600 700 800 / 600-700-800 / 600700800
  `\\d{3}${SEP}\\d{2}${SEP}\\d{2}${SEP}\\d{2}`, // 600 12 34 56
  `\\d{2}${SEP}\\d{3}${SEP}\\d{2}${SEP}\\d{2}`, // 22 123 45 67
  `\\(\\d{2}\\)[ \\t]?\\d{3}${SEP}\\d{2}${SEP}\\d{2}`, // (22) 123-45-67
];
// Nie traktujemy jako telefon liczb, po których stoi jednostka (km, zł…).
const NOT_UNIT = String.raw`(?![ \t]*(?:km|tys|zł|zl|pln|eur|€|cm3|ccm|kg|r\.|rok))`;
/** Numery zagraniczne: +49 151 23456789, 0049 …, +420 … (bez +48 – te łapie PHONE_RE). */
const INTL_PHONE_RE = new RegExp(String.raw`(?<![\p{L}\d])(?:\+|00)(?!48)\d{2,3}(?:[ \t.\-/]?\d{2,8}){2,4}(?![\p{L}\d])`, "gu");
const PHONE_RE = new RegExp(
  `(?<![\\p{L}\\d+(])(?:${PREFIX})?(?:${PHONE_BODIES.join("|")})${NA}${NOT_UNIT}`,
  "giu",
);

/* ---------- numery rejestracyjne ---------- */
// Pierwsza litera = wyróżnik województwa. Wielkie litery (tak piszą je ludzie w ogłoszeniach).
const PLATE_RE = /(?<![\p{L}\d])([BCDEFGKLNOPRSTWZ][A-Z]{1,2})[ \t-]?(\d[A-Z0-9]{3,4})(?![\p{L}\d])/gu;
// Małymi literami tylko po „nr rej.”, „tablice”, „blachy” („nr rej. wx1234a”).
const PLATE_CTX_RE = /((?:nr\.?[ \t]*)?(?:rej\p{L}*|tablic\p{L}*|blach\p{L}*)(?!\p{L})\.?[ \t]*[:\-–]?[ \t]*)([bcdefgklnoprstwz][a-z]{1,2})[ \t-]?(\d[a-z0-9]{3,4})(?![\p{L}\d])/giu;
// Skróty motoryzacyjne i słowa, które wyglądają jak wyróżnik powiatu.
const PLATE_STOPLIST = new Set([
  "BMW", "TDI", "TSI", "TFSI", "FSI", "CDI", "CRD", "HDI", "DCI", "CDTI", "TDCI", "DSG", "CVT", "GTI", "GTD",
  "ABS", "ESP", "LPG", "CNG", "KM", "KW", "PLN", "EUR", "SUV", "TCE", "MPI", "GDI", "CRDI", "VTEC", "TDDI",
  "SDI", "PDC", "LED", "NAVI", "SE", "SR", "ST", "RS", "GT", "TT", "DS", "CC", "GL", "GLE", "GLC", "CLA",
  "CLS", "SL", "SLK", "EV", "PHEV", "ECO", "OC", "NR", "ROK", "TEL", "GAZ", "DPF", "FAP", "EGR", "BLUE", "CD",
  "TD", "D", "E", "BOSE", "LCI", "FL", "FR", "ED", "EDC", "DKG", "SMG", "CR",
]);

/* ---------- adresy ---------- */
const STREET_RE = /(?<!\p{L})(?:ul|al|os|pl)\.[ \t]*\p{Lu}[\p{L}.\- ]{1,40}?[ \t]+\d{1,4}[a-zA-Z]?(?:[ \t]*\/[ \t]*\d{1,4})?(?:[ \t]*,?[ \t]*\d{2}-\d{3}(?:[ \t]+\p{Lu}\p{Ll}+(?:[ \t-]\p{Lu}\p{Ll}+)?)?)?/gu;
const POSTAL_CITY_RE = /(?<![\p{L}\d])\d{2}-\d{3}[ \t]+\p{Lu}\p{Ll}+(?:[ \t-]\p{Lu}\p{Ll}+)?/gu;

/* ---------- dane kontaktowe ---------- */
/**
 * Popularne polskie imiona (ok. 200 + zdrobnienia) – używane TYLKO razem z kontekstem (telefon obok, nawias,
 * „Zapraszam,”, „Kontakt”), nigdy samodzielnie. Bez imion będących nazwami modeli aut (np. „Leon”).
 */
export const FIRST_NAMES = new Set(
  `Jan Piotr Paweł Krzysztof Tomasz Andrzej Michał Marcin Łukasz Mateusz Grzegorz Adam Marek Rafał Robert Dariusz Mariusz Zbigniew Ryszard Kazimierz Jerzy Stanisław Tadeusz Józef Jacek Sławomir Artur Sebastian Daniel Damian Przemysław Arkadiusz Kamil Maciej Wiesław Henryk Waldemar Mirosław Leszek Roman Zdzisław Edward Janusz Bogdan Czesław Krystian Adrian Norbert Radosław Hubert Bartosz Bartłomiej Dawid Konrad Karol Kacper Wiktor Oskar Natan Tymon Emil Eryk Ireneusz Witold Zenon Lech Mieczysław Marian Władysław Bolesław Jarosław Zygmunt Sylwester Gabriel Julian Stefan Ludwik Feliks Kajetan Borys Fabian Ksawery Remigiusz Seweryn Dominik Patryk Jakub Wojciech Aleksander Mikołaj Igor Filip Szymon Antoni Franciszek Oliwer Ignacy Stanisław Tymoteusz Maksymilian Alan Nikodem Kuba Tomek Janek Bartek Krzysiek Piotrek Wojtek Grzesiek Maciek Jarek Darek Mirek Sławek Przemek Radek Rysiek Staszek Zbyszek Jurek Józek Heniek Waldek Romek Jędrek Arek Olek Mati Seba Kazik Marcinek Adaś Michałek Anna Maria Katarzyna Małgorzata Agnieszka Barbara Ewa Krystyna Elżbieta Zofia Teresa Magdalena Joanna Janina Monika Danuta Jadwiga Aleksandra Halina Irena Beata Marta Dorota Karolina Jolanta Natalia Iwona Grażyna Bożena Urszula Justyna Renata Alicja Paulina Sylwia Agata Wiesława Patrycja Julia Hanna Helena Lena Maja Zuzanna Oliwia Amelia Wiktoria Emilia Antonina Laura Gabriela Martyna Weronika Kinga Klaudia Izabela Edyta Anita Ilona Kamila Ewelina Dominika Marzena Mirosława Stanisława Lucyna Genowefa Wanda Bogumiła Henryka Regina Celina Kazimiera Lidia Mariola Aneta Wioletta Violetta Roksana Nikola Milena Angelika Adrianna Daria Diana Sandra Kornelia Michalina Nina Kasia Gosia Małgosia Basia Ola Asia Ania Magda Ela Iza Ula Zosia Madzia Marysia Ewka Jola Bogusia Krysia Hania Tosia Julka Natka Agatka`.split(/\s+/),
);
/** Słowa poprzedzające, po których „imię” jest nazwą modelu (Opel Adam, Seat Leon…). */
const MAKES = new Set(["opel", "seat", "volkswagen", "vw", "skoda", "škoda", "toyota", "ford", "renault", "fiat", "kia", "hyundai", "mazda", "nissan", "peugeot", "citroen", "dacia", "bmw", "audi", "mercedes", "honda", "suzuki", "volvo", "mitsubishi"]);

const NAME = String.raw`\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?(?:[ \t]+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?)?`;
const ALWAYS_CONTACT_LABELS = String.raw`(?:osoba do kontaktu|osoba kontaktowa|kontakt|imię i nazwisko|imie i nazwisko|nazwisko|dzwonić do|dzwonic do|proszę pytać o|prosze pytac o|pytać o|pytac o)`;
const NAME_ONLY_LABELS = String.raw`(?:sprzedający|sprzedajacy|sprzedawca|właściciel|wlasciciel|imię|imie)`;
const SPACE_LABELS = String.raw`(?:dzwonić do|dzwonic do|proszę pytać o|prosze pytac o|pytać o|pytac o)`;
/** „Kontakt: …” na początku linii ALBO w środku linii po [.,;!] („…zadbane. Kontakt: Jan Kowalski, tel…”). */
const CONTACT_LINE_RE = new RegExp(
  String.raw`(^|[.,;!][ \t]*)([ \t]*${ALWAYS_CONTACT_LABELS}[ \t]*[:\-–][ \t]*|[ \t]*${SPACE_LABELS}[ \t]+)(\S.*)$`,
  "gimu",
);
/** „Kontakt Jan Kowalski” – bez dwukropka, ale z imieniem zaraz po etykiecie. */
const CONTACT_NO_COLON_RE = new RegExp(String.raw`(?<!\p{L})(kontakt|sprzedający|sprzedajacy|właściciel|wlasciciel)([ \t]+)(${NAME})`, "giu");
/** Etykieta sama w linii, dane w następnej („Kontakt\nJan Kowalski”). */
const LABEL_NEXT_LINE_RE = new RegExp(
  String.raw`^([ \t]*(?:${ALWAYS_CONTACT_LABELS}|${NAME_ONLY_LABELS}|dane kontaktowe)[ \t]*:?[ \t]*\r?\n[ \t]*)(${NAME})(?=[ \t]*(?:[,;]|\r?\n|$|\[))`,
  "gimu",
);
const NAME_LABEL_LINE_RE = new RegExp(
  String.raw`^([ \t]*${NAME_ONLY_LABELS}[ \t]*[:\-–][ \t]*)((?:pan|pani)[ \t]+)?(${NAME})[ \t]*$`,
  "gimu",
);
/** „pan Marek”, „Pana Marka”, „pani Ania” (także małą literą). */
const PAN_NAME_RE = new RegExp(String.raw`(?<![\p{L}])([Pp]an|[Pp]ani|[Pp]ana|[Pp]anią|[Pp]anem)[ \t]+(?!Państw)(${NAME})`, "gu");
/** Podpis: „Pozdrawiam, Tomek”, „Zapraszam, Marek”, „Dziękuję – Anna”. Imię z listy albo na końcu linii. */
const SIGNATURE_RE = new RegExp(
  String.raw`((?:pozdrawiam|pozdrowienia|z poważaniem|z powazaniem|zapraszam|zapraszamy|dziękuję|dziekuje|serdecznie)[ \t]*[,!.\-–]?\s+)(${NAME})(?=[ \t]*(?:[.!,;)]|\r?\n|$))`,
  "gimu",
);
/** Imię w nawiasie: „(Tomek)”, „(Jan Kowalski)”. */
const PAREN_NAME_RE = new RegExp(String.raw`\([ \t]*(${NAME})[ \t]*\)`, "gu");
/** Imię (i nazwisko) tuż przed telefonem: „Jan Kowalski, tel. [telefon]”. */
const NAME_BEFORE_PHONE_RE = new RegExp(String.raw`(?<![\p{L}])(${NAME})([ \t]*[,;:\-–]?[ \t]*(?:tel\.?|telefon|kom\.?|nr)?[ \t]*[:.]?[ \t]*\[telefon\])`, "gu");
/** Imię tuż po telefonie: „[telefon] Krzysztof”, „[telefon] – pan Jan”. */
const NAME_AFTER_PHONE_RE = new RegExp(String.raw`(\[telefon\][ \t]*[,;\-–(]?[ \t]*)(${NAME})`, "gu");
/** Blok profilu z OLX/Otomoto: „Marek Nowak\nOsoba prywatna”, „Jan\nNa OLX od 2015”. */
const PROFILE_BLOCK_RE = new RegExp(
  String.raw`^([ \t]*)(${NAME})([ \t]*\r?\n[ \t]*(?:osoba prywatna|firma|na olx od|na otomoto od|w serwisie od|użytkownik od|uzytkownik od|ostatnio online|członek od|czlonek od|sprzedający od|sprzedajacy od))`,
  "gimu",
);

// Słowa, które po „Sprzedawca:” są informacją, a nie nazwiskiem.
const NOT_A_NAME = /^(osoba|firma|komis|prywatn|dealer|diler|salon|autoryzowan|faktura|handlarz)/iu;

/** Wszystkie słowa z wielkiej litery (flaga „i” w regexach sprawia, że \p{Lu} łapie też małe litery). */
function isCap(name: string): boolean {
  return name.split(/[ \t]+/).every((w) => /^\p{Lu}\p{Ll}/u.test(w));
}

/** Czy fragment wygląda na imię (i nazwisko): pierwsze słowo z listy imion, nie poprzedzone marką auta. */
function isFirstName(name: string, before = ""): boolean {
  const first = name.split(/[ \t-]+/)[0];
  if (!isCap(name) || !FIRST_NAMES.has(first)) return false;
  const prev = before.trimEnd().split(/\s+/).at(-1)?.toLowerCase() ?? "";
  return !MAKES.has(prev);
}

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
  const stats: AnonymizeStats = { telefon: 0, email: 0, nrRej: 0, link: 0, kontakt: 0, adres: 0 };
  let t = input.normalize("NFC");
  const K = PLACEHOLDERS.kontakt;
  const kontakt = () => stats.kontakt++;

  // 1. e-maile (przed linkami – inaczej domena zostałaby linkiem), potem profile @nick
  t = countingReplace(t, EMAIL_RE, () => PLACEHOLDERS.email, () => stats.email++);
  t = countingReplace(t, HANDLE_RE, () => K, kontakt);

  // 2. linki
  t = countingReplace(t, URL_RE, () => PLACEHOLDERS.link, () => stats.link++);
  t = countingReplace(t, BARE_DOMAIN_RE, () => PLACEHOLDERS.link, () => stats.link++);

  // 3. telefony (zagraniczne przed polskimi)
  t = countingReplace(t, INTL_PHONE_RE, () => PLACEHOLDERS.telefon, () => stats.telefon++);
  t = countingReplace(t, PHONE_RE, () => PLACEHOLDERS.telefon, () => stats.telefon++);

  // 4. numery rejestracyjne (małymi literami tylko w kontekście, wielkimi – wszędzie poza skrótami)
  t = countingReplace(
    t,
    PLATE_CTX_RE,
    (whole, label, letters) => (PLATE_STOPLIST.has(letters.toUpperCase()) ? whole : `${label}${PLACEHOLDERS.nrRej}`),
    () => stats.nrRej++,
  );
  t = countingReplace(
    t,
    PLATE_RE,
    (whole, letters) => (PLATE_STOPLIST.has(letters) ? whole : PLACEHOLDERS.nrRej),
    () => stats.nrRej++,
  );

  // 5. adresy
  t = countingReplace(t, STREET_RE, () => PLACEHOLDERS.adres, () => stats.adres++);
  t = countingReplace(t, POSTAL_CITY_RE, () => PLACEHOLDERS.adres, () => stats.adres++);

  // 6. dane kontaktowe
  t = countingReplace(t, PROFILE_BLOCK_RE, (whole, indent, name, rest) => (isFirstName(name) || (isCap(name) && name.includes(" ")) ? `${indent}${K}${rest}` : whole), kontakt);
  t = countingReplace(t, LABEL_NEXT_LINE_RE, (whole, label, name) => (NOT_A_NAME.test(name) || !isCap(name) ? whole : `${label}${K}`), kontakt);
  t = countingReplace(
    t,
    CONTACT_LINE_RE,
    (whole, pre, label, rest) => {
      const stripped = rest.replace(/\[(telefon|email|link|nr rej|kontakt|adres)\]/g, "").replace(/[\s,;:.\-–/|]+/g, "");
      if (stripped.length === 0) return whole; // w linii były już tylko placeholdery
      return `${pre}${label}${K}`;
    },
    kontakt,
  );
  t = countingReplace(t, CONTACT_NO_COLON_RE, (whole, label, sp, name) => (isFirstName(name) ? `${label}${sp}${K}` : whole), kontakt);
  t = countingReplace(
    t,
    NAME_LABEL_LINE_RE,
    (whole, label, _pan, name) => (NOT_A_NAME.test(name ?? "") || !isCap(name ?? "") ? whole : `${label}${K}`),
    kontakt,
  );
  t = countingReplace(t, PAN_NAME_RE, () => K, kontakt);
  // Podpis: imię z listy albo dowolne „Imię” stojące samo do końca linii („Pozdrawiam,\nTomek”).
  t = t.replace(SIGNATURE_RE, (whole: string, greeting: string, name: string, offset: number, all: string) => {
    const restOfLine = all.slice(offset + whole.length).split("\n")[0] ?? "";
    if (!isFirstName(name) && !/^\s*[.!]?\s*$/.test(restOfLine)) return whole;
    if (NOT_A_NAME.test(name) || !isCap(name)) return whole;
    stats.kontakt++;
    return `${greeting}${K}`;
  });
  t = countingReplace(t, PAREN_NAME_RE, (whole, name) => (isFirstName(name) ? `(${K})` : whole), kontakt);
  t = t.replace(NAME_BEFORE_PHONE_RE, (whole: string, name: string, tail: string, offset: number, all: string) => {
    if (!isFirstName(name, all.slice(Math.max(0, offset - 20), offset))) return whole;
    stats.kontakt++;
    return `${K}${tail}`;
  });
  t = countingReplace(t, NAME_AFTER_PHONE_RE, (whole, pre, name) => (isFirstName(name) ? `${pre}${K}` : whole), kontakt);

  return { text: t, stats };
}

/** Skrót: tylko tekst. */
export function anonymizeText(input: string): string {
  return anonymize(input).text;
}
