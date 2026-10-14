import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanupImages, dataUrlBytes, decrypt, dropImages, encrypt, getImages, imagesDir, isJpegDataUrl, parseKey, putImages } from "./image-cache";
import { tempDir } from "./test-utils";

const KEY = "a".repeat(64);
const jpeg = (extra: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(extra)]);
const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;

beforeEach(() => {
  process.env.IMAGES_DIR = tempDir("sprawdz-img-");
  process.env.IMAGE_ENCRYPTION_KEY = KEY;
});

describe("szyfrowanie AES-256-GCM", () => {
  it("szyfruje i odszyfrowuje (losowe IV – dwa szyfrogramy różne)", () => {
    const key = randomBytes(32);
    const plain = Buffer.from("zdjęcie auta");
    const a = encrypt(plain, key);
    const b = encrypt(plain, key);
    expect(a.equals(b)).toBe(false);
    expect(decrypt(a, key).toString()).toBe("zdjęcie auta");
  });

  it("wykrywa modyfikację danych i zły klucz", () => {
    const key = randomBytes(32);
    const blob = encrypt(Buffer.from("abc"), key);
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(blob, randomBytes(32))).toThrow();
  });

  it("odrzuca klucz w złym formacie", () => {
    expect(() => parseKey("abc")).toThrow(/64 znaki hex/);
    expect(parseKey(KEY)).toHaveLength(32);
  });
});

describe("putImages / getImages / dropImages", () => {
  it("zapisuje zaszyfrowane pliki <reportId>/<n>.jpg i odczytuje je w kolejności", () => {
    const id = randomUUID();
    const imgs = Array.from({ length: 10 }, (_, i) => dataUrl(jpeg(`zdjecie-${i}`)));
    putImages(id, imgs);
    const dir = path.join(imagesDir(), id);
    const files = fs.readdirSync(dir).sort();
    expect(files).toContain("1.jpg");
    expect(files).toContain("10.jpg");
    const raw = fs.readFileSync(path.join(dir, "1.jpg"));
    expect(raw.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false); // nie leży jawnym tekstem
    expect(raw.includes(Buffer.from("zdjecie-0"))).toBe(false);
    expect(getImages(id)).toEqual(imgs);
    dropImages(id);
    expect(fs.existsSync(dir)).toBe(false);
    expect(getImages(id)).toEqual([]);
  });

  it("po zmianie klucza pliki są nieczytelne (pomijane, bez wyjątku)", () => {
    const id = randomUUID();
    putImages(id, [dataUrl(jpeg("x"))]);
    process.env.IMAGE_ENCRYPTION_KEY = "b".repeat(64);
    expect(getImages(id)).toEqual([]);
  });

  it("odrzuca identyfikator, który nie jest UUID (ochrona przed path traversal)", () => {
    expect(() => putImages("../../etc", [dataUrl(jpeg("x"))])).toThrow();
    expect(getImages("../x")).toEqual([]);
  });

  it("cleanupImages kasuje katalogi starsze niż 48 h", () => {
    const old = randomUUID();
    const fresh = randomUUID();
    putImages(old, [dataUrl(jpeg("a"))]);
    putImages(fresh, [dataUrl(jpeg("b"))]);
    const past = new Date(Date.now() - 49 * 3600_000);
    fs.utimesSync(path.join(imagesDir(), old), past, past);
    expect(cleanupImages(48)).toBe(1);
    expect(getImages(old)).toEqual([]);
    expect(getImages(fresh)).toHaveLength(1);
  });

  it("bez klucza w produkcji – błąd; w dev – klucz deweloperski", () => {
    delete process.env.IMAGE_ENCRYPTION_KEY;
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = "production";
    globalThis.__sprawdzImageKey = undefined;
    try {
      expect(() => putImages(randomUUID(), [dataUrl(jpeg("a"))])).toThrow(/IMAGE_ENCRYPTION_KEY/);
    } finally {
      env.NODE_ENV = prev;
    }
    const id = randomUUID();
    putImages(id, [dataUrl(jpeg("a"))]);
    expect(fs.existsSync(path.join(imagesDir(), ".dev-key"))).toBe(true);
    expect(getImages(id)).toHaveLength(1);
  });
});

describe("walidacja zdjęć", () => {
  it("rozpoznaje JPEG po magic bytes", () => {
    expect(isJpegDataUrl(dataUrl(jpeg("x")))).toBe(true);
    expect(isJpegDataUrl(dataUrl(Buffer.from("\x89PNG\r\n\x1a\n")))).toBe(false);
    expect(isJpegDataUrl(`data:image/jpeg;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`)).toBe(false);
  });

  it("liczy rozmiar zdekodowanych danych", () => {
    const b = randomBytes(1000);
    expect(dataUrlBytes(dataUrl(b))).toBe(1000);
  });
});
