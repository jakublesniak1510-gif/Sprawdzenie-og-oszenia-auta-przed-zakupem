import { NextResponse } from "next/server";
import { SMALL_JSON_MAX_BYTES, readJsonLimited } from "@/lib/http";
import { z } from "zod";
import { detectModels, loadModels, modelLabel } from "@/lib/models";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().max(30000).default(""), rocznik: z.number().int().nullable().optional() });

/** Lista modeli z bazy + kandydaci rozpoznani z tekstu ogłoszenia (aliasy). */
export async function POST(req: Request) {
  const limited = rateLimit(req, "modelsDetect");
  if (limited) return limited;
  const body = await readJsonLimited(req, SMALL_JSON_MAX_BYTES);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.data ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  const models = await loadModels();
  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      label: modelLabel(m),
      years: m.years,
      engines: m.engines.map((e) => ({ code: e.code, fuel: e.fuel })),
    })),
    candidates: detectModels(parsed.data.text, models, parsed.data.rocznik ?? null).slice(0, 5),
  });
}
