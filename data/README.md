# Baza wiedzy – `data/`

Kuratorowana baza, z której korzysta aplikacja (`app/`). Model językowy dostaje **tylko** wpis z tej bazy dla rozpoznanego modelu i silnika i niczego nie dopisuje – dlatego treści są konkretne i ostrożnie sformułowane. Kontrakt danych opisują schematy w `schema/` (nie zmieniamy ich bez uzgodnienia z zespołem aplikacji).

## Struktura

```
data/
├── schema/                       # kontrakt (JSON Schema 2020-12) – tylko do odczytu
│   ├── model.schema.json
│   └── red-flags.schema.json
├── models/<id>.json              # 30 modeli: silniki, usterki, oględziny, pytania
├── red-flags.json                # heurystyki czerwonych flag w treści ogłoszenia
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

| id | Model | Silniki | Usterki |
|---|---|---|---|
| `audi-a4-b8` | Audi A4 B8 (2007–2015) | 4 | 22 |
| `bmw-3-e90` | BMW Seria 3 E90/E91/E92/E93 (2005–2013) | 4 | 21 |
| `bmw-3-f30` | BMW Seria 3 F30/F31 (2012–2019) | 5 | 22 |
| `bmw-5-f10` | BMW Seria 5 F10/F11 (2010–2017) | 4 | 20 |
| `dacia-duster-1` | Dacia Duster I (2010–2017) – SUV | 4 | 20 |
| `ford-focus-2` | Ford Focus II (2004–2011) | 5 | 24 |
| `ford-focus-3` | Ford Focus III (2010–2018) | 5 | 23 |
| `ford-mondeo-4` | Ford Mondeo IV (2007–2014) | 5 | 21 |
| `hyundai-i30-2` | Hyundai i30 II (GD, 2011–2017) | 4 | 19 |
| `kia-ceed-2` | Kia Ceed II (JD, 2012–2018) | 4 | 19 |
| `kia-sportage-4` | Kia Sportage IV (QL, 2015–2021) – SUV | 5 | 22 |
| `mercedes-c-w204` | Mercedes-Benz Klasa C W204 (2007–2014) | 4 | 20 |
| `nissan-qashqai-2` | Nissan Qashqai II (J11, 2013–2021) – SUV | 4 | 19 |
| `opel-astra-h` | Opel Astra H (2004–2014) | 5 | 24 |
| `opel-astra-j` | Opel Astra J (2009–2015) | 5 | 23 |
| `opel-insignia-a` | Opel Insignia A (2008–2017) | 4 | 22 |
| `peugeot-308-2` | Peugeot 308 II (T9, 2013–2021) | 5 | 24 |
| `renault-clio-4` | Renault Clio IV (2012–2019) | 4 | 19 |
| `renault-megane-3` | Renault Megane III (2008–2016) | 5 | 24 |
| `skoda-fabia-2` | Škoda Fabia II (2007–2014) | 5 | 21 |
| `skoda-octavia-2` | Škoda Octavia II (2004–2013) | 7 | 31 |
| `skoda-octavia-3` | Škoda Octavia III (2012–2020) | 6 | 25 |
| `toyota-auris-2` | Toyota Auris II (E180, 2012–2018) | 5 | 22 |
| `toyota-avensis-t27` | Toyota Avensis T27 (2009–2018) | 5 | 22 |
| `toyota-yaris-3` | Toyota Yaris III (XP130, 2011–2020) | 4 | 17 |
| `vw-golf-6` | Volkswagen Golf VI (2008–2013) | 5 | 23 |
| `vw-golf-7` | Volkswagen Golf VII (2012–2020) | 5 | 21 |
| `vw-passat-b7` | Volkswagen Passat B7 (2010–2014) | 4 | 21 |
| `vw-passat-b8` | Volkswagen Passat B8 (2014–2023) | 5 | 21 |
| `vw-tiguan-1` | Volkswagen Tiguan I (2007–2016) – SUV | 3 | 15 |

Aktualne statystyki zawsze wypisuje `node validate.mjs`.

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

### Czerwone flagi (`red-flags.json`)

- `patterns` to:
  - **zwykłe frazy** – małe litery, dopasowanie jako podciąg w tekście ogłoszenia zamienionym na małe litery; każda fraza z polskimi znakami ma też wariant bez nich;
  - **wyrażenia regularne** – zapisane jako `/wzorzec/flagi` (np. `/\busa\b/iu`); rozpoznawać po pierwszym `/` i ostatnim `/`, kompilować `new RegExp(wzorzec, flagi)`. Służą m.in. do pomijania zaprzeczeń („nie dymi”, „nie stuka”).
- **Puste `patterns`** oznaczają heurystykę do oceny przez model (zdjęcia, porównanie z parametrami lub ofertami): `przebieg-vs-stan`, `zdjecia-plac-komisu-ogloszenie-prywatne`, `rocznik-vs-wyposazenie`, `opis-vs-parametry`. Przekaż je modelowi jako listę rzeczy do sprawdzenia.
- **Flagi „braku”**: `brak-vin` należy też zgłosić, gdy w tekście nie ma 17-znakowego VIN-u, np. `/\b[a-hj-npr-z0-9]{17}\b/i` nie znajduje dopasowania. `tablice-zasloniete` ocenia głównie model wizyjny.
- Trafienie wzorca to **sygnał, nie werdykt**. W raporcie używaj wyłącznie `neutral_wording` i `question_for_seller`. Model powinien uwzględnić kontekst (np. „rozrząd wymieniony, faktura” lub „przegląd ważny do 05.2027” wyjaśnia flagę).
- `severity` (`niska`/`srednia`/`wysoka`) służy do sortowania; nie przedstawiaj go użytkownikowi jako oceny sprzedawcy.

### Checklisty i wzór umowy

Pliki Markdown są samodzielne i gotowe do druku (A4). Można je renderować w raporcie lub udostępniać do pobrania. Wzór umowy ma na górze zastrzeżenie „wzór, nie porada prawna” – nie usuwaj go.

## Jak dodać model

1. Utwórz `models/<marka>-<model>-<generacja>.json` (np. `mazda-6-gh.json`). Pole `id` = nazwa pliku bez `.json` (tylko `a-z`, `0-9`, `-`).
2. Wypełnij pola wg `schema/model.schema.json`. Minimalne wymagania jakości w tej bazie (sprawdza walidator, są ostrzejsze niż schemat):
   - co najmniej **3 silniki** (najpopularniejsze w Polsce; LPG jako osobny wpis z `fuel: "lpg"`, jeśli wersja z gazem jest częsta),
   - co najmniej **3 usterki na silnik**, `common_faults` (skrzynie, zawieszenie, elektryka, korozja),
   - co najmniej **6** `inspection_tips` i **5** `questions_for_seller`,
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

- zgodność każdego `models/*.json` z `schema/model.schema.json` i `red-flags.json` z `schema/red-flags.schema.json`,
- zgodność nazwy pliku z `id` i unikalność `id`,
- unikalność aliasów modeli w całej bazie oraz brak niejednoznaczności przy zalecanym dopasowaniu z granicami słów,
- małe litery w aliasach i wzorcach, poprawność wyrażeń regularnych we flagach,
- progi jakości (silniki, usterki, wskazówki, pytania, min. 40 flag), poprawność widełek kosztów, brak linków,

oraz wypisuje statystyki (liczba modeli, silników wg paliwa, usterek, wskazówek, pytań, aliasów, flag wg kategorii). Kod wyjścia `1` przy błędach – nadaje się do CI.
