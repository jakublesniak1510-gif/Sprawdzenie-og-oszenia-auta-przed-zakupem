import { NextResponse } from "next/server";

/** Limit body POST /api/reports: 8 zdjęć × ~400 KB (base64 ≈ +33%) + tekst. */
export const REPORTS_MAX_BODY_BYTES = 6 * 1024 * 1024;
/** Limit dla małych endpointów JSON (rozpoznanie modelu, kupony). */
export const SMALL_JSON_MAX_BYTES = 64 * 1024;

export type JsonBody = { ok: true; data: unknown } | { ok: false; response: NextResponse };

const tooLarge = (max: number) =>
  NextResponse.json(
    {
      error:
        max >= 1024 * 1024
          ? `Za duże dane (limit ${Math.round(max / 1024 / 1024)} MB). Dodaj mniej zdjęć albo zmniejsz ich rozdzielczość.`
          : `Za duże dane (limit ${Math.round(max / 1024)} KB).`,
    },
    { status: 413 },
  );

/**
 * Czyta JSON z limitem rozmiaru: najpierw nagłówek Content-Length, potem faktycznie odczytane bajty
 * (strumieniowo – przerywa po przekroczeniu, nie trzyma w pamięci więcej niż limit).
 */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<JsonBody> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: tooLarge(maxBytes) };
  if (!req.body) return { ok: true, data: null };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, response: tooLarge(maxBytes) };
    }
    chunks.push(value);
  }
  try {
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: true, data: null };
  }
}
