import { describe, expect, it } from "vitest";
import { PRZYKLAD_RAPORT } from "@/components/fixtures/przyklad";
import { ReportSchema } from "@/lib/report-schema";
import { nextSteps, questionsMessage, reportToc, summarizeReport, vehicleName } from "./summary";

describe("przykładowy raport (fixture)", () => {
  it("jest zgodny ze schematem Report", () => {
    expect(ReportSchema.safeParse(PRZYKLAD_RAPORT).success).toBe(true);
  });
});

describe("teksty z raportu", () => {
  it("podsumowanie ma 3 zdania i nazwę auta", () => {
    const s = summarizeReport(PRZYKLAD_RAPORT);
    expect(s.startsWith("Sprawdziłem ogłoszenie: Volkswagen Golf VII – ryzyko zakupu oceniono jako wysokie.")).toBe(true);
    expect(s.match(/[.!?](\s|$)/g)?.length).toBe(3);
  });
  it("pytania gotowe do SMS: numerowane, z powitaniem", () => {
    const q = questionsMessage(PRZYKLAD_RAPORT);
    expect(q.split("\n")[0]).toContain("Dzień dobry");
    expect(q).toContain("\n1. ");
    expect(q).toContain(`\n${PRZYKLAD_RAPORT.pytania_do_sprzedawcy.length}. `);
  });
  it("następny krok: zalecenie na początku, mechanik na końcu; bez historii – prośba o VIN", () => {
    const s = nextSteps(PRZYKLAD_RAPORT);
    expect(s[0]).toBe(PRZYKLAD_RAPORT.podsumowanie.zalecenie);
    expect(s.at(-1)).toMatch(/mechanika/);
    expect(nextSteps({ ...PRZYKLAD_RAPORT, przebieg: null }).some((x) => x.includes("VIN"))).toBe(true);
    // zalecenie już mówi o VIN i mechaniku → bez powtórzeń
    const dup = nextSteps({ ...PRZYKLAD_RAPORT, przebieg: null, podsumowanie: { ...PRZYKLAD_RAPORT.podsumowanie, zalecenie: "Poproś o VIN. Umów mechanika." } });
    expect(dup.filter((x) => x.includes("VIN"))).toHaveLength(1);
    expect(dup.filter((x) => /mechanik/.test(x))).toHaveLength(1);
  });
  it("spis treści zależy od sekcji i pakietu", () => {
    expect(reportToc(PRZYKLAD_RAPORT, "raport_plus").map((t) => t.id)).toContain("ceny");
    expect(reportToc({ ...PRZYKLAD_RAPORT, porownanie_cen: null, zdjecia: null }, "raport").map((t) => t.id)).not.toContain("ceny");
  });
  it("nieustalony model → nazwa zastępcza", () => {
    expect(vehicleName({ ...PRZYKLAD_RAPORT, rozpoznany_pojazd: { ...PRZYKLAD_RAPORT.rozpoznany_pojazd, marka: "nie ustalono" } }, "Opel Corsa")).toBe("Opel Corsa");
  });
});
