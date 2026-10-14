import { afterEach, describe, expect, it } from "vitest";
import { LIMITS, TokenBucketLimiter, clientIp, ipKey, limiter, peekToken, rateLimit, takeToken } from "./rate-limit";

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
  it("przy TRUST_PROXY=1 bierze OSTATNI element x-forwarded-for (dopisany przez nasze proxy)", () => {
    process.env.TRUST_PROXY = "1";
    expect(clientIp(req("6.6.6.6, 1.2.3.4"))).toBe("1.2.3.4"); // pierwszy element mógł podać klient
    expect(clientIp(req("1.2.3.4"))).toBe("1.2.3.4");
  });
  it("X-Real-IP (ustawiany przez Caddy) ma pierwszeństwo", () => {
    process.env.TRUST_PROXY = "1";
    const r = new Request("http://localhost/", { headers: { "x-forwarded-for": "6.6.6.6, 7.7.7.7", "x-real-ip": "5.5.5.5" } });
    expect(clientIp(r)).toBe("5.5.5.5");
  });
});

describe("ipKey – IPv6 per /64", () => {
  it("adresy z jednej podsieci /64 mają wspólny klucz", () => {
    expect(ipKey("2001:db8:1:2:aaaa::1")).toBe(ipKey("2001:db8:1:2:bbbb:cccc:dddd:eeee"));
    expect(ipKey("2001:db8:1:2::1")).toBe("2001:0db8:0001:0002::/64");
    expect(ipKey("2001:db8:1:3::1")).not.toBe(ipKey("2001:db8:1:2::1"));
    expect(ipKey("1.2.3.4")).toBe("1.2.3.4");
    expect(ipKey("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
  it("limit liczony wspólnie dla całego /64", () => {
    for (let i = 0; i < LIMITS.reports.limit; i++) expect(takeToken("reports", `2001:db8:9:9::${i + 1}`)).toBe(0);
    expect(takeToken("reports", "2001:db8:9:9::ffff")).toBeGreaterThan(0);
  });
  it("peekToken nie zużywa tokenu", () => {
    expect(peekToken("adminAuthFail", "9.9.9.1")).toBe(0);
    for (let i = 0; i < LIMITS.adminAuthFail.limit; i++) takeToken("adminAuthFail", "9.9.9.1");
    expect(peekToken("adminAuthFail", "9.9.9.1")).toBeGreaterThan(0);
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
