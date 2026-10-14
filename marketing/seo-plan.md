# Plan SEO – podstrony „typowe usterki [model]” generowane z bazy

Cel: darmowy ruch od osób, które **już wybrały model i oglądają konkretne ogłoszenia**. Taka osoba szuka „golf 7 1.4 tsi usterki” albo „octavia 3 2.0 tdi na co uważać” – jest kilka dni od zakupu, a nasz raport za 19 zł to dla niej naturalny następny krok.

Źródło treści: wpisy w `data/` (schemat: `data/schema/model.schema.json`). Jedna podstrona = jeden plik modelu (generacji). Strony generuje aplikacja w czasie budowania – bez ręcznego pisania.

---

## 1. Struktura adresów

- `/usterki` – indeks: lista marek i modeli, wyszukiwarka.
- `/usterki/{id}` – strona modelu/generacji, np. `/usterki/vw-golf-7` (`id` z bazy).
- Silniki – na start jako sekcje z kotwicami na stronie modelu (`/usterki/vw-golf-7#silnik-1-4-tsi`). Osobne podstrony silników (`/usterki/vw-golf-7/1-4-tsi`) dopiero, gdy Search Console pokaże, że frazy z silnikiem przynoszą wyświetlenia, a wpis ma dość treści (min. 4 usterki), by nie była to „cienka” strona.
- `/blog/{slug}` – artykuły poradnikowe (sekcja 5).

## 2. Szablon podstrony modelu

### Meta

| Element | Szablon | Przykład |
|---|---|---|
| `<title>` (do ~60 znaków) | `{make} {model} {generation_short} – typowe usterki i na co uważać` | `VW Golf VII – typowe usterki i na co uważać` |
| meta description (do ~155 znaków) | `Typowe usterki {make} {model} ({years}): {top 2 usterki}. Koszty napraw, pytania do sprzedawcy i checklista oględzin.` | `Typowe usterki VW Golf VII (2012–2020): rozrząd 1.4 TSI, DSG7. Koszty napraw, pytania do sprzedawcy i checklista oględzin.` |
| canonical | adres własny strony | – |
| Open Graph | tytuł + opis jw., obraz: generowana grafika z nazwą modelu (bez zdjęć aut z ogłoszeń) | – |

### Sekcje strony (kolejność)

1. **H1:** `{make} {model} {generation} – typowe usterki i na co uważać przy zakupie`
2. **Lead (2–4 zdania)** – pole `summary`. Pod spodem data „Ostatnia aktualizacja: …” i krótka informacja, skąd wiedza (`sources_note`).
3. **CTA nr 1 (nad zgięciem):** pole na wklejenie ogłoszenia + przycisk „Sprawdź konkretne ogłoszenie – szybkie sprawdzenie za darmo”.
4. **H2: Który silnik wybrać** – tabela silników: kod, paliwo, moc, rozrząd (`timing`), werdykt (`polecany` / `neutralny` / `ryzykowny` – jako etykiety z krótkim uzasadnieniem, bez straszenia).
5. **H2: Typowe usterki – silniki** – dla każdego silnika H3 z nazwą i lista usterek: tytuł, objawy, przebieg, waga, koszt naprawy (widełki w zł), jak sprawdzić na oględzinach.
6. **H2: Usterki niezależne od silnika** – `common_faults` (zawieszenie, elektryka, skrzynie, korozja).
7. **H2: Na co patrzeć na oględzinach** – `inspection_tips` jako checklista.
8. **H2: O co zapytać sprzedawcę** – `questions_for_seller`.
9. **H2: Sytuacja rynkowa** – `market_note` (jeśli jest).
10. **CTA nr 2:** „Masz już upatrzone ogłoszenie? Wklej je – sprawdzimy, czy nic w nim nie wymaga wyjaśnienia.” + link do przykładowego raportu.
11. **H2: Najczęstsze pytania (FAQ)** – 4–6 pytań generowanych z danych (szablony niżej).
12. **Powiązane modele** – sekcja linkowania (punkt 4).
13. Krótki disclaimer: „Opis dotyczy typowych usterek modelu, nie konkretnego egzemplarza. Przed zakupem zleć oględziny mechanikowi.”

### Szablony pytań FAQ

- „Jaki silnik wybrać w {model} {generation}?” → silniki z werdyktem `polecany` + jedno zdanie.
- „Czy {model} z silnikiem {ryzykowny silnik} to dobry wybór?” → najważniejsza usterka i jak ją sprawdzić.
- „Ile kosztuje naprawa {najdroższa usterka} w {model}?” → widełki `cost_pln`.
- „Na co zwrócić uwagę na jeździe próbnej {model}?” → 3 pierwsze `inspection_tips`.
- „O co zapytać sprzedawcę {model}?” → 3 pierwsze `questions_for_seller`.

### Dane strukturalne (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Jaki silnik wybrać w VW Golf VII?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Treść odpowiedzi wygenerowana z pól engines[].verdict i summary."
      }
    }
  ]
}
```

Dodatkowo `BreadcrumbList` (Strona główna → Usterki → Marka → Model). Uwaga: Google od 2023 r. pokazuje rozszerzone wyniki FAQ głównie dla serwisów rządowych i medycznych, więc nie liczymy na „rozwijane pytania” w wynikach. Znacznik FAQ zostawiamy, bo pomaga innym wyszukiwarkom i narzędziom AI rozumieć strukturę, a nic nie kosztuje. Treść FAQ musi być widoczna na stronie.

### Zasady jakości

- Nie publikujemy strony, jeśli wpis ma mniej niż 2 silniki lub mniej niż 6 usterek łącznie – generator ustawia wtedy `noindex`.
- Treść pochodzi wyłącznie z bazy, bez dopisywania przez model językowy w locie (spójność z raportem i brak halucynacji).
- Żadnych zdjęć z cudzych ogłoszeń. Grafiki – własne, generowane z tekstu.
- Data aktualizacji zmienia się tylko przy faktycznej zmianie wpisu.
- Raporty klientów (`/raport/...`) – zawsze `noindex` i wykluczone w `robots.txt`.

## 3. 30 słów kluczowych z intencją zakupową

Wolumeny i trudność – do zweryfikowania w narzędziu (Google Keyword Planner, Senuto lub podobne) przed priorytetyzacją. Lista modeli musi odpowiadać wpisom w `data/` – po zakończeniu bazy uzgodnić i podmienić frazy dla modeli, których nie ma.

| # | Fraza | Intencja | Strona docelowa |
|---|---|---|---|
| 1 | golf 7 1.4 tsi usterki | wybiera silnik przed zakupem | /usterki/vw-golf-7#silnik-1-4-tsi |
| 2 | golf 7 1.6 tdi opinie | ocenia konkretną wersję | /usterki/vw-golf-7 |
| 3 | skoda octavia 3 2.0 tdi na co uważać | ogląda ogłoszenia | /usterki/skoda-octavia-3 |
| 4 | octavia 3 1.4 tsi czy warto kupić | decyzja zakupowa | /usterki/skoda-octavia-3 |
| 5 | passat b8 2.0 tdi usterki | wybiera silnik | /usterki/vw-passat-b8 |
| 6 | passat b7 kupno na co zwrócić uwagę | oględziny | /usterki/vw-passat-b7 |
| 7 | toyota corolla e21 hybryda używana co sprawdzić | oględziny | /usterki/toyota-corolla-e21 |
| 8 | toyota auris 2 hybryda opinie usterki | wybór modelu | /usterki/toyota-auris-2 |
| 9 | opel astra k 1.4 turbo usterki | wybór silnika | /usterki/opel-astra-k |
| 10 | opel astra j 1.7 cdti na co uważać | oględziny | /usterki/opel-astra-j |
| 11 | ford focus mk3 1.0 ecoboost czy kupić | decyzja (silnik o złej reputacji) | /usterki/ford-focus-3 |
| 12 | ford focus mk3 1.6 tdci usterki | wybór silnika | /usterki/ford-focus-3 |
| 13 | audi a4 b8 2.0 tdi kupno | decyzja zakupowa | /usterki/audi-a4-b8 |
| 14 | audi a4 b8 2.0 tfsi olej | znany problem (zużycie oleju) | /usterki/audi-a4-b8 |
| 15 | audi a3 8v używane na co zwrócić uwagę | oględziny | /usterki/audi-a3-8v |
| 16 | bmw f30 320d usterki | wybór wersji | /usterki/bmw-3-f30 |
| 17 | bmw e90 kupno na co uważać | oględziny | /usterki/bmw-3-e90 |
| 18 | skoda fabia 3 1.2 tsi usterki | wybór silnika | /usterki/skoda-fabia-3 |
| 19 | renault clio 4 0.9 tce opinie | decyzja zakupowa | /usterki/renault-clio-4 |
| 20 | renault megane 3 1.5 dci na co uważać | oględziny | /usterki/renault-megane-3 |
| 21 | toyota yaris 3 używana co sprawdzić | oględziny | /usterki/toyota-yaris-3 |
| 22 | hyundai i30 2 1.6 crdi usterki | wybór silnika | /usterki/hyundai-i30-2 |
| 23 | kia ceed 2 używana opinie | wybór modelu | /usterki/kia-ceed-2 |
| 24 | kia sportage 4 1.6 t-gdi usterki | wybór silnika | /usterki/kia-sportage-4 |
| 25 | nissan qashqai j11 1.2 dig-t czy kupić | decyzja (silnik o złej reputacji) | /usterki/nissan-qashqai-j11 |
| 26 | mercedes c w205 używany na co uważać | oględziny | /usterki/mercedes-c-w205 |
| 27 | peugeot 308 2 1.2 puretech pasek rozrządu | znany problem | /usterki/peugeot-308-2 |
| 28 | opel insignia 2.0 cdti usterki | wybór silnika | /usterki/opel-insignia-a |
| 29 | mazda 6 gj 2.2 skyactiv-d opinie | decyzja zakupowa | /usterki/mazda-6-gj |
| 30 | dacia duster 1.5 dci używana co sprawdzić | oględziny | /usterki/dacia-duster-1 |

Frazy ogólne (bez modelu), na które celujemy artykułami blogowymi: „jak sprawdzić auto przed zakupem”, „historia pojazdu jak czytać”, „cofnięty licznik jak sprawdzić”, „auto z niemiec co sprawdzić”, „pytania do sprzedawcy samochodu”.

## 4. Linkowanie wewnętrzne

1. **Indeks `/usterki`** linkuje do wszystkich modeli; strona główna linkuje do indeksu i do 6–8 najpopularniejszych modeli.
2. **Strona modelu → modele powiązane (3–5 linków):** ta sama marka/platforma (Golf ↔ Octavia ↔ Leon ↔ A3), konkurenci w segmencie (Golf ↔ Astra ↔ Focus ↔ i30), poprzednia/następna generacja (Passat B7 ↔ B8). Lista generowana automatycznie z pól marki i segmentu (segment trzeba dopisać do bazy lub do pliku konfiguracyjnego SEO – uzgodnić z autorem `data/`).
3. **Strona modelu → blog:** kontekstowo, np. przy usterce skrzyni DSG link do artykułu „DSG – czy się bać”, przy sekcji o przebiegu – do „Jak czytać Historię Pojazdu”.
4. **Blog → strony modeli:** każdy artykuł linkuje do 3–6 stron modeli, których dotyczy (np. artykuł o DSG → Golf, Octavia, Passat, A3).
5. **Raport → strona modelu:** w raporcie link „Wszystkie typowe usterki tego modelu” (raport jest `noindex`, ale link pomaga klientowi i wraca ruch).
6. **Okruszki (breadcrumbs)** na każdej stronie: Usterki → Marka → Model.
7. Anchory opisowe („typowe usterki Skody Octavii III”), nie „kliknij tutaj”. Bez nadmiaru dokładnych dopasowań.
8. Brak stron osieroconych: generator sprawdza, że każda podstrona ma co najmniej 3 linki przychodzące.

## 5. 10 tematów artykułów blogowych

| # | Tytuł roboczy | Fraza główna | Kluczowa treść | Linki do |
|---|---|---|---|---|
| 1 | Jak czytać Historię Pojazdu – przebiegi, właściciele, badania krok po kroku | historia pojazdu jak czytać | jakie dane są potrzebne (VIN, numer rejestracyjny, data pierwszej rejestracji), co oznaczają poszczególne sekcje, jak wyłapać niespójny przebieg, czego tam nie ma | narzędzie (wklej wynik) |
| 2 | Auto z Niemiec – co sprawdzić, zanim zapłacisz | auto z niemiec co sprawdzić | dokumenty, historia z zagranicy, „sprowadzony, opłacony” – co to znaczy, typowe pytania | carVertical/autoDNA (afiliacja, oznaczona) |
| 3 | DSG – czy się bać? Mokra i sucha skrzynia w praktyce | dsg czy się bać | różnice między wersjami, objawy na jeździe próbnej, koszty, serwis oleju | Golf, Octavia, Passat, A3 |
| 4 | Cofnięty licznik – 7 sposobów, żeby to sprawdzić bez specjalistycznego sprzętu | cofnięty licznik jak sprawdzić | historia badań, zużycie kierownicy/pedałów/fotela, serwis, faktury | narzędzie |
| 5 | 25 pytań do sprzedawcy używanego auta (i co znaczą odpowiedzi) | pytania do sprzedawcy samochodu | lista z interpretacją, jak pytać na piśmie | strony modeli |
| 6 | Oględziny auta krok po kroku – checklista do wydrukowania | oględziny samochodu checklista | lakier, szczeliny, zimny start, jazda próbna, dokumenty | narzędzie, PDF |
| 7 | Zaliczka za auto przed obejrzeniem – kiedy to ryzyko | zaliczka za samochód | dlaczego nie płacić przed oględzinami, bezpieczne formy płatności, umowa | wzór umowy |
| 8 | Umowa kupna-sprzedaży samochodu – wzór i najczęstsze błędy | umowa kupna sprzedaży samochodu wzór | co wpisać, współwłaściciele, PCC, zgłoszenie w urzędzie | wzór (pakiet 29 zł) |
| 9 | Hybryda Toyoty z drugiej ręki – bateria, falownik, na co patrzeć | używana hybryda toyota co sprawdzić | stan baterii, serwis, objawy | Auris, Corolla, Yaris, RAV4 |
| 10 | 1.2 PureTech, 1.0 EcoBoost, 1.2 DIG-T – małe benzyny turbo z trudną reputacją: jak sprawdzić konkretny egzemplarz | silniki z problemami lista | konkretne problemy, jak zweryfikować historię serwisową, kiedy egzemplarz może być OK | Peugeot 308, Focus, Qashqai |

Rytm: 1 artykuł tygodniowo przez pierwsze 10 tygodni. Każdy artykuł kończy się CTA „Sprawdź konkretne ogłoszenie” i ma sekcję „Powiązane modele”.

## 6. Pomiar

- Google Search Console od pierwszego dnia: wyświetlenia i kliknięcia per podstrona, frazy z silnikiem (decyzja o osobnych stronach silników).
- Konwersja: kliknięcia CTA na stronie modelu → darmowe sprawdzenie → płatny raport (zdarzenia w analityce zgodnej z polityką prywatności).
- Przegląd co 2 tygodnie: strony z wyświetleniami i niskim CTR → poprawa `title`/`description`; strony bez wyświetleń po 8 tygodniach → sprawdzić indeksację i linkowanie.
