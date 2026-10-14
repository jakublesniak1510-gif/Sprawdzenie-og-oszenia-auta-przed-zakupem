import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("./email", async (orig) => ({
  ...(await orig<typeof import("./email")>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return { ok: true, provider: "test" };
  }),
}));

import { createReport, getDb, getReport, markPaymentPending, setStripeSession, type StoredInput } from "./db";
import { runFollowups, type FollowupDeps } from "./notifications";
import { useTempDb } from "./test-utils";

const input = { tekst_ogloszenia: "x".repeat(120), model_label: null } as unknown as StoredInput;

function order(email: string, hoursAgo: number, session = "cs_test_1") {
  const r = createReport({ input, offer: "raport", email });
  setStripeSession(r.id, session, 1900);
  getDb().prepare(`UPDATE reports SET created_at = ? WHERE id = ?`).run(new Date(Date.now() - hoursAgo * 3600_000).toISOString(), r.id);
  return r.id;
}

const sessions: Record<string, Awaited<ReturnType<FollowupDeps["retrieveSession"]>>> = {};
const deps: FollowupDeps = { retrieveSession: async (id) => sessions[id] ?? null };

beforeEach(() => {
  useTempDb();
  sent.length = 0;
  for (const k of Object.keys(sessions)) delete sessions[k];
});

describe("przypomnienie o płatności", () => {
  it("wysyła dla otwartej sesji z tym samym e-mailem; w treści info o 48 h na zdjęcia", async () => {
    sessions.cs_test_1 = { status: "open", payment_status: "unpaid", customer_details: null };
    const id = order("klient@example.com", 3);
    expect((await runFollowups(Date.now(), deps)).payment).toBe(1);
    expect(sent[0].to).toBe("klient@example.com");
    expect(sent[0].text).toMatch(/48 godzin/);
    expect(getReport(id)!.payment_followup_sent_at).toBeTruthy();
    expect((await runFollowups(Date.now(), deps)).payment).toBe(0); // najwyżej raz
  });

  it("nie wysyła: płatność w toku (sesja complete lub payment_pending_at), inny e-mail w Stripe, brak sesji", async () => {
    sessions.cs_a = { status: "complete", payment_status: "unpaid", customer_details: null };
    sessions.cs_b = { status: "open", payment_status: "unpaid", customer_details: { email: "ktos.inny@example.com" } as never };
    order("a@example.com", 3, "cs_a");
    order("b@example.com", 3, "cs_b");
    order("c@example.com", 3, "cs_brak");
    const pending = order("d@example.com", 3, "cs_d");
    sessions.cs_d = { status: "open", payment_status: "unpaid", customer_details: null };
    markPaymentPending(pending);
    const r = await runFollowups(Date.now(), deps);
    expect(r.payment).toBe(0);
    expect(sent).toEqual([]);
  });

  it("limit: ten sam adres najwyżej 1 przypomnienie na 24 h (ochrona przed spamem na cudzy adres)", async () => {
    sessions.cs_test_1 = { status: "open", payment_status: "unpaid", customer_details: null };
    order("ofiara@example.com", 3);
    order("ofiara@example.com", 4);
    order("OFIARA@example.com", 5);
    expect((await runFollowups(Date.now(), deps)).payment).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("okno 2–40 h (zdjęcia kasowane po 48 h)", async () => {
    sessions.cs_test_1 = { status: "open", payment_status: "unpaid", customer_details: null };
    order("x@example.com", 1);
    order("y@example.com", 41);
    expect((await runFollowups(Date.now(), deps)).payment).toBe(0);
  });
});
