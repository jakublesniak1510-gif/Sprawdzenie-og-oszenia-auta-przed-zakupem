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
| `content/` | Treści czytane przez aplikację: copy strony głównej, przykładowe ogłoszenie i raport, artykuły blogowe, szablony e-maili |

Najważniejsze dokumenty:

- [`docs/00-ocena-projektu.md`](docs/00-ocena-projektu.md) – ocena konceptu, decyzje i podział pracy
- [`docs/01-koncept.md`](docs/01-koncept.md) – koncept wejściowy
- [`docs/02-runda-2-plan.md`](docs/02-runda-2-plan.md) – plan rundy 2
- [`docs/03-analiza-konkurencji.md`](docs/03-analiza-konkurencji.md) – konkurencja (stan 10.2026): ceny, co dają, nasze przewagi i słabości
- [`docs/04-roadmap.md`](docs/04-roadmap.md) – co po MVP, w kolejności wartości dla klienta
- [`docs/plan-wdrozenia.md`](docs/plan-wdrozenia.md) – plan 3 tygodni, hosting, koszty miesięczne
- [`docs/regulamin.md`](docs/regulamin.md), [`docs/polityka-prywatnosci.md`](docs/polityka-prywatnosci.md), [`docs/disclaimer.md`](docs/disclaimer.md) – wzory dokumentów prawnych (**do weryfikacji przez prawnika przed publikacją**)
- [`marketing/seo-plan.md`](marketing/seo-plan.md), [`marketing/tiktok-scenariusze.md`](marketing/tiktok-scenariusze.md), [`marketing/grupy-fb-i-fora.md`](marketing/grupy-fb-i-fora.md)

## Szybki start

Instalacja, konfiguracja zmiennych środowiskowych i uruchomienie aplikacji: **patrz [`app/README.md`](app/README.md)**.

## Runda 2

Cel: produkt wyraźnie lepszy od tego, co już istnieje. Raporty historii (autoDNA, carVertical, Autobaza) sprzedają dane po VIN; mechanik ogląda auto na miejscu. Nikt nie analizuje **treści konkretnego ogłoszenia** z bazą usterek, pytaniami i checklistą – to nasza nisza (szczegóły: [`docs/03-analiza-konkurencji.md`](docs/03-analiza-konkurencji.md)). Plan i podział pracy: [`docs/02-runda-2-plan.md`](docs/02-runda-2-plan.md).

- **Darmowy szybki test** (`/szybki-test`) – bez AI, natychmiast: rozpoznany model, rzeczy do wyjaśnienia, 3 najważniejsze usterki, prośba o VIN.
- **Raport, którego nie da się zgubić** – wznowienie przerwanych raportów, e-mail z linkiem, kupon na 5 raportów (49 zł, ważny rok), zabezpieczenia produkcyjne.
- **Baza 50 modeli z widełkami cen** – flaga „cena poniżej rynku” bez wklejania porównań.
- **Treści, które sprzedają** – landing z uczciwym porównaniem, przykładowy raport, blog, e-maile.

### Katalog `content/`

Pliki czytane przez aplikację w czasie budowania/działania (parsery w `app/components/content/` i `app/lib/email-templates.ts`). Zmiana treści nie wymaga zmian w kodzie – trzeba tylko zachować format.

| Plik | Co to jest | Format |
|---|---|---|
| `content/landing.md` | Copy strony głównej | Sekcje `## hero`, `## jak-to-dziala`, `## co-dostajesz`, `## porownanie`, `## faq`, `## cennik`, `## stopka`. W hero linie `tytul:`, `podtytul:`, `cta1:`, `cta2:`; FAQ i cennik jako `### nazwa` + treść; w cenniku linie `cena:`, `opis:`, `cta:` i lista. |
| `content/przyklad-ogloszenie.md` | Fikcyjne ogłoszenie VW Golf VII 1.6 TDI 2015 (VIN `TEST…`) | Markdown; H1 = tytuł, `**Cena:**` = cena |
| `content/przyklad-raport.json` | Przykładowy raport dla tego ogłoszenia | Dokładnie schemat `Report` z `app/lib/report-schema.ts`; usterki i koszty 1:1 z `data/models/vw-golf-7.json` |
| `content/blog/*.md` | 6 artykułów poradnikowych | Frontmatter YAML: `title`, `description` (≤155 znaków), `date`, `slug`, `models` (id z `data/models`), `keywords` |
| `content/emails/*.md` | E-maile: raport gotowy, płatność niedokończona, „czy kupiłeś?” | Pierwsza linia `temat: …`, potem markdown z `{{link}}`, `{{data_waznosci}}`, `{{link_tak}}`, `{{link_nie}}` |

Zasady dla treści: wszystkie ogłoszenia w przykładach są fikcyjne, bez danych osobowych; nic nie oskarża sprzedawcy; koszty napraw tylko z bazy i „orientacyjnie”; statystyki tylko ze źródłem. Po zmianie przykładowego raportu sprawdź zgodność ze schematem (np. `ReportSchema.safeParse` w `app/`).

## Status MVP

- [ ] Baza wiedzy – 30 modeli (`data/`)
- [ ] Aplikacja działająca lokalnie (`app/`)
- [ ] Płatności Stripe (BLIK, P24, karta)
- [ ] Hosting i domena
- [x] Wzory: regulamin, polityka prywatności, zastrzeżenia (wymagają uzupełnienia danych i weryfikacji prawnej)
- [ ] Test na 20 prawdziwych ogłoszeniach (procedura w `docs/plan-wdrozenia.md`)
- [ ] Programy partnerskie
- [x] Plan SEO, scenariusze filmów, zasady dla grup FB (`marketing/`)
- [x] Runda 2 – treści: analiza konkurencji, roadmapa, landing, przykładowy raport, 6 artykułów, e-maile, seria filmów „szybki test na żywo” (`docs/`, `content/`, `marketing/`)
- [ ] Start publiczny

Zasady obowiązujące w całym projekcie: treści po polsku; nic nie oskarża sprzedawcy; dane osobowe z ogłoszeń są usuwane przed przetwarzaniem; model językowy nie wymyśla usterek spoza bazy.

## Licencja

Do decyzji właściciela projektu. Do czasu decyzji: wszelkie prawa zastrzeżone; kod, baza wiedzy i treści nie są udostępniane na licencji otwartej.
