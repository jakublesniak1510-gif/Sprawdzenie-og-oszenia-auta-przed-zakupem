/**
 * Start serwera (wywoływane z instrumentation.ts, tylko runtime Node.js):
 * 1. blokady produkcyjne (tryb testowy płatności / atrapa AI / brak klucza do zdjęć),
 * 2. wznowienie przerwanych raportów + okresowy „watchdog” kolejki.
 */

export class UnsafeProductionConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `Niebezpieczna konfiguracja produkcyjna – serwer nie wystartuje:\n- ${problems.join("\n- ")}\n` +
        `Popraw zmienne środowiskowe albo (tylko świadomie, np. na serwerze testowym) ustaw ALLOW_UNSAFE_PROD=1.`,
    );
    this.name = "UnsafeProductionConfigError";
  }
}

/** localhost / 127.x / 0.0.0.0 / ::1 / *.local. */
export function isLocalUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "0.0.0.0" || h === "::1" || /^127\./.test(h);
  } catch {
    return true; // nieparsowalny adres traktujemy jak błędny
  }
}

/** Zwraca listę problemów; rzuca wyjątek w produkcji, chyba że ALLOW_UNSAFE_PROD=1. */
export function checkProductionSafety(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];
  if (env.DEV_SKIP_PAYMENT === "1") problems.push("DEV_SKIP_PAYMENT=1 (raporty bez płatności)");
  if (env.AI_MOCK === "1") problems.push("AI_MOCK=1 (atrapa AI zamiast prawdziwych raportów)");
  if (!env.IMAGE_ENCRYPTION_KEY) problems.push("brak IMAGE_ENCRYPTION_KEY (szyfrowanie zdjęć) – wygeneruj: openssl rand -hex 32");
  if (env.RATE_LIMIT_DISABLED === "1") problems.push("RATE_LIMIT_DISABLED=1 (brak ochrony przed nadużyciami)");
  if (!env.APP_URL || isLocalUrl(env.APP_URL)) problems.push(`APP_URL ${env.APP_URL ? `wskazuje na ${env.APP_URL}` : "jest pusty"} – ustaw publiczny adres (https://…), inaczej linki w e-mailach i powroty ze Stripe nie zadziałają`);
  if (env.NEXT_PUBLIC_BASE_URL !== undefined && (!env.NEXT_PUBLIC_BASE_URL || isLocalUrl(env.NEXT_PUBLIC_BASE_URL))) {
    problems.push(`NEXT_PUBLIC_BASE_URL ${env.NEXT_PUBLIC_BASE_URL ? `wskazuje na ${env.NEXT_PUBLIC_BASE_URL}` : "jest pusty"} – ustaw publiczny adres albo usuń zmienną (użyty zostanie APP_URL)`);
  }
  if (problems.length === 0) return [];
  if (env.ALLOW_UNSAFE_PROD === "1") {
    console.warn(`[UWAGA] ALLOW_UNSAFE_PROD=1 – start mimo problemów:\n- ${problems.join("\n- ")}`);
    return problems;
  }
  throw new UnsafeProductionConfigError(problems);
}

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzWatchdog: ReturnType<typeof setInterval> | undefined;
}

export async function startServer(): Promise<void> {
  try {
    checkProductionSafety();
  } catch (e) {
    // Sam wyjątek w register() zostawia proces Next żywy (każde żądanie → 500). Kończymy proces, żeby
    // Docker/systemd pokazał błąd startu zamiast „zdrowego” kontenera.
    console.error(`[start] ${(e as Error).message}`);
    if (process.env.VITEST === undefined) process.exit(1);
    throw e;
  }
  const { resumeGenerations } = await import("./queue");
  try {
    const r = await resumeGenerations();
    if (r.requeued || r.enqueued) console.log(`[start] Wznowiono generowanie: ${r.requeued} przerwanych, ${r.enqueued} w kolejce.`);
  } catch (e) {
    console.error("[start] Nie udało się wznowić raportów:", e);
  }
  // Watchdog: co 5 min podnosi raporty „zawieszone” w generating i opłacone, których nikt nie wziął do kolejki.
  if (!globalThis.__sprawdzWatchdog) {
    globalThis.__sprawdzWatchdog = setInterval(() => {
      resumeGenerations().catch((e) => console.error("[watchdog]", e));
    }, 5 * 60_000);
    globalThis.__sprawdzWatchdog.unref?.();
  }
}
