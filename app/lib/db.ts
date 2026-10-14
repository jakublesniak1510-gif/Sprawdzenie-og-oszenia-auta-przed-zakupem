import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { OfferId, Report, ReportInput } from "./report-schema";

/**
 * SQLite (better-sqlite3), plik `data/app.db` (w .gitignore).
 * Dane wejściowe zapisujemy JUŻ ZANONIMIZOWANE i bez zdjęć. Wszystko wygasa po 30 dniach.
 */

export type ReportStatus = "pending_payment" | "paid" | "generating" | "done" | "error" | "expired";

export interface ReportRow {
  id: string;
  created_at: string;
  expires_at: string;
  status: ReportStatus;
  offer: OfferId;
  input_json: string;
  report_json: string | null;
  error: string | null;
  email: string | null;
  stripe_session_id: string | null;
  /** Liczba rozpoczętych prób generowania (max MAX_GENERATION_ATTEMPTS). */
  attempts: number;
  /** Kwota oczekiwana w Stripe (grosze) – ustawiana przy tworzeniu sesji płatności. */
  amount_gr: number | null;
  /** Kod kuponu, którym opłacono raport (zamiast Stripe). */
  coupon_code: string | null;
  paid_at: string | null;
  generating_started_at: string | null;
  done_at: string | null;
  ready_email_sent_at: string | null;
  payment_followup_sent_at: string | null;
  feedback_followup_sent_at: string | null;
  /** Odpowiedź z e-maila „Kupiłeś to auto?”: 1 = tak, 0 = nie, null = brak. */
  kupil: number | null;
  /** Liczba ręcznych ponowień („Spróbuj ponownie”), max MAX_MANUAL_RETRIES. */
  manual_retries: number;
  /** Płatność rozpoczęta, ale jeszcze nie potwierdzona (np. Przelewy24 – sesja complete + unpaid). */
  payment_pending_at: string | null;
}

export interface StoredInput extends ReportInput {
  /** Wynik detekcji / wyboru modelu w chwili tworzenia zamówienia. */
  model_label: string | null;
  liczba_zdjec: number;
}

export const RETENTION_DAYS = 30;
export const MAX_GENERATION_ATTEMPTS = 3;
export const MAX_MANUAL_RETRIES = 1;

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzDb: Database.Database | undefined;
}

function dbPath(): string {
  return process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(process.cwd(), "data", "app.db");
}

export function getDb(): Database.Database {
  if (globalThis.__sprawdzDb) return globalThis.__sprawdzDb;
  const file = dbPath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  // Usunięte dane są nadpisywane zerami (RODO: skasowane ogłoszenia nie zostają w wolnych stronach pliku).
  db.pragma("secure_delete = ON");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalThis.__sprawdzDb = db;
  return db;
}

/** Tylko do testów: zamyka i zapomina połączenie (kolejne getDb() otworzy DATABASE_PATH od nowa). */
export function resetDbForTests() {
  globalThis.__sprawdzDb?.close();
  globalThis.__sprawdzDb = undefined;
}

const REPORTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending_payment','paid','generating','done','error','expired')),
    offer TEXT NOT NULL DEFAULT 'raport',
    input_json TEXT NOT NULL,
    report_json TEXT,
    error TEXT,
    email TEXT,
    stripe_session_id TEXT
  )`;

/** Kolumny dokładane migracją (ALTER TABLE … ADD COLUMN, jeśli brak – sprawdzane przez PRAGMA table_info). */
const REPORT_EXTRA_COLUMNS: [string, string][] = [
  ["attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["amount_gr", "INTEGER"],
  ["coupon_code", "TEXT"],
  ["paid_at", "TEXT"],
  ["generating_started_at", "TEXT"],
  ["done_at", "TEXT"],
  ["ready_email_sent_at", "TEXT"],
  ["payment_followup_sent_at", "TEXT"],
  ["feedback_followup_sent_at", "TEXT"],
  ["kupil", "INTEGER"],
  ["manual_retries", "INTEGER NOT NULL DEFAULT 0"],
  ["payment_pending_at", "TEXT"],
];

function columns(db: Database.Database, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, ddl: string) {
  if (!columns(db, table).has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

/**
 * Runda 1 miała CHECK bez statusu 'expired'. SQLite nie zmienia CHECK przez ALTER, więc przebudowujemy tabelę
 * (dane zostają). Robione raz – potem warunek nie jest spełniony.
 */
function upgradeStatusCheck(db: Database.Database) {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reports'`).get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'expired'")) return;
  const cols = [...columns(db, "reports")].join(", ");
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(REPORTS_TABLE_SQL.replace("IF NOT EXISTS reports", "reports_new"));
      for (const [c, ddl] of REPORT_EXTRA_COLUMNS) addColumnIfMissing(db, "reports_new", c, ddl);
      db.exec(`INSERT INTO reports_new (${cols}) SELECT ${cols} FROM reports`);
      db.exec(`DROP TABLE reports`);
      db.exec(`ALTER TABLE reports_new RENAME TO reports`);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function migrate(db: Database.Database) {
  db.exec(REPORTS_TABLE_SQL);
  upgradeStatusCheck(db);
  for (const [c, ddl] of REPORT_EXTRA_COLUMNS) addColumnIfMissing(db, "reports", c, ddl);
  db.exec(`
    CREATE INDEX IF NOT EXISTS reports_expires ON reports(expires_at);
    CREATE INDEX IF NOT EXISTS reports_status ON reports(status);

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      helpful INTEGER NOT NULL CHECK (helpful IN (0,1)),
      comment TEXT
    );

    -- Kupony (pakiet 5 raportów, kody dla influencerów). offer: 'raport' | 'raport_plus' | 'any'.
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      uses_left INTEGER NOT NULL CHECK (uses_left >= 0),
      offer TEXT NOT NULL DEFAULT 'raport',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      uses_total INTEGER NOT NULL DEFAULT 0,
      email TEXT,
      stripe_session_id TEXT UNIQUE
    );

    -- Opłacone sesje Stripe (raporty i pakiety) – przychód do panelu admina + idempotencja tworzenia kuponów.
    CREATE TABLE IF NOT EXISTS payments (
      stripe_session_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      report_id TEXT,
      amount_gr INTEGER NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Idempotencja webhooka Stripe (duplikat = zdarzenie z ustawionym processed_at).
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL,
      processed_at TEXT
    );

    -- Limit e-maili przypominających na adres (ochrona przed wysyłką na cudzy adres). Adres jako skrót SHA-256.
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT NOT NULL,
      kind TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS email_log_hash ON email_log(email_hash, sent_at);

    -- Drobne ustawienia/stan (np. data ostatniego VACUUM).
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Zużycie Claude API (koszt szacowany z lib/ai/pricing.ts). Bez FK – statystyka ma przetrwać usunięcie raportu.
    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      cached_tokens INTEGER NOT NULL,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL,
      cost_usd_est REAL,
      created_at TEXT NOT NULL
    );

    -- Analityka bez cookies: nazwa zdarzenia + proste właściwości, IP hashowane dziennym saltem.
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      props_json TEXT,
      created_at TEXT NOT NULL,
      ip_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS events_name_created ON events(name, created_at);

    CREATE TABLE IF NOT EXISTS analytics_salts (
      day TEXT PRIMARY KEY,
      salt TEXT NOT NULL
    );
  `);
  if (!columns(db, "stripe_events").has("processed_at")) {
    db.exec(`ALTER TABLE stripe_events ADD COLUMN processed_at TEXT`);
    // Zdarzenia sprzed migracji były obsłużone w chwili zapisu.
    db.exec(`UPDATE stripe_events SET processed_at = received_at WHERE processed_at IS NULL`);
  }
}

export const nowIso = () => new Date().toISOString();

export function createReport(args: { input: StoredInput; offer: OfferId; email?: string | null }): ReportRow {
  const id = randomUUID();
  const created = new Date();
  const expires = new Date(created.getTime() + RETENTION_DAYS * 24 * 3600 * 1000);
  getDb()
    .prepare(
      `INSERT INTO reports (id, created_at, expires_at, status, offer, input_json, email)
       VALUES (?, ?, ?, 'pending_payment', ?, ?, ?)`,
    )
    .run(id, created.toISOString(), expires.toISOString(), args.offer, JSON.stringify(args.input), args.email ?? null);
  return getReport(id)!;
}

export function getReport(id: string): ReportRow | null {
  const row = getDb().prepare(`SELECT * FROM reports WHERE id = ? AND expires_at > ?`).get(id, nowIso()) as ReportRow | undefined;
  return row ?? null;
}

export function setStripeSession(id: string, sessionId: string, amountGr?: number) {
  getDb()
    .prepare(`UPDATE reports SET stripe_session_id = ?, amount_gr = COALESCE(?, amount_gr) WHERE id = ?`)
    .run(sessionId, amountGr ?? null, id);
}

/**
 * pending_payment (lub expired – klient zapłacił w nowej sesji) → paid. Zwraca true, jeśli to wywołanie zmieniło status.
 * Zdarzenie analityczne `platnosc_oplacona` wysyła wywołujący (lib/payment-flow.ts).
 */
export function markPaid(id: string, opts: { couponCode?: string | null } = {}): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE reports SET status = 'paid', paid_at = ?, coupon_code = COALESCE(?, coupon_code)
         WHERE id = ? AND status IN ('pending_payment','expired')`,
      )
      .run(nowIso(), opts.couponCode ?? null, id).changes === 1
  );
}

/** pending_payment → expired (sesja Stripe wygasła). Tylko gdy to wciąż bieżąca sesja raportu. */
export function markExpired(id: string, sessionId: string): boolean {
  return (
    getDb()
      .prepare(`UPDATE reports SET status = 'expired' WHERE id = ? AND status = 'pending_payment' AND stripe_session_id = ?`)
      .run(id, sessionId).changes === 1
  );
}

/** expired → pending_payment (klient wraca do płatności z linku w e-mailu). */
export function reopenPayment(id: string): boolean {
  return getDb().prepare(`UPDATE reports SET status = 'pending_payment' WHERE id = ? AND status = 'expired'`).run(id).changes === 1;
}

/**
 * paid → generating (atomowo – tylko jeden proces generuje raport). Zwiększa licznik prób.
 * Zwraca false, gdy raport nie jest w statusie `paid` albo wyczerpano limit prób.
 */
export function claimForGeneration(id: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE reports SET status = 'generating', error = NULL, attempts = attempts + 1, generating_started_at = ?
         WHERE id = ? AND status = 'paid' AND attempts < ?`,
      )
      .run(nowIso(), id, MAX_GENERATION_ATTEMPTS).changes === 1
  );
}

/** generating → paid (ponowienie po błędzie przejściowym). */
export function releaseForRetry(id: string, message: string) {
  getDb().prepare(`UPDATE reports SET status = 'paid', error = ? WHERE id = ? AND status = 'generating'`).run(message.slice(0, 2000), id);
}

export function saveReportResult(id: string, report: Report) {
  getDb()
    .prepare(`UPDATE reports SET status = 'done', report_json = ?, error = NULL, done_at = ? WHERE id = ?`)
    .run(JSON.stringify(report), nowIso(), id);
}

export function saveReportError(id: string, message: string) {
  getDb().prepare(`UPDATE reports SET status = 'error', error = ? WHERE id = ?`).run(message.slice(0, 2000), id);
}

/**
 * Ponowienie po błędzie (przycisk „spróbuj ponownie”): error → paid.
 * Najwyżej MAX_MANUAL_RETRIES razy na raport (kolumna manual_retries) i jedna próba generowania na ponowienie
 * (attempts = MAX - 1) – klikanie nie może generować płatnych wywołań AI bez końca.
 * Tylko dla raportów opłaconych (paid_at) – błąd przed płatnością nie może dać darmowego raportu.
 */
export function resetErrorToPaid(id: string): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE reports SET status = 'paid', attempts = MIN(attempts, ?), manual_retries = manual_retries + 1
         WHERE id = ? AND status = 'error' AND (paid_at IS NOT NULL OR attempts > 0) AND manual_retries < ?`,
      )
      .run(MAX_GENERATION_ATTEMPTS - 1, id, MAX_MANUAL_RETRIES).changes === 1
  );
}

/** Czy raport może jeszcze zostać ponowiony ręcznie (do UI: pokazać przycisk czy kontakt). */
export function canRetryManually(row: ReportRow): boolean {
  return row.status === "error" && (row.manual_retries ?? 0) < MAX_MANUAL_RETRIES && (!!row.paid_at || row.attempts > 0);
}

export function clearPaymentPending(id: string) {
  getDb().prepare(`UPDATE reports SET payment_pending_at = NULL WHERE id = ?`).run(id);
}

/** Płatność w toku (P24: sesja zakończona, pieniądze jeszcze niepotwierdzone). */
export function markPaymentPending(id: string) {
  getDb().prepare(`UPDATE reports SET payment_pending_at = COALESCE(payment_pending_at, ?) WHERE id = ? AND status IN ('pending_payment','expired')`).run(nowIso(), id);
}

/**
 * Wznowienie po restarcie: raporty `generating` starsze niż `olderThanMin` minut → `paid`.
 * `skip` – identyfikatory generowane właśnie w tym procesie. Zwraca liczbę zmienionych.
 */
export function requeueStaleGenerating(olderThanMin: number, skip: Iterable<string> = []): number {
  const cutoff = new Date(Date.now() - olderThanMin * 60_000).toISOString();
  const skipSet = new Set(skip);
  const rows = getDb()
    .prepare(
      `SELECT id FROM reports WHERE status = 'generating' AND COALESCE(generating_started_at, created_at) < ? AND expires_at > ?`,
    )
    .all(cutoff, nowIso()) as { id: string }[];
  const upd = getDb().prepare(`UPDATE reports SET status = 'paid' WHERE id = ? AND status = 'generating'`);
  let n = 0;
  for (const r of rows) if (!skipSet.has(r.id)) n += upd.run(r.id).changes;
  return n;
}

export function listPaidReportIds(): string[] {
  return (getDb().prepare(`SELECT id FROM reports WHERE status = 'paid' AND expires_at > ? ORDER BY created_at`).all(nowIso()) as { id: string }[]).map(
    (r) => r.id,
  );
}

export function markEmailSent(id: string, kind: "ready" | "payment_followup" | "feedback_followup") {
  const col = { ready: "ready_email_sent_at", payment_followup: "payment_followup_sent_at", feedback_followup: "feedback_followup_sent_at" }[kind];
  getDb().prepare(`UPDATE reports SET ${col} = ? WHERE id = ?`).run(nowIso(), id);
}

/** Zapisuje odpowiedź „czy kupiłeś?” (tylko pierwszą). true = zapisano. */
export function setBought(id: string, bought: boolean): boolean {
  return getDb().prepare(`UPDATE reports SET kupil = ? WHERE id = ? AND kupil IS NULL`).run(bought ? 1 : 0, id).changes === 1;
}

export function addFeedback(reportId: string, helpful: boolean, comment: string | null) {
  getDb()
    .prepare(`INSERT INTO feedback (report_id, created_at, helpful, comment) VALUES (?, ?, ?, ?)`)
    .run(reportId, nowIso(), helpful ? 1 : 0, comment);
}

export function hasFeedback(reportId: string): boolean {
  return !!getDb().prepare(`SELECT 1 FROM feedback WHERE report_id = ? LIMIT 1`).get(reportId);
}

/** Usuwa zamówienie (np. gdy nie udało się rozpocząć płatności). */
export function deleteReport(id: string) {
  getDb().prepare(`DELETE FROM reports WHERE id = ?`).run(id);
}

/** Kasuje stare identyfikatory zdarzeń (Stripe ponawia najwyżej przez 3 dni). */
export function deleteOldStripeEvents(days = 30): number {
  const cutoff = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  return getDb().prepare(`DELETE FROM stripe_events WHERE received_at < ?`).run(cutoff).changes;
}

/** RODO: kasuje e-mail kupującego z kuponów wygasłych, wyczerpanych lub starszych niż 30 dni. */
export function scrubCouponEmails(now = Date.now()): number {
  const iso = new Date(now).toISOString();
  const cutoff = new Date(now - 30 * 24 * 3600_000).toISOString();
  return getDb()
    .prepare(`UPDATE coupons SET email = NULL WHERE email IS NOT NULL AND (expires_at <= ? OR uses_left = 0 OR created_at < ?)`)
    .run(iso, cutoff).changes;
}

export function getMeta(key: string): string | null {
  return (getDb().prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value: string } | undefined)?.value ?? null;
}

export function setMeta(key: string, value: string) {
  getDb().prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
}

/** VACUUM najwyżej raz na `everyDays` dni (zwalnia miejsce i fizycznie usuwa skasowane dane). true = wykonano. */
export function vacuumIfDue(everyDays = 7, now = Date.now()): boolean {
  const last = getMeta("last_vacuum_at");
  if (last && now - Date.parse(last) < everyDays * 24 * 3600_000) return false;
  getDb().exec("VACUUM");
  setMeta("last_vacuum_at", new Date(now).toISOString());
  return true;
}

/** Kasuje wygasłe raporty (feedback kasuje się kaskadowo). Zwraca liczbę usuniętych. */
export function deleteExpired(): number {
  return getDb().prepare(`DELETE FROM reports WHERE expires_at <= ?`).run(nowIso()).changes;
}

export function parseInput(row: ReportRow): StoredInput {
  return JSON.parse(row.input_json) as StoredInput;
}

export function parseReport(row: ReportRow): Report | null {
  return row.report_json ? (JSON.parse(row.report_json) as Report) : null;
}
