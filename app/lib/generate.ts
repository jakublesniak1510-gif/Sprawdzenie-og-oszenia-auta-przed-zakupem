import { generateReport, type AiReportRequest } from "./ai";
import { analyzeMileage, dedupeSort, normalizeDate, parseHistoriaPojazdu } from "./cepik";
import { claimForGeneration, getReport, parseInput, saveReportError, saveReportResult, type StoredInput } from "./db";
import { dropImages, getImages } from "./image-cache";
import { getModel } from "./models";
import { loadRedFlags, matchRedFlags } from "./red-flags";
import type { OfferId } from "./report-schema";

export async function buildAiRequest(input: StoredInput, oferta: OfferId, images: string[]): Promise<AiReportRequest> {
  const model = input.model_id ? await getModel(input.model_id) : null;
  const silnikKod = model && input.silnik_kod && model.engines.some((e) => e.code === input.silnik_kod) ? input.silnik_kod : null;

  const manual = input.odczyty_reczne.flatMap((r) => {
    const d = normalizeDate(r.data);
    return d && r.km !== null ? [{ data: d, km: r.km }] : [];
  });
  const odczyty = dedupeSort([...parseHistoriaPojazdu(input.historia_pojazdu), ...manual]);

  const flags = await loadRedFlags();
  return {
    oferta,
    tekstOgloszenia: input.tekst_ogloszenia,
    deklaracje: { cena_pln: input.cena_pln, przebieg_km: input.przebieg_km, rocznik: input.rocznik },
    historiaPojazduTekst: input.historia_pojazdu,
    odczyty,
    analizaPrzebiegu: analyzeMileage(odczyty, input.przebieg_km),
    podobneOferty: input.podobne_oferty,
    model,
    silnikKod,
    flagi: matchRedFlags(input.tekst_ogloszenia, flags),
    heurystykiDoOceny: flags.filter((f) => f.patterns.length === 0),
    zdjecia: images.map((d) => d.replace(/^data:image\/jpeg;base64,/, "")),
  };
}

/**
 * Generuje raport dla zamówienia w statusie `paid`. Idempotentne: jeśli raport jest już generowany
 * lub gotowy, nic nie robi. Wywoływane z webhooka Stripe, ze strony powrotu z płatności albo od razu (DEV_SKIP_PAYMENT=1).
 */
export async function runGeneration(id: string): Promise<void> {
  if (!claimForGeneration(id)) return;
  try {
    const row = getReport(id);
    if (!row) return;
    const req = await buildAiRequest(parseInput(row), row.offer, getImages(id));
    const report = await generateReport(req);
    saveReportResult(id, report);
    dropImages(id);
  } catch (e) {
    console.error(`[generate] Raport ${id} – błąd:`, e);
    saveReportError(id, e instanceof Error ? e.message : String(e));
  }
}
