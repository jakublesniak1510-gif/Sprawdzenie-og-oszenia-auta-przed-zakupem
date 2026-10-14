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

## Stan po rundzie 2 (2026-10-14)

Zrobione i zweryfikowane: testy 239/239, typecheck, build 69 stron, walidacja bazy OK, niezależny przegląd bezpieczeństwa (0 krytycznych, 16 z 17 znalezisk naprawionych; pominięto CSP z nonce, bo wymaga dynamicznego renderowania stron).

Do zrobienia przez właściciela przed startem:
1. Klucze: `ANTHROPIC_API_KEY`, Stripe (sekret, webhook z `checkout.session.completed`, `expired`, `async_payment_failed`), `IMAGE_ENCRYPTION_KEY`, `ADMIN_USER/ADMIN_PASSWORD`, e-mail (Resend lub SMTP), `APP_URL`.
2. Test 10–20 prawdziwych ogłoszeń z prawdziwym kluczem (procedura w `docs/plan-wdrozenia.md`); ocena halucynacji i kosztu (panel `/admin` pokazuje koszt AI).
3. Kalibracja widełek cen w `data/models/*.json` na prawdziwych ogłoszeniach – to szacunki, flaga „cena poniżej rynku” zależy od nich.
4. Weryfikacja wpisów oznaczonych jako niepewne (lista w `data/README.md` i raportach pracownika B) z mechanikiem.
5. Prawnik: regulamin, polityka, reklama porównawcza na landingu (nazwy autoDNA/carVertical), prawo odstąpienia przy kuponie.
6. Wdrożenie: VPS + Docker + Caddy (`app/README.md`), obraz Dockera nie był budowany w tym środowisku.
