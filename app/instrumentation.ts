/**
 * Hook startowy Next.js (wywoływany raz przy starcie serwera). Logika w lib/startup.ts:
 * blokady produkcyjne (DEV_SKIP_PAYMENT / AI_MOCK w produkcji → odmowa startu, chyba że ALLOW_UNSAFE_PROD=1)
 * oraz wznowienie raportów przerwanych restartem (kolejka, max 2 równolegle).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Podczas `next build` nie startujemy kolejki ani nie sprawdzamy sekretów produkcyjnych.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startServer } = await import("./lib/startup");
  await startServer();
}
