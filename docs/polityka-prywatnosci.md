# Polityka prywatności serwisu [NAZWA SERWISU – DO UZUPEŁNIENIA]

> **Wzór do weryfikacji przez prawnika przed publikacją.**
> Opis przetwarzania musi odpowiadać temu, co faktycznie robi aplikacja (`app/`). Przed publikacją sprawdź każde zdanie oznaczone `[SPRAWDZIĆ W APLIKACJI]`.

Wersja: [DO UZUPEŁNIENIA]
Obowiązuje od: [DO UZUPEŁNIENIA]

---

## 1. Kto jest administratorem danych

Administratorem danych osobowych jest:

- Nazwa / imię i nazwisko przedsiębiorcy: [DO UZUPEŁNIENIA]
- Adres: [DO UZUPEŁNIENIA]
- NIP: [DO UZUPEŁNIENIA]
- E-mail w sprawach danych osobowych: [DO UZUPEŁNIENIA]

Nie wyznaczyliśmy inspektora ochrony danych [DO WERYFIKACJI – przy obecnej skali nie jest to obowiązkowe; potwierdzić z prawnikiem].

## 2. Krótko, po ludzku

- Zbieramy tylko to, czego potrzebujemy, żeby przygotować i dostarczyć raport oraz rozliczyć płatność.
- Z wklejonego ogłoszenia **automatycznie usuwamy numery telefonów, adresy e-mail i numery rejestracyjne, zanim tekst trafi dalej** (do modelu językowego i do bazy). Oryginału nie zapisujemy.
- Zdjęcia analizujemy w pamięci serwera i **nie zapisujemy ich na stałe**.
- Raport i dane wejściowe usuwamy **po 30 dniach**.
- Nie sprzedajemy danych. Nie profilujemy ani klientów, ani sprzedawców.

## 3. Jakie dane przetwarzamy

| Kategoria | Skąd | Co dokładnie |
|---|---|---|
| Dane klienta | od Ciebie | adres e-mail (do wysłania linku do raportu i potwierdzenia zamówienia); dane do faktury, jeśli o nią poprosisz |
| Dane płatności | od Ciebie, obsługuje Stripe | metoda płatności, status, kwota, identyfikator transakcji. **Pełnych danych karty ani danych logowania do banku nie widzimy** – przetwarza je Stripe |
| Treść ogłoszenia | od Ciebie | tekst ogłoszenia **po automatycznej anonimizacji**: usuwamy numery telefonów, adresy e-mail i numery rejestracyjne przed dalszym przetwarzaniem [SPRAWDZIĆ W APLIKACJI: czy usuwane są także imiona i nazwiska oraz numer VIN – dopisać zgodnie ze stanem faktycznym] |
| Zdjęcia / zrzuty ekranu | od Ciebie | przetwarzane w pamięci na czas generowania raportu, przekazywane do modelu językowego, **nie są składowane** po wygenerowaniu raportu |
| Wynik z Historii Pojazdu | od Ciebie (opcjonalnie) | daty i przebiegi z badań technicznych, liczba właścicieli, dane techniczne pojazdu |
| Podobne oferty | od Ciebie (opcjonalnie) | treść ofert do porównania, anonimizowana tak samo jak ogłoszenie |
| Raport | generujemy my | treść raportu, data wygenerowania |
| Informacja zwrotna | od Ciebie (opcjonalnie) | odpowiedź na pytanie „Kupiłeś? Co się potwierdziło?” |
| Dane techniczne | automatycznie | adres IP, typ przeglądarki, logi błędów i bezpieczeństwa |
| Zgoda marketingowa | od Ciebie (opcjonalnie) | adres e-mail i data/treść udzielonej zgody |

Nie prosimy o imię, nazwisko, telefon ani adres, chyba że potrzebujesz faktury.

## 4. Dane sprzedawców pojawiające się w ogłoszeniach

Ogłoszenia sprzedaży aut często zawierają dane sprzedawcy: telefon, imię, czasem nazwę firmy, lokalizację, numer rejestracyjny auta. Te osoby nie są naszymi klientami i nie wiedzą, że ktoś sprawdza ich ogłoszenie. Dlatego:

1. **Minimalizujemy te dane technicznie, nie tylko deklaratywnie.** Numery telefonów, adresy e-mail i numery rejestracyjne są wycinane automatycznie, zanim tekst zostanie zapisany lub wysłany do modelu językowego. Do raportu nie są potrzebne – liczy się opis auta, nie dane osoby.
2. **Nie tworzymy bazy sprzedawców.** Nie łączymy ogłoszeń w historię konkretnego sprzedawcy, nie oceniamy sprzedawców, nie przypisujemy im etykiet i nie udostępniamy takich informacji innym klientom.
3. **Nie profilujemy sprzedawców.** Raport dotyczy treści jednego ogłoszenia i jednego pojazdu. Wskazania są formułowane jako „do wyjaśnienia ze sprzedawcą”, a nie jako ocena osoby.
4. Dane, które mimo anonimizacji zostaną w tekście (np. nazwa miejscowości), przechowujemy tylko przez 30 dni razem z raportem.
5. Podstawą tego ograniczonego przetwarzania jest nasz prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO) oraz interes klienta w ocenie oferty, którą sprzedawca sam opublikował. Osoba, której dane mogły się znaleźć w ogłoszeniu, może skontaktować się z nami w sprawie swoich praw (pkt 9).
6. Prosimy klientów, by nie wklejali danych osobowych osób trzecich ponad to, co jest niezbędne (Regulamin, § 4).

## 5. Cele i podstawy prawne

| Cel | Podstawa prawna (RODO) | Jak długo |
|---|---|---|
| Przygotowanie i dostarczenie szybkiego sprawdzenia i raportu, kontakt w sprawie zamówienia | art. 6 ust. 1 lit. b – wykonanie umowy | 30 dni od wygenerowania raportu |
| Obsługa płatności i zwrotów | art. 6 ust. 1 lit. b – umowa; art. 6 ust. 1 lit. c – obowiązek prawny | jak niżej (księgowość) |
| Prowadzenie księgowości i rozliczeń podatkowych | art. 6 ust. 1 lit. c – obowiązek prawny | 5 lat od końca roku kalendarzowego, w którym upłynął termin płatności podatku |
| Rozpatrywanie reklamacji | art. 6 ust. 1 lit. b i c | do zakończenia sprawy, a następnie do upływu terminu przedawnienia roszczeń |
| Ustalenie, dochodzenie lub obrona roszczeń | art. 6 ust. 1 lit. f – prawnie uzasadniony interes | do upływu terminu przedawnienia roszczeń |
| Bezpieczeństwo serwisu, zapobieganie nadużyciom, logi | art. 6 ust. 1 lit. f | [DO UZUPEŁNIENIA, np. 30 dni] |
| Ulepszanie bazy wiedzy na podstawie informacji zwrotnej | art. 6 ust. 1 lit. f | w formie zanonimizowanej – bez ograniczenia; dane identyfikujące – 30 dni |
| Newsletter i informacje marketingowe e-mailem | art. 6 ust. 1 lit. a – zgoda (oraz zgoda na komunikację elektroniczną wymagana przepisami prawa komunikacji elektronicznej) | do wycofania zgody |

Podanie e-maila jest dobrowolne, ale bez niego nie możemy dostarczyć płatnego raportu ani potwierdzenia zamówienia.

**Decyzje automatyczne.** Raport jest generowany automatycznie, ale dotyczy pojazdu i ogłoszenia, nie Ciebie. Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywoływałyby skutki prawne lub w podobny sposób istotnie na Ciebie wpływały.

## 6. Komu przekazujemy dane

| Odbiorca | Rola | Co otrzymuje | Lokalizacja i transfer |
|---|---|---|---|
| **Stripe** (Stripe Payments Europe, Limited, Irlandia) | operator płatności; w zakresie m.in. zapobiegania oszustwom i obowiązków regulacyjnych działa jako odrębny administrator | e-mail, dane płatności, adres IP | EOG; możliwy transfer do Stripe, Inc. (USA) – na podstawie standardowych klauzul umownych (SCC) Komisji Europejskiej i/lub decyzji o adekwatności dla EU-US Data Privacy Framework (DPF). [DO WERYFIKACJI: aktualny status DPF] |
| **Anthropic** – dostawca modelu językowego (Claude) | podmiot przetwarzający | zanonimizowany tekst ogłoszenia, zdjęcia, wynik Historii Pojazdu, fragmenty bazy wiedzy. **Bez Twojego e-maila** | USA – transfer poza EOG na podstawie standardowych klauzul umownych (SCC) zawartych w umowie powierzenia (DPA) dostawcy [DO WERYFIKACJI: podmiot umowy – Anthropic PBC lub Anthropic Ireland, Limited; status DPF; okres przechowywania danych przez dostawcę]. Zgodnie z warunkami komercyjnymi dostawcy dane przesyłane przez API nie są używane do trenowania modeli [DO WERYFIKACJI w aktualnych warunkach] |
| **Hosting** [DO UZUPEŁNIENIA: np. Hetzner Online GmbH (Niemcy) albo Vercel Inc. (USA) + Turso] | podmiot przetwarzający | wszystkie dane przechowywane w serwisie | Hetzner: EOG (Niemcy/Finlandia) – bez transferu. Vercel/Turso: możliwy transfer do USA na podstawie SCC/DPF [DO UZUPEŁNIENIA wg wybranego wariantu] |
| Dostawca wysyłki e-maili [DO UZUPEŁNIENIA] | podmiot przetwarzający | e-mail, link do raportu | [DO UZUPEŁNIENIA] |
| Biuro rachunkowe [DO UZUPEŁNIENIA] | podmiot przetwarzający | dane z dokumentów sprzedaży | Polska |
| Organy publiczne | odrębni administratorzy | tylko gdy wymaga tego prawo | – |

Kopię zabezpieczeń dotyczących transferu poza EOG (np. SCC) możesz otrzymać, pisząc na adres z pkt 1.

## 7. Jak długo przechowujemy dane

- **Raport, zanonimizowana treść ogłoszenia i pozostałe dane wejściowe – 30 dni** od wygenerowania raportu, potem automatyczne usunięcie. [SPRAWDZIĆ W APLIKACJI: zadanie czyszczące]
- **Zdjęcia – nie są składowane**; istnieją tylko w pamięci w trakcie generowania raportu.
- **Dane księgowe (dokumenty sprzedaży, dane transakcji) – 5 lat** od końca roku kalendarzowego, w którym upłynął termin płatności podatku.
- Reklamacje – do zakończenia sprawy i upływu terminu przedawnienia roszczeń.
- Dane marketingowe – do wycofania zgody.
- Logi techniczne – [DO UZUPEŁNIENIA, np. 30 dni].
- Kopie zapasowe – nadpisywane cyklicznie, najpóźniej po [DO UZUPEŁNIENIA, np. 7–14 dniach]; dane usunięte z bazy znikają z kopii po tym czasie.

## 8. Pliki cookie

Używamy minimum plików cookie:

| Rodzaj | Po co | Zgoda |
|---|---|---|
| Niezbędne (sesja, ochrona formularza, zapamiętanie zamówienia) | żeby serwis działał | niewymagana |
| Stripe (na stronie płatności) | obsługa płatności i zapobieganie oszustwom | niewymagana – niezbędne do realizacji płatności |
| Analityka | [DO DECYZJI: brak / analityka bez cookie (np. Plausible) / Google Analytics – wtedy wymagany baner zgody] | zależnie od wyboru |
| Marketingowe (piksele reklamowe) | nie używamy [DO DECYZJI: jeśli dojdą, wymagany baner zgody] | wymagana |

Możesz usunąć lub zablokować cookie w ustawieniach przeglądarki; bez cookie niezbędnych serwis może nie działać.

## 9. Twoje prawa

Masz prawo do:

- dostępu do swoich danych i otrzymania ich kopii,
- sprostowania danych,
- usunięcia danych („prawo do bycia zapomnianym”),
- ograniczenia przetwarzania,
- przenoszenia danych (dla danych przetwarzanych na podstawie umowy lub zgody),
- sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,
- wycofania zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed wycofaniem),
- wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, www.uodo.gov.pl).

Żeby skorzystać z praw, napisz na adres z pkt 1. Odpowiemy bez zbędnej zwłoki, co do zasady w ciągu miesiąca. Możemy poprosić o informację pozwalającą potwierdzić, że wniosek dotyczy Twoich danych (np. o adres e-mail użyty przy zamówieniu).

Uwaga praktyczna: ponieważ telefony, e-maile i numery rejestracyjne usuwamy z ogłoszeń przed zapisem, zwykle nie jesteśmy w stanie wyszukać ogłoszenia po danych sprzedawcy – po prostu ich nie mamy.

## 10. Bezpieczeństwo

- Połączenie z serwisem jest szyfrowane (HTTPS).
- Dostęp do bazy danych i panelu dostawców ma wyłącznie administrator, z uwierzytelnianiem dwuskładnikowym.
- Raporty są dostępne przez trudny do odgadnięcia link; nie są indeksowane przez wyszukiwarki.
- Anonimizacja odbywa się przed zapisem i przed wysłaniem danych do modelu językowego.

## 11. Kontakt i zmiany polityki

Pytania dotyczące danych: [DO UZUPEŁNIENIA: e-mail].
O zmianach tej polityki informujemy w serwisie; istotne zmiany dotyczące klientów z aktywnym kuponem lub zgodą marketingową przesyłamy też e-mailem.

---

### Lista kontrolna przed publikacją (usuń z wersji publicznej)

- [ ] Wszystkie `[SPRAWDZIĆ W APLIKACJI]` potwierdzone z kodem w `app/` (anonimizacja: zakres wzorców; zdjęcia nie trafiają na dysk ani do logów; zadanie usuwające po 30 dniach; czy VIN jest zapisywany).
- [ ] Zawarte umowy powierzenia (DPA) z: Anthropic, hostingiem, dostawcą e-maili, biurem rachunkowym. Stripe – zaakceptowane warunki ochrony danych w panelu.
- [ ] Zweryfikowany mechanizm transferu (SCC/DPF) dla każdego odbiorcy spoza EOG.
- [ ] Rejestr czynności przetwarzania (wewnętrzny dokument) – przygotowany.
- [ ] Analiza prawnie uzasadnionego interesu (test równowagi) dla danych sprzedawców – przygotowana i zweryfikowana przez prawnika.
- [ ] Decyzja o analityce i ewentualny baner zgody.
- [ ] Logi aplikacji nie zawierają treści ogłoszeń ani zdjęć.
