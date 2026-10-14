import type { Report } from "../report-schema";
import type { AiProvider, AiReportRequest } from "./types";

/**
 * Atrapa modelu (AI_MOCK=1) – do testów całej ścieżki bez klucza API.
 * Składa sensowny raport z danych wejściowych i wpisu bazy; nie analizuje treści „inteligentnie”.
 */
export class MockProvider implements AiProvider {
  name = "mock";

  async generate(req: AiReportRequest): Promise<Report> {
    const delay = Number(process.env.AI_MOCK_DELAY_MS ?? 2500);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    const hasVin = /\b[A-HJ-NPR-Z0-9]{17}\b/.test(req.tekstOgloszenia.toUpperCase());
    const m = req.model;
    const engine = m && req.silnikKod ? m.engines.find((e) => e.code === req.silnikKod) ?? null : null;
    const fmtKm = (n: number) => `${n.toLocaleString("pl-PL")} km`;

    const flagi: Report["czerwone_flagi"] = [];
    if (!hasVin) {
      flagi.push({
        tytul: "Brak numeru VIN w ogłoszeniu",
        opis: "Bez VIN nie da się sprawdzić historii w gov.pl ani w bazach zagranicznych. Do wyjaśnienia ze sprzedawcą – większość sprzedających podaje VIN na prośbę.",
        waga: "srednia",
        pytanie_do_sprzedawcy: "Czy może Pan/Pani podać VIN, numer rejestracyjny i datę pierwszej rejestracji?",
      });
    }
    for (const f of req.flagi.slice(0, 4)) {
      flagi.push({
        tytul: `Fraza w ogłoszeniu: „${f.trafienie}”`,
        opis: f.neutral_wording,
        waga: f.severity,
        pytanie_do_sprzedawcy: f.question_for_seller ?? "Czy może Pan/Pani rozwinąć ten fragment ogłoszenia?",
      });
    }
    if (req.analizaPrzebiegu.cofniecia.length > 0) {
      const c = req.analizaPrzebiegu.cofniecia[0];
      flagi.push({
        tytul: "Niższy odczyt licznika w późniejszym badaniu",
        opis: `Odczyt z ${c.na.data} (${fmtKm(c.na.km)}) jest niższy niż z ${c.z.data} (${fmtKm(c.z.km)}). Do wyjaśnienia ze sprzedawcą – możliwe przyczyny to m.in. wymiana licznika lub błąd wpisu.`,
        waga: "wysoka",
        pytanie_do_sprzedawcy: "Czy licznik lub zestaw wskaźników był wymieniany? Czy są na to dokumenty?",
      });
    }

    if (req.analizaPrzebiegu.deklarowanyNizszyOdOstatniego && req.analizaPrzebiegu.ostatni) {
      flagi.push({
        tytul: "Przebieg w ogłoszeniu niższy niż ostatni odczyt z badania",
        opis: `Ostatni odczyt z badania technicznego (${fmtKm(req.analizaPrzebiegu.ostatni.km)}) jest wyższy niż przebieg podany w ogłoszeniu. Do wyjaśnienia ze sprzedawcą – może to być np. pomyłka w ogłoszeniu.`,
        waga: "wysoka",
        pytanie_do_sprzedawcy: "Jaki jest aktualny stan licznika? Czy licznik był wymieniany?",
      });
    }
    const declared = req.deklaracje.przebieg_km;
    const last = req.analizaPrzebiegu.ostatni;
    const przebieg: Report["przebieg"] =
      req.odczyty.length || declared !== null
        ? {
            deklarowany_km: declared,
            odczyty: req.odczyty,
            wniosek: req.odczyty.length
              ? req.analizaPrzebiegu.deklarowanyNizszyOdOstatniego
                ? `Deklarowany przebieg jest niższy niż ostatni odczyt z badania (${fmtKm(last!.km)}). Do wyjaśnienia ze sprzedawcą.`
                : `Odczyty z badań technicznych rosną i nie przekraczają deklarowanego przebiegu. Ostatni odczyt: ${fmtKm(last!.km)} (${last!.data}).`
              : "Brak odczytów z badań. Poproś o VIN, numer rejestracyjny i datę pierwszej rejestracji i sprawdź auto w gov.pl „Historia Pojazdu”.",
            uwagi: ["[TRYB TESTOWY – raport wygenerowany przez atrapę AI_MOCK]"],
          }
        : null;

    const typowe: Report["typowe_usterki"] = m
      ? [...(engine?.faults ?? m.engines.flatMap((e) => e.faults)), ...m.common_faults].slice(0, 6).map((f) => ({
          tytul: f.title,
          objawy: f.symptoms,
          koszt_pln_od: f.cost_pln[0],
          koszt_pln_do: f.cost_pln[1],
          waga: f.severity,
          jak_sprawdzic: f.check_at_inspection,
        }))
      : [];

    const ocena: Report["podsumowanie"]["ocena"] =
      flagi.some((f) => f.waga === "wysoka") ? "wysokie" : flagi.length >= 2 || !hasVin ? "srednie" : "niskie";

    return {
      podsumowanie: {
        ocena,
        uzasadnienie:
          "[TRYB TESTOWY] To przykładowy raport wygenerowany bez wywołania modelu AI. " +
          (hasVin ? "Ogłoszenie zawiera VIN, co ułatwia weryfikację historii." : "W ogłoszeniu nie ma VIN, więc historii auta nie da się jeszcze sprawdzić."),
        zalecenie: "Poproś o VIN i sprawdź historię w gov.pl. Przed zakupem umów oględziny u niezależnego mechanika.",
      },
      rozpoznany_pojazd: {
        marka: m?.make ?? "nie ustalono",
        model: m?.model ?? "nie ustalono",
        generacja: m?.generation ?? "nie ustalono",
        silnik: engine?.code ?? "nie ustalono",
        pewnosc: m ? (engine ? "wysoka" : "srednia") : "niska",
        w_bazie: !!m,
      },
      czerwone_flagi: flagi,
      przebieg,
      typowe_usterki: typowe,
      zdjecia: req.zdjecia.length
        ? {
            uwagi: [
              `Liczba dołączonych zdjęć: ${req.zdjecia.length}. [TRYB TESTOWY – zdjęcia nie były analizowane]`,
              "Na oględzinach porównaj kolor i odcień lakieru na sąsiednich elementach.",
              "Sprawdź, czy zużycie kierownicy i fotela kierowcy pasuje do przebiegu.",
            ],
          }
        : null,
      porownanie_cen:
        req.oferta === "raport_plus" && req.podobneOferty.length
          ? {
              wiersze: [
                {
                  zrodlo: "to ogłoszenie",
                  cena: req.deklaracje.cena_pln,
                  rocznik: req.deklaracje.rocznik,
                  przebieg_km: req.deklaracje.przebieg_km,
                  wyposazenie: "wg ogłoszenia",
                  uwaga: "",
                },
                ...req.podobneOferty.map((o, i) => ({
                  zrodlo: `oferta ${i + 1}`,
                  cena: o.cena,
                  rocznik: o.rocznik,
                  przebieg_km: o.przebieg_km,
                  wyposazenie: o.tekst ? o.tekst.slice(0, 60) : "brak danych",
                  uwaga: "",
                })),
              ],
              wniosek: "[TRYB TESTOWY] Zestawienie bez interpretacji – w trybie produkcyjnym model oceni, czy cena odbiega od rynku.",
            }
          : null,
      pytania_do_sprzedawcy: [
        ...(hasVin ? [] : ["Proszę o VIN, numer rejestracyjny i datę pierwszej rejestracji."]),
        "Jak długo jest Pan/Pani właścicielem auta i czy jest ono zarejestrowane na Pana/Panią?",
        "Czy auto miało szkody lub naprawy blacharsko-lakiernicze?",
        "Czy jest historia serwisowa (faktury, książka)?",
        "Kiedy był wymieniany rozrząd i olej?",
        "Czy mogę przyjechać z mechanikiem i podłączyć komputer diagnostyczny?",
        ...(m?.questions_for_seller ?? []),
      ],
      checklista_ogledzin: [
        { obszar: "Dokumenty", punkty: ["VIN w dowodzie = VIN na tabliczce i nabity na nadwoziu", "Sprzedający jest właścicielem (lub ma pełnomocnictwo)", "Ważne badanie techniczne i OC"] },
        { obszar: "Nadwozie i lakier", punkty: ["Pomiar grubości lakieru na każdym elemencie", "Równe szczeliny między elementami", "Brak lakieru na uszczelkach i gumach"] },
        { obszar: "Silnik", punkty: ["Zimny rozruch – bez stuków i dymienia", "Brak wycieków oleju i płynu", "Diagnostyka komputerowa – błędy zapisane w sterownikach"] },
        { obszar: "Jazda próbna", punkty: ["Ruszanie i hamowanie – auto nie ściąga", "Zmiana biegów bez szarpnięć", "Brak stuków na nierównościach"] },
        ...(m ? [{ obszar: `Specyficzne dla ${m.make} ${m.model}`, punkty: m.inspection_tips.slice(0, 5) }] : []),
      ],
      dokumenty_do_sprawdzenia: [
        "Dowód rejestracyjny (zgodność VIN, właściciel)",
        "Karta pojazdu (jeśli wydana)",
        "Dokument nabycia przez sprzedającego (umowa/faktura)",
        "Polisa OC – sprawdź także w UFG",
        "Faktury serwisowe / książka serwisowa",
      ],
    };
  }
}
