import { afterEach, describe, expect, it } from "vitest";
import { LIMITS, TokenBucketLimiter, clientIp, limiter, rateLimit } from "./rate-limit";

const req = (ip?: string) => new Request("http://localhost/api/reports", { method: "POST", headers: ip ? { "x-forwarded-for": ip } : {} });

afterEach(() => {
  delete process.env.TRUST_PROXY;
  limiter().reset();
});

describe("TokenBucketLimiter", () => {
  it("przepuszcza `limit` żądań, potem każe czekać, a z czasem się napełnia", () => {
    const l = new TokenBucketLimiter();
    const rule = { limit: 5, windowMs: 10 * 60_000 };
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(l.take("ip", rule, t0)).toBe(0);
    const wait = l.take("ip", rule, t0);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(120); // 1 token co 2 min
    expect(l.take("ip", rule, t0 + 2 * 60_000 + 10)).toBe(0);
    expect(l.take("ip", rule, t0 + 2 * 60_000 + 20)).toBeGreaterThan(0);
  });

  it("kubełki są niezależne per klucz", () => {
    const l = new TokenBucketLimiter();
    const rule = { limit: 1, windowMs: 60_000 };
    expect(l.take("a", rule, 0)).toBe(0);
    expect(l.take("b", rule, 0)).toBe(0);
    expect(l.take("a", rule, 0)).toBeGreaterThan(0);
  });
});

describe("clientIp", () => {
  it("ignoruje x-forwarded-for bez TRUST_PROXY", () => {
    expect(clientIp(req("1.2.3.4"))).toBe("local");
  });
  it("bierze pierwszy element x-forwarded-for przy TRUST_PROXY=1", () => {
    process.env.TRUST_PROXY = "1";
    expect(clientIp(req("1.2.3.4, 10.0.0.1"))).toBe("1.2.3.4");
  });
});

describe("rateLimit (odpowiedź 429)", () => {
  it("po przekroczeniu limitu /api/reports zwraca 429 po polsku z Retry-After", async () => {
    process.env.TRUST_PROXY = "1";
    for (let i = 0; i < LIMITS.reports.limit; i++) expect(rateLimit(req("9.9.9.9"), "reports")).toBeNull();
    const r = rateLimit(req("9.9.9.9"), "reports")!;
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await r.json()).error).toMatch(/Zbyt wiele zapytań/);
    expect(rateLimit(req("8.8.8.8"), "reports")).toBeNull(); // inne IP
  });

  it("limity zgodne z założeniami", () => {
    expect(LIMITS.reports).toEqual({ limit: 5, windowMs: 600_000 });
    expect(LIMITS.modelsDetect).toEqual({ limit: 30, windowMs: 60_000 });
    expect(LIMITS.szybkiTest).toEqual({ limit: 20, windowMs: 600_000 });
  });
});
