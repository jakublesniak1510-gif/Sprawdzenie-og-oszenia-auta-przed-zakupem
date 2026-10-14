# Baza wiedzy – `data/`

Kuratorowana baza, z której korzysta aplikacja (`app/`). Model językowy dostaje **tylko** wpis z tej bazy dla rozpoznanego modelu i silnika i niczego nie dopisuje – dlatego treści są konkretne i ostrożnie sformułowane. Kontrakt danych opisują schematy w `schema/` (nie zmieniamy ich bez uzgodnienia z zespołem aplikacji; zmiany z rundy 2 opisuje sekcja „Zmiany kontraktu – runda 2”).

## Struktura

```
data/
├── schema/                       # kontrakt (JSON Schema 2020-12)
│   ├── model.schema.json         # model (+ price_ranges, running_costs, buy_advice – runda 2)
│   ├── red-flags.schema.json
│   ├── questions-by-category.schema.json
│   ├── glossary.schema.json
│   └── cepik-sample.schema.json  # format plików samples/cepik/*.expected.json
├── models/<id>.json              # 50 modeli: silniki, usterki, oględziny, pytania, widełki cen
├── red-flags.json                # 87 heurystyk czerwonych flag w treści ogłoszenia
├── questions-by-category.json    # 5–8 uniwersalnych pytań na kategorię flag
├── glossary.json                 # 48 pojęć do tooltipów (DSG, DPF, akcyza, „do opłat”…)
├── samples/cepik/                # 6 FIKCYJNYCH próbek wklejonej Historii Pojazdu + .expected.json
├── checklists/
│   ├── ogledziny.md              # checklista oględzin (A4)
│   ├── pytania-do-sprzedawcy.md  # pytania pogrupowane (A4)
│   ├── dokumenty.md              # dokumenty przy zakupie (A4)
│   └── historia-pojazdu-instrukcja.md  # Historia Pojazdu + OC w UFG (A4)
├── wzory/
│   └── umowa-kupna-sprzedazy.md  # wzór umowy z protokołem wydania
├── validate.mjs                  # walidator + statystyki
└── package.json                  # zależności walidatora (ajv, ajv-formats)
```

## Modele w bazie

| id | Model | Silniki | Usterki | Widełki cen (2026) |
|---|---|---|---|---|
| `audi-a3-8p` | Audi A3 8P (2003–2012) | 6 | 28 | 8–30 tys. |
| `audi-a3-8v` | Audi A3 8V (2012–2020) | 5 | 22 | 40–88 tys. |
| `audi-a4-b8` | Audi A4 B8 (2007–2015) | 4 | 22 | 20–65 tys. |
| `audi-a6-c7` | Audi A6 C7 (2011–2018) | 4 | 24 | 47–122 tys. |
| `bmw-3-e90` | BMW Seria 3 E90/E91/E92/E93 (2005–2013) | 4 | 21 | 15–43 tys. |
| `bmw-3-f30` | BMW Seria 3 F30/F31 (2012–2019) | 5 | 22 | 37–92 tys. |
| `bmw-5-f10` | BMW Seria 5 F10/F11 (2010–2017) | 4 | 20 | 40–108 tys. |
| `bmw-x3-f25` | BMW X3 F25 (2010–2017) | 4 | 19 | 44–98 tys. |
| `dacia-duster-1` | Dacia Duster I (2010–2017) | 4 | 20 | 19–44 tys. |
| `dacia-sandero-2` | Dacia Sandero II (2012–2020) | 5 | 23 | 16–40 tys. |
| `ford-fiesta-mk7` | Ford Fiesta Mk7 (2008–2017) | 5 | 23 | 9–30 tys. |
| `ford-focus-2` | Ford Focus II (Mk2, 2004–2011) | 5 | 24 | 6–17 tys. |
| `ford-focus-3` | Ford Focus III (Mk3, 2010–2018) | 5 | 23 | 17–47 tys. |
| `ford-kuga-2` | Ford Kuga II (2012–2019) | 4 | 21 | 41–82 tys. |
| `ford-mondeo-4` | Ford Mondeo IV (Mk4, 2007–2014) | 5 | 21 | 11–34 tys. |
| `hyundai-i30-2` | Hyundai i30 II (GD, 2011–2017) | 4 | 19 | 23–45 tys. |
| `hyundai-tucson-3` | Hyundai Tucson III (TL, 2015–2020) | 5 | 22 | 57–100 tys. |
| `kia-ceed-2` | Kia Ceed II (JD, 2012–2018) | 4 | 19 | 24–50 tys. |
| `kia-sportage-3` | Kia Sportage III (SL, 2010–2015) | 5 | 24 | 33–58 tys. |
| `kia-sportage-4` | Kia Sportage IV (QL, 2015–2021) | 5 | 22 | 58–110 tys. |
| `mazda-6-gj` | Mazda 6 III (GJ 2012–2018, po liftingu GL 2018–2023) | 3 | 17 | 38–125 tys. |
| `mercedes-c-w204` | Mercedes-Benz Klasa C W204/S204 (2007–2014) | 4 | 20 | 23–58 tys. |
| `mercedes-e-w212` | Mercedes-Benz Klasa E W212/S212 (2009–2016) | 4 | 20 | 37–98 tys. |
| `nissan-qashqai-2` | Nissan Qashqai II (J11, 2013–2021) | 4 | 19 | 41–88 tys. |
| `opel-astra-h` | Opel Astra H (2004–2014, w tym Astra Classic III) | 5 | 24 | 6–17 tys. |
| `opel-astra-j` | Opel Astra J (2009–2015) | 5 | 23 | 16–34 tys. |
| `opel-astra-k` | Opel Astra K (2015–2021) | 4 | 20 | 31–64 tys. |
| `opel-corsa-d-e` | Opel Corsa D (2006–2014) i E (2014–2019) | 4 | 21 | 6–34 tys. |
| `opel-insignia-a` | Opel Insignia A (2008–2017) | 4 | 22 | 16–46 tys. |
| `peugeot-308-2` | Peugeot 308 II (T9, 2013–2021) | 5 | 24 | 27–64 tys. |
| `renault-captur-1` | Renault Captur I (2013–2019) | 4 | 19 | 27–55 tys. |
| `renault-clio-4` | Renault Clio IV (2012–2019) | 4 | 19 | 19–41 tys. |
| `renault-megane-3` | Renault Megane III (2008–2016) | 5 | 24 | 10–27 tys. |
| `seat-leon-3` | Seat Leon III (5F, 2012–2020) | 6 | 25 | 33–74 tys. |
| `skoda-fabia-2` | Škoda Fabia II (2007–2014) | 5 | 21 | 8–21 tys. |
| `skoda-octavia-2` | Škoda Octavia II (2004–2013) | 7 | 31 | 10–29 tys. |
| `skoda-octavia-3` | Škoda Octavia III (2012–2020) | 6 | 25 | 32–76 tys. |
| `skoda-superb-3` | Škoda Superb III (3V, 2015–2023) | 5 | 22 | 54–145 tys. |
| `toyota-auris-2` | Toyota Auris II (E180, 2012–2018) | 5 | 22 | 32–63 tys. |
| `toyota-avensis-t27` | Toyota Avensis III (T27, 2009–2018) | 5 | 22 | 21–56 tys. |
| `toyota-corolla-e16-e17` | Toyota Corolla XI (E160/E170, sedan, 2013–2019) | 4 | 18 | 30–60 tys. |
| `toyota-rav4-4` | Toyota RAV4 IV (XA40, 2013–2018) | 5 | 24 | 55–100 tys. |
| `toyota-yaris-3` | Toyota Yaris III (XP130, 2011–2020) | 4 | 17 | 21–55 tys. |
| `vw-golf-6` | Volkswagen Golf VI (2008–2013) | 5 | 23 | 15–34 tys. |
| `vw-golf-7` | Volkswagen Golf VII (2012–2020) | 5 | 21 | 34–78 tys. |
| `vw-passat-b6` | Volkswagen Passat B6 (3C, 2005–2010) | 6 | 32 | 9–24 tys. |
| `vw-passat-b7` | Volkswagen Passat B7 (2010–2014) | 4 | 21 | 25–49 tys. |
| `vw-passat-b8` | Volkswagen Passat B8 (2014–2023) | 5 | 21 | 46–125 tys. |
| `vw-polo-5` | Volkswagen Polo V (6R/6C, 2009–2017) | 6 | 26 | 11–33 tys. |
| `vw-tiguan-1` | Volkswagen Tiguan I (2007–2016) | 3 | 15 | 29–60 tys. |

Aktualne statystyki zawsze wypisuje `node validate.mjs`.

Runda 2 dodała 20 modeli najpopularniejszych na rynku wtórnym w Polsce: Opel Astra K, Opel Corsa D/E (jeden plik – obie generacje na wspólnej płycie, 2006–2019), Audi A3 8P, Audi A3 8V, Audi A6 C7, Toyota Corolla E16/E17 (sedan 2013–2019), Toyota RAV4 IV, VW Polo V, VW Passat B6, Seat Leon III, Škoda Superb III, Ford Fiesta Mk7 (2008–2017), Ford Kuga II, Hyundai Tucson III, Mercedes E W212, BMW X3 F25, Mazda 6 GJ/GL, Dacia Sandero II, Kia Sportage III, Renault Captur I.

Uwaga do Fiesty: oznaczenie „VII” jest niejednoznaczne (polska numeracja: VI = 2008–2017, VII = 2017–2023; brytyjska: Mk7 = 2008–2017). Plik `ford-fiesta-mk7` opisuje auta z lat 2008–2017 i celowo nie ma aliasów `fiesta vi`/`fiesta vii`.

Usterki wspólne dla rodzin silników i skrzyń (EA189/EA288/EA211, DSG, K9K, 1.5/1.6 TDCi, LPG itd.) w nowych modelach mają te same treści co w modelach z rundy 1 – to celowe (spójność raportów); różnią się koszty i wskazówki, gdy model tego wymaga.

## Wskazówki dla aplikacji (kontrakt użycia)

### Rozpoznawanie modelu i silnika (aliasy)

- Aliasy są małymi literami, w wariantach z polskimi znakami i bez (np. `škoda octavia ii` / `skoda octavia ii`), oraz z kropką i przecinkiem w pojemności (`1.6 tdi` / `1,6 tdi`).
- Aliasy **modeli** są unikalne w całej bazie (sprawdza walidator). Aliasy **silników** są unikalne tylko w obrębie modelu – najpierw rozpoznaj model, potem silnik.
- Dopasowuj alias z granicami słów, tak by nie był kontynuowany literą, cyfrą ani częścią dziesiętną. Zalecany wzorzec (JS, flaga `u`), ten sam, którym walidator sprawdza niejednoznaczności:

  ```js
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(alias)}(?![\\p{L}\\p{N}]|[.,]\\d|x\\d)`, 'u');
  re.test(tekstOgloszenia.toLowerCase());
  ```

  Dzięki temu `golf 6` nie trafi w `golf 1.6`, a `octavia 2` nie trafi w `octavia 2.0 tdi`.
- Gdy pasuje kilka silników (np. ogłoszenie podaje tylko „2.0”), pokaż listę do wyboru zamiast zgadywać.
- Jeśli modelu nie ma w bazie – raport mówi to wprost i korzysta tylko z ogólnych checklist.

### Zmiany kontraktu – runda 2 (`model.schema.json`)

Trzy nowe pola **opcjonalne w schemacie** (aplikacja musi działać bez nich), ale **wymagane progami jakości tej bazy** – walidator wymaga ich w każdym modelu:

```jsonc
"price_ranges": [            // 3–5 przedziałów po rocznikach, rosnąco, bez nakładania się
  { "years": [2015, 2016],   // roczniki objęte widełkami (włącznie), w zakresie years modelu
    "km_max": 200000,        // górna granica typowego przebiegu dla tych widełek
    "price_pln": [41000, 54000],  // typowe ceny ofertowe (Otomoto/OLX), stan dobry, bez wypadku
    "note": "2.0 TDI o ok. 10–15% drożej niż 1.6 TDI" }   // opcjonalnie: co przesuwa cenę
],
"running_costs": {
  "oc_ac_note": "OC zwykle ok. 600–1200 zł/rok; AC …",   // orientacyjnie: kierowca 35+, bez szkód
  "service_interval_km": 15000,                          // zalecany w praktyce interwał oleju (nie LongLife)
  "typical_parts_note": "…"                              // dostępność i ceny typowych części
},
"buy_advice": { "best_pick": "…", "avoid": "…", "sweet_spot_years": [2015, 2019] }
```

**Flaga „cena poniżej rynku”** (`cena-ponizej-widelek` w `red-flags.json`) działa na `price_ranges`:

1. Wybierz przedział, którego `years` obejmuje rocznik z ogłoszenia (rok produkcji; gdy jest tylko rok pierwszej rejestracji – użyj go).
2. Jeśli przebieg ≤ `km_max` i cena < `price_pln[0]` o więcej niż ok. 15% → zgłoś flagę z jej `neutral_wording`. Przy przebiegu > `km_max` niska cena bywa uzasadniona – co najwyżej łagodna wzmianka.
3. Jeśli jednocześnie trafiła flaga `stan-idealny` → zgłoś też `opis-idealny-cena-niska`.
4. Brak przedziału dla rocznika lub brak `price_ranges` → nie oceniaj ceny (nie zgaduj).

Widełki to **orientacyjne ceny ofertowe w Polsce w 2026 r.** dla typowych egzemplarzy (benzyna/diesel o średniej mocy, popularna wersja wyposażenia); `note` mówi, co je przesuwa (mocny silnik, 4x4, wersje sportowe – zwykle poza widełkami). Ceny trzeba okresowo kalibrować na danych z ogłoszeń. `market_note` zawiera skrót tych samych widełek tekstem.

### Czerwone flagi (`red-flags.json`)

- `patterns` to:
  - **zwykłe frazy** – małe litery, dopasowanie jako podciąg w tekście ogłoszenia zamienionym na małe litery; każda fraza z polskimi znakami ma też wariant bez nich;
  - **wyrażenia regularne** – zapisane jako `/wzorzec/flagi` (np. `/\busa\b/iu`); rozpoznawać po pierwszym `/` i ostatnim `/`, kompilować `new RegExp(wzorzec, flagi)`. Służą m.in. do pomijania zaprzeczeń („nie dymi”, „nie stuka”).
- **Puste `patterns`** oznaczają heurystykę do oceny przez model lub aplikację (zdjęcia, porównanie z parametrami, ofertami lub bazą): `przebieg-vs-stan`, `zdjecia-plac-komisu-ogloszenie-prywatne`, `rocznik-vs-wyposazenie`, `opis-vs-parametry`, a od rundy 2 także:
  - `cena-ponizej-widelek` i `opis-idealny-cena-niska` – liczone przez aplikację z `price_ranges` (patrz wyżej),
  - `przebieg-roczny-nietypowy` – przebieg / wiek auta poniżej ok. 6 tys. lub powyżej ok. 40 tys. km rocznie,
  - `vin-vs-model` – VIN wskazuje inną markę/rocznik niż ogłoszenie.
- Regexy obsługują formy męskie, żeńskie i nijakie („zalany/zalana/zalane”, „uszkodzony/…/uszkodzone”, „pierwsza właścicielka”) i zaprzeczenia („nie uszkodzone”, „bez rdzy”, „brak korozji”). Zamiast `\b` przy polskich literach używamy `(?<!\p{L})…(?!\p{L})` (`\b` w JS nie zna polskich znaków).
- Wzorce, które łatwo trafiają w środek innych słów, są regexami z granicami liter (np. `dawca` vs „sprzedawca”, `komis` vs „komisja”, `elka` vs „właścicielka”, `uk` vs „Ukraina”, `grad` vs „gradient”).
- **Flagi „braku”**: `brak-vin` należy też zgłosić, gdy w tekście nie ma 17-znakowego VIN-u, np. `/\b[a-hj-npr-z0-9]{17}\b/i` nie znajduje dopasowania. `tablice-zasloniete` ocenia głównie model wizyjny.
- Trafienie wzorca to **sygnał, nie werdykt**. W raporcie używaj wyłącznie `neutral_wording` i `question_for_seller`. Model powinien uwzględnić kontekst (np. „rozrząd wymieniony, faktura” lub „przegląd ważny do 05.2027” wyjaśnia flagę).
- `severity` (`niska`/`srednia`/`wysoka`) służy do sortowania; nie przedstawiaj go użytkownikowi jako oceny sprzedawcy.

### Pytania wg kategorii (`questions-by-category.json`)

`kategorie.<kategoria>` = `{ etykieta, pytania[5–8] }` dla każdej kategorii z `red-flags.schema.json`. Raport: dla kategorii trafionych flag dobierz 1–3 pytania, pomijając te, które już padły w `question_for_seller` trafionych flag i w `questions_for_seller` modelu (porównanie po znormalizowanym tekście), żeby pytania się nie powtarzały. Walidator pilnuje, by w pliku nie było duplikatów.

### Słowniczek (`glossary.json`)

Tablica `{ term, aliases[], category, short, explanation }` (schemat: `schema/glossary.schema.json`). `short` (≤ 120 znaków) do tooltipa, `explanation` – 2–3 zdania. Aliasy małymi literami; dopasowanie w tekście raportu jak dla aliasów modeli (granice liter), pierwsze wystąpienie w akapicie. Krótkie aliasy (`oc`, `ac`, `vin`, `gaz`) dopasowuj tylko jako osobne słowa. Kwoty i stawki (akcyza 3,1%/18,6%, PCC 2%, terminy 30 dni) są stanem na 2026 r. – przy zmianie przepisów trzeba je zaktualizować.

### Próbki Historii Pojazdu (`samples/cepik/`)

Sześć **fikcyjnych** tekstów naśladujących skopiowany wynik z gov.pl „Historia Pojazdu” (VIN-y zaczynają się od `TEST`, tablice `XX 0000n`, każdy plik ma nagłówek „DANE FIKCYJNE”). Układ i etykiety są **przybliżone** – służą do testów odporności parsera, nie jako wzorzec urzędowego dokumentu.

| Plik | Wariant |
|---|---|
| `a-pelny-wynik.txt` | pełny wynik („oś czasu”), rosnące przebiegi w schemacie badań 3–2–1, moc „150 KM” obok przebiegów (pułapka „KM” ≠ „km”), zaprzeczenie kradzieży |
| `b-cofniecie-licznika.txt` | lista „data – zdarzenie” (data przed opisem), import, spadek przebiegu o 43 600 km po zmianie właściciela |
| `c-przerwa-w-badaniach.txt` | tabela, przerwa w badaniach ok. 3 lat i 5 mies., okres bez OC |
| `d-import-pozna-rejestracja.txt` | pierwsza rejestracja za granicą 2013, w Polsce 2021, brak danych sprzed importu |
| `e-wklejone-z-telefonu.txt` | zlepione linie, separatory dat `/`, `-`, `.`, ISO, „r.”, kropka i spacja nierozdzielająca w liczbach, „74 120km”, tabulatory |
| `f-status-wyrejestrowany-kradziony.hipotetyczny.txt` | **hipotetyczny** – brzmienie komunikatów o kradzieży/odnalezieniu i wyrejestrowaniu niepotwierdzone w usłudze |

Każda próbka ma `<nazwa>.expected.json` (schemat `schema/cepik-sample.schema.json`): `odczyty [{data: "RRRR-MM-DD", km}]` (rosnąco po dacie), `pierwszaRejestracja`, `pierwszaRejestracjaPl` (null, gdy tekst tego nie rozstrzyga), `cofniecia [{z, na}]`, `sygnaly[]` (znormalizowane tagi, np. `cofniecie_przebiegu`, `import`, `przerwa_w_badaniach`, `kradziez_w_historii`, `wyrejestrowany`) oraz `uwagi[]` – komentarz autora próbki (co raport powinien zauważyć), nie dosłowny wynik parsera. Pliki z `.hipotetyczny.` w nazwie mają `hipotetyczny_format: true`.

### Checklisty i wzór umowy

Pliki Markdown są samodzielne i gotowe do druku (A4). Można je renderować w raporcie lub udostępniać do pobrania. Wzór umowy ma na górze zastrzeżenie „wzór, nie porada prawna” – nie usuwaj go.

## Jak dodać model

1. Utwórz `models/<marka>-<model>-<generacja>.json` (np. `mazda-6-gh.json`). Pole `id` = nazwa pliku bez `.json` (tylko `a-z`, `0-9`, `-`).
2. Wypełnij pola wg `schema/model.schema.json`. Minimalne wymagania jakości w tej bazie (sprawdza walidator, są ostrzejsze niż schemat):
   - co najmniej **3 silniki** (najpopularniejsze w Polsce; LPG jako osobny wpis z `fuel: "lpg"`, jeśli wersja z gazem jest częsta),
   - co najmniej **3 usterki na silnik**, `common_faults` (skrzynie, zawieszenie, elektryka, korozja),
   - co najmniej **6** `inspection_tips` i **5** `questions_for_seller`,
   - `price_ranges` (3–5 przedziałów), `running_costs` i `buy_advice` (patrz „Zmiany kontraktu – runda 2”),
   - `cost_pln` jako `[od, do]` w zł, niezależny warsztat, ceny bieżącego roku.
3. Każda usterka ma objawy, orientacyjny przebieg, koszt i **sposób sprawdzenia na oględzinach**.
4. Aliasy: małe litery, warianty z ogłoszeń (rzymskie i arabskie numery generacji, kody nadwozia, z polskimi znakami i bez). Nie dodawaj aliasów niejednoznacznych (np. samo `golf`, `duster 1`, `sportage 4` – kolizja z „1.5 dci” i „4x4”).
5. Uruchom walidację (niżej) i popraw błędy.

### Zasady treści

- Po polsku, konkretnie, bez lania wody.
- Pisz tylko to, co jest dobrze znane. Gdy usterka dotyczy części egzemplarzy – „zdarza się”, „bywa”, „w części wersji”. Nie wymyślaj kodów silników – lepiej podać rodzinę (np. „EA189”) niż zgadywać kod.
- Ton neutralny wobec sprzedawców, zero oskarżeń. Żadnych nazwisk, telefonów, linków do ogłoszeń, forów ani stron.
- `sources_note` – ogólnie („wiedza warsztatowa, zgłoszenia użytkowników, akcje serwisowe”), bez linków (walidator odrzuca linki w modelach).

## Walidacja

```bash
cd data
npm install          # jednorazowo: ajv + ajv-formats (node_modules jest w .gitignore)
npm run validate     # lub: node validate.mjs
```

Walidator sprawdza:

- zgodność każdego `models/*.json` z `schema/model.schema.json`, `red-flags.json` z `schema/red-flags.schema.json`, `questions-by-category.json`, `glossary.json` i `samples/cepik/*.expected.json` z ich schematami,
- zgodność nazwy pliku z `id` i unikalność `id`,
- unikalność aliasów modeli w całej bazie oraz brak niejednoznaczności przy zalecanym dopasowaniu z granicami słów,
- małe litery w aliasach i wzorcach, poprawność wyrażeń regularnych we flagach,
- progi jakości (silniki, usterki, wskazówki, pytania, min. 80 flag, każda z `neutral_wording` i `question_for_seller`), poprawność widełek kosztów, brak linków,
- `price_ranges`: 3–5 przedziałów w zakresie roczników modelu, rosnące i nienakładające się, realne ceny i `km_max` (ostrzeżenie, gdy nowsze roczniki są tańsze lub widełki bardzo szerokie); `running_costs` (interwał 5–40 tys. km) i `buy_advice` (`sweet_spot_years` w zakresie modelu),
- pytania wg kategorii: komplet kategorii z `red-flags.schema.json`, 5–8 pytań, bez duplikatów; słowniczek: min. 40 pojęć, unikalne nazwy, aliasy małymi literami,
- próbki CEPiK: min. 6, każda `.txt` ma `.expected.json` (i odwrotnie), oznaczenie „DANE FIKCYJNE”, fikcyjny VIN `TEST…` obecny w tekście, każdy oczekiwany odczyt występuje w tekście, `cofniecia` i sygnał `cofniecie_przebiegu` zgodne z odczytami, `hipotetyczny_format` zgodny z nazwą pliku,
- że **każdy** plik `*.json` w `data/` (poza `node_modules`) się parsuje,

oraz wypisuje statystyki (liczba modeli, modeli z widełkami cen i liczba przedziałów, silników wg paliwa, usterek, wskazówek, pytań, aliasów, flag wg kategorii, pytań wg kategorii, pojęć słowniczka, próbek CEPiK). Kod wyjścia `1` przy błędach – nadaje się do CI.
