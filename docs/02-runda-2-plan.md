# Runda 2: cel „lepsze niż to, co istnieje”

Konkurencja (autoDNA, carVertical, Autobaza) sprzedaje historię pojazdu. Nikt nie sprzedaje **analizy konkretnego ogłoszenia** z bazą usterek, pytaniami i checklistą. Przewagę budujemy w czterech miejscach:

1. **Darmowy szybki test bez AI** (`/szybki-test`): flagi z bazy, rozpoznanie modelu, 3 najważniejsze usterki, „poproś o VIN”. Zero kosztu, natychmiast, główny lead magnet i materiał na TikToka.
2. **Raport, którego nie da się zgubić**: zdjęcia zapisywane zaszyfrowane do czasu wygenerowania, wznowienie przerwanych raportów, e-mail z linkiem, kupon na 5 raportów, zabezpieczenia produkcyjne (rate limit, idempotentny webhook, blokada trybu testowego na produkcji), Docker na VPS.
3. **Baza 50 modeli z widełkami cen rynkowych**, żeby flaga „cena poniżej rynku” działała bez wklejania porównań.
4. **Treści, które sprzedają**: landing z porównaniem do raportów historii, przykładowy raport, blog, e-maile, analiza konkurencji.

| Pracownik | Zakres | Katalogi |
|---|---|---|
| A1 backend | zdjęcia na dysku, wznowienie, e-mail, kupony, rate limit, webhook, Docker, admin, cache promptu | `app/lib`, `app/app/api`, `app/scripts`, `app/Dockerfile`, `app/package.json` |
| A2 frontend | landing, szybki test, przykładowy raport, blog, SEO (sitemap, robots, JSON-LD, OG), udostępnianie, mobile | `app/app/*` (strony), `app/components`, `app/public` |
| B baza | +20 modeli (50), widełki cen, więcej flag, próbki formatów CEPiK do testów | `data/` |
| C treści | analiza konkurencji, copy landingu, przykładowy raport, 6 artykułów blog, e-maile | `docs/`, `marketing/`, `content/` |
