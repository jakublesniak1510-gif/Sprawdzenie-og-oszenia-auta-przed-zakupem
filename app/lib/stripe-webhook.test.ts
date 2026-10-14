import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueued: string[] = [];
vi.mock("./queue", () => ({ enqueueGeneration: vi.fn(async (id: string) => void enqueued.push(id)) }));

import { getCouponBySession } from "./coupons";
import { createReport, getDb, getReport, setStripeSession, type StoredInput } from "./db";
import { processStripeEvent } from "./stripe-webhook";
import { useTempDb } from "./test-utils";

process.env.EMAIL_PROVIDER = "none";

const input = { tekst_ogloszenia: "x".repeat(120), cena_pln: null, przebieg_km: null, rocznik: null, historia_pojazdu: "", odczyty_reczne: [], podobne_oferty: [], model_id: null, silnik_kod: null, model_label: null, liczba_zdjec: 0 } as StoredInput;

function session(over: Partial<Stripe.Checkout.Session>): Stripe.Checkout.Session {
  return { id: "cs_test_a", object: "checkout.session", payment_status: "paid", status: "complete", currency: "pln", amount_total: 1900, metadata: {}, client_reference_id: null, customer_details: null, customer_email: null, ...over } as Stripe.Checkout.Session;
}
function event(id: string, type: string, obj: Stripe.Checkout.Session): Stripe.Event {
  return { id, type, data: { object: obj } } as unknown as Stripe.Event;
}

beforeEach(() => {
  useTempDb();
  enqueued.length = 0;
});

describe("webhook Stripe", () => {
  it("opłacona sesja → paid + generowanie; duplikat zdarzenia → bez działania", async () => {
    const r = createReport({ input, offer: "raport" });
    setStripeSession(r.id, "cs_test_a", 1900);
    const ev = event("evt_1", "checkout.session.completed", session({ metadata: { kind: "raport", report_id: r.id } }));
    expect(await processStripeEvent(ev)).toEqual({ received: true, result: "ok" });
    expect(getReport(r.id)!.status).toBe("paid");
    expect(enqueued).toEqual([r.id]);
    expect(await processStripeEvent(ev)).toEqual({ received: true, duplicate: true });
    expect(enqueued).toEqual([r.id]);
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM payments`).get()).toEqual({ n: 1 });
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE name = 'platnosc_oplacona'`).get()).toEqual({ n: 1 });
  });

  it("inna kwota lub waluta → raport NIE jest opłacony", async () => {
    const r = createReport({ input, offer: "raport_plus" });
    setStripeSession(r.id, "cs_test_a", 2900);
    const bad = await processStripeEvent(event("evt_2", "checkout.session.completed", session({ amount_total: 100, metadata: { report_id: r.id } })));
    expect(bad.result).toMatch(/kwota/);
    const eur = await processStripeEvent(event("evt_3", "checkout.session.completed", session({ amount_total: 2900, currency: "eur", metadata: { report_id: r.id } })));
    expect(eur.result).toMatch(/waluta/);
    expect(getReport(r.id)!.status).toBe("pending_payment");
    expect(enqueued).toEqual([]);
  });

  it("nieopłacona sesja (async P24 w toku) → bez zmian", async () => {
    const r = createReport({ input, offer: "raport" });
    setStripeSession(r.id, "cs_test_a", 1900);
    await processStripeEvent(event("evt_4", "checkout.session.completed", session({ payment_status: "unpaid", metadata: { report_id: r.id } })));
    expect(getReport(r.id)!.status).toBe("pending_payment");
  });

  it("checkout.session.expired → status expired (tylko dla bieżącej sesji raportu)", async () => {
    const r = createReport({ input, offer: "raport" });
    setStripeSession(r.id, "cs_test_new", 1900);
    await processStripeEvent(event("evt_5", "checkout.session.expired", session({ id: "cs_test_old", payment_status: "unpaid", metadata: { report_id: r.id } })));
    expect(getReport(r.id)!.status).toBe("pending_payment");
    await processStripeEvent(event("evt_6", "checkout.session.expired", session({ id: "cs_test_new", payment_status: "unpaid", metadata: { report_id: r.id } })));
    expect(getReport(r.id)!.status).toBe("expired");
    // spóźniona płatność wygasłego zamówienia (np. nowa sesja z linku w e-mailu) nadal działa
    setStripeSession(r.id, "cs_test_new2", 1900);
    await processStripeEvent(event("evt_7", "checkout.session.completed", session({ id: "cs_test_new2", metadata: { report_id: r.id } })));
    expect(getReport(r.id)!.status).toBe("paid");
  });

  it("pakiet 5 raportów → jeden kupon na sesję, także przy ponownym zdarzeniu", async () => {
    const s = session({ id: "cs_test_pak", amount_total: 4900, metadata: { kind: "pakiet5", amount_gr: "4900" }, customer_details: { email: "kupujacy@example.com" } as Stripe.Checkout.Session.CustomerDetails });
    await processStripeEvent(event("evt_8", "checkout.session.completed", s));
    await processStripeEvent(event("evt_9", "checkout.session.async_payment_succeeded", s));
    const c = getCouponBySession("cs_test_pak")!;
    expect(c).toMatchObject({ uses_left: 5, offer: "raport", source: "pakiet5", email: "kupujacy@example.com" });
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM coupons`).get()).toEqual({ n: 1 });
    expect(getDb().prepare(`SELECT COUNT(*) AS n FROM events WHERE name = 'pakiet_kupiony'`).get()).toEqual({ n: 1 });
  });

  it("pakiet ze złą kwotą → brak kuponu", async () => {
    await processStripeEvent(event("evt_10", "checkout.session.completed", session({ id: "cs_test_pak2", amount_total: 100, metadata: { kind: "pakiet5", amount_gr: "4900" } })));
    expect(getCouponBySession("cs_test_pak2")).toBeNull();
  });
});
