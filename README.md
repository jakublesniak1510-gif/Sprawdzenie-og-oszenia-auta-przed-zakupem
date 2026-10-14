# Sprawdź ogłoszenie auta przed zakupem

Serwis dla osób kupujących używane auto w Polsce. Kupujący wkleja treść i zrzuty ekranu ogłoszenia (opcjonalnie wynik z bezpłatnej Historii Pojazdu i podobne oferty), a w kilka minut dostaje raport:

- co w ogłoszeniu warto wyjaśnić ze sprzedawcą (zawsze jako „do wyjaśnienia”, nigdy jako zarzut),
- typowe usterki danego modelu i silnika z kuratorowanej bazy wiedzy, z orientacyjnymi kosztami napraw,
- porównanie przebiegów z badań technicznych,
- pytania do sprzedawcy i checklistę oględzin.

Model biznesowy: darmowe szybkie sprawdzenie (lead magnet) + płatny raport (BLIK / Przelewy24 / karta przez Stripe), afiliacja raportów historii z zagranicy. Raport jest pomocą w decyzji generowaną automatycznie z użyciem modelu językowego – nie ekspertyzą rzeczoznawcy.

## Struktura repozytorium

| Katalog | Zawartość |
|---|---|
| `app/` | Aplikacja Next.js: formularz, anonimizacja danych, wywołanie modelu językowego, raport, płatności Stripe, wersja do druku |
| `data/` | Baza wiedzy: modele, silniki, typowe usterki, sygnały do wyjaśnienia, checklisty; schematy w `data/schema/` |
| `docs/` | Dokumenty projektu: ocena i koncept, regulamin, polityka prywatności, zastrzeżenia, plan wdrożenia |
| `marketing/` | Plan SEO, scenariusze krótkich filmów, zasady obecności w grupach i na forach |

Najważniejsze dokumenty:

- [`docs/00-ocena-projektu.md`](docs/00-ocena-projektu.md) – ocena konceptu, decyzje i podział pracy
- [`docs/01-koncept.md`](docs/01-koncept.md) – koncept wejściowy
- [`docs/plan-wdrozenia.md`](docs/plan-wdrozenia.md) – plan 3 tygodni, hosting, koszty miesięczne
- [`docs/regulamin.md`](docs/regulamin.md), [`docs/polityka-prywatnosci.md`](docs/polityka-prywatnosci.md), [`docs/disclaimer.md`](docs/disclaimer.md) – wzory dokumentów prawnych (**do weryfikacji przez prawnika przed publikacją**)
- [`marketing/seo-plan.md`](marketing/seo-plan.md), [`marketing/tiktok-scenariusze.md`](marketing/tiktok-scenariusze.md), [`marketing/grupy-fb-i-fora.md`](marketing/grupy-fb-i-fora.md)

## Szybki start

Instalacja, konfiguracja zmiennych środowiskowych i uruchomienie aplikacji: **patrz [`app/README.md`](app/README.md)**.

## Status MVP

- [ ] Baza wiedzy – 30 modeli (`data/`)
- [ ] Aplikacja działająca lokalnie (`app/`)
- [ ] Płatności Stripe (BLIK, P24, karta)
- [ ] Hosting i domena
- [x] Wzory: regulamin, polityka prywatności, zastrzeżenia (wymagają uzupełnienia danych i weryfikacji prawnej)
- [ ] Test na 20 prawdziwych ogłoszeniach (procedura w `docs/plan-wdrozenia.md`)
- [ ] Programy partnerskie
- [x] Plan SEO, scenariusze filmów, zasady dla grup FB (`marketing/`)
- [ ] Start publiczny

Zasady obowiązujące w całym projekcie: treści po polsku; nic nie oskarża sprzedawcy; dane osobowe z ogłoszeń są usuwane przed przetwarzaniem; model językowy nie wymyśla usterek spoza bazy.

## Licencja

Do decyzji właściciela projektu. Do czasu decyzji: wszelkie prawa zastrzeżone; kod, baza wiedzy i treści nie są udostępniane na licencji otwartej.
