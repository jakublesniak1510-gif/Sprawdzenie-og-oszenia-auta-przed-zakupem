import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Basic Auth panelu admina (ADMIN_USER / ADMIN_PASSWORD). Bez obu zmiennych panel nie istnieje (404).
 * Używane w proxy.ts (Next 16: dawne middleware.ts, runtime Node.js) i ponownie w samej stronie (obrona w głąb).
 */

export function adminConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.ADMIN_USER && env.ADMIN_PASSWORD);
}

/** Porównanie w stałym czasie niezależnie od długości (porównujemy skróty SHA-256). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** Sprawdza nagłówek `Authorization: Basic …` (dane w UTF-8, np. hasło z polskimi znakami). */
export function checkBasicAuth(header: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!adminConfigured(env) || !header || !/^Basic\s+/i.test(header)) return false;
  const b64 = header.replace(/^Basic\s+/i, "").trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  const decoded = Buffer.from(b64, "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = safeEqual(decoded.slice(0, i), env.ADMIN_USER!);
  const okPass = safeEqual(decoded.slice(i + 1), env.ADMIN_PASSWORD!);
  return okUser && okPass;
}
