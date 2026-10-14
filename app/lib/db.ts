import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { OfferId, Report, ReportInput } from "./report-schema";

/**
 * SQLite (better-sqlite3), plik `data/app.db` (w .gitignore).
 * Dane wejściowe zapisujemy JUŻ ZANONIMIZOWANE i bez zdjęć. Wszystko wygasa po 30 dniach.
 */

export type ReportStatus = "pending_payment" | "paid" | "generating" | "done" | "error";

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
}

export interface StoredInput extends ReportInput {
  /** Wynik detekcji / wyboru modelu w chwili tworzenia zamówienia. */
  model_label: string | null;
  liczba_zdjec: number;
}

const RETENTION_DAYS = 30;

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
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalThis.__sprawdzDb = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending_payment','paid','generating','done','error')),
      offer TEXT NOT NULL DEFAULT 'raport',
      input_json TEXT NOT NULL,
      report_json TEXT,
      error TEXT,
      email TEXT,
      stripe_session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS reports_expires ON reports(expires_at);

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      helpful INTEGER NOT NULL CHECK (helpful IN (0,1)),
      comment TEXT
    );
  `);
}

const nowIso = () => new Date().toISOString();

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

export function setStripeSession(id: string, sessionId: string) {
  getDb().prepare(`UPDATE reports SET stripe_session_id = ? WHERE id = ?`).run(sessionId, id);
}

/** pending_payment → paid. Zwraca true, jeśli to wywołanie zmieniło status. */
export function markPaid(id: string): boolean {
  return getDb().prepare(`UPDATE reports SET status = 'paid' WHERE id = ? AND status = 'pending_payment'`).run(id).changes === 1;
}

/** paid → generating (atomowo – tylko jeden proces generuje raport). */
export function claimForGeneration(id: string): boolean {
  return getDb().prepare(`UPDATE reports SET status = 'generating', error = NULL WHERE id = ? AND status = 'paid'`).run(id).changes === 1;
}

export function saveReportResult(id: string, report: Report) {
  getDb().prepare(`UPDATE reports SET status = 'done', report_json = ?, error = NULL WHERE id = ?`).run(JSON.stringify(report), id);
}

export function saveReportError(id: string, message: string) {
  getDb().prepare(`UPDATE reports SET status = 'error', error = ? WHERE id = ?`).run(message.slice(0, 2000), id);
}

/** Ponowienie po błędzie (np. przycisk „spróbuj ponownie”): error → paid. */
export function resetErrorToPaid(id: string): boolean {
  return getDb().prepare(`UPDATE reports SET status = 'paid' WHERE id = ? AND status = 'error'`).run(id).changes === 1;
}

export function addFeedback(reportId: string, helpful: boolean, comment: string | null) {
  getDb()
    .prepare(`INSERT INTO feedback (report_id, created_at, helpful, comment) VALUES (?, ?, ?, ?)`)
    .run(reportId, nowIso(), helpful ? 1 : 0, comment);
}

export function hasFeedback(reportId: string): boolean {
  return !!getDb().prepare(`SELECT 1 FROM feedback WHERE report_id = ? LIMIT 1`).get(reportId);
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
