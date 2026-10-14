/** Stałe serwisu – bez zależności serwerowych (można importować w komponentach klienckich). */

export const SITE_NAME = "SprawdźOgłoszenie";
export const SITE_TITLE = "Sprawdź ogłoszenie auta przed zakupem";
export const CONTACT_PLACEHOLDER = "[DO UZUPEŁNIENIA]";

/** Klucz sessionStorage: dane z szybkiego testu przekazywane do formularza /sprawdz. */
export const QUICK_PREFILL_KEY = "szybki-test-prefill-v1";

/** Adres bazowy serwisu (metadataBase, sitemap, canonical). */
export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Usuwa dopisek z latami z nazwy generacji: „VII (2012–2020)” → „VII”. */
export function shortGeneration(g: string): string {
  return g.replace(/\s*\(.*?\)\s*/g, " ").trim();
}

/** Bezpieczny slug (kotwice, porównania). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
