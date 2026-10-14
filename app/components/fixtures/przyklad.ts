import type { Report } from "@/lib/report-schema";

/**
 * Przykładowy raport na FIKCYJNYM ogłoszeniu (Volkswagen Golf VII 1.6 TDI, 2015).
 * Używany na /przyklad i na landingu, gdy brak `content/przyklad-raport.json`.
 * Usterki i koszty zgodne z wpisem `data/models/vw-golf-7.json`.
 */
export const PRZYKLAD_META = {
  tytul: "Volkswagen Golf VII 1.6 TDI 110 KM, 2015",
  cena_pln: 36900,
  przebieg_km: 148000,
  ogloszenie:
    "Sprzedam VW Golf VII 1.6 TDI 110 KM, 2015 r., przebieg 148 000 km. Polski salon, pierwszy właściciel, serwisowany w ASO. Bezwypadkowy, zadbany, nowy rozrząd. Klimatyzacja, nawigacja, czujniki parkowania. Cena 36 900 zł do negocjacji.",
};

export const PRZYKLAD_RAPORT: Report = {
  podsumowanie: {
    ocena: "wysokie",
    uzasadnienie:
      "Deklarowany przebieg (148 000 km) jest niższy niż ostatni odczyt z badania technicznego w 2021 r. (171 300 km). Cena jest wyraźnie niższa od podobnych ofert, a opis „pierwszy właściciel” nie zgadza się z liczbą właścicieli w Historii Pojazdu. Każda z tych rzeczy może mieć wyjaśnienie, ale wymaga go przed wyjazdem.",
    zalecenie:
      "Przed umówieniem oględzin zapytaj sprzedawcę o różnicę przebiegu i poproś o dokumenty (faktury serwisowe, wymiana licznika). Bez wiarygodnego wyjaśnienia rozważ inne oferty.",
  },
  rozpoznany_pojazd: {
    marka: "Volkswagen",
    model: "Golf",
    generacja: "VII (2012–2020)",
    silnik: "1.6 TDI 90–115 KM (EA288, m.in. CLHA/CXXB)",
    pewnosc: "wysoka",
    w_bazie: true,
  },
  czerwone_flagi: [
    {
      tytul: "Przebieg w ogłoszeniu niższy niż ostatni odczyt z badania technicznego",
      opis: "W Historii Pojazdu ostatni odczyt (2021-05-18) to 171 300 km, a ogłoszenie podaje 148 000 km. Możliwe przyczyny to wymiana licznika lub błąd w ogłoszeniu – do wyjaśnienia ze sprzedawcą.",
      waga: "wysoka",
      pytanie_do_sprzedawcy: "Ostatni odczyt z badania technicznego to 171 300 km, a w ogłoszeniu jest 148 000 km. Z czego wynika ta różnica? Czy wymieniano licznik lub zegary – czy jest na to dokument?",
    },
    {
      tytul: "Opis „pierwszy właściciel” a liczba właścicieli w Historii Pojazdu",
      opis: "Historia Pojazdu pokazuje 3 zmiany właściciela od pierwszej rejestracji. Opis może dotyczyć np. pierwszego właściciela prywatnego po leasingu – warto doprecyzować.",
      waga: "srednia",
      pytanie_do_sprzedawcy: "Od kiedy jest Pan/Pani właścicielem i kto użytkował auto wcześniej (leasing, firma, osoba prywatna)?",
    },
    {
      tytul: "Cena poniżej podobnych ofert",
      opis: "Cena jest o ok. 15–20% niższa niż w trzech podobnych ogłoszeniach (ten sam rocznik i silnik). Niższa cena może wynikać z wyposażenia, stanu lub szybkiej sprzedaży – do wyjaśnienia.",
      waga: "srednia",
      pytanie_do_sprzedawcy: "Z czego wynika cena niższa niż w podobnych ofertach? Czy auto ma coś do naprawy?",
    },
    {
      tytul: "Deklaracja serwisu w ASO bez wzmianki o dokumentach",
      opis: "Ogłoszenie podaje serwis w ASO i nowy rozrząd, ale nie wspomina o książce serwisowej ani fakturach. Deklaracja ma wartość, gdy da się ją potwierdzić.",
      waga: "niska",
      pytanie_do_sprzedawcy: "Czy może Pan/Pani przesłać zdjęcia książki serwisowej i faktury za wymianę rozrządu (z datą i przebiegiem)?",
    },
  ],
  przebieg: {
    deklarowany_km: 148000,
    odczyty: [
      { data: "2018-05-14", km: 74120 },
      { data: "2019-05-20", km: 118400 },
      { data: "2020-05-11", km: 146950 },
      { data: "2021-05-18", km: 171300 },
    ],
    wniosek:
      "Odczyty z badań technicznych rosną równomiernie (ok. 30–45 tys. km rocznie, typowo dla auta flotowego), ale ostatni z nich jest o 23 300 km wyższy niż przebieg w ogłoszeniu. Do wyjaśnienia ze sprzedawcą przed oględzinami.",
    uwagi: [
      "Brak odczytów po 2021 r. – zapytaj, dlaczego auto nie miało badania technicznego w kolejnych latach albo czy było wyrejestrowane.",
      "Na oględzinach porównaj przebieg z licznika z zapisami w sterownikach (diagnostyka) i z ostatnim wpisem serwisowym.",
    ],
  },
  typowe_usterki: [
    {
      tytul: "Zawór EGR i chłodnica spalin – zanieczyszczenie, nieszczelność",
      objawy: "Kontrolka silnika, szarpanie przy niskich obrotach, spadek mocy, czarny dym. Nieszczelna chłodnica EGR może powodować ubytek płynu chłodzącego bez widocznego wycieku.",
      koszt_pln_od: 800,
      koszt_pln_do: 3500,
      waga: "srednia",
      jak_sprawdzic: "Diagnostyka (błędy EGR, przepływ rzeczywisty vs zadany), kontrola poziomu płynu chłodzącego, biały dym na ciepłym silniku.",
    },
    {
      tytul: "Filtr cząstek stałych DPF – zapchanie, częste regeneracje",
      objawy: "Kontrolka DPF, spadek mocy, tryb awaryjny, wentylator pracujący po zgaszeniu silnika, częste wypalanie w mieście.",
      koszt_pln_od: 700,
      koszt_pln_do: 5000,
      waga: "srednia",
      jak_sprawdzic: "W diagnostyce stopień zapełnienia filtra i liczba regeneracji; obejrzyj wydech pod kątem śladów cięcia obudowy filtra.",
    },
    {
      tytul: "Koło dwumasowe i sprzęgło",
      objawy: "Metaliczne stuki na biegu jałowym (znikają po wciśnięciu sprzęgła), wibracje przy ruszaniu, ślizganie się sprzęgła.",
      koszt_pln_od: 3000,
      koszt_pln_do: 5500,
      waga: "srednia",
      jak_sprawdzic: "Kilka razy zgaś i uruchom ciepły silnik, posłuchaj na luzie; przyspieszanie od 1500 obr./min na 4–5 biegu.",
    },
    {
      tytul: "Klimatyzacja – skraplacz i sprężarka",
      objawy: "Słabe chłodzenie, hałas sprężarki, wycieki czynnika po uszkodzeniu skraplacza (np. od kamieni).",
      koszt_pln_od: 800,
      koszt_pln_do: 3500,
      waga: "srednia",
      jak_sprawdzic: "Włącz klimatyzację na maksimum – po kilku minutach temperatura z nawiewów powinna wyraźnie spaść.",
    },
    {
      tytul: "Termostat / pompa cieczy – wycieki i niedogrzewanie",
      objawy: "Silnik długo się nagrzewa, zimno z nawiewów, ubytek płynu.",
      koszt_pln_od: 500,
      koszt_pln_do: 1500,
      waga: "niska",
      jak_sprawdzic: "Na jeździe próbnej temperatura płynu powinna szybko dojść do ok. 90°C i się utrzymać.",
    },
  ],
  zdjecia: {
    uwagi: [
      "Na zdjęciu kokpitu licznik pokazuje 148 0xx km – zgodnie z ogłoszeniem, ale niezgodnie z ostatnim odczytem z badania technicznego.",
      "Zużycie kierownicy i gałki zmiany biegów wygląda na większe niż typowe dla 148 tys. km – warto ocenić na żywo.",
      "Przedni zderzak ma nieco inny odcień niż błotniki na jednym ze zdjęć – może to być efekt światła; zmierz lakier na oględzinach.",
    ],
  },
  porownanie_cen: {
    wiersze: [
      { zrodlo: "to ogłoszenie", cena: 36900, rocznik: 2015, przebieg_km: 148000, wyposazenie: "Comfortline, nawigacja, czujniki", uwaga: "przebieg do wyjaśnienia" },
      { zrodlo: "oferta 1", cena: 44500, rocznik: 2015, przebieg_km: 182000, wyposazenie: "Comfortline, nawigacja", uwaga: "faktury serwisowe" },
      { zrodlo: "oferta 2", cena: 42900, rocznik: 2015, przebieg_km: 205000, wyposazenie: "Trendline", uwaga: "—" },
      { zrodlo: "oferta 3", cena: 46800, rocznik: 2016, przebieg_km: 169000, wyposazenie: "Highline, LED", uwaga: "polski salon" },
    ],
    wniosek:
      "Ta oferta jest o ok. 6–10 tys. zł tańsza niż podobne auta, mimo niższego deklarowanego przebiegu. Przy przebiegu zbliżonym do odczytu z CEPiK (ok. 170+ tys. km) cena byłaby bliższa rynkowej.",
  },
  pytania_do_sprzedawcy: [
    "Ostatni odczyt z badania technicznego to 171 300 km, a w ogłoszeniu jest 148 000 km. Z czego wynika różnica?",
    "Czy wymieniano licznik lub zestaw wskaźników? Czy jest na to faktura?",
    "Od kiedy jest Pan/Pani właścicielem i kto wcześniej użytkował auto?",
    "Czy może Pan/Pani przesłać zdjęcia książki serwisowej i faktury za rozrząd?",
    "Czy filtr DPF był czyszczony lub wymieniany? Czy zawór EGR był naprawiany?",
    "Czy auto miało szkody komunikacyjne i które elementy były lakierowane?",
    "Czy mogę podjechać autem do niezależnego warsztatu na diagnostykę przed zakupem?",
  ],
  checklista_ogledzin: [
    {
      obszar: "Dokumenty i przebieg",
      punkty: [
        "Porównaj VIN w dowodzie, na tabliczce i na szybie",
        "Przebieg na liczniku vs ostatni odczyt z CEPiK (171 300 km)",
        "Faktury serwisowe – daty i przebiegi po kolei",
      ],
    },
    {
      obszar: "Silnik 1.6 TDI",
      punkty: [
        "Zimny rozruch – dym, praca na wolnych obrotach",
        "Diagnostyka: błędy EGR, stan DPF, liczba regeneracji",
        "Poziom płynu chłodzącego i ślady wycieków",
      ],
    },
    {
      obszar: "Nadwozie",
      punkty: [
        "Grubość lakieru na każdym elemencie (zwłaszcza przedni pas, błotniki, maska)",
        "Szczeliny między elementami i daty produkcji szyb",
      ],
    },
    {
      obszar: "Jazda próbna",
      punkty: [
        "Sprzęgło i koło dwumasowe – stuki, ślizganie",
        "Klimatyzacja na maksimum – temperatura z nawiewów",
        "Zawieszenie na nierównościach, prowadzenie na wprost",
      ],
    },
  ],
  dokumenty_do_sprawdzenia: [
    "Dowód rejestracyjny – zgodność VIN i danych właściciela ze sprzedającym",
    "Ważne OC (sprawdzisz w UFG po numerze rejestracyjnym) i badanie techniczne",
    "Książka serwisowa i faktury (rozrząd, DPF/EGR, sprzęgło)",
    "Dokument wymiany licznika, jeśli sprzedawca tak wyjaśni różnicę przebiegu",
    "Karta pojazdu (jeśli była wydana)",
  ],
};
