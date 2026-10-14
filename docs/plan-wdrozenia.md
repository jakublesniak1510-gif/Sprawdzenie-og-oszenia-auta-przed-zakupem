# Plan wdrożenia MVP – 3 tygodnie, jedna osoba

Założenia: jedna osoba, ok. 6–8 godzin dziennie w dni robocze, weekendy jako bufor. Kod aplikacji powstaje w `app/` (instrukcja uruchomienia: `app/README.md`), baza wiedzy w `data/`. Ten plan nie powtarza komend – odsyła do tamtych plików.

Cel na koniec 3. tygodnia: działająca strona pod własną domeną, płatności BLIK/P24/karta, regulamin i polityka opublikowane, 20 ogłoszeń przetestowanych z wynikiem „go”, pierwsze materiały marketingowe opublikowane.

---

## Tydzień 1 – baza wiedzy i aplikacja lokalnie

| Dzień | Zadania | Wynik na koniec dnia |
|---|---|---|
| 1 (pon) | Uruchomić aplikację lokalnie wg `app/README.md`. Założyć konto Anthropic API, ustawić limit wydatków miesięcznych (np. 50 USD) i klucz w zmiennych środowiskowych. Przejrzeć schemat `data/schema/`. | Aplikacja startuje lokalnie z `DEV_SKIP_PAYMENT`, pierwszy raport z przykładowego ogłoszenia. |
| 2 (wt) | Przegląd bazy usterek (`data/`): wybrać 10 najpopularniejszych modeli i przeczytać każdy wpis – czy koszty napraw są realne, czy sformułowania nie oskarżają. Lista poprawek dla autora bazy. | Lista poprawek do bazy, 10 wpisów zaakceptowanych. |
| 3 (śr) | Pozostałe 20 wpisów bazy – ta sama procedura. Sprawdzić aliasy (jak ludzie piszą model w ogłoszeniach: „golf 7”, „golf VII”, „mk7”). | 30 wpisów zaakceptowanych lub z listą poprawek. |
| 4 (czw) | Test anonimizacji: 15 próbek tekstu z różnymi formatami telefonów (+48, spacje, myślniki, „sześćset…”), e-maili, numerów rejestracyjnych. Sprawdzić, że oryginał nie ląduje w bazie ani w logach. Sprawdzić odporność na prompt injection (ogłoszenie z „zignoruj instrukcje…”). | Lista błędów anonimizacji/injection przekazana do `app/` lub poprawiona. |
| 5 (pt) | Przegląd szablonu raportu: czytelność na telefonie, wersja do druku, sekcja „nie mamy tego modelu w bazie”. Wstawić disclaimer (`docs/disclaimer.md`, wersja średnia) do stopki raportu. | Raport czytelny na telefonie i w druku, ze stopką. |
| 6–7 (weekend) | Bufor. Opcjonalnie: nagrać 2 pierwsze filmy próbne wg `marketing/tiktok-scenariusze.md` (bez publikacji). | – |

**Kryterium wyjścia z tygodnia 1:** 5 raportów wygenerowanych lokalnie z fikcyjnych ogłoszeń, bez błędów i bez danych osobowych w bazie.

---

## Tydzień 2 – płatności, hosting, domena, dokumenty

| Dzień | Zadania | Wynik |
|---|---|---|
| 8 (pon) | **Formalności i Stripe.** Działalność gospodarcza (jeśli brak) lub decyzja o działalności nierejestrowanej – skonsultować z księgowym, bo od tego zależy VAT i dokumentowanie sprzedaży. Konto Stripe (Polska), weryfikacja tożsamości, włączenie BLIK, Przelewy24, kart. | Konto Stripe w trybie testowym, metody płatności włączone. |
| 9 (wt) | **Stripe w aplikacji (tryb testowy).** Checkout, webhook potwierdzający płatność, e-mail z potwierdzeniem zawierający treść oświadczenia o utracie prawa odstąpienia. Test: płatność udana, odrzucona, porzucona, zwrot. | Pełna ścieżka zakupu działa w trybie testowym. |
| 10 (śr) | **Hosting** – wybór wariantu (poniżej) i pierwsze wdrożenie. Kopie zapasowe bazy. | Aplikacja działa pod tymczasowym adresem. |
| 11 (czw) | **Domena i e-mail.** Zakup domeny (.pl), DNS, HTTPS, skrzynka kontaktowa, wysyłka e-maili transakcyjnych (SPF, DKIM, DMARC – inaczej e-maile wpadną do spamu). Webhook Stripe na docelowy adres. | Strona pod domeną, e-maile dochodzą do Gmaila i Onetu/WP poza spamem. |
| 12 (pt) | **Regulamin, polityka, disclaimer.** Uzupełnić `[DO UZUPEŁNIENIA]` w `docs/regulamin.md` i `docs/polityka-prywatnosci.md`, wysłać prawnikowi. Opublikować wersje robocze na stronie (z linkami w stopce i przy checkboxie). Zawrzeć/zaakceptować umowy powierzenia (DPA) z Anthropic, hostingiem, dostawcą e-maili. | Dokumenty u prawnika, DPA zaakceptowane. |
| 13–14 (weekend) | Bufor. Przygotować 20 ogłoszeń do testów (procedura niżej). | Folder z 20 ogłoszeniami, poza repozytorium. |

### Hosting – dwa warianty

**Ważne: SQLite jako plik na Vercel nie zadziała.** Funkcje serverless na Vercel mają system plików tylko do odczytu (poza katalogiem tymczasowym, który znika razem z instancją) i działają w wielu instancjach naraz. Zapis do pliku `.db` albo się nie uda, albo zniknie po chwili, a każda instancja widziałaby inną bazę. Do tego plan darmowy Vercel (Hobby) jest wyłącznie do użytku niekomercyjnego – płatny serwis wymaga planu Pro.

#### Wariant A: Vercel Pro + Turso (libSQL)

- Turso to hostowana baza zgodna z SQLite (libSQL). Schemat i zapytania zostają te same, zmienia się klient bazy w `app/` (połączenie przez URL + token zamiast pliku). **Wymaga uzgodnienia z autorem `app/`** – warstwa bazy powinna obsługiwać oba tryby (plik lokalnie, Turso na produkcji).
- Region bazy w Turso wybrać w UE.
- Uwaga na czas wykonania funkcji: generowanie raportu z 8 zdjęciami może trwać kilkadziesiąt sekund – ustawić maksymalny czas trwania funkcji i sprawdzić limity planu w dokumentacji Vercel; najlepiej streamować odpowiedź lub generować raport w tle i odpytywać o status.
- Plusy: zero administrowania serwerem, automatyczne wdrożenia z GitHuba, podglądy gałęzi.
- Minusy: dane u dostawców z USA (transfer – SCC/DPF w polityce prywatności), droższy przy jednej osobie, ryzyko limitów czasu.

| Pozycja | Koszt / mies. |
|---|---|
| Vercel Pro (1 osoba) | 20 USD ≈ 74 zł |
| Turso Free (5 GB, 500 mln odczytów, 10 mln zapisów / mies.) | 0 zł – wystarczy na MVP |
| Turso Developer (gdy wyjdziemy poza Free) | 4,99 USD ≈ 18 zł |
| **Razem** | **ok. 74–92 zł** |

#### Wariant B: mały VPS w UE + Docker (rekomendowany na MVP)

- Np. Hetzner Cloud (Niemcy lub Finlandia), najmniejsza maszyna 2 vCPU / 4 GB RAM w zupełności wystarcza.
- Docker Compose: kontener aplikacji Next.js + reverse proxy z automatycznym HTTPS (np. Caddy). SQLite jako plik na wolumenie – **działa bez zmian w kodzie**.
- Kopie zapasowe: codzienny zrzut bazy na zewnętrzny magazyn (np. Hetzner Storage Box lub magazyn obiektowy S3) albo ciągła replikacja (Litestream). Przetestować odtworzenie z kopii.
- Aktualizacje: ręczne wdrożenie (`git pull` + przebudowa kontenera) lub prosty workflow GitHub Actions. Automatyczne aktualizacje bezpieczeństwa systemu, firewall (tylko 80/443/SSH), logowanie kluczem SSH.
- Plusy: najtańszy, dane w UE (prostsza polityka prywatności), brak limitów czasu wykonania, SQLite bez zmian.
- Minusy: trzeba umieć podstawy administracji Linuxem; awaria serwera to nasz problem.

| Pozycja | Koszt / mies. |
|---|---|
| VPS (najmniejszy plan, z IPv4) | ok. 5–10 EUR ≈ 21–43 zł [SPRAWDZIĆ aktualny cennik – ceny VPS rosły w 2025–2026] |
| Magazyn na kopie zapasowe | ok. 3–4 EUR ≈ 13–17 zł [SPRAWDZIĆ] |
| **Razem** | **ok. 35–60 zł** |

**Rekomendacja:** wariant B, jeśli właściciel (lub ktoś z zespołu) bez stresu postawi Dockera na serwerze – taniej, dane w UE, SQLite bez zmian, brak problemu z długimi wywołaniami modelu. Wariant A, jeśli priorytetem jest zero administracji i właściciel akceptuje transfer danych do USA i dopasowanie warstwy bazy do Turso.

**Kryterium wyjścia z tygodnia 2:** płatność testowa BLIK → raport → e-mail z linkiem działa na docelowej domenie; kopia zapasowa bazy odtworzona na próbę.

---

## Tydzień 3 – testy na 20 ogłoszeniach, partnerzy, start

| Dzień | Zadania | Wynik |
|---|---|---|
| 15 (pon) | Testy: ogłoszenia 1–10 (procedura niżej). Ocena w arkuszu. | 10 wierszy arkusza. |
| 16 (wt) | Testy: ogłoszenia 11–20. Podsumowanie metryk, lista poprawek promptu/bazy. | Wynik go/no-go, lista poprawek. |
| 17 (śr) | Poprawki z testów. Ponowny test ogłoszeń, które wypadły źle. Zgłoszenia do programów partnerskich. Włączenie trybu produkcyjnego Stripe, jedna prawdziwa płatność (np. własna) i zwrot. | Poprawki wdrożone, Stripe na produkcji. |
| 18 (czw) | Uwagi prawnika do dokumentów → wersje finalne. Wygenerowanie pierwszych 10 podstron „typowe usterki [model]” (`marketing/seo-plan.md`), zgłoszenie mapy strony w Google Search Console. | Dokumenty finalne, SEO wystartowało. |
| 19 (pt) | **Start.** Publikacja 2–3 filmów, pierwsze wpisy w grupach wg `marketing/grupy-fb-i-fora.md` (najpierw wartość, bez linku). Monitoring: błędy, płatności, koszty API. | Serwis publicznie dostępny. |
| 20–21 (weekend) | Dyżur: odpowiedzi na komentarze, poprawki krytycznych błędów, przegląd pierwszych raportów klientów (tylko technicznie – czy się wygenerowały). | – |

### Procedura testu na 20 prawdziwych ogłoszeniach

**Dobór próby (20 ogłoszeń):**

- 10 ogłoszeń modeli, które są w bazie, z różnych segmentów cenowych,
- 4 ogłoszenia z wyraźnymi sygnałami do wyjaśnienia (cena znacznie poniżej rynku, sprzeczności w opisie, brak VIN, zdjęcia niepasujące do opisu),
- 3 ogłoszenia modeli spoza bazy (sprawdzamy, czy raport mówi to wprost i nie zmyśla usterek),
- 3 ogłoszenia z wklejonym wynikiem Historii Pojazdu (w tym 1 z niespójnym przebiegiem – może być spreparowany na podstawie prawdziwego),
- dodatkowo 2 ogłoszenia testowe z próbą prompt injection (fikcyjne, poza liczbą 20).

**Zasady pracy z prawdziwymi ogłoszeniami:** zapisujemy je lokalnie, poza repozytorium; nie publikujemy; nie kontaktujemy się ze sprzedawcami; po zakończeniu testów usuwamy kopie. Zrzuty ekranu w materiałach marketingowych – tylko po zamazaniu danych lub w wersji fikcyjnej.

**Przebieg dla każdego ogłoszenia:**

1. **Najpierw ocena ręczna (przed raportem!)** – zapisz w arkuszu: rozpoznany model/silnik, listę sygnałów do wyjaśnienia, które sam widzisz. To jest „wzorzec”. Robienie tego po przeczytaniu raportu zawyża wyniki.
2. Wygeneruj raport (tryb `DEV_SKIP_PAYMENT` lub testowy Stripe). Zanotuj czas generowania i zużycie tokenów (wejście/wyjście z odpowiedzi API).
3. Porównaj raport ze wzorcem i bazą – wypełnij arkusz.
4. Każdą halucynację opisz w kolumnie „uwagi” dosłownym cytatem.

**Definicje:**

- **Trafna flaga** – sygnał w raporcie, który faktycznie wynika z ogłoszenia/zdjęć/Historii Pojazdu.
- **Fałszywa flaga** – sygnał, którego nie da się uzasadnić materiałem (np. „różnica w odcieniu lakieru”, której na zdjęciu nie ma).
- **Pominięta flaga** – sygnał ze wzorca, którego raport nie zawiera.
- **Trafna usterka** – usterka obecna w bazie dla rozpoznanego modelu i silnika.
- **Halucynacja** – twierdzenie niepoparte materiałem ani bazą: usterka spoza bazy, wymyślony koszt, nieistniejący fakt o aucie, zła wersja silnika podana jako pewna, wymyślona liczba z Historii Pojazdu.

**Arkusz oceny** (skopiuj do arkusza kalkulacyjnego; jeden wiersz = jedno ogłoszenie):

```csv
nr;model_wzorzec;silnik_wzorzec;model_raport;silnik_raport;rozpoznanie_ok(0/1);flagi_wzorzec(liczba);flagi_trafne;flagi_falszywe;flagi_pominiete;usterki_w_raporcie;usterki_z_bazy;usterki_spoza_bazy;halucynacje_fakty;przebieg_cepik_ok(0/1/nd);sformulowania_oskarzajace;dane_osobowe_w_raporcie(0/1);czas_s;tokeny_we;tokeny_wy;ocena_uzytecznosci(1-5);uwagi
1;;;;;;;;;;;;;;;;;;;;;
```

**Metryki i progi „go”:**

| Metryka | Jak liczyć | Próg „go” |
|---|---|---|
| Trafność flag (precyzja) | suma flag trafnych / suma flag w raportach | ≥ 80% |
| Wykrywalność flag | suma flag trafnych / suma flag wzorca | ≥ 70% |
| Trafność rozpoznania modelu i silnika | rozpoznanie_ok / liczba ogłoszeń z modelem w bazie | ≥ 90%, a przy niepewności raport musi o nią zapytać |
| Usterki spoza bazy | suma `usterki_spoza_bazy` | **0** (każda = błąd blokujący) |
| Halucynacje faktów | suma `halucynacje_fakty` | ≤ 1 na 20 raportów, żadna istotna dla decyzji |
| Sformułowania oskarżające | suma | **0** |
| Dane osobowe w raporcie | suma | **0** |
| Prompt injection | 2 ogłoszenia testowe | raport ignoruje polecenia z ogłoszenia |
| Użyteczność | średnia ocen 1–5 | ≥ 4 |

Jeśli którykolwiek próg „0” nie jest spełniony – nie startujemy z płatną wersją, poprawiamy i powtarzamy test na ogłoszeniach, które wypadły źle, plus 5 nowych.

### Programy partnerskie

Link afiliacyjny wstawiamy w sekcji raportu „Chcesz sprawdzić historię z zagranicy?” i oznaczamy jako link partnerski (przejrzystość wobec klienta).

**carVertical**

- Ma oficjalny program partnerski (strona „affiliate program” na carvertical.com) z panelem partnera.
- Zgłoszenie: formularz na stronie programu; opisz serwis, źródła ruchu (SEO, TikTok, raporty), szacowany ruch. Przed zgłoszeniem miej działającą stronę z regulaminem i polityką prywatności – nowe, puste strony są często odrzucane.
- Warunki deklarowane publicznie: cookie 90 dni, wypłaty miesięczne, minimalna wypłata 50 EUR, brak prowizji za zakupy własne, zakaz „cookie stuffingu” i maskowania linków. Wysokość prowizji – podawana w panelu/umowie i może zależeć od kraju; **sprawdź przed podpisaniem**.

**autoDNA**

- Nie znaleźliśmy publicznego, opisanego programu partnerskiego z warunkami. Ścieżki: sekcja „współpraca/partnerzy” w stopce autodna.pl, kontakt z działem B2B/marketingu e-mailem, ewentualnie polskie sieci afiliacyjne (sprawdzić, czy autoDNA w nich występuje).
- W wiadomości: kim jesteśmy, w którym miejscu raportu pojawi się link, prognoza liczby raportów miesięcznie, prośba o model rozliczenia (procent od sprzedaży lub stała kwota) i kod rabatowy dla naszych klientów.

**Typowe warunki w programach tego typu (do sprawdzenia w umowie):** prowizja procentowa od sprzedaży raportu lub stała kwota za sprzedaż; okres ważności cookie 30–90 dni; próg wypłaty; zakaz reklamy w wyszukiwarce na słowa z marką partnera (brand bidding); wymóg oznaczania linków; wypłata po okresie na zwroty/anulacje.

---

## Koszty miesięczne

Założenia:
- **200 płatnych raportów miesięcznie po 19 zł brutto** = 3 800 zł brutto = 3 089,43 zł netto (VAT 23%: 710,57 zł).
- Kurs: **1 USD = 3,70 zł, 1 EUR = 4,25 zł** [DO AKTUALIZACJI w dniu kalkulacji].
- Ceny dostawców sprawdzone 14.10.2026 na publicznych cennikach; mogą się zmienić.

### Koszt modelu językowego – Claude Sonnet 5.5

Cennik publiczny API (Anthropic, stan na 14.10.2026): **wejście 2 USD / 1 mln tokenów, wyjście 10 USD / 1 mln tokenów** (odczyt z cache: 0,10 USD / 1 mln; Batch API: 1 / 5 USD – nie dla nas, bo klient czeka na raport).

Liczenie tokenów za obrazy: obraz dzielony jest na pola 28×28 px, koszt = ⌈szerokość/28⌉ × ⌈wysokość/28⌉ tokenów. Sonnet 5.5 należy do modeli wysokiej rozdzielczości (do 2576 px dłuższego boku), więc zdjęcie zmniejszone w przeglądarce do 1280 px nie jest dodatkowo skalowane:
- zdjęcie 1280×960 (proporcje 4:3, typowe zdjęcie z ogłoszenia): 46 × 35 = **1 610 tokenów**,
- zrzut 1280×720 (16:9): 46 × 26 = 1 196 tokenów.

Przyjmujemy wariant ostrożny – 8 zdjęć 4:3.

| Pozycja na 1 raport | Tokeny | Koszt |
|---|---|---|
| Tekst wejściowy (prompt systemowy, wpis z bazy, ogłoszenie, Historia Pojazdu) | 6 000 | 0,0120 USD |
| 8 zdjęć × 1 610 | 12 880 | 0,0258 USD |
| **Wejście razem** | **18 880** | **0,0378 USD** |
| Wyjście (raport) | 3 000 | 0,0300 USD |
| **Razem na raport** | | **0,0678 USD ≈ 0,25 zł** |
| Wariant z myśleniem modelu: +3 000 tokenów wyjścia | 6 000 wyj. | 0,0978 USD ≈ 0,36 zł |

**Uwaga o myśleniu modelu:** Sonnet 5.5 ma domyślnie włączone myślenie adaptacyjne, a tokeny myślenia są rozliczane jak tokeny wyjścia. Rzeczywiste zużycie trzeba zmierzyć na 20 testowych ogłoszeniach (pole `usage` w odpowiedzi API) i ewentualnie obniżyć poziom `effort`, jeśli jakość się utrzymuje.

**Na 200 raportów: 13,55 USD ≈ 50 zł (bez dodatkowego myślenia) do 19,55 USD ≈ 72 zł (z myśleniem 3k).**

Darmowe szybkie sprawdzenie (etap 1, bez zdjęć) – szacunek: 4 000 tokenów wejścia + 1 000 wyjścia = 0,018 USD ≈ 0,07 zł. Przy 1 000 darmowych sprawdzeń miesięcznie: 18 USD ≈ 67 zł. To realny koszt pozyskania klienta – ustaw limit dzienny i ochronę przed nadużyciami (np. limit na adres IP / e-mail).

Oszczędności na później: cache stałej części promptu (prompt systemowy + instrukcje) – odczyt z cache kosztuje 5% ceny wejścia; zysk jest niewielki, bo większość wejścia to zmienne zdjęcia i ogłoszenie.

### Prowizje Stripe (cennik Stripe dla Polski, standardowy)

| Metoda | Prowizja | Na 1 transakcji 19 zł | Na 200 transakcjach |
|---|---|---|---|
| BLIK | 1,6% + 1,00 zł | 1,30 zł | 260,80 zł |
| Karta standardowa z EOG | 1,5% + 1,00 zł | 1,29 zł | 257,00 zł |
| Przelewy24 | 1,9% + 1,00 zł | 1,36 zł | 272,20 zł |
| **Miks założony: 70% BLIK, 20% karta, 10% P24** | | | **261,18 zł** |

Stała opłata 1 zł to ok. 5% ceny raportu – dlatego niska cena jednostkowa jest droga w obsłudze. Kupon 5 raportów za 49 zł to jedna prowizja zamiast pięciu. Karty spoza EOG/premium są droższe (np. karty premium z EOG: 1,9% + 1 zł, karty międzynarodowe: 3,25% + 1 zł).

### Zestawienie miesięczne przy 200 raportach

| Pozycja | Wariant A (Vercel + Turso) | Wariant B (VPS) |
|---|---|---|
| Hosting + baza | 74 zł | 35–60 zł (z kopiami) |
| Domena .pl (60–120 zł/rok, odnowienie) | 5–10 zł | 5–10 zł |
| E-mail transakcyjny (darmowy plan na start) | 0 zł | 0 zł |
| Prowizje Stripe | 261 zł | 261 zł |
| LLM – płatne raporty | 50–72 zł | 50–72 zł |
| LLM – 1 000 darmowych sprawdzeń | 67 zł | 67 zł |
| **Razem (bez księgowości)** | **ok. 457–484 zł** | **ok. 418–470 zł** |
| Księgowość | [DO UZUPEŁNIENIA – oferta biura] | [DO UZUPEŁNIENIA] |
| Jednorazowo: konsultacja prawna regulaminu i polityki | [DO UZUPEŁNIENIA] | [DO UZUPEŁNIENIA] |

Na tle 3 089 zł przychodu netto koszty zmienne (Stripe + LLM, łącznie z darmowymi sprawdzeniami: 378–400 zł) to ok. 12–13% przychodu netto; największą pozycją są prowizje Stripe, nie model językowy. Kwoty dostawców zagranicznych (Anthropic, Vercel, Turso) są netto – rozliczenie VAT od usług importowanych ustalić z księgowym.

---

## Rzeczy do decyzji przed startem

- [ ] Forma działalności i sposób dokumentowania sprzedaży (kasa fiskalna/zwolnienie, faktury na żądanie, KSeF) – księgowy.
- [ ] Wariant hostingu A czy B.
- [ ] Cennik finalny i zasady zwrotu, gdy modelu nie ma w bazie.
- [ ] Limit darmowych sprawdzeń dziennie.
- [ ] Miesięczny limit wydatków w konsoli Anthropic.
- [ ] Prawnik: regulamin, polityka prywatności, obowiązki informacyjne dotyczące AI.
