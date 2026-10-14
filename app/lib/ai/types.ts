import type { OfferId, Report } from "../report-schema";
import type { MileageAnalysis, MileageReading } from "../cepik";
import type { CarModel } from "../models";
import type { RedFlag } from "../red-flags";

/** Wszystko, czego warstwa AI potrzebuje do wygenerowania raportu. Teksty są już zanonimizowane. */
export interface AiReportRequest {
  oferta: OfferId;
  tekstOgloszenia: string;
  deklaracje: { cena_pln: number | null; przebieg_km: number | null; rocznik: number | null };
  historiaPojazduTekst: string;
  odczyty: MileageReading[];
  analizaPrzebiegu: MileageAnalysis;
  /** Dodatkowe fakty z parsera CEPiK (daty pierwszej rejestracji, uwagi: wyrejestrowanie, kradzież, import…). */
  cepik?: { pierwszaRejestracja: string | null; pierwszaRejestracjaPl: string | null; uwagi: string[] };
  podobneOferty: { tekst: string; cena: number | null; rocznik: number | null; przebieg_km: number | null }[];
  model: CarModel | null;
  silnikKod: string | null;
  flagi: (RedFlag & { trafienie: string })[];
  /** Heurystyki bez wzorców tekstowych (puste `patterns`) – do oceny przez model, nie zgłaszane mechanicznie. */
  heurystykiDoOceny?: RedFlag[];
  /** Zdjęcia JPEG jako base64 (bez prefiksu data:). Nigdy nie zapisywane na dysku. */
  zdjecia: string[];
}

/** Zużycie tokenów jednego wywołania API (pola z `response.usage`). */
export interface AiUsage {
  model: string;
  input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  output_tokens: number;
}

export interface GenerateOptions {
  /** Wywoływane po każdym wywołaniu API (także nieudanym walidacyjnie) – do zapisu kosztów. */
  onUsage?: (u: AiUsage) => void;
}

export interface AiProvider {
  name: string;
  generate(req: AiReportRequest, opts?: GenerateOptions): Promise<Report>;
}
