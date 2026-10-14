import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { ClaudeProvider, DEFAULT_MODEL } from "./claude";
import { MockProvider } from "./mock";
import type { AiReportRequest } from "./types";

process.env.AI_MOCK_DELAY_MS = "0";

const req: AiReportRequest = {
  oferta: "raport",
  tekstOgloszenia: "Sprzedam auto",
  deklaracje: { cena_pln: null, przebieg_km: null, rocznik: null },
  historiaPojazduTekst: "",
  odczyty: [],
  analizaPrzebiegu: { cofniecia: [], deklarowanyNizszyOdOstatniego: false, ostatni: null },
  podobneOferty: [],
  model: null,
  silnikKod: null,
  flagi: [],
  zdjecia: ["QUJD"],
};

/** Atrapa klienta SDK: zwraca kolejne odpowiedzi i zapisuje wysłane parametry. */
function fakeClient(responses: unknown[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: Record<string, unknown>) => {
          calls.push(structuredClone(params));
          const msg = responses.shift();
          return { finalMessage: async () => msg };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const toolMsg = (input: unknown) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "toolu_1", name: "zapisz_raport", input }],
});

describe("ClaudeProvider", () => {
  it("wysyła poprawne żądanie i zwraca zwalidowany raport", async () => {
    const valid = await new MockProvider().generate(req);
    const { client, calls } = fakeClient([toolMsg(valid)]);
    const out = await new ClaudeProvider(client).generate(req);
    expect(out.podsumowanie.ocena).toBe(valid.podsumowanie.ocena);
    const p = calls[0] as Record<string, any>;
    expect(p.model).toBe(DEFAULT_MODEL);
    expect(p.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(p.tools[0]).toMatchObject({ name: "zapisz_raport", strict: true });
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p.fallbacks).toBe("default");
    const content = p.messages[0].content;
    expect(content.some((b: any) => b.type === "image" && b.source.media_type === "image/jpeg")).toBe(true);
  });

  it("przy błędzie walidacji robi jedną ponowną próbę z tool_result is_error", async () => {
    const valid = await new MockProvider().generate(req);
    const { client, calls } = fakeClient([toolMsg({ podsumowanie: {} }), toolMsg(valid)]);
    await new ClaudeProvider(client).generate(req);
    expect(calls).toHaveLength(2);
    const second = (calls[1] as any).messages;
    expect(second).toHaveLength(3);
    expect(second[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1", is_error: true });
  });

  it("po dwóch nieudanych próbach zgłasza błąd", async () => {
    const { client } = fakeClient([toolMsg({}), toolMsg({})]);
    await expect(new ClaudeProvider(client).generate(req)).rejects.toThrow(/walidacji/);
  });

  it("odmowa modelu kończy się czytelnym błędem", async () => {
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] }]);
    await expect(new ClaudeProvider(client).generate(req)).rejects.toThrow(/odmówił/);
  });

  it("prompt caching: cache_control na narzędziu i prompcie systemowym, nie na danych użytkownika; usage do onUsage", async () => {
    const valid = await new MockProvider().generate(req);
    const usage = { input_tokens: 900, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0, output_tokens: 3000 };
    const { client, calls } = fakeClient([{ ...toolMsg(valid), model: "claude-sonnet-5-5", usage }]);
    const seen: unknown[] = [];
    await new ClaudeProvider(client).generate(req, { onUsage: (u) => seen.push(u) });
    const p = calls[0] as Record<string, any>;
    expect(p.tools[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(p.messages)).not.toContain("cache_control");
    expect(p.cache_control).toBeUndefined();
    expect(seen).toEqual([{ model: "claude-sonnet-5-5", ...usage }]);
  });
});
