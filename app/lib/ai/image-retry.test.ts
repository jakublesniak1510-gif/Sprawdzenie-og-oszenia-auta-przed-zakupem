import { beforeEach, describe, expect, it } from "vitest";
import { AiError, isImageErrorMessage } from "./claude";
import { PHOTOS_FAILED_NOTE, generateReport } from "./index";
import { MockProvider } from "./mock";
import type { AiProvider, AiReportRequest } from "./types";
import { useTempDb } from "../test-utils";

process.env.AI_MOCK_DELAY_MS = "0";

const req: AiReportRequest = {
  oferta: "raport", tekstOgloszenia: "Sprzedam auto", deklaracje: { cena_pln: null, przebieg_km: null, rocznik: null }, historiaPojazduTekst: "",
  odczyty: [], analizaPrzebiegu: { cofniecia: [], deklarowanyNizszyOdOstatniego: false, ostatni: null }, podobneOferty: [],
  model: null, silnikKod: null, flagi: [], zdjecia: ["QUJD", "REVG"],
};

beforeEach(() => useTempDb());

describe("błąd obrazu w Claude API", () => {
  it("ponawia raz bez zdjęć i dopisuje uwagę „zdjęć nie udało się przetworzyć”", async () => {
    const calls: number[] = [];
    const provider: AiProvider = {
      name: "test",
      async generate(r) {
        calls.push(r.zdjecia.length);
        if (r.zdjecia.length) throw new AiError("Błędne żądanie do Claude API: 400 Could not process image", false, true);
        return new MockProvider().generate(r);
      },
    };
    const out = await generateReport(req, { provider });
    expect(calls).toEqual([2, 0]);
    expect(out.zdjecia).toEqual({ uwagi: [PHOTOS_FAILED_NOTE] });
  });

  it("inne błędy 400 nie są ponawiane", async () => {
    const provider: AiProvider = { name: "t", generate: async () => { throw new AiError("Błędne żądanie: max_tokens", false, false); } };
    await expect(generateReport(req, { provider })).rejects.toThrow(/max_tokens/);
  });

  it("rozpoznaje komunikat o obrazie", () => {
    expect(isImageErrorMessage("400 invalid_request_error: messages.0.content.1.image.source.base64: invalid image")).toBe(true);
    expect(isImageErrorMessage("max_tokens: too large")).toBe(false);
  });
});
