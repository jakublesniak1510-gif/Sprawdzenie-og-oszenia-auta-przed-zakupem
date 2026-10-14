import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findContentFile, formatDatePl, mdToText, renderEmail, splitSubject, substitute } from "./email-templates";
import { tempDir } from "./test-utils";

afterEach(() => {
  delete process.env.EMAIL_CONTENT_DIR;
});

describe("szablony e-maili", () => {
  it("wbudowany „raport gotowy” ma link i datę ważności w HTML i tekście", () => {
    process.env.EMAIL_CONTENT_DIR = tempDir(); // pusty katalog = treść wbudowana
    const m = renderEmail("raport_gotowy", { link: "https://x.pl/raport/abc", data_waznosci: "13.11.2026" });
    expect(m.source).toBe("builtin");
    expect(m.subject).toBe("Twój raport jest gotowy");
    expect(m.html).toContain('href="https://x.pl/raport/abc"');
    expect(m.text).toContain("https://x.pl/raport/abc");
    expect(m.text).toContain("13.11.2026");
    expect(m.text).not.toContain("{{");
  });

  it("używa content/emails/*.md, gdy istnieje, z podstawieniem {{link}} i {{data_waznosci}}", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, "01-raport-gotowy.md"), "---\ntemat: Raport czeka do {{data_waznosci}}\n---\nCześć! Twój raport: {{link}}\n\nWażny do {{data_waznosci}}. {{nieznane}}");
    fs.writeFileSync(path.join(dir, "02-czy-kupiles.md"), "# Jak poszło?\n\n[Oceń]({{link}})");
    process.env.EMAIL_CONTENT_DIR = dir;
    const m = renderEmail("raport_gotowy", { link: "https://x.pl/r/1", data_waznosci: "01.12.2026" });
    expect(m.source).toBe("content");
    expect(m.subject).toBe("Raport czeka do 01.12.2026");
    expect(m.text).toContain("Twój raport: https://x.pl/r/1");
    expect(m.text).not.toContain("{{");
    const f = renderEmail("czy_kupiles", { link: "https://x.pl/r/1#opinia" });
    expect(f.subject).toBe("Jak poszło?");
    expect(f.text).toContain("Oceń: https://x.pl/r/1#opinia");
    expect(findContentFile("platnosc_niedokonczona", dir)).toBeNull();
  });

  it("prawdziwe treści z content/emails (jeśli są) renderują się bez niepodstawionych zmiennych", () => {
    const vars = { link: "https://x.pl/r", link_tak: "https://x.pl/t", link_nie: "https://x.pl/n", data_waznosci: "01.01.2027", kod: "ABCD-EFGH", liczba_raportow: "5" };
    for (const kind of ["raport_gotowy", "platnosc_niedokonczona", "czy_kupiles", "kupon_pakiet"] as const) {
      const m = renderEmail(kind, vars);
      expect(m.subject.length).toBeGreaterThan(3);
      expect(m.text).not.toMatch(/\{\{/);
      expect(m.html).not.toMatch(/\{\{/);
      expect(m.text).toContain("https://x.pl/");
    }
  });

  it("escapuje HTML w podstawianych wartościach", () => {
    process.env.EMAIL_CONTENT_DIR = tempDir();
    const m = renderEmail("kupon_pakiet", { link: "https://x.pl", kod: "<b>ABCD</b>", liczba_raportow: "5", data_waznosci: "1.1.2027" });
    expect(m.html).not.toContain("<b>ABCD</b>");
    expect(m.html).toContain("&lt;b&gt;ABCD");
  });

  it("temat z linii „Temat:” i konwersja do tekstu", () => {
    expect(splitSubject("Temat: Hej\n\nTreść")).toEqual({ subject: "Hej", body: "Treść" });
    expect(mdToText("**Ważne** [link](https://a.pl)")).toBe("Ważne link: https://a.pl");
    expect(formatDatePl("2026-11-13T10:00:00.000Z")).toBe("13.11.2026");
  });

  it("nieznana zmienna loguje ostrzeżenie zamiast cicho znikać; znana pusta – bez ostrzeżenia", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(substitute("A {{link}} B {{literowka}} C {{model}}", { link: "L" })).toBe("A L B  C ");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/\{\{literowka\}\}/);
    } finally {
      warn.mockRestore();
    }
  });

  it("czy-kupiles: przyciski tak/nie dostają linki", () => {
    const m = renderEmail("czy_kupiles", { link: "https://x.pl/r", link_tak: "https://x.pl/kupil?odp=tak", link_nie: "https://x.pl/kupil?odp=nie" });
    expect(m.html).toContain('href="https://x.pl/kupil?odp=tak"');
    expect(m.html).toContain('href="https://x.pl/kupil?odp=nie"');
  });
});
