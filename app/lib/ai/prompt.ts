import fs from "node:fs";
import path from "node:path";
import { modelContextForAi } from "../models";
import type { AiReportRequest } from "./types";

let cached: string | null = null;

/** Prompt systemowy z `prompts/raport.md` (cache w pamięci procesu poza trybem dev). */
export function loadSystemPrompt(): string {
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = fs.readFileSync(path.resolve(process.cwd(), "prompts", "raport.md"), "utf8");
  return cached;
}

/** Dane od osób trzecich nie mogą „zamknąć” naszych znaczników – neutralizujemy < i >. */
export function escapeData(s: string): string {
  return s.replace(/</g, "‹").replace(/>/g, "›");
}

const fmt = (n: number | null, unit: string) => (n === null ? "nie podano" : `${n.toLocaleString("pl-PL")} ${unit}`);

export function buildUserText(req: AiReportRequest): string {
  const parts: string[] = [];

  parts.push(
    `<deklaracje_klienta>
cena: ${fmt(req.deklaracje.cena_pln, "zł")}
przebieg: ${fmt(req.deklaracje.przebieg_km, "km")}
rocznik: ${req.deklaracje.rocznik ?? "nie podano"}
pakiet: ${req.oferta === "raport_plus" ? "Raport+ (z porównaniem cen)" : "Raport (bez porównania cen – zwróć porownanie_cen = null)"}
liczba_zdjec: ${req.zdjecia.length}
</deklaracje_klienta>`,
  );

  parts.push(`<ogloszenie>\n${escapeData(req.tekstOgloszenia)}\n</ogloszenie>`);

  if (req.historiaPojazduTekst.trim()) {
    parts.push(`<historia_pojazdu>\n${escapeData(req.historiaPojazduTekst)}\n</historia_pojazdu>`);
  }

  parts.push(
    `<odczyty_przebiegu>\n${JSON.stringify(
      {
        odczyty: req.odczyty,
        analiza: {
          liczba_odczytow: req.odczyty.length,
          cofniecia_licznika: req.analizaPrzebiegu.cofniecia,
          ostatni_odczyt: req.analizaPrzebiegu.ostatni,
          deklarowany_nizszy_od_ostatniego_odczytu: req.analizaPrzebiegu.deklarowanyNizszyOdOstatniego,
        },
        ...(req.cepik
          ? {
              pierwsza_rejestracja: req.cepik.pierwszaRejestracja,
              pierwsza_rejestracja_w_polsce: req.cepik.pierwszaRejestracjaPl,
              uwagi_z_historii_pojazdu: req.cepik.uwagi,
            }
          : {}),
      },
      null,
      1,
    )}\n</odczyty_przebiegu>`,
  );

  if (req.oferta === "raport_plus" && req.podobneOferty.length > 0) {
    const offers = req.podobneOferty
      .map(
        (o, i) =>
          `<oferta nr="${i + 1}">\ncena: ${fmt(o.cena, "zł")}; rocznik: ${o.rocznik ?? "nie podano"}; przebieg: ${fmt(o.przebieg_km, "km")}\n${escapeData(o.tekst)}\n</oferta>`,
      )
      .join("\n");
    parts.push(`<podobne_oferty>\n${offers}\n</podobne_oferty>`);
  } else {
    parts.push(`<podobne_oferty>BRAK</podobne_oferty>`);
  }

  parts.push(
    req.model
      ? `<baza_modelu>\n${JSON.stringify(modelContextForAi(req.model, req.silnikKod), null, 1)}\n</baza_modelu>`
      : `<baza_modelu>BRAK – modelu nie ma w naszej bazie. Nie podawaj usterek konkretnego modelu.</baza_modelu>`,
  );

  parts.push(
    `<wstepne_flagi>\n${
      req.flagi.length
        ? JSON.stringify(
            req.flagi.map((f) => ({
              kategoria: f.category,
              trafienie: f.trafienie,
              dlaczego: f.explanation,
              waga: f.severity,
              neutral_wording: f.neutral_wording,
              pytanie: f.question_for_seller ?? null,
            })),
            null,
            1,
          )
        : "brak trafień heurystyk"
    }${
      req.heurystykiDoOceny?.length
        ? `\nDo samodzielnej oceny (bez trafień tekstowych – zgłoś tylko, jeśli dane to uzasadniają):\n${JSON.stringify(
            req.heurystykiDoOceny.map((f) => ({ id: f.id, dlaczego: f.explanation, waga: f.severity, neutral_wording: f.neutral_wording, pytanie: f.question_for_seller ?? null })),
            null,
            1,
          )}`
        : ""
    }\n</wstepne_flagi>`,
  );

  parts.push("Przeanalizuj powyższe dane i zapisz raport, wywołując narzędzie zapisz_raport dokładnie raz.");
  return parts.join("\n\n");
}
