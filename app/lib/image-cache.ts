import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Zdjęcia z ogłoszenia – trzymane TYLKO do czasu wygenerowania raportu.
 *
 * - Zapis: `data/images/<reportId>/<n>.jpg` (katalog: IMAGES_DIR), zaszyfrowane AES-256-GCM
 *   kluczem z IMAGE_ENCRYPTION_KEY (32 bajty jako 64 znaki hex). Format pliku: IV (12 B) | tag (16 B) | szyfrogram.
 * - Dzięki temu raport opłacony przed restartem serwera powstaje ze zdjęciami (wznowienie w instrumentation.ts).
 * - Po wygenerowaniu raportu (sukces albo ostateczny błąd) katalog jest usuwany (`dropImages`).
 * - `cleanupImages()` (scripts/cleanup.ts) kasuje katalogi starsze niż 48 h (np. nieopłacone zamówienia).
 *
 * Brak klucza: w dev generujemy losowy i zapisujemy w `data/images/.dev-key` (z ostrzeżeniem),
 * w produkcji (NODE_ENV=production) – błąd.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IV_LEN = 12;
const TAG_LEN = 16;
export const IMAGE_MAX_AGE_HOURS = 48;

export function imagesDir(): string {
  return process.env.IMAGES_DIR ? path.resolve(process.env.IMAGES_DIR) : path.resolve(process.cwd(), "data", "images");
}

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzImageKey: Buffer | undefined;
}

/** Parsuje klucz z env. Rzuca błąd przy złym formacie. */
export function parseKey(hex: string): Buffer {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) throw new Error("IMAGE_ENCRYPTION_KEY musi mieć 64 znaki hex (32 bajty). Wygeneruj: openssl rand -hex 32");
  return Buffer.from(clean, "hex");
}

export function getImageKey(): Buffer {
  const env = process.env.IMAGE_ENCRYPTION_KEY;
  if (env) return parseKey(env);
  if (globalThis.__sprawdzImageKey) return globalThis.__sprawdzImageKey;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Brak IMAGE_ENCRYPTION_KEY w produkcji. Wygeneruj: openssl rand -hex 32");
  }
  const keyFile = path.join(imagesDir(), ".dev-key");
  let key: Buffer;
  try {
    key = parseKey(fs.readFileSync(keyFile, "utf8"));
  } catch {
    key = randomBytes(32);
    fs.mkdirSync(imagesDir(), { recursive: true });
    fs.writeFileSync(keyFile, key.toString("hex"), { mode: 0o600 });
  }
  console.warn(`[images] Brak IMAGE_ENCRYPTION_KEY – używam klucza deweloperskiego z ${keyFile}. W produkcji ustaw własny klucz!`);
  globalThis.__sprawdzImageKey = key;
  return key;
}

export function encrypt(plain: Buffer, key: Buffer = getImageKey()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

/** Rzuca błąd, gdy dane zmieniono albo klucz jest inny (uwierzytelnienie GCM). */
export function decrypt(blob: Buffer, key: Buffer = getImageKey()): Buffer {
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("Uszkodzony plik zdjęcia.");
  const decipher = createDecipheriv("aes-256-gcm", key, blob.subarray(0, IV_LEN));
  decipher.setAuthTag(blob.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(blob.subarray(IV_LEN + TAG_LEN)), decipher.final()]);
}

function reportDir(reportId: string): string {
  if (!UUID_RE.test(reportId)) throw new Error("Nieprawidłowy identyfikator raportu.");
  return path.join(imagesDir(), reportId.toLowerCase());
}

const PREFIX = "data:image/jpeg;base64,";

/** Zapisuje zdjęcia (data URL JPEG) zaszyfrowane na dysku. */
export function putImages(reportId: string, images: string[]) {
  if (!images.length) return;
  const dir = reportDir(reportId);
  const key = getImageKey();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  images.forEach((img, i) => {
    const b64 = img.startsWith(PREFIX) ? img.slice(PREFIX.length) : img;
    fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), encrypt(Buffer.from(b64, "base64"), key), { mode: 0o600 });
  });
}

/** Odczytuje zdjęcia jako data URL JPEG (w kolejności). Pliki nie do odszyfrowania są pomijane z ostrzeżeniem. */
export function getImages(reportId: string): string[] {
  let dir: string;
  try {
    dir = reportDir(reportId);
  } catch {
    return [];
  }
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f));
  } catch {
    return [];
  }
  files.sort((a, b) => parseInt(a) - parseInt(b));
  const key = getImageKey();
  const out: string[] = [];
  for (const f of files) {
    try {
      out.push(PREFIX + decrypt(fs.readFileSync(path.join(dir, f)), key).toString("base64"));
    } catch (e) {
      console.warn(`[images] Nie można odczytać ${reportId}/${f}: ${(e as Error).message}`);
    }
  }
  return out;
}

export function dropImages(reportId: string) {
  try {
    fs.rmSync(reportDir(reportId), { recursive: true, force: true });
  } catch {
    /* nieprawidłowe id – nic do usunięcia */
  }
}

/** Kasuje katalogi zdjęć starsze niż `maxAgeHours`. Zwraca liczbę usuniętych katalogów. */
export function cleanupImages(maxAgeHours = IMAGE_MAX_AGE_HOURS, now = Date.now()): number {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(imagesDir(), { withFileTypes: true });
  } catch {
    return 0;
  }
  let n = 0;
  for (const e of entries) {
    if (!e.isDirectory() || !UUID_RE.test(e.name)) continue;
    const p = path.join(imagesDir(), e.name);
    try {
      if (now - fs.statSync(p).mtimeMs > maxAgeHours * 3600_000) {
        fs.rmSync(p, { recursive: true, force: true });
        n++;
      }
    } catch {
      /* równoległe usunięcie – pomijamy */
    }
  }
  return n;
}

/* ---------- walidacja zdjęć ---------- */

/** Sprawdza magic bytes JPEG (FF D8 FF) w data URL. */
export function isJpegDataUrl(dataUrl: string): boolean {
  if (!dataUrl.startsWith(PREFIX)) return false;
  const head = Buffer.from(dataUrl.slice(PREFIX.length, PREFIX.length + 8), "base64");
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

/** Rozmiar zdekodowanego zdjęcia w bajtach (bez dekodowania). */
export function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}
