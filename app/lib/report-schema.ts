import { z } from "zod";

/**
 * Schemat raportu zwracanego przez model (narzędzie `zapisz_raport`).
 * Ten sam schemat służy do: (1) wygenerowania JSON Schema dla narzędzia,
 * (2) walidacji odpowiedzi po stronie serwera, (3) typów w UI.
 *
 * Uwaga: bez ograniczeń typu min/max – tryb `strict` narzędzi ich nie obsługuje.
 */

export const Waga = z.enum(["niska", "srednia", "wysoka"]);
export type Waga = z.infer<typeof Waga>;

export const ReportSchema = z.object({
  podsumowanie: z.object({
    ocena: z.enum(["niskie", "srednie", "wysokie"]).describe("Poziom ryzyka zakupu na podstawie przekazanych danych"),
    uzasadnienie: z.string().describe("2–4 zdania, neutralnie, bez oskarżania sprzedawcy"),
    zalecenie: z.string().describe("Co kupujący powinien zrobić dalej"),
  }),
  rozpoznany_pojazd: z.object({
    marka: z.string(),
    model: z.string(),
    generacja: z.string(),
    silnik: z.string(),
    pewnosc: z.enum(["wysoka", "srednia", "niska"]),
    w_bazie: z.boolean().describe("true tylko gdy przekazano wpis z bazy usterek"),
  }),
  czerwone_flagi: z.array(
    z.object({
      tytul: z.string(),
      opis: z.string().describe("Sformułowanie neutralne: 'do wyjaśnienia ze sprzedawcą'"),
      waga: Waga,
      pytanie_do_sprzedawcy: z.string(),
    }),
  ),
  przebieg: z
    .object({
      deklarowany_km: z.number().int().nullable(),
      odczyty: z.array(z.object({ data: z.string().describe("RRRR-MM-DD"), km: z.number().int() })),
      wniosek: z.string(),
      uwagi: z.array(z.string()),
    })
    .nullable(),
  typowe_usterki: z.array(
    z.object({
      tytul: z.string(),
      objawy: z.string(),
      koszt_pln_od: z.number().int(),
      koszt_pln_do: z.number().int(),
      waga: Waga,
      jak_sprawdzic: z.string(),
    }),
  ),
  zdjecia: z.object({ uwagi: z.array(z.string()) }).nullable(),
  porownanie_cen: z
    .object({
      wiersze: z.array(
        z.object({
          zrodlo: z.string().describe("'to ogłoszenie' albo 'oferta 1', 'oferta 2'…"),
          cena: z.number().int().nullable(),
          rocznik: z.number().int().nullable(),
          przebieg_km: z.number().int().nullable(),
          wyposazenie: z.string(),
          uwaga: z.string(),
        }),
      ),
      wniosek: z.string(),
    })
    .nullable(),
  pytania_do_sprzedawcy: z.array(z.string()),
  checklista_ogledzin: z.array(z.object({ obszar: z.string(), punkty: z.array(z.string()) })),
  dokumenty_do_sprawdzenia: z.array(z.string()),
});

export type Report = z.infer<typeof ReportSchema>;

/** JSON Schema narzędzia – oczyszczony z pól, których tryb strict nie akceptuje. */
export function reportJsonSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(ReportSchema, { io: "output" }) as Record<string, unknown>;
  return sanitize(raw) as Record<string, unknown>;
}

const DROP_KEYS = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "pattern"]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP_KEYS.has(k)) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return node;
}

/* ---------- Dane wejściowe od klienta (formularz) ---------- */

export const OfferId = z.enum(["raport", "raport_plus"]);
export type OfferId = z.infer<typeof OfferId>;

const optNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : Number(v)),
  z.number().int().nonnegative().nullable(),
);

export const SimilarOfferSchema = z.object({
  tekst: z.string().max(20000).default(""),
  cena: optNum.default(null),
  rocznik: optNum.default(null),
  przebieg_km: optNum.default(null),
});
export type SimilarOffer = z.infer<typeof SimilarOfferSchema>;

export const ReportInputSchema = z.object({
  tekst_ogloszenia: z.string().trim().min(100, "Tekst ogłoszenia musi mieć co najmniej 100 znaków").max(30000),
  cena_pln: optNum.default(null),
  przebieg_km: optNum.default(null),
  rocznik: optNum.default(null),
  historia_pojazdu: z.string().max(30000).default(""),
  odczyty_reczne: z
    .array(z.object({ data: z.string().max(20), km: optNum }))
    .max(40)
    .default([]),
  podobne_oferty: z.array(SimilarOfferSchema).max(5).default([]),
  model_id: z.string().max(100).nullable().default(null),
  silnik_kod: z.string().max(200).nullable().default(null),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export const CreateReportRequestSchema = z.object({
  input: ReportInputSchema,
  zdjecia: z
    .array(z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Nieprawidłowy format zdjęcia"))
    .max(8, "Maksymalnie 8 zdjęć")
    .default([]),
  oferta: OfferId,
  zgoda_tresc_cyfrowa: z.literal(true, { message: "Wymagana zgoda na natychmiastowe dostarczenie treści cyfrowej" }),
  zgoda_regulamin: z.literal(true, { message: "Wymagana akceptacja regulaminu" }),
  email: z.string().email().max(200).nullable().optional(),
  /** Kod kuponu (pakiet 5 raportów / kod promocyjny) – gdy ważny, raport bez płatności. */
  coupon: z.string().max(40).nullable().optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;
