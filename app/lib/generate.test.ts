import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const behaviour: { mode: "ok" | "retryable" | "fatal" } = { mode: "ok" };
vi.mock("./ai", async () => {
  const { AiError } = await import("./ai/claude");
  const { MockProvider } = await import("./ai/mock");
  return {
    generateReport: vi.fn(async (req: unknown) => {
      if (behaviour.mode === "retryable") throw new AiError("Błąd Claude API (529): overloaded", true);
      if (behaviour.mode === "fatal") throw new AiError("Model odmówił przygotowania raportu dla tych danych.");
      return new MockProvider().generate(req as never);
    }),
  };
});

import { CLIENT_ERROR_MESSAGE, generateNow } from "./generate";
import { createReport, getDb, getReport, markPaid, requeueStaleGenerating, resetErrorToPaid, type StoredInput } from "./db";
import { getImages, putImages } from "./image-cache";
import { Semaphore, enqueueGeneration } from "./queue";
import { tempDir, useTempDb } from "./test-utils";

process.env.AI_MOCK_DELAY_MS = "0";
process.env.EMAIL_PROVIDER = "none";
process.env.IMAGE_ENCRYPTION_KEY = "c".repeat(64);
process.env.MODELS_DIR = tempDir();
process.env.RED_FLAGS_PATH = "/nonexistent.json";

const input = { tekst_ogloszenia: "Sprzedam auto. ".repeat(10), cena_pln: null, przebieg_km: null, rocznik: null, historia_pojazdu: "", odczyty_reczne: [], podobne_oferty: [], model_id: null, silnik_kod: null, model_label: null, liczba_zdjec: 1 } as StoredInput;
const jpg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString("base64")}`;

function paidReport() {
  const r = createReport({ input, offer: "raport" });
  markPaid(r.id);
  putImages(r.id, [jpg]);
  return r.id;
}

beforeEach(() => {
  useTempDb();
  process.env.IMAGES_DIR = tempDir();
  behaviour.mode = "ok";
});

describe("generateNow – licznik prób", () => {
  it("sukces: done, zdjęcia usunięte, zdarzenie raport_wygenerowany", async () => {
    const id = paidReport();
    expect(await generateNow(id)).toEqual({});
    const row = getReport(id)!;
    expect(row).toMatchObject({ status: "done", attempts: 1 });
    expect(row.done_at).toBeTruthy();
    expect(getImages(id)).toEqual([]);
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE name = 'raport_wygenerowany'`).get()).toEqual({ n: 1 });
  });

  it("błąd przejściowy: 2× ponowienie, po 3. próbie error z komunikatem dla klienta", async () => {
    behaviour.mode = "retryable";
    const id = paidReport();
    const o1 = await generateNow(id);
    expect(o1.retryInMs).toBeGreaterThan(0);
    expect(getReport(id)).toMatchObject({ status: "paid", attempts: 1 });
    expect(getImages(id)).toHaveLength(1); // zdjęcia zostają do kolejnej próby
    expect((await generateNow(id)).retryInMs).toBeGreaterThan(o1.retryInMs!);
    expect(await generateNow(id)).toEqual({});
    expect(getReport(id)).toMatchObject({ status: "error", attempts: 3, error: CLIENT_ERROR_MESSAGE });
    expect(getImages(id)).toEqual([]);
    const ev = getDb().prepare(`SELECT props_json FROM events WHERE name = 'raport_blad'`).get() as { props_json: string };
    expect(JSON.parse(ev.props_json).powod).toMatch(/529/);
    // przycisk „spróbuj ponownie” daje dokładnie jedną dodatkową próbę
    expect(resetErrorToPaid(id)).toBe(true);
    expect(getReport(id)).toMatchObject({ status: "paid", attempts: 2 });
    behaviour.mode = "ok";
    await generateNow(id);
    expect(getReport(id)!.status).toBe("done");
  });

  it("błąd nie do ponowienia (odmowa) → od razu error", async () => {
    behaviour.mode = "fatal";
    const id = paidReport();
    expect(await generateNow(id)).toEqual({});
    expect(getReport(id)).toMatchObject({ status: "error", attempts: 1 });
  });

  it("raport nieopłacony nie jest generowany; błąd przed płatnością nie daje darmowej próby", async () => {
    const r = createReport({ input, offer: "raport" });
    await generateNow(r.id);
    expect(getReport(r.id)!.status).toBe("pending_payment");
    getDb().prepare(`UPDATE reports SET status = 'error' WHERE id = ?`).run(r.id);
    expect(resetErrorToPaid(r.id)).toBe(false);
  });

  it("wznowienie: generating starsze niż 10 min → paid (z pominięciem generowanych w tym procesie)", () => {
    const a = paidReport();
    const b = paidReport();
    const c = paidReport();
    const old = new Date(Date.now() - 11 * 60_000).toISOString();
    getDb().prepare(`UPDATE reports SET status = 'generating', generating_started_at = ? WHERE id IN (?, ?)`).run(old, a, b);
    getDb().prepare(`UPDATE reports SET status = 'generating', generating_started_at = ? WHERE id = ?`).run(new Date().toISOString(), c);
    expect(requeueStaleGenerating(10, [b])).toBe(1);
    expect(getReport(a)!.status).toBe("paid");
    expect(getReport(b)!.status).toBe("generating");
    expect(getReport(c)!.status).toBe("generating");
  });
});

describe("kolejka", () => {
  it("semafor: najwyżej 2 zadania naraz", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        sem.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });

  it("deduplikacja po id i ponowienie po retryInMs", async () => {
    const calls: string[] = [];
    let n = 0;
    const runner = async (id: string) => {
      calls.push(id);
      return ++n < 2 ? { retryInMs: 1 } : {};
    };
    const id = randomUUID();
    const p1 = enqueueGeneration(id, { runner });
    const p2 = enqueueGeneration(id, { runner });
    expect(p1).toBe(p2);
    await p1;
    expect(calls).toEqual([id, id]);
  });
});
