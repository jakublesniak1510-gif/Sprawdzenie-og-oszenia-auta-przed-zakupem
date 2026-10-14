/**
 * Zdjęcia trzymamy WYŁĄCZNIE w pamięci procesu, do czasu wygenerowania raportu
 * (albo wygaśnięcia – domyślnie 2 h, np. gdy klient nie dokończy płatności).
 * Nie trafiają na dysk ani do bazy. Po restarcie serwera giną – raport powstanie wtedy bez zdjęć.
 */

interface Entry {
  images: string[];
  expires: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzImages: Map<string, Entry> | undefined;
}

const store = (): Map<string, Entry> => (globalThis.__sprawdzImages ??= new Map());
const ttlMs = () => Number(process.env.IMAGE_CACHE_TTL_MIN ?? 120) * 60_000;

function sweep() {
  const now = Date.now();
  for (const [k, v] of store()) if (v.expires < now) store().delete(k);
}

export function putImages(reportId: string, images: string[]) {
  sweep();
  if (images.length) store().set(reportId, { images, expires: Date.now() + ttlMs() });
}

export function getImages(reportId: string): string[] {
  sweep();
  return store().get(reportId)?.images ?? [];
}

export function dropImages(reportId: string) {
  store().delete(reportId);
}
