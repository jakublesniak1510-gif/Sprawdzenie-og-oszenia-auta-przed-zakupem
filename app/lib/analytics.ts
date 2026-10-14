import { createHash, randomBytes } from "node:crypto";
import { getDb, nowIso } from "./db";
import { clientIp } from "./client-ip";

/**
 * Analityka bez cookies. Zapisujemy nazwę zdarzenia, kilka prostych właściwości i skrót IP
 * (SHA-256 z dziennym, losowym saltem trzymanym w bazie tylko na dziś – po północy stary salt jest kasowany,
 * więc skrótów nie da się już powiązać z adresem IP ani między dniami).
 */

export type EventName =
  | "szybki_test"
  | "raport_utworzony"
  | "platnosc_rozpoczeta"
  | "platnosc_oplacona"
  | "raport_wygenerowany"
  | "raport_blad"
  | "feedback"
  | "pakiet_kupiony"
  | "kupon_uzyty";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

const today = () => new Date().toISOString().slice(0, 10);

function dailySalt(): string {
  const db = getDb();
  const day = today();
  const row = db.prepare(`SELECT salt FROM analytics_salts WHERE day = ?`).get(day) as { salt: string } | undefined;
  if (row) return row.salt;
  const salt = randomBytes(32).toString("hex");
  db.prepare(`INSERT OR IGNORE INTO analytics_salts (day, salt) VALUES (?, ?)`).run(day, salt);
  db.prepare(`DELETE FROM analytics_salts WHERE day <> ?`).run(day);
  return (db.prepare(`SELECT salt FROM analytics_salts WHERE day = ?`).get(day) as { salt: string }).salt;
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${dailySalt()}|${ip}`).digest("hex").slice(0, 32);
}

/** Zapisuje zdarzenie. Nigdy nie rzuca wyjątku (analityka nie może zepsuć zakupu). */
export function track(name: EventName, props: EventProps = {}, req?: Request): void {
  try {
    const ip = req ? clientIp(req) : null;
    const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
    getDb()
      .prepare(`INSERT INTO events (name, props_json, created_at, ip_hash) VALUES (?, ?, ?, ?)`)
      .run(name, Object.keys(clean).length ? JSON.stringify(clean) : null, nowIso(), ip ? hashIp(ip) : null);
  } catch (e) {
    console.warn(`[analytics] Nie zapisano zdarzenia ${name}: ${(e as Error).message}`);
  }
}

/** Kasuje zdarzenia starsze niż `days` dni (scripts/cleanup.ts). */
export function deleteOldEvents(days = 400): number {
  const cutoff = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  return getDb().prepare(`DELETE FROM events WHERE created_at < ?`).run(cutoff).changes;
}
