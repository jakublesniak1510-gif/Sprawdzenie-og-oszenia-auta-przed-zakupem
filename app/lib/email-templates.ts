import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

/**
 * Szablony e-maili (HTML + tekst, po polsku).
 *
 * Źródło treści: jeśli istnieje `content/emails/*.md` (katalog w repo, nadpisywany przez EMAIL_CONTENT_DIR) z plikiem
 * pasującym do rodzaju e-maila (po fragmencie nazwy, patrz FILE_HINTS), używamy go; w przeciwnym razie treść wbudowana.
 *
 * Format pliku .md: temat w nagłówku YAML (`temat:` / `subject:`), w linii „Temat: …” albo jako pierwszy nagłówek `# …`.
 * Podstawiane zmienne: {{link}}, {{link_tak}}, {{link_nie}}, {{data_waznosci}}, {{kod}}, {{liczba_raportow}}, {{model}}
 * (nieznane → puste).
 */

export type EmailKind = "raport_gotowy" | "platnosc_niedokonczona" | "czy_kupiles" | "kupon_pakiet";

export interface EmailVars {
  link: string;
  /** „Czy kupiłeś?” – linki jednego kliknięcia (content/emails/czy-kupiles.md). */
  link_tak?: string;
  link_nie?: string;
  data_waznosci?: string;
  kod?: string;
  liczba_raportow?: string;
  model?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  source: "content" | "builtin";
}

/** Fragmenty nazw plików w content/emails (bez polskich znaków, małe litery), sprawdzane po kolei. */
const FILE_HINTS: Record<EmailKind, string[]> = {
  raport_gotowy: ["raport-gotowy", "raport_gotowy", "gotowy"],
  platnosc_niedokonczona: ["nie-dokonczono", "niedokonczon", "porzucon", "platnosc", "przypomnienie"],
  czy_kupiles: ["czy-kupiles", "kupiles", "kupilas", "po-7-dniach", "7-dni", "feedback", "opinia"],
  kupon_pakiet: ["kupon", "pakiet"],
};

const BUILTIN: Record<EmailKind, string> = {
  raport_gotowy: `# Twój raport jest gotowy

Dzień dobry,

raport o ogłoszeniu auta jest gotowy. Znajdziesz w nim czerwone flagi, analizę przebiegu, typowe usterki modelu z kosztami, pytania do sprzedawcy i checklistę oględzin.

[Otwórz raport]({{link}})

Link jest ważny do **{{data_waznosci}}** – potem raport i dane z ogłoszenia są automatycznie usuwane. Jeśli chcesz zachować raport na dłużej, wydrukuj go albo zapisz jako PDF (przycisk „Drukuj” na stronie raportu).

Powodzenia na oględzinach!

Raport nie zastępuje przeglądu w warsztacie ani sprawdzenia historii pojazdu.`,

  platnosc_niedokonczona: `# Płatność za raport nie została dokończona

Dzień dobry,

zacząłeś zamawiać raport o ogłoszeniu auta, ale płatność nie została dokończona. Dane z ogłoszenia czekają – wystarczy dokończyć płatność (BLIK, Przelewy24 lub karta), a raport przygotujemy w kilka minut.

[Dokończ płatność]({{link}})

Jeśli to auto już Cię nie interesuje – zignoruj tę wiadomość. Dane wygasną automatycznie.`,

  czy_kupiles: `# Kupiłeś to auto?

Dzień dobry,

tydzień temu przygotowaliśmy dla Ciebie raport o ogłoszeniu auta. Daj nam znać jednym kliknięciem, czy raport pomógł w decyzji – to dla nas najcenniejsza informacja.

[Tak, kupiłem]({{link_tak}}) [Nie, szukam dalej]({{link_nie}})

Jeśli chcesz, napisz też, czy raport pomógł – [oceń raport]({{link}}).

Dziękujemy!`,

  kupon_pakiet: `# Twój kod na {{liczba_raportow}} raportów

Dzień dobry,

dziękujemy za zakup pakietu. Twój kod:

**{{kod}}**

Wpisz go w formularzu zamówienia w polu „Kod rabatowy” – raport zostanie wygenerowany bez płatności. Kod obejmuje {{liczba_raportow}} raportów i jest ważny do **{{data_waznosci}}**.

[Sprawdź ogłoszenie]({{link}})`,
};

export function contentDir(): string {
  return process.env.EMAIL_CONTENT_DIR
    ? path.resolve(process.env.EMAIL_CONTENT_DIR)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "content", "emails");
}

const plain = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

/** Znajduje plik .md dla rodzaju e-maila w content/emails. */
export function findContentFile(kind: EmailKind, dir = contentDir()): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.toLowerCase().endsWith(".md")).sort();
  } catch {
    return null;
  }
  for (const hint of FILE_HINTS[kind]) {
    const f = files.find((x) => plain(x).includes(hint));
    if (f) return path.join(dir, f);
  }
  return null;
}

/** Rozdziela plik .md na temat i treść. */
export function splitSubject(md: string): { subject: string | null; body: string } {
  let body = md.replace(/^﻿/, "").trimStart();
  let subject: string | null = null;
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body);
  if (fm) {
    body = body.slice(fm[0].length).trimStart();
    const m = /^(?:temat|subject|tytul|tytuł)\s*:\s*["']?(.+?)["']?\s*$/im.exec(fm[1]);
    if (m) subject = m[1];
  }
  if (!subject) {
    const m = /^\**(?:temat|subject)\**\s*:\**\s*(.+?)\s*$/im.exec(body.split(/\r?\n/).slice(0, 5).join("\n"));
    if (m) {
      subject = m[1].replace(/\*+$/, "").trim();
      body = body.replace(m[0], "").trimStart();
    }
  }
  if (!subject) {
    const m = /^#\s+(.+?)\s*$/m.exec(body);
    if (m && body.trimStart().startsWith("#")) {
      subject = m[1];
      body = body.replace(m[0], "").trimStart();
    }
  }
  return { subject, body };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Zmienne, które aplikacja zna (mogą być puste, np. brak modelu). Każda inna w treści = ostrzeżenie w logu. */
export const KNOWN_VARS = new Set(["link", "link_tak", "link_nie", "data_waznosci", "kod", "liczba_raportow", "model"]);

export function substitute(tpl: string, vars: Record<string, string | undefined>, escape = false): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => {
    const key = k.toLowerCase();
    if (!KNOWN_VARS.has(key) && vars[key] === undefined) {
      console.warn(`[email] Nieznana zmienna {{${k}}} w treści e-maila – zostaje pusta. Znane: ${[...KNOWN_VARS].join(", ")}.`);
    }
    const v = vars[key] ?? "";
    return escape ? escapeHtml(v) : v;
  });
}

/** Markdown → czysty tekst (linki jako „tekst: adres”). */
export function mdToText(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t: string, u: string) => (t === u ? u : `${t}: ${u}`))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapHtml(subject: string, inner: string): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border-radius:12px;padding:24px">${inner}</div>
<p style="font-size:12px;color:#64748b;margin-top:16px">Wiadomość wysłana automatycznie w związku z zamówieniem raportu. Nie odpowiadaj na nią, jeśli nie masz pytań.</p>
</div></body></html>`;
}

/** Styl linków-przycisków w HTML (klienci poczty ignorują arkusze stylów). */
function styleHtml(html: string): string {
  return html
    .replace(/<a href=/g, '<a style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600" href=')
    .replace(/<h1>/g, '<h1 style="font-size:20px;margin:0 0 16px">');
}

export function renderEmail(kind: EmailKind, vars: EmailVars): RenderedEmail {
  let source: RenderedEmail["source"] = "builtin";
  let md = BUILTIN[kind];
  const file = findContentFile(kind);
  if (file) {
    try {
      md = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8");
      source = "content";
    } catch {
      /* zostaje treść wbudowana */
    }
  }
  const { subject: rawSubject, body } = splitSubject(md);
  const v: Record<string, string | undefined> = { ...vars };
  const subject = substitute(rawSubject ?? defaultSubject(kind), v).replace(/\s+/g, " ").trim();
  const text = substitute(mdToText(body), v);
  const htmlInner = styleHtml(marked.parse(substitute(body, v, true), { gfm: true, async: false }) as string);
  return { subject, html: wrapHtml(subject, `<h1>${escapeHtml(subject)}</h1>${htmlInner}`), text: `${subject}\n\n${text}`, source };
}

function defaultSubject(kind: EmailKind): string {
  return {
    raport_gotowy: "Twój raport jest gotowy",
    platnosc_niedokonczona: "Płatność za raport nie została dokończona",
    czy_kupiles: "Kupiłeś to auto?",
    kupon_pakiet: "Twój kod na raporty",
  }[kind];
}

/** Data jako DD.MM.RRRR (strefa Europe/Warsaw). */
export function formatDatePl(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" });
}
