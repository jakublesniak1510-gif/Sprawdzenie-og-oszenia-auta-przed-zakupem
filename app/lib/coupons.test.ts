import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { beforeEach, describe, expect, it } from "vitest";
import { COUPON_ALPHABET, REDEEM_SQL, checkCoupon, createCoupon, generateCouponCode, getCoupon, normalizeCouponCode, redeemCoupon, refundCoupon } from "./coupons";
import { getDb } from "./db";
import { useTempDb } from "./test-utils";

let dbFile: string;
beforeEach(() => {
  dbFile = useTempDb();
});

describe("kody kuponów", () => {
  it("8 znaków bez mylących liter", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateCouponCode();
      expect(c).toMatch(/^[A-Z2-9]{8}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(COUPON_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalizuje wpisany kod (małe litery, myślnik, spacje)", () => {
    expect(normalizeCouponCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeCouponCode("ABCD-EFG0")).toBeNull(); // zero nie występuje w alfabecie
    expect(normalizeCouponCode("ABC")).toBeNull();
  });
});

describe("walidacja i wykorzystanie", () => {
  it("zmniejsza uses_left i odmawia po wyczerpaniu", () => {
    const c = createCoupon({ uses: 2, days: 30 });
    expect(checkCoupon(c.code.toLowerCase(), "raport").ok).toBe(true);
    expect(redeemCoupon(c.code, "raport")).toBe(true);
    expect(redeemCoupon(c.code, "raport")).toBe(true);
    expect(redeemCoupon(c.code, "raport")).toBe(false);
    expect(getCoupon(c.code)).toMatchObject({ uses_left: 0, uses_total: 2 });
    const r = checkCoupon(c.code, "raport");
    expect(r.ok).toBe(false);
    refundCoupon(c.code);
    expect(getCoupon(c.code)!.uses_left).toBe(1);
  });

  it("komunikat nie ujawnia liczby użyć", () => {
    const c = createCoupon({ uses: 3, days: 30 });
    const r = checkCoupon(c.code, "raport");
    expect(Object.keys(r).sort()).toEqual(["code", "offer", "ok"]);
    expect(checkCoupon("ZZZZZZZZ", "raport")).toEqual({ ok: false, message: "Nieprawidłowy lub wykorzystany kod." });
  });

  it("pilnuje pakietu i daty ważności", () => {
    const c = createCoupon({ uses: 1, days: 30, offer: "raport" });
    expect(checkCoupon(c.code, "raport_plus").ok).toBe(false);
    expect(redeemCoupon(c.code, "raport_plus")).toBe(false);
    const any = createCoupon({ uses: 1, days: 30, offer: "any" });
    expect(redeemCoupon(any.code, "raport_plus")).toBe(true);
    const old = createCoupon({ uses: 1, days: 1 });
    getDb().prepare(`UPDATE coupons SET expires_at = ? WHERE code = ?`).run("2000-01-01T00:00:00.000Z", old.code);
    expect(checkCoupon(old.code, "raport")).toEqual({ ok: false, message: "Ten kod wygasł." });
    expect(redeemCoupon(old.code, "raport")).toBe(false);
  });

  it("jedna sesja Stripe = jeden kupon (idempotencja)", () => {
    const a = createCoupon({ uses: 5, days: 365, stripeSessionId: "cs_test_1" });
    const b = createCoupon({ uses: 5, days: 365, stripeSessionId: "cs_test_1" });
    expect(b.code).toBe(a.code);
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM coupons`).get()).toEqual({ n: 1 });
  });
});

describe("atomowość przy równoległym użyciu", () => {
  it("8 wątków × 5 prób na kupon z 10 użyciami → dokładnie 10 sukcesów", async () => {
    const c = createCoupon({ uses: 10, days: 30 });
    getDb().pragma("wal_checkpoint(TRUNCATE)");
    // Każdy wątek ma własne połączenie SQLite do tego samego pliku i wykonuje ten sam SQL co redeemCoupon().
    const workerSrc = `
      const { parentPort, workerData } = require("node:worker_threads");
      const Database = require(workerData.mod);
      const db = new Database(workerData.file);
      db.pragma("busy_timeout = 5000");
      const stmt = db.prepare(workerData.sql);
      let ok = 0;
      // BEGIN IMMEDIATE: blokada zapisu od początku (bez SQLITE_BUSY_SNAPSHOT przy WAL); ponawiamy przy BUSY.
      const redeem = db.transaction(() => stmt.run(workerData.code, new Date().toISOString(), "raport").changes);
      for (let i = 0; i < 5; i++) {
        for (let t = 0; ; t++) {
          try { ok += redeem.immediate(); break; }
          catch (e) { if (!String(e.code).startsWith("SQLITE_BUSY") || t > 50) throw e; }
        }
      }
      db.close();
      parentPort.postMessage(ok);
    `;
    const mod = createRequire(import.meta.url).resolve("better-sqlite3");
    const results = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          new Promise<number>((resolve, reject) => {
            const w = new Worker(workerSrc, { eval: true, workerData: { file: dbFile, sql: REDEEM_SQL, code: c.code, mod } });
            w.once("message", resolve);
            w.once("error", reject);
          }),
      ),
    );
    expect(results.reduce((a, b) => a + b, 0)).toBe(10);
    expect(getCoupon(c.code)).toMatchObject({ uses_left: 0, uses_total: 10 });
  });

  it("równoległe redeemCoupon w jednym procesie nie schodzą poniżej zera", async () => {
    const c = createCoupon({ uses: 3, days: 30 });
    const res = await Promise.all(Array.from({ length: 20 }, async () => redeemCoupon(c.code, "raport")));
    expect(res.filter(Boolean)).toHaveLength(3);
    expect(getCoupon(c.code)!.uses_left).toBe(0);
  });
});
