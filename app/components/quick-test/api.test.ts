import { describe, expect, it, vi } from "vitest";
import { QuickTestError, normalizeQuickTest, runQuickTest, shareText, toPricePosition } from "./api";

/** Odpowiedź w formacie A1 (lib/quick-test.ts → QuickTestResult). */
const apiResponse = {
  rozpoznany: { model_id: "vw-golf-7", nazwa: "Volkswagen Golf VII (2012–2020)", silnik: "1.6 TDI 90–115 KM (EA288, m.in. CLHA/CXXB)", lata: [2012, 2020] },
  flagi: [
    { id: "brak-vin", kategoria: "dokumenty", waga: "srednia", opis: "W ogłoszeniu nie ma numeru VIN.", pytanie: "Czy może Pan/Pani podać VIN?" },
    { id: "auto-od-niemca", kategoria: "handlarz", waga: "niska", opis: "Informacje o poprzednim właścicielu za granicą.", pytanie: null },
  ],
  usterki_top3: [
    { tytul: "Skrzynia DSG DQ200", objawy: "Szarpanie", waga: "wysoka", koszt_pln: [3000, 9000], jak_sprawdzic: "Jazda w korku", przebieg_km: null },
    { tytul: "Zawór EGR", objawy: "Kontrolka", waga: "srednia", koszt_pln: [800, 3500], jak_sprawdzic: "Diagnostyka", przebieg_km: "100–220 tys. km" },
  ],
  cena: { pozycja: "ponizej", komentarz: "Cena 30 000 zł jest niższa od typowych 35 000–45 000 zł.", widelki_pln: [35000, 45000] },
  brak_vin: true,
  nastepny_krok: "Poproś sprzedawcę o VIN.",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("runQuickTest (atrapa fetch)", () => {
  it("wysyła umowę {tekst, cena, przebieg, rocznik} i normalizuje odpowiedź", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(apiResponse));
    const r = await runQuickTest({ tekst: "Golf VII 1.6 TDI 2015 sprzedam, auto od Niemca, zadbany", cena: 30000, przebieg: null, rocznik: 2015 }, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/szybki-test");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ tekst: expect.any(String), cena: 30000, przebieg: null, rocznik: 2015 });

    expect(r.rozpoznany).toEqual({ modelId: "vw-golf-7", nazwa: "Volkswagen Golf VII (2012–2020)", silnik: expect.stringContaining("1.6 TDI") });
    expect(r.flagi).toHaveLength(2);
    expect(r.flagi[0]).toMatchObject({ id: "brak-vin", tytul: "Brak VIN", waga: "srednia", pytanie: "Czy może Pan/Pani podać VIN?" });
    expect(r.flagi[1].tytul).toBe("Sformułowania w ogłoszeniu"); // kategoria → neutralny nagłówek
    expect(r.usterki[0]).toMatchObject({ tytul: "Skrzynia DSG DQ200", waga: "wysoka", koszt: [3000, 9000] });
    expect(r.cena).toMatchObject({ pozycja: "ponizej", etykieta: "Cena poniżej typowych ofert" });
    expect(r.brakVin).toBe(true);
    expect(r.nastepnyKrok).toBe("Poproś sprzedawcę o VIN.");
  });

  it("404 (endpoint jeszcze nie istnieje) → czytelny komunikat", async () => {
    const f = vi.fn(async () => new Response("Not found", { status: 404 }));
    await expect(runQuickTest({ tekst: "x".repeat(40) }, f as unknown as typeof fetch)).rejects.toMatchObject({
      name: "QuickTestError",
      status: 404,
      message: expect.stringContaining("chwilowo niedostępny"),
    });
  });

  it("400 → komunikat z serwera, 429 → prośba o odczekanie, brak sieci → komunikat o połączeniu", async () => {
    const bad = vi.fn(async () => jsonResponse({ error: "Wklej treść ogłoszenia (co najmniej 30 znaków)." }, 400));
    await expect(runQuickTest({ tekst: "krótko" }, bad as unknown as typeof fetch)).rejects.toThrow("co najmniej 30 znaków");
    const limited = vi.fn(async () => jsonResponse({}, 429));
    await expect(runQuickTest({ tekst: "x".repeat(40) }, limited as unknown as typeof fetch)).rejects.toThrow(/Odczekaj/);
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(runQuickTest({ tekst: "x".repeat(40) }, offline as unknown as typeof fetch)).rejects.toBeInstanceOf(QuickTestError);
  });
});

describe("normalizeQuickTest – tolerancja na nazwy pól", () => {
  it("akceptuje angielskie nazwy i brak sekcji", () => {
    const r = normalizeQuickTest({
      rozpoznany: null,
      flagi: [{ title: "Cena", description: "Niska cena", severity: "high" }],
      usterki: [{ title: "Rozrząd", cost_pln: [1000, 2000], severity: "medium" }],
      cena: { pozycja: "w normie" },
    });
    expect(r.rozpoznany).toBeNull();
    expect(r.flagi[0]).toMatchObject({ tytul: "Cena", opis: "Niska cena", waga: "wysoka" });
    expect(r.usterki[0]).toMatchObject({ tytul: "Rozrząd", koszt: [1000, 2000], waga: "srednia" });
    expect(r.cena.pozycja).toBe("w_normie");
    expect(r.brakVin).toBe(false);
  });

  it("mapuje pozycję ceny", () => {
    expect(toPricePosition("ponizej")).toBe("ponizej");
    expect(toPricePosition("powyżej")).toBe("powyzej");
    expect(toPricePosition("brak_danych")).toBe("brak_danych");
    expect(toPricePosition(undefined)).toBe("brak_danych");
  });

  it("tekst do udostępnienia jest neutralny i zawiera model", () => {
    const txt = shareText(normalizeQuickTest(apiResponse));
    expect(txt).toContain("Volkswagen Golf VII");
    expect(txt).toContain("Do wyjaśnienia ze sprzedawcą: 2 sprawy");
    expect(txt).toContain("Brak VIN");
    expect(txt).not.toMatch(/oszust|kłam/i);
  });
});
