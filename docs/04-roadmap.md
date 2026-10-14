# Roadmapa po MVP

Data: 2026-10-14. Kolejność według **wartości dla klienta** (kupującego używane auto), nie według łatwości wdrożenia. Szacunki kosztu to dni pracy jednego programisty plus koszty zewnętrzne – orientacyjnie, do weryfikacji przy planowaniu sprintu. „Kiedy” zakłada start publiczny MVP w listopadzie 2026 r. i podejmowanie decyzji na podstawie danych (liczba raportów, konwersja szybki test → płatny raport, zgłoszenia klientów).

## Podsumowanie

| # | Funkcja | Wartość dla klienta | Koszt | Ryzyko | Kiedy |
|---|---|---|---|---|---|
| 1 | OCR VIN z tabliczki / dowodu / zdjęcia spod szyby | Wysoka | Niski (3–5 dni) | Niskie–średnie | Zaraz po MVP (grudzień 2026) |
| 2 | Raport PDF generowany serwerowo | Średnia | Niski–średni (3–6 dni) | Niskie | Gdy ≥10% klientów drukuje / prosi o PDF; najpóźniej I kw. 2027 |
| 3 | Marketplace mechaników do oględzin (prowizja) | Wysoka | Wysoki | Wysokie | Pilot w 1 mieście: II kw. 2027 |
| 4 | Wersja EN/DE dla importu | Średnia–wysoka (dla segmentu) | Średni | Średnie | II–III kw. 2027, po potwierdzeniu popytu |
| 5 | Wersja dla sprzedających i dealerów („audyt własnego ogłoszenia”) | Pośrednia (lepsze ogłoszenia) | Średni | Średnie (wizerunek) | III kw. 2027 |
| 6 | API dla portali | Pośrednia | Średni + sprzedaż | Średnie–wysokie | Najwcześniej 2028, po dowodach jakości |
| – | Powiadomienia o nowych ogłoszeniach | – | – | **Nie robimy** | – |

---

## 1. Odczyt VIN ze zdjęcia (rozszerzenie OCR zdjęć)

**Co:** klient dodaje zdjęcie tabliczki znamionowej, VIN-u spod przedniej szyby, fragmentu dowodu rejestracyjnego (za zgodą sprzedawcy, z zasłoniętymi danymi osobowymi) albo zdjęcie z ogłoszenia, na którym widać VIN. Model wizyjny odczytuje 17 znaków, a system:
- sprawdza format (bez liter I, O, Q; 17 znaków) i dekoduje prefiks producenta (WMI) – czy pasuje do marki z ogłoszenia;
- porównuje VIN z tekstu ogłoszenia z VIN-em ze zdjęcia (rozbieżność = flaga „do wyjaśnienia”);
- wstawia VIN do instrukcji Historii Pojazdu („brakuje Ci jeszcze numeru rejestracyjnego i daty pierwszej rejestracji”).

**Wartość:** największa przeszkoda w lejku to brak VIN. Odczyt ze zdjęcia skraca drogę do bezpłatnej Historii Pojazdu i do raportu historii z zagranicy (afiliacja). Na oględzinach: szybkie porównanie VIN z dokumentów i z tabliczki.

**Koszt:** niski – model wizyjny już jest w raporcie; dochodzi prompt, walidacja, UI (3–5 dni). Koszt tokenów: jedno małe zdjęcie na raport.

**Ryzyko:** błędny odczyt (0↔O, 8↔B) – zawsze pokazujemy odczyt do potwierdzenia przez klienta, nigdy nie wnioskujemy z niego automatycznie. VIN w połączeniu z numerem rejestracyjnym może pozwalać pośrednio ustalić właściciela – traktujemy go jak dane wrażliwe dla prywatności: nie publikujemy, kasujemy po 30 dniach z raportem, nie łączymy z innymi źródłami. **Do weryfikacji prawnej:** status VIN-u w polityce prywatności.

**Kiedy:** pierwszy sprint po starcie (grudzień 2026).

---

## 2. Raport PDF generowany serwerowo

**Co:** przycisk „Pobierz PDF” – identyczny wygląd na każdym urządzeniu, do wysłania mechanikowi lub wydruku. Dziś jest wersja do druku (CSS print), co na telefonie bywa niewygodne.

**Wartość:** średnia. Pomaga w dzieleniu się raportem i w trybie offline na oględzinach. Ułatwia też zwrotny przepływ do mechanika (punkt 3).

**Koszt:** 3–6 dni. Dwie drogi: przeglądarka bezgłowa (Chromium/Playwright) w kontenerze – prosty kod, ale +ok. kilkaset MB obrazu i więcej RAM na VPS; albo biblioteka składająca PDF z danych (bez przeglądarki) – lżejsza, ale osobny szablon do utrzymania. Rekomendacja: biblioteka z danych, bo raport ma stały schemat JSON.

**Ryzyko:** niskie. PDF krąży poza naszą kontrolą – w stopce zawsze disclaimer, data i informacja „wygenerowano automatycznie”. PDF generowany na żądanie, nie składowany trwale.

**Kiedy:** gdy z analityki wynika, że ≥10% klientów używa wersji do druku albo pisze o PDF; najpóźniej I kw. 2027.

---

## 3. Marketplace mechaników do oględzin (z prowizją)

**Co:** po raporcie przycisk „Umów oględziny” – lista sprawdzonych mechaników mobilnych i warsztatów w okolicy auta, z ceną i terminem. Mechanik dostaje checklistę z raportu. Serwis pobiera prowizję lub opłatę za lead.

**Wartość:** wysoka. Raport zawsze kończy się zaleceniem „pokaż auto mechanikowi” – a klient zwykle nie wie, kogo wybrać, szczególnie gdy auto jest 200 km dalej. Rynek: średnio ok. 330–550 zł za sprawdzenie (szczegóły: `docs/03-analiza-konkurencji.md`).

**Koszt:** wysoki. Pozyskanie i weryfikacja mechaników (strona podaży), obsługa terminów, reklamacje, rozliczenia (przy płatności przez nas – Stripe Connect i weryfikacja tożsamości partnerów), regulamin dla partnerów.

**Ryzyko:** wysokie. (1) Jakość – zły mechanik obciąża naszą markę. (2) Konflikt interesów – mechanik z prowizją od nas nie może być „naszym rzeczoznawcą”; musi być niezależny i sam odpowiadać za swoją usługę. (3) Prawo – pośrednictwo w usługach, odpowiedzialność za polecenie, przetwarzanie danych klienta przez partnera (umowa powierzenia lub współadministrowanie). **Do weryfikacji prawnej.**

**Kiedy:** pilot w jednym dużym mieście w II kw. 2027 w najprostszej formie: lista 5–10 partnerów, rezerwacja bezpośrednio u nich, prowizja za lead, bez obsługi płatności. Pełny marketplace – dopiero gdy pilot pokaże, że klienci z niego korzystają i są zadowoleni.

---

## 4. Wersja EN/DE dla importu

**Co:** analiza ogłoszeń z niemieckich portali (opis po niemiecku) z raportem po polsku – dla osób, które same sprowadzają auto. W drugim kroku interfejs po angielsku (np. dla obcokrajowców kupujących auto w Polsce).

**Wartość:** średnia–wysoka dla segmentu „sprowadzam sam”: niemieckie zwroty z ogłoszeń, dokumenty (Zulassungsbescheinigung Teil I/II), raporty z przeglądów HU, koszty akcyzy i rejestracji w Polsce w jednym miejscu.

**Koszt:** średni. Model językowy czyta niemiecki bez zmian, ale potrzebne są: niemiecka lista sygnałów do wyjaśnienia (osobny plik w `data/`), aliasy modeli w nazewnictwie niemieckim, instrukcja dokumentów importowych, teksty UI i SEO w nowym języku. Baza usterek zostaje ta sama.

**Ryzyko:** średnie. Inne realia prawne (sprzedaż w Niemczech, rękojmia, Händler vs. Privat) – nie wolno przenosić polskich porad 1:1. Konkurencja raportów historii jest tam silniejsza.

**Kiedy:** II–III kw. 2027, po potwierdzeniu popytu (np. udział ogłoszeń z frazami „sprowadzony”, „do rejestracji” w szybkich testach i pytania klientów).

---

## 5. Wersja dla sprzedających i dealerów – „audyt własnego ogłoszenia”

**Co:** sprzedawca wkleja swoje ogłoszenie i widzi, co kupujący prawdopodobnie zapyta: brak VIN, brak informacji o rozrządzie, rozbieżność opis–zdjęcia, zwroty, które budzą pytania. Dostaje sugestie: „dodaj zdjęcie faktury za rozrząd”, „podaj VIN”, „opisz lakierowane elementy”.

**Wartość dla kupującego:** pośrednia, ale realna – lepsze, pełniejsze ogłoszenia oznaczają mniej pytań i mniej zmarnowanych wyjazdów. Dla sprzedawcy: szybsza sprzedaż. Nowy segment przychodu (dealerzy – abonament).

**Koszt:** średni. Ten sam silnik i baza; inny prompt („co uzupełnić”), inny widok, cennik B2B, faktury.

**Ryzyko:** średnie, głównie wizerunkowe. Kupujący nie może odnieść wrażenia, że „sprawdzamy na zlecenie sprzedawcy”. Zasady: (1) żadnych odznak typu „zweryfikowane przez nas” w ogłoszeniach – audyt dotyczy treści, nie auta; (2) audyt nie zmienia wyniku raportu kupującego; (3) osobna nazwa produktu i jasna informacja na stronie.

**Kiedy:** III kw. 2027, gdy produkt dla kupujących ma stabilną jakość.

---

## 6. API dla portali

**Co:** portal ogłoszeniowy lub komis wywołuje nasze API i pokazuje przy ogłoszeniu „rzeczy, o które warto zapytać” albo przycisk „sprawdź to ogłoszenie”.

**Wartość dla klienta:** pośrednia – analiza w miejscu, gdzie klient już jest. Dla nas: zasięg i przychód B2B.

**Koszt:** średni technicznie (uwierzytelnianie, limity, wersjonowanie schematu, SLA), wysoki sprzedażowo (długi cykl decyzji po stronie portali).

**Ryzyko:** średnie–wysokie. Zależność od jednego dużego klienta; portal może zbudować podobną funkcję sam (patrz bezpłatna weryfikacja historii na Automarket.pl z autoDNA, `docs/03-analiza-konkurencji.md`); presja, żeby łagodzić flagi w ogłoszeniach płacących klientów portalu – nie do przyjęcia, musi to wykluczać umowa.

**Kiedy:** najwcześniej 2028, gdy będziemy mieć twarde dane o jakości (np. odsetek flag potwierdzonych przez kupujących z pętli „czy kupiłeś?”).

---

## Nie robimy: powiadomienia o nowych ogłoszeniach

**Pomysł:** „Ustaw wyszukiwanie, a my powiadomimy cię o nowych ogłoszeniach Golfa VII i od razu je sprawdzimy.”

**Dlaczego nie:**

1. **Regulaminy portali.** Monitorowanie nowych ogłoszeń wymaga automatycznego, systematycznego pobierania treści z portali (scraping). Duże serwisy internetowe zwykle wprost zakazują w regulaminach automatycznego pobierania i eksploracji danych bez zgody (przykład: zastrzeżenie w stopce serwisów Ringier Axel Springer Polska, np. [Auto Świat](https://www.auto-swiat.pl/moto-awards-2023/), zakazuje scrapingu i eksploracji tekstu i danych bez zgody wydawcy). Naruszenie regulaminu, który się zaakceptowało, może rodzić odpowiedzialność cywilną ([omówienie prawne](https://monolith.law/pl/?p=59821)). Regulaminy Otomoto i OLX trzeba sprawdzić u źródła – ale nawet bez wyraźnego zakazu ryzyko blokad i sporu jest wysokie.
2. **Ochrona baz danych.** Zbiór ogłoszeń portalu może być chroniony jako baza danych (prawo sui generis producenta bazy) – systematyczne pobieranie istotnej części to ryzyko prawne niezależnie od regulaminu.
3. **RODO.** Ogłoszenia prywatne zawierają dane osobowe sprzedawców. Pobieranie ich hurtem, bez wiedzy sprzedawców, łamie naszą zasadę „analizujemy tylko to, co wkleił klient” i wymagałoby osobnej podstawy prawnej.
4. **Zaufanie.** Naszą przewagą jest to, że działamy po stronie kupującego, na jego zlecenie i na jego danych. Robot przeszukujący portale to inny produkt i inna relacja z portalami, od których zależy nasz ruch.

**Co zamiast tego:** (a) w poradniku i e-mailu podpowiadamy, jak ustawić **wbudowane alerty** w portalach (zapisane wyszukiwania); (b) kupujący wkleja do nas ogłoszenie, gdy znajdzie coś ciekawego – szybki test jest za darmo i natychmiast; (c) jeśli kiedyś – tylko na podstawie umowy z portalem (punkt 6).

---

## Rzeczy mniejsze, warte zrobienia po drodze

Pomysły z analizy konkurencji (`docs/03-analiza-konkurencji.md`, sekcja 6), tańsze niż powyższe:

- **Gotowa wiadomość do sprzedawcy** (kopiuj do SMS/komunikatora) – 1–2 dni, wysoka wartość.
- **Budżet na pierwszy rok** (cena + typowe naprawy wg przebiegu z bazy) – 2–3 dni.
- **Tryb „na oględzinach”** (checklista do odhaczania offline) – 3–5 dni.
- **Porównanie 2–3 kandydatów** – po wdrożeniu kuponu 5 raportów, 4–6 dni.
