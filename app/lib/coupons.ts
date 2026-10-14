import { randomInt } from "node:crypto";
import { getDb, nowIso } from "./db";
import type { OfferId } from "./report-schema";

/**
 * Kupony: pakiet 5 raportów (kupowany przez Stripe) i kody ręczne (np. dla influencerów – scripts/coupon.ts).
 * Kod: 8 znaków z alfabetu bez mylących znaków (bez 0/O, 1/I/L). Wielkość liter i myślniki/spacje nie mają znaczenia.
 * Wykorzystanie zmniejsza `uses_left` jednym atomowym UPDATE … WHERE uses_left > 0 (bezpieczne przy równoległych żądaniach).
 */

export const COUPON_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const COUPON_LENGTH = 8;

export type CouponOffer = OfferId | "any";

export interface CouponRow {
  code: string;
  uses_left: number;
  offer: CouponOffer;
  expires_at: string;
  created_at: string;
  source: string;
  uses_total: number;
  email: string | null;
  stripe_session_id: string | null;
}

export function generateCouponCode(): string {
  let s = "";
  for (let i = 0; i < COUPON_LENGTH; i++) s += COUPON_ALPHABET[randomInt(COUPON_ALPHABET.length)];
  return s;
}

/** „abcd-efgh ” → „ABCDEFGH”. Zwraca null, gdy kod nie może być prawidłowy. */
export function normalizeCouponCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.toUpperCase().replace(/[\s-]/g, "");
  if (c.length !== COUPON_LENGTH) return null;
  for (const ch of c) if (!COUPON_ALPHABET.includes(ch)) return null;
  return c;
}

/** Ładny zapis do wyświetlenia: ABCD-EFGH. */
export function formatCouponCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function createCoupon(args: {
  uses: number;
  days: number;
  offer?: CouponOffer;
  source?: string;
  email?: string | null;
  stripeSessionId?: string | null;
}): CouponRow {
  if (!Number.isInteger(args.uses) || args.uses < 1) throw new Error("Liczba użyć musi być dodatnią liczbą całkowitą.");
  if (!(args.days > 0)) throw new Error("Liczba dni musi być dodatnia.");
  const db = getDb();
  const created = new Date();
  const expires = new Date(created.getTime() + args.days * 24 * 3600_000);
  for (let i = 0; i < 10; i++) {
    const code = generateCouponCode();
    const res = db
      .prepare(
        `INSERT OR IGNORE INTO coupons (code, uses_left, offer, expires_at, created_at, source, email, stripe_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(code, args.uses, args.offer ?? "raport", expires.toISOString(), created.toISOString(), args.source ?? "manual", args.email ?? null, args.stripeSessionId ?? null);
    if (res.changes === 1) return getCoupon(code)!;
    // Kolizja: albo kod (losujemy ponownie), albo sesja Stripe ma już kupon (zwracamy istniejący).
    if (args.stripeSessionId) {
      const existing = getCouponBySession(args.stripeSessionId);
      if (existing) return existing;
    }
  }
  throw new Error("Nie udało się wygenerować unikalnego kodu kuponu.");
}

export function getCoupon(code: string): CouponRow | null {
  return (getDb().prepare(`SELECT * FROM coupons WHERE code = ?`).get(code) as CouponRow | undefined) ?? null;
}

export function getCouponBySession(sessionId: string): CouponRow | null {
  return (getDb().prepare(`SELECT * FROM coupons WHERE stripe_session_id = ?`).get(sessionId) as CouponRow | undefined) ?? null;
}

export type CouponCheck = { ok: true; code: string; offer: CouponOffer } | { ok: false; message: string };

function offerMatches(couponOffer: CouponOffer, offer: OfferId | null | undefined): boolean {
  return couponOffer === "any" || !offer || couponOffer === offer;
}

const OFFER_NAME: Record<CouponOffer, string> = { raport: "Raport", raport_plus: "Raport+", any: "dowolny raport" };

/** Walidacja bez zużycia (formularz). Celowo nie ujawnia liczby pozostałych użyć. */
export function checkCoupon(raw: string | null | undefined, offer?: OfferId | null): CouponCheck {
  const code = normalizeCouponCode(raw);
  const invalid: CouponCheck = { ok: false, message: "Nieprawidłowy lub wykorzystany kod." };
  if (!code) return invalid;
  const c = getCoupon(code);
  if (!c || c.uses_left < 1) return invalid;
  if (c.expires_at <= nowIso()) return { ok: false, message: "Ten kod wygasł." };
  if (!offerMatches(c.offer, offer)) return { ok: false, message: `Ten kod obejmuje pakiet: ${OFFER_NAME[c.offer]}.` };
  return { ok: true, code, offer: c.offer };
}

/** SQL jednego atomowego wykorzystania kuponu (eksportowany do testu współbieżności). */
export const REDEEM_SQL = `UPDATE coupons SET uses_left = uses_left - 1, uses_total = uses_total + 1
  WHERE code = ? AND uses_left > 0 AND expires_at > ? AND (offer = 'any' OR offer = ?)`;

/** Zużywa jedno użycie. true = sukces. Bezpieczne przy równoległych wywołaniach (także z wielu procesów). */
export function redeemCoupon(code: string, offer: OfferId): boolean {
  return getDb().prepare(REDEEM_SQL).run(code, nowIso(), offer).changes === 1;
}

/** Zwraca użycie (np. gdy po zużyciu kuponu nie udało się utworzyć raportu). */
export function refundCoupon(code: string) {
  getDb().prepare(`UPDATE coupons SET uses_left = uses_left + 1, uses_total = MAX(uses_total - 1, 0) WHERE code = ?`).run(code);
}

export function listCoupons(limit = 50): CouponRow[] {
  return getDb().prepare(`SELECT * FROM coupons ORDER BY created_at DESC LIMIT ?`).all(limit) as CouponRow[];
}
