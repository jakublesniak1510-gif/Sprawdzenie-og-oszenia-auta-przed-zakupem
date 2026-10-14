/**
 * Basic Auth panelu admina (ADMIN_USER / ADMIN_PASSWORD). Bez obu zmiennych panel nie istnieje (404).
 * Używane w proxy.ts (Next 16: dawne middleware.ts) i ponownie w samej stronie (obrona w głąb).
 */

export function adminConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.ADMIN_USER && env.ADMIN_PASSWORD);
}

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Sprawdza nagłówek `Authorization: Basic …`. */
export function checkBasicAuth(header: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!adminConfigured(env) || !header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const okUser = safeEqual(decoded.slice(0, i), env.ADMIN_USER!);
  const okPass = safeEqual(decoded.slice(i + 1), env.ADMIN_PASSWORD!);
  return okUser && okPass;
}
