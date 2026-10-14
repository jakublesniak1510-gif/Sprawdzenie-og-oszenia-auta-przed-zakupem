import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { ReportSchema, reportJsonSchema, type Report } from "../report-schema";
import { buildUserText, loadSystemPrompt } from "./prompt";
import type { AiProvider, AiReportRequest } from "./types";

/**
 * Cienka warstwa nad Claude API (Messages API, @anthropic-ai/sdk).
 *
 * - Model: `ANTHROPIC_MODEL` (domyślnie Claude Sonnet 5.5 – `claude-sonnet-5-5`), zdjęcia jako bloki `image` base64.
 * - Wynik: jedno narzędzie `zapisz_raport` ze schematem (strict: true). Sonnet 5.5 nie obsługuje wymuszonego
 *   `tool_choice` (any/tool → 400), więc używamy `auto` + polecenie w prompcie + walidacja zod po stronie serwera.
 * - Przy błędzie walidacji (lub braku wywołania narzędzia) – jedna ponowna próba w tej samej rozmowie.
 * - Odmowa (`stop_reason: "refusal"`): włączony serwerowy fallback `fallbacks: "default"` (wyłącz: ANTHROPIC_FALLBACK=0).
 */

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const TOOL_NAME = "zapisz_raport";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function config() {
  const effort = (process.env.ANTHROPIC_EFFORT ?? "medium") as Effort;
  return {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    effort,
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 32000),
    // Dla modeli starszych niż 4.6, które nie znają trybu adaptive, ustaw ANTHROPIC_THINKING=off.
    thinking: process.env.ANTHROPIC_THINKING !== "off",
    fallback: process.env.ANTHROPIC_FALLBACK !== "0",
  };
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "AiError";
  }
}

function buildTool(): Anthropic.Beta.BetaTool {
  return {
    name: TOOL_NAME,
    description:
      "Zapisuje gotowy raport o ogłoszeniu samochodowym. Wywołaj dokładnie raz, z kompletem sekcji. Wszystkie opisy po polsku, neutralnie (bez oskarżania sprzedawcy).",
    input_schema: reportJsonSchema() as Anthropic.Beta.BetaTool.InputSchema,
    strict: true,
  };
}

function buildUserContent(req: AiReportRequest): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  req.zdjecia.forEach((data, i) => {
    content.push({ type: "text", text: `Zdjęcie ${i + 1} z ogłoszenia:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({ type: "text", text: buildUserText(req) });
  return content;
}

type ParseOutcome =
  | { ok: true; report: Report }
  | { ok: false; kind: "no_tool"; message: string }
  | { ok: false; kind: "invalid"; toolUseId: string; message: string };

function extractReport(msg: Anthropic.Beta.BetaMessage): ParseOutcome {
  const block = msg.content.find(
    (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!block) return { ok: false, kind: "no_tool", message: "Model nie wywołał narzędzia zapisz_raport." };
  const parsed = ReportSchema.safeParse(block.input);
  if (parsed.success) return { ok: true, report: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 15)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return { ok: false, kind: "invalid", toolUseId: block.id, message: issues };
}

export class ClaudeProvider implements AiProvider {
  name = "claude";
  private client: Anthropic;

  constructor(client?: Anthropic) {
    // Klucz z ANTHROPIC_API_KEY (lub inne źródła poświadczeń SDK).
    this.client = client ?? new Anthropic();
  }

  private async call(messages: Anthropic.Beta.BetaMessageParam[]): Promise<Anthropic.Beta.BetaMessage> {
    const cfg = config();
    const params: BetaMessageStreamParams = {
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      system: [{ type: "text", text: loadSystemPrompt(), cache_control: { type: "ephemeral" } }],
      tools: [buildTool()],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      output_config: { effort: cfg.effort },
      ...(cfg.thinking ? { thinking: { type: "adaptive" as const } } : {}),
      ...(cfg.fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
      messages,
    };
    try {
      // Streaming + finalMessage(): długie odpowiedzi nie trafiają w timeout HTTP.
      return await this.client.beta.messages.stream(params).finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new AiError("Błędny lub brakujący klucz ANTHROPIC_API_KEY.");
      if (e instanceof Anthropic.BadRequestError) throw new AiError(`Błędne żądanie do Claude API: ${e.message}`);
      if (e instanceof Anthropic.RateLimitError) throw new AiError("Przekroczony limit zapytań do Claude API – spróbuj za chwilę.", true);
      if (e instanceof Anthropic.APIError) throw new AiError(`Błąd Claude API (${e.status ?? "?"}): ${e.message}`, true);
      throw e;
    }
  }

  async generate(req: AiReportRequest): Promise<Report> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: buildUserContent(req) }];

    for (let attempt = 0; attempt < 2; attempt++) {
      const msg = await this.call(messages);

      if (msg.stop_reason === "refusal") {
        throw new AiError("Model odmówił przygotowania raportu dla tych danych.");
      }
      if (msg.stop_reason === "max_tokens") {
        throw new AiError("Odpowiedź modelu została ucięta (limit tokenów). Zwiększ ANTHROPIC_MAX_TOKENS.", true);
      }

      const outcome = extractReport(msg);
      if (outcome.ok) return outcome.report;
      if (attempt === 1) throw new AiError(`Raport nie przeszedł walidacji: ${outcome.message}`, true);

      // Jedna ponowna próba – dopisujemy do rozmowy (append-only), z informacją co poprawić.
      messages.push({ role: "assistant", content: msg.content });
      if (outcome.kind === "invalid") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: outcome.toolUseId,
              is_error: true,
              content: `Raport nie przeszedł walidacji schematu. Popraw i wywołaj ${TOOL_NAME} ponownie z kompletnym raportem.\n${outcome.message}`,
            },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: `Nie zapisano raportu. Wywołaj teraz narzędzie ${TOOL_NAME} z kompletnym raportem (nie odpowiadaj zwykłym tekstem).`,
        });
      }
    }
    throw new AiError("Nie udało się wygenerować raportu.");
  }
}
