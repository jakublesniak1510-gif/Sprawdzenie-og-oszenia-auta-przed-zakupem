import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const created: string[] = [];
const retrieved: Record<string, unknown> = {};
vi.mock("./payments", async (orig) => ({
  ...(await orig<typeof import("./payments")>()),
  retrieveCheckoutSession: vi.fn(async (id: string) => retrieved[id] ?? null),
  createCheckoutSession: vi.fn(async (a: { reportId: string }) => {
    created.push(a.reportId);
    return { id: "cs_test_new", url: "https://checkout.stripe.com/c/new", amountGr: 1900 };
  }),
}));

import { GET as zaplac } from "../app/api/reports/[id]/zaplac/route";
import { GET as kupilGet, POST as kupilPost } from "../app/api/reports/[id]/kupil/route";
import { createReport, getDb, getReport, markPaymentPending, setStripeSession, type StoredInput } from "./db";
import { readJsonLimited } from "./http";
import { limiter } from "./rate-limit";
import { proxy } from "../proxy";
import { checkBasicAuth } from "./admin-auth";
import { useTempDb } from "./test-utils";

process.env.APP_URL = "https://sprawdz.example.pl";
const input = { tekst_ogloszenia: "x".repeat(120) } as unknown as StoredInput;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  useTempDb();
  created.length = 0;
  for (const k of Object.keys(retrieved)) delete retrieved[k];
  limiter().reset();
});

describe("GET /api/reports/[id]/zaplac", () => {
  function pending() {
    const r = createReport({ input, offer: "raport" });
    setStripeSession(r.id, "cs_test_old", 1900);
    return r.id;
  }

  it("sesja complete + unpaid (P24 w toku) → strona raportu „płatność w toku”, BEZ nowej sesji", async () => {
    const id = pending();
    retrieved.cs_test_old = { id: "cs_test_old", status: "complete", payment_status: "unpaid" };
    const res = await zaplac(new Request(`https://x/api/reports/${id}/zaplac`), ctx(id));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`https://sprawdz.example.pl/raport/${id}?platnosc=w_toku`);
    expect(created).toEqual([]);
    expect(getReport(id)!.payment_pending_at).toBeTruthy();
  });

  it("płatność w toku zapisana w bazie → bez pytania Stripe i bez nowej sesji", async () => {
    const id = pending();
    markPaymentPending(id);
    const res = await zaplac(new Request("https://x/"), ctx(id));
    expect(res.headers.get("location")).toContain("platnosc=w_toku");
    expect(created).toEqual([]);
  });

  it("otwarta sesja → przekierowanie do niej; wygasła → nowa sesja", async () => {
    const id = pending();
    retrieved.cs_test_old = { id: "cs_test_old", status: "open", payment_status: "unpaid", url: "https://checkout.stripe.com/c/old" };
    expect((await zaplac(new Request("https://x/"), ctx(id))).headers.get("location")).toBe("https://checkout.stripe.com/c/old");
    retrieved.cs_test_old = { id: "cs_test_old", status: "expired", payment_status: "unpaid" };
    expect((await zaplac(new Request("https://x/"), ctx(id))).headers.get("location")).toBe("https://checkout.stripe.com/c/new");
    expect(created).toEqual([id]);
  });

  it("raport opłacony lub nieistniejący → bez płatności", async () => {
    const id = pending();
    getDb().prepare(`UPDATE reports SET status = 'done' WHERE id = ?`).run(id);
    expect((await zaplac(new Request("https://x/"), ctx(id))).headers.get("location")).toBe(`https://sprawdz.example.pl/raport/${id}`);
    expect((await zaplac(new Request("https://x/"), ctx("nie-uuid"))).headers.get("location")).toContain("/sprawdz");
    expect(created).toEqual([]);
  });
});

describe("/api/reports/[id]/kupil – GET bez skutków, zapis tylko POST", () => {
  it("GET pokazuje formularz i nic nie zapisuje; POST zapisuje i przekierowuje do opinii", async () => {
    const r = createReport({ input, offer: "raport" });
    const g = await kupilGet(new Request(`https://x/api/reports/${r.id}/kupil?odp=tak`), ctx(r.id));
    expect(g.status).toBe(200);
    expect(await g.text()).toContain('method="post"');
    expect(getReport(r.id)!.kupil).toBeNull();
    const form = new FormData();
    form.set("odp", "nie");
    const p = await kupilPost(new Request(`https://x/api/reports/${r.id}/kupil`, { method: "POST", body: form }), ctx(r.id));
    expect(p.status).toBe(303);
    expect(p.headers.get("location")).toBe(`https://sprawdz.example.pl/raport/${r.id}?kupil=nie#opinia`);
    expect(getReport(r.id)!.kupil).toBe(0);
  });
});

describe("readJsonLimited", () => {
  it("413 przy Content-Length ponad limit", async () => {
    const r = await readJsonLimited(new Request("https://x/", { method: "POST", body: "{}", headers: { "content-length": "999999" } }), 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });
  it("413 przy strumieniu bez Content-Length ponad limit", async () => {
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode("x".repeat(50)));
        c.close();
      },
    });
    const r = await readJsonLimited(new Request("https://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit), 100);
    expect(r.ok).toBe(false);
  });
  it("poprawny JSON i błędny JSON (→ null)", async () => {
    const ok = await readJsonLimited(new Request("https://x/", { method: "POST", body: '{"a":"ż"}' }), 100);
    expect(ok).toEqual({ ok: true, data: { a: "ż" } });
    const bad = await readJsonLimited(new Request("https://x/", { method: "POST", body: "{nie json" }), 100);
    expect(bad).toEqual({ ok: true, data: null });
  });
});

describe("panel admina – Basic Auth", () => {
  const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`, "utf8").toString("base64")}`;
  const env = { ADMIN_USER: "admin", ADMIN_PASSWORD: "zażółć-gęślą" } as unknown as NodeJS.ProcessEnv;
  const call = (auth?: string) => proxy(new NextRequest("https://x/admin", { headers: auth ? { authorization: auth } : {} }));

  it("checkBasicAuth: hasło w UTF-8, złe hasło, śmieci", () => {
    expect(checkBasicAuth(basic("admin", "zażółć-gęślą"), env)).toBe(true);
    expect(checkBasicAuth(basic("admin", "zle"), env)).toBe(false);
    expect(checkBasicAuth("Basic !!!", env)).toBe(false);
    expect(checkBasicAuth(null, env)).toBe(false);
    expect(checkBasicAuth(basic("admin", "x"), {} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("proxy: 404 bez konfiguracji, 401 bez/ze złym hasłem, 200 z dobrym, 429 po 10 błędnych (także dla dobrego)", () => {
    delete process.env.ADMIN_USER;
    delete process.env.ADMIN_PASSWORD;
    expect(call().status).toBe(404);
    Object.assign(process.env, env);
    try {
      expect(call().status).toBe(401);
      expect(call().headers.get("www-authenticate")).toMatch(/Basic/);
      expect(call(basic("admin", "zażółć-gęślą")).status).toBe(200);
      for (let i = 0; i < 10; i++) expect(call(basic("admin", `zle${i}`)).status).toBe(401);
      expect(call(basic("admin", "zle")).status).toBe(429);
      expect(call(basic("admin", "zażółć-gęślą")).status).toBe(429);
    } finally {
      delete process.env.ADMIN_USER;
      delete process.env.ADMIN_PASSWORD;
    }
  });
});
