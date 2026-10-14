import { generateReport, type AiReportRequest } from "./ai";
import { AiError } from "./ai/claude";
import { track } from "./analytics";
import { analyzeMileage, dedupeSort, normalizeDate, parseCepik } from "./cepik";
import {
  MAX_GENERATION_ATTEMPTS,
  claimForGeneration,
  getReport,
  parseInput,
  releaseForRetry,
  saveReportError,
  saveReportResult,
  type StoredInput,
} from "./db";
import { dropImages, getImages } from "./image-cache";
import { COMPUTED_FLAG_IDS, computeFlags } from "./computed-flags";
import { modelForListing } from "./fault-filter";
import { getModel } from "./models";
import { loadQuestionsByCategory, questionsForCategories } from "./questions";
import { sendReportReadyEmail } from "./notifications";
import type { GenerationOutcome } from "./queue";
import { loadRedFlags, matchRedFlags } from "./red-flags";
import type { OfferId } from "./report-schema";

/** Komunikat dla klienta po ostatecznym błędzie (szczegóły techniczne tylko w logu i w zdarzeniu `raport_blad`). */
export const CLIENT_ERROR_MESSAGE =
  "Nie udało się wygenerować raportu mimo kilku prób. Płatność jest zachowana – spróbuj ponownie albo napisz do nas, podając numer raportu.";

export async function buildAiRequest(input: StoredInput, oferta: OfferId, images: string[]): Promise<AiReportRequest> {
  const baseModel = input.model_id ? await getModel(input.model_id) : null;
  const silnikKod = baseModel && input.silnik_kod && baseModel.engines.some((e) => e.code === input.silnik_kod) ? input.silnik_kod : null;
  // Usterki wspólne bez tych, które nie dotyczą skrzyni/paliwa z ogłoszenia (np. DSG przy manualu, DPF przy benzynie).
  const model = baseModel ? modelForListing(baseModel, input.tekst_ogloszenia, silnikKod) : null;

  const manual = input.odczyty_reczne.flatMap((r) => {
    const d = normalizeDate(r.data);
    return d && r.km !== null ? [{ data: d, km: r.km }] : [];
  });
  const cepik = parseCepik(input.historia_pojazdu);
  const odczyty = dedupeSort([...cepik.odczyty, ...manual]);

  const flags = await loadRedFlags();
  const trafione = matchRedFlags(input.tekst_ogloszenia, flags);
  const obliczone = computeFlags(
    { tekst: input.tekst_ogloszenia, cena: input.cena_pln, przebieg: input.przebieg_km, rocznik: input.rocznik, model, trafione },
    flags,
  );
  const flagi = [...trafione, ...obliczone];
  const computedIds = new Set<string>(COMPUTED_FLAG_IDS);
  const pytaniaKategorii = questionsForCategories(
    await loadQuestionsByCategory(),
    flagi.map((f) => f.category),
    [...flagi.flatMap((f) => (f.question_for_seller ? [f.question_for_seller] : [])), ...(model?.questions_for_seller ?? [])],
  );
  return {
    oferta,
    tekstOgloszenia: input.tekst_ogloszenia,
    deklaracje: { cena_pln: input.cena_pln, przebieg_km: input.przebieg_km, rocznik: input.rocznik },
    historiaPojazduTekst: input.historia_pojazdu,
    odczyty,
    analizaPrzebiegu: analyzeMileage(odczyty, input.przebieg_km),
    cepik: { pierwszaRejestracja: cepik.pierwszaRejestracja, pierwszaRejestracjaPl: cepik.pierwszaRejestracjaPl, uwagi: cepik.uwagi },
    podobneOferty: input.podobne_oferty,
    model,
    silnikKod,
    flagi,
    // Flagi bez wzorców ocenia model – z wyjątkiem tych liczonych przez aplikację (computed-flags).
    heurystykiDoOceny: flags.filter((f) => f.patterns.length === 0 && !computedIds.has(f.id)),
    pytaniaKategorii,
    zdjecia: images.map((d) => d.replace(/^data:image\/jpeg;base64,/, "")),
  };
}

const retryDelayMs = (attempt: number) => Number(process.env.GENERATION_RETRY_DELAY_MS ?? 30_000) * attempt;

function finalError(id: string, technical: string, extra: Record<string, string | number> = {}) {
  console.error(`[generate] Raport ${id} – ostateczny błąd: ${technical}`);
  saveReportError(id, CLIENT_ERROR_MESSAGE);
  dropImages(id);
  track("raport_blad", { report_id: id, powod: technical.slice(0, 300), ...extra });
}

/**
 * Jedna próba wygenerowania raportu w statusie `paid` (wywołuje ją kolejka – lib/queue.ts).
 * - Idempotentne: gdy raport jest już generowany/gotowy, nic nie robi.
 * - Błąd przejściowy i limit prób nie wyczerpany → status wraca do `paid`, kolejka ponawia po opóźnieniu.
 * - Ostateczny błąd (limit prób albo błąd nie do ponowienia) → `error` z komunikatem dla klienta, zdjęcia usuwane.
 */
export async function generateNow(id: string): Promise<GenerationOutcome> {
  const before = getReport(id);
  if (!before) return {};
  if (before.status === "paid" && before.attempts >= MAX_GENERATION_ATTEMPTS) {
    finalError(id, `wyczerpany limit ${MAX_GENERATION_ATTEMPTS} prób (${before.error ?? "brak szczegółów"})`, { proba: before.attempts });
    return {};
  }
  if (!claimForGeneration(id)) return {};
  const row = getReport(id)!;
  const t0 = Date.now();
  try {
    const images = getImages(id);
    const req = await buildAiRequest(parseInput(row), row.offer, images);
    const report = await generateReport(req, { reportId: id });
    saveReportResult(id, report);
    dropImages(id);
    track("raport_wygenerowany", { report_id: id, oferta: row.offer, czas_s: Math.round((Date.now() - t0) / 1000), proba: row.attempts, zdjecia: images.length });
    await sendReportReadyEmail(id);
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = !(e instanceof AiError) || e.retryable;
    if (retryable && row.attempts < MAX_GENERATION_ATTEMPTS) {
      console.warn(`[generate] Raport ${id} – próba ${row.attempts}/${MAX_GENERATION_ATTEMPTS} nieudana, ponowię: ${msg}`);
      releaseForRetry(id, msg);
      return { retryInMs: retryDelayMs(row.attempts) };
    }
    finalError(id, msg, { proba: row.attempts });
    return {};
  }
}

/**
 * Uruchamia generowanie przez kolejkę (max 2 równolegle). Idempotentne – można wołać wielokrotnie
 * (webhook, strona powrotu z płatności, przycisk „spróbuj ponownie”).
 */
export async function runGeneration(id: string): Promise<void> {
  const { enqueueGeneration } = await import("./queue");
  return enqueueGeneration(id);
}
