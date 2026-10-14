import { listCoupons, type CouponRow } from "./coupons";
import { getDb } from "./db";
import { queueStats } from "./queue";

/** Zestawienia do panelu admina (tylko odczyt). */

export interface Funnel {
  dni: number;
  szybkie_testy: number;
  raporty_utworzone: number;
  platnosci_rozpoczete: number;
  oplacone: number;
  wygenerowane: number;
  bledy: number;
  pakiety: number;
  przychod_gr: number;
  przychod_raporty_gr: number;
  przychod_pakiety_gr: number;
  koszt_ai_usd: number;
  tokeny_wejscie: number;
  tokeny_cache: number;
  tokeny_wyjscie: number;
  sredni_czas_s: number | null;
  feedback_tak: number;
  feedback_nie: number;
  kupil_tak: number;
  kupil_nie: number;
}

const since = (days: number) => new Date(Date.now() - days * 24 * 3600_000).toISOString();

function countEvent(name: string, from: string, extra = ""): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE name = ? AND created_at >= ? ${extra}`).get(name, from) as { n: number }).n;
}

export function funnel(dni: number): Funnel {
  const db = getDb();
  const from = since(dni);
  const pay = db
    .prepare(
      `SELECT COALESCE(SUM(amount_gr),0) AS total,
              COALESCE(SUM(CASE WHEN kind = 'pakiet5' THEN amount_gr ELSE 0 END),0) AS pakiety
       FROM payments WHERE created_at >= ?`,
    )
    .get(from) as { total: number; pakiety: number };
  const ai = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd_est),0) AS cost, COALESCE(SUM(input_tokens),0) AS inp, COALESCE(SUM(cached_tokens),0) AS cached,
              COALESCE(SUM(output_tokens),0) AS outp FROM ai_usage WHERE created_at >= ?`,
    )
    .get(from) as { cost: number; inp: number; cached: number; outp: number };
  const avg = db
    .prepare(`SELECT AVG(CAST(json_extract(props_json, '$.czas_s') AS REAL)) AS a FROM events WHERE name = 'raport_wygenerowany' AND created_at >= ?`)
    .get(from) as { a: number | null };
  const fb = db
    .prepare(`SELECT COALESCE(SUM(helpful),0) AS tak, COALESCE(SUM(1 - helpful),0) AS nie FROM feedback WHERE created_at >= ?`)
    .get(from) as { tak: number; nie: number };
  const kupil = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN json_extract(props_json, '$.kupil') = 1 THEN 1 ELSE 0 END),0) AS tak,
              COALESCE(SUM(CASE WHEN json_extract(props_json, '$.kupil') = 0 THEN 1 ELSE 0 END),0) AS nie
       FROM events WHERE name = 'feedback' AND created_at >= ?`,
    )
    .get(from) as { tak: number; nie: number };
  return {
    dni,
    szybkie_testy: countEvent("szybki_test", from),
    raporty_utworzone: countEvent("raport_utworzony", from),
    platnosci_rozpoczete: countEvent("platnosc_rozpoczeta", from, `AND json_extract(props_json, '$.rodzaj') <> 'pakiet5'`),
    oplacone: countEvent("platnosc_oplacona", from, `AND json_extract(props_json, '$.rodzaj') <> 'pakiet5'`),
    wygenerowane: countEvent("raport_wygenerowany", from),
    bledy: countEvent("raport_blad", from),
    pakiety: countEvent("pakiet_kupiony", from),
    przychod_gr: pay.total,
    przychod_raporty_gr: pay.total - pay.pakiety,
    przychod_pakiety_gr: pay.pakiety,
    koszt_ai_usd: ai.cost,
    tokeny_wejscie: ai.inp,
    tokeny_cache: ai.cached,
    tokeny_wyjscie: ai.outp,
    sredni_czas_s: avg.a === null ? null : Math.round(avg.a),
    feedback_tak: fb.tak,
    feedback_nie: fb.nie,
    kupil_tak: kupil.tak,
    kupil_nie: kupil.nie,
  };
}

export interface FeedbackItem {
  created_at: string;
  report_id: string;
  helpful: number;
  comment: string | null;
  offer: string | null;
  model_label: string | null;
}

export function recentFeedback(limit = 20): FeedbackItem[] {
  return getDb()
    .prepare(
      `SELECT f.created_at, f.report_id, f.helpful, f.comment, r.offer, json_extract(r.input_json, '$.model_label') AS model_label
       FROM feedback f LEFT JOIN reports r ON r.id = f.report_id ORDER BY f.created_at DESC LIMIT ?`,
    )
    .all(limit) as FeedbackItem[];
}

export interface ErrorItem {
  created_at: string;
  report_id: string | null;
  powod: string | null;
  proba: number | null;
}

export function recentErrors(limit = 20): ErrorItem[] {
  return getDb()
    .prepare(
      `SELECT created_at, json_extract(props_json, '$.report_id') AS report_id, json_extract(props_json, '$.powod') AS powod,
              json_extract(props_json, '$.proba') AS proba
       FROM events WHERE name = 'raport_blad' ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as ErrorItem[];
}

export function statusCounts(): Record<string, number> {
  const rows = getDb().prepare(`SELECT status, COUNT(*) AS n FROM reports GROUP BY status`).all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export interface AdminDashboard {
  okresy: Funnel[];
  statusy: Record<string, number>;
  kolejka: ReturnType<typeof queueStats>;
  feedback: FeedbackItem[];
  bledy: ErrorItem[];
  kupony: CouponRow[];
}

export function adminDashboard(): AdminDashboard {
  return {
    okresy: [funnel(7), funnel(30)],
    statusy: statusCounts(),
    kolejka: queueStats(),
    feedback: recentFeedback(20),
    bledy: recentErrors(20),
    kupony: listCoupons(50),
  };
}
