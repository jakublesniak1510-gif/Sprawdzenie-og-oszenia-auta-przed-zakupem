import { NextResponse } from "next/server";
import { clientIp, clientIpFromHeaders, ipKey } from "./client-ip";

export { clientIp, clientIpFromHeaders, ipKey };

/**
 * Prosty rate limit w pamięci procesu: token bucket per (nazwa limitu, IP).
 * Wystarcza przy jednym procesie Node (Docker na VPS). Przy kilku instancjach – przenieść do Redis.
 *
 * IP klienta: lib/client-ip.ts (X-Real-IP / ostatni element X-Forwarded-For, tylko przy TRUST_PROXY=1);
 * IPv6 liczone per prefiks /64. Bez TRUST_PROXY wszyscy dzielą jeden kubełek „local”.
 */

export interface LimitRule {
  /** Pojemność kubełka = liczba żądań w oknie. */
  limit: number;
  /** Okno w ms – w tym czasie kubełek napełnia się od zera do pełna. */
  windowMs: number;
}

export const LIMITS = {
  reports: { limit: 5, windowMs: 10 * 60_000 },
  modelsDetect: { limit: 30, windowMs: 60_000 },
  szybkiTest: { limit: 20, windowMs: 10 * 60_000 },
  couponCheck: { limit: 20, windowMs: 10 * 60_000 },
  couponBuy: { limit: 10, windowMs: 10 * 60_000 },
  couponSession: { limit: 10, windowMs: 10 * 60_000 },
  retryGeneration: { limit: 3, windowMs: 10 * 60_000 },
  adminAuthFail: { limit: 10, windowMs: 10 * 60_000 },
  boughtAnswer: { limit: 20, windowMs: 10 * 60_000 },
} satisfies Record<string, LimitRule>;

interface Bucket {
  tokens: number;
  updated: number;
  windowMs: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  /** Zwraca 0, gdy żądanie przepuszczone, albo liczbę sekund do odczekania. */
  take(key: string, rule: LimitRule, now = Date.now()): number {
    this.sweep(now);
    const rate = rule.limit / rule.windowMs; // tokeny na ms
    const b = this.buckets.get(key) ?? { tokens: rule.limit, updated: now, windowMs: rule.windowMs };
    b.tokens = Math.min(rule.limit, b.tokens + (now - b.updated) * rate);
    b.updated = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      this.buckets.set(key, b);
      return 0;
    }
    this.buckets.set(key, b);
    return Math.max(1, Math.ceil((1 - b.tokens) / rate / 1000));
  }

  /** Jak `take`, ale bez zużycia tokenu: 0 = jest token, inaczej sekundy do odczekania. */
  peek(key: string, rule: LimitRule, now = Date.now()): number {
    const b = this.buckets.get(key);
    if (!b) return 0;
    const rate = rule.limit / rule.windowMs;
    const tokens = Math.min(rule.limit, b.tokens + (now - b.updated) * rate);
    return tokens >= 1 ? 0 : Math.max(1, Math.ceil((1 - tokens) / rate / 1000));
  }

  /** Usuwa kubełki, które i tak byłyby już pełne (ochrona pamięci). */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, b] of this.buckets) if (now - b.updated > b.windowMs) this.buckets.delete(k);
  }

  reset() {
    this.buckets.clear();
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __sprawdzLimiter: TokenBucketLimiter | undefined;
}

export const limiter = (): TokenBucketLimiter => (globalThis.__sprawdzLimiter ??= new TokenBucketLimiter());

function minutesPl(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.ceil(sec / 60);
  return `${m} min`;
}

/** Pobiera token dla limitu i IP (IPv6 liczone per /64). 0 = przepuść, inaczej sekundy do odczekania. */
export function takeToken(name: keyof typeof LIMITS, ip: string): number {
  if (process.env.RATE_LIMIT_DISABLED === "1") return 0;
  return limiter().take(`${name}|${ipKey(ip)}`, LIMITS[name]);
}

/** Sprawdza limit bez zużycia tokenu. */
export function peekToken(name: keyof typeof LIMITS, ip: string): number {
  if (process.env.RATE_LIMIT_DISABLED === "1") return 0;
  return limiter().peek(`${name}|${ipKey(ip)}`, LIMITS[name]);
}

export function tooManyRequests(wait: number): NextResponse {
  return NextResponse.json(
    { error: `Zbyt wiele zapytań. Spróbuj ponownie za ${minutesPl(wait)}.` },
    { status: 429, headers: { "Retry-After": String(wait) } },
  );
}

/**
 * Sprawdza limit. Zwraca `null` (przepuść) albo gotową odpowiedź 429 po polsku z nagłówkiem Retry-After.
 * Użycie: `const limited = rateLimit(req, "reports"); if (limited) return limited;`
 */
export function rateLimit(req: Request, name: keyof typeof LIMITS): NextResponse | null {
  const wait = takeToken(name, clientIp(req));
  return wait === 0 ? null : tooManyRequests(wait);
}
