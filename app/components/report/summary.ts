import type { Report } from "@/lib/report-schema";

/** Pomocnicze teksty z raportu (bez zmiany kontraktu danych) – czyste funkcje, testowane w summary.test.ts. */

const OCENA_TXT: Record<Report["podsumowanie"]["ocena"], string> = { niskie: "niskie", srednie: "średnie", wysokie: "wysokie" };
const WAGA_ORDER = { wysoka: 0, srednia: 1, niska: 2 } as const;

export function vehicleName(r: Report, fallback = "auto z ogłoszenia"): string {
  const v = r.rozpoznany_pojazd;
  if (!v.marka || v.marka === "nie ustalono") return fallback;
  const gen = v.generacja && v.generacja !== "nie ustalono" ? ` ${v.generacja.replace(/\s*\(.*?\)\s*/g, " ").trim()}` : "";
  return `${v.marka} ${v.model}${gen}`.trim();
}

function firstSentence(s: string): string {
  const m = /^(.+?[.!?])(\s|$)/s.exec(s.trim());
  return (m ? m[1] : s).trim();
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** „Podsumowanie w 3 zdaniach do wysłania znajomemu”. */
export function summarizeReport(r: Report, fallbackName?: string): string {
  const name = vehicleName(r, fallbackName);
  const flags = [...r.czerwone_flagi].sort((a, b) => WAGA_ORDER[a.waga] - WAGA_ORDER[b.waga]);
  const s1 = `Sprawdziłem ogłoszenie: ${name} – ryzyko zakupu oceniono jako ${OCENA_TXT[r.podsumowanie.ocena]}.`;
  let s2: string;
  if (flags.length === 0) s2 = "W ogłoszeniu nie ma sygnałów wymagających wyjaśnienia, ale oględziny i tak są konieczne.";
  else {
    const top = flags.slice(0, 2).map((f) => lowerFirst(f.tytul.replace(/[.]$/, "")));
    const more = flags.length - top.length;
    s2 = `Do wyjaśnienia ze sprzedawcą: ${top.join("; ")}${more > 0 ? ` (i ${more} ${more === 1 ? "inna sprawa" : more < 5 ? "inne sprawy" : "innych spraw"})` : ""}.`;
  }
  const s3 = firstSentence(r.podsumowanie.zalecenie).replace(/([^.!?])$/, "$1.");
  return [s1, s2, s3].join(" ");
}

/** Pytania do sprzedawcy w formie gotowej do SMS-a / Messengera. */
export function questionsMessage(r: Report, fallbackName?: string): string {
  const name = vehicleName(r, fallbackName);
  const lines = r.pytania_do_sprzedawcy.map((q, i) => `${i + 1}. ${q.trim()}`);
  return [`Dzień dobry, piszę w sprawie ogłoszenia: ${name}. Mam kilka pytań przed umówieniem oględzin:`, ...lines, "Z góry dziękuję za odpowiedź!"].join("\n");
}

/** Konkretne kroki na górę raportu. */
export function nextSteps(r: Report): string[] {
  const steps = [r.podsumowanie.zalecenie.trim()];
  const noHistory = !r.przebieg || r.przebieg.odczyty.length === 0;
  if (noHistory)
    steps.push(
      "Poproś sprzedawcę o VIN, numer rejestracyjny i datę pierwszej rejestracji, a potem sprawdź auto bezpłatnie w usłudze Historia Pojazdu na gov.pl.",
    );
  if (r.pytania_do_sprzedawcy.length) steps.push("Wyślij sprzedawcy pytania z raportu – przycisk „Skopiuj pytania” jest w sekcji pytań.");
  steps.push("Przed zakupem umów oględziny u niezależnego mechanika lub na stacji diagnostycznej.");
  return steps;
}

export interface TocEntry {
  id: string;
  label: string;
}

/** Spis treści – w tej samej kolejności co sekcje w ReportView. */
export function reportToc(r: Report, offer: "raport" | "raport_plus"): TocEntry[] {
  const t: (TocEntry | false)[] = [
    { id: "nastepny-krok", label: "Następny krok" },
    { id: "podsumowanie", label: "Podsumowanie" },
    { id: "flagi", label: `Flagi (${r.czerwone_flagi.length})` },
    !!r.przebieg && { id: "przebieg", label: "Przebieg" },
    { id: "usterki", label: "Usterki" },
    !!r.zdjecia && { id: "zdjecia", label: "Zdjęcia" },
    !!r.porownanie_cen && { id: "ceny", label: "Ceny" },
    { id: "pytania", label: "Pytania" },
    { id: "checklista", label: "Checklista" },
    { id: "dokumenty", label: "Dokumenty" },
    offer === "raport_plus" && { id: "umowa", label: "Umowa" },
  ];
  return t.filter((x): x is TocEntry => !!x);
}
