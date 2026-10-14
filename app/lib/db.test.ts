import Database from "better-sqlite3";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createReport, getDb, getReport, markExpired, resetDbForTests, scrubCouponEmails, setBought, vacuumIfDue, type StoredInput } from "./db";
import { tempDir, useTempDb } from "./test-utils";

describe("migracja bazy z rundy 1", () => {
  it("dokłada kolumny, nowe tabele i status 'expired', zachowując dane", () => {
    const file = path.join(tempDir(), "old.db");
    const old = new Database(file);
    old.exec(`
      CREATE TABLE reports (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending_payment','paid','generating','done','error')),
        offer TEXT NOT NULL DEFAULT 'raport', input_json TEXT NOT NULL, report_json TEXT, error TEXT, email TEXT, stripe_session_id TEXT);
      CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL, helpful INTEGER NOT NULL CHECK (helpful IN (0,1)), comment TEXT);
    `);
    const id = "11111111-1111-4111-8111-111111111111";
    old.prepare(`INSERT INTO reports VALUES (?, ?, ?, 'pending_payment', 'raport', '{}', NULL, NULL, 'a@b.pl', 'cs_1')`).run(id, new Date().toISOString(), "2999-01-01T00:00:00.000Z");
    old.prepare(`INSERT INTO feedback (report_id, created_at, helpful) VALUES (?, ?, 1)`).run(id, new Date().toISOString());
    old.close();

    resetDbForTests();
    process.env.DATABASE_PATH = file;
    const db = getDb();
    const cols = (db.prepare(`PRAGMA table_info(reports)`).all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["attempts", "amount_gr", "coupon_code", "paid_at", "done_at", "payment_followup_sent_at"]));
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["coupons", "stripe_events", "ai_usage", "events", "payments"]));
    expect(getReport(id)).toMatchObject({ email: "a@b.pl", attempts: 0 });
    expect(markExpired(id, "cs_1")).toBe(true);
    expect(getReport(id)!.status).toBe("expired");
    // klucz obcy feedback → reports nadal działa (kaskada)
    db.prepare(`DELETE FROM reports WHERE id = ?`).run(id);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM feedback`).get()).toEqual({ n: 0 });
    // ponowne otwarcie – migracja idempotentna
    resetDbForTests();
    expect(() => getDb()).not.toThrow();
  });
});

describe("odpowiedź „czy kupiłeś?”", () => {
  it("zapisuje tylko pierwszą odpowiedź", () => {
    useTempDb();
    const r = createReport({ input: { tekst_ogloszenia: "x" } as StoredInput, offer: "raport" });
    expect(setBought(r.id, true)).toBe(true);
    expect(setBought(r.id, false)).toBe(false);
    expect(getReport(r.id)!.kupil).toBe(1);
  });
});

describe("sprzątanie: e-maile kuponów i VACUUM", () => {
  it("zeruje e-mail w kuponach wyczerpanych, wygasłych i starszych niż 30 dni; aktywne zostają", () => {
    useTempDb();
    const db = getDb();
    const ins = db.prepare(`INSERT INTO coupons (code, uses_left, offer, expires_at, created_at, email) VALUES (?, ?, 'raport', ?, ?, ?)`);
    const future = "2999-01-01T00:00:00.000Z";
    ins.run("AAAAAAAA", 0, future, new Date().toISOString(), "a@x.pl");
    ins.run("BBBBBBBB", 3, "2000-01-01T00:00:00.000Z", new Date().toISOString(), "b@x.pl");
    ins.run("CCCCCCCC", 3, future, new Date(Date.now() - 31 * 864e5).toISOString(), "c@x.pl");
    ins.run("DDDDDDDD", 3, future, new Date().toISOString(), "d@x.pl");
    expect(scrubCouponEmails()).toBe(3);
    expect(db.prepare(`SELECT code FROM coupons WHERE email IS NOT NULL`).all()).toEqual([{ code: "DDDDDDDD" }]);
  });

  it("VACUUM najwyżej raz na 7 dni; secure_delete włączone", () => {
    useTempDb();
    expect(getDb().pragma("secure_delete", { simple: true })).toBe(1);
    const now = Date.now();
    expect(vacuumIfDue(7, now)).toBe(true);
    expect(vacuumIfDue(7, now + 864e5)).toBe(false);
    expect(vacuumIfDue(7, now + 8 * 864e5)).toBe(true);
  });
});
