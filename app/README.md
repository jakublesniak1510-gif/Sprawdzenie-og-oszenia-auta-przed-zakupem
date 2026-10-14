# Aplikacja „Sprawdź ogłoszenie auta przed zakupem”

Next.js 16 (App Router) + TypeScript + Tailwind 4. SQLite (better-sqlite3), Claude API, Stripe Checkout (BLIK / Przelewy24 / karta).

## Uruchomienie

Wymagany Node.js 20.9+ (testowane na 22).

```bash
cd app
npm install
cp .env.example .env.local   # uzupełnij klucze (patrz niżej)
npm run dev                  # http://localhost:3000
```

Inne komendy:

| Komenda | Co robi |
|---|---|
| `npm run build` / `npm start` | build produkcyjny i serwer |
| `npm run test` | testy jednostkowe (vitest): anonimizacja, parser CEPiK, reguły raportu, szyfrowanie zdjęć, kupony, rate limit, webhook, szybki test |
| `npm run typecheck` | sprawdzenie typów |
| `npm run cleanup` | kasuje raporty starsze niż 30 dni i zdjęcia starsze niż 48 h (cron co godzinę / raz dziennie) |
| `npm run followup` | e-maile: „nie dokończono płatności” (po 2 h) i „czy kupiłeś?” (po 7 dniach) – cron co godzinę |
| `npm run coupon -- create --uses 5 --days 365` | ręczny kupon (np. dla influencera); `npm run coupon -- list` – lista |
| `npm run build:scripts` | bundluje skrypty crona do `dist-scripts/*.cjs` (używane w Dockerze) |

## Test bez Stripe i bez klucza API

W `.env.local`:

```
DEV_SKIP_PAYMENT=1   # pomija płatność – raport generuje się od razu
AI_MOCK=1            # atrapa AI – przykładowy raport bez wywołania Claude API
```

Wejdź na `/sprawdz`, wklej dowolny tekst (min. 100 znaków), przejdź kroki i kliknij „Generuj raport (tryb testowy)”.
Po ok. 2,5 s (`AI_MOCK_DELAY_MS`) raport pojawi się pod `/raport/<id>`.

Z prawdziwym modelem: ustaw `ANTHROPIC_API_KEY`, `AI_MOCK=0` (domyślny model: `claude-sonnet-5-5`, zmiana przez `ANTHROPIC_MODEL`).

### Stripe lokalnie

1. Klucz testowy `sk_test_…` w `STRIPE_SECRET_KEY`, `DEV_SKIP_PAYMENT=0`.
2. W Dashboard → Settings → Payment methods włącz BLIK i Przelewy24 (waluta PLN).
3. `stripe listen --forward-to localhost:3000/api/stripe/webhook` i wpisz wypisany `whsec_…` w `STRIPE_WEBHOOK_SECRET`.
4. Nawet bez webhooka strona powrotu (`/raport/<id>?session_id=…`) sama sprawdza status płatności w Stripe.

## Jak to działa

1. Formularz (`components/CheckForm.tsx`) – 4 kroki; zdjęcia zmniejszane w przeglądarce (max 1280 px, JPEG 0,8).
2. `POST /api/reports` – rate limit (5 / 10 min / IP), limit body 6 MB (413), walidacja (zod), zdjęcia tylko JPEG
   (magic bytes), **anonimizacja** (`lib/anonymize.ts`) tekstu ogłoszenia, historii i ofert, zapis do SQLite (bez zdjęć).
   Zdjęcia: `data/images/<id>/<n>.jpg` zaszyfrowane AES-256-GCM (`lib/image-cache.ts`), usuwane po wygenerowaniu.
   Opcjonalne pole `coupon` – ważny kupon pomija płatność.
3. Płatność Stripe → webhook `POST /api/stripe/webhook` (idempotentny, weryfikuje kwotę i walutę) → status `paid` →
   kolejka generowania (`lib/queue.ts`, max 2 równolegle) → `lib/generate.ts` (do 3 prób).
4. `lib/ai/` – prompt `prompts/raport.md`, wywołanie Claude z jednym narzędziem `zapisz_raport` (JSON Schema ze
   `lib/report-schema.ts`, `strict: true`), walidacja zod + jedna ponowna próba. Potem twarde reguły (`postProcess`):
   usterki wyłącznie z bazy (koszty z bazy), przebiegi z naszego parsera, sekcje zależne od pakietu.
5. `/raport/[id]` – odświeża się co 3 s do gotowości; wersja do druku przez `@media print`.

Statusy raportu: `pending_payment → paid → generating → done | error`, a `pending_payment → expired`, gdy sesja Stripe
wygaśnie (link „Dokończ płatność”: `GET /api/reports/<id>/zaplac`). Przy `error` jest przycisk „Spróbuj ponownie”
(jedna dodatkowa próba).

Parser CEPiK (`lib/cepik.ts`, `parseCepik`) wyciąga z wklejonej historii odczyty przebiegu, daty pierwszej rejestracji
(za granicą / w Polsce) oraz sygnały i uwagi (import, cofnięcie licznika, przerwa w badaniach, okres bez OC, kradzież,
wyrejestrowanie, brak aktualnego OC/badania…); uwagi trafiają do promptu. Testy na próbkach `data/samples/cepik/*.txt`
(oczekiwany wynik w `*.expected.json`).

Flagi liczone przez aplikację (`lib/computed-flags.ts`, wspólne dla szybkiego testu i raportu): `cena-ponizej-widelek`
(cena > 15% poniżej `price_ranges` przy przebiegu ≤ `km_max`), `opis-idealny-cena-niska`, `przebieg-roczny-nietypowy`
(< 6 tys. lub > 40 tys. km/rok) i `vin-vs-model` (WMI z VIN jawnie wskazuje inną markę; nieznany WMI = brak oceny).
Do promptu trafiają też pytania z `data/questions-by-category.json` dla kategorii trafionych flag (bez powtórzeń);
`getGlossary()` (`lib/glossary.ts`) zwraca `data/glossary.json` do tooltipów.

### Odporność generowania

- Licznik prób (`reports.attempts`, max 3). Błąd przejściowy (limit API, 5xx, sieć) → powrót do `paid` i ponowienie po
  30 s × numer próby. Błąd ostateczny (limit prób, odmowa modelu, błędny klucz) → `error` z komunikatem dla klienta,
  szczegóły w logu serwera i w zdarzeniu `raport_blad` (panel admina). Zdjęcia są wtedy usuwane.
- Wznowienie po restarcie: `instrumentation.ts` → `lib/startup.ts` przy starcie oznacza raporty `generating` starsze
  niż 10 min jako `paid` i wrzuca wszystkie `paid` do kolejki; to samo robi watchdog co 5 min.
- Blokady produkcyjne: przy `NODE_ENV=production` serwer **nie wystartuje**, jeśli `DEV_SKIP_PAYMENT=1`, `AI_MOCK=1`
  albo brak `IMAGE_ENCRYPTION_KEY` (obejście tylko świadomie: `ALLOW_UNSAFE_PROD=1`).
- Nagłówki bezpieczeństwa (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS) – `next.config.ts`.

### Koszty Claude API (prompt caching)

`lib/ai/claude.ts` oznacza definicję narzędzia `zapisz_raport` i prompt systemowy `cache_control: {type: "ephemeral"}`
(stały prefiks; dane ogłoszenia, wpis bazy modelu i zdjęcia są w wiadomości użytkownika – zmienne, niecache'owane).
Każde wywołanie zapisuje `usage` do tabeli `ai_usage` (wejście, odczyt z cache, zapis do cache, wyjście, koszt w USD
liczony z cennika `lib/ai/pricing.ts` – zaktualizuj przy zmianie cen). Sprawdzenie, czy cache działa: w logu
`[ai] usage … cache_read=` powinno być > 0 od drugiego raportu w ciągu 5 minut.

## API

| Endpoint | Opis |
|---|---|
| `POST /api/szybki-test` | darmowy szybki test bez AI: `{tekst, cena?, przebieg?, rocznik?}` → `{rozpoznany, flagi[], usterki_top3[], cena: {pozycja: ponizej\|w_normie\|powyzej\|brak_danych, komentarz}, brak_vin, nastepny_krok}`. Limit 20 / 10 min / IP |
| `POST /api/reports` | zamówienie raportu (formularz `/sprawdz`), pole `coupon` opcjonalne |
| `GET /api/reports/<id>/zaplac` | wznowienie płatności (link z e-maila i ze strony raportu) |
| `GET /api/reports/<id>/kupil?odp=tak\|nie` | odpowiedź z e-maila „Kupiłeś to auto?” → zapis + przekierowanie do opinii |
| `POST /api/models/detect` | rozpoznanie modelu z tekstu (limit 30 / min / IP) |
| `POST /api/coupons/check` | walidacja kodu `{code, oferta?}` → `{valid, message}` (bez liczby użyć) |
| `POST /api/coupons/buy` | zakup pakietu 5 raportów `{email?}` → `{redirect}` (Stripe Checkout) |
| `GET /api/coupons/<sessionId>` | kod z opłaconego pakietu (weryfikacja w Stripe); 202 = płatność w toku |
| `POST /api/stripe/webhook` | webhook Stripe |
| `GET /api/health` | healthcheck (sprawdza bazę) |

Przekroczenie limitu → `429` z komunikatem po polsku i nagłówkiem `Retry-After`. Za reverse proxy ustaw `TRUST_PROXY=1`
(IP z pierwszego elementu `X-Forwarded-For`); bez tego wszyscy klienci dzielą jeden limit.

## E-mail

Dostawca przez `EMAIL_PROVIDER`:

- `resend` – `RESEND_API_KEY`, domena nadawcy zweryfikowana w Resend; wysyłka przez REST API (bez SDK),
- `smtp` – `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (`SMTP_SECURE=1` dla portu 465), przez nodemailer,
- `none` (domyślnie) – nic nie wysyła, loguje temat i zamaskowany adres.

Nadawca `EMAIL_FROM`, opcjonalnie `EMAIL_REPLY_TO`. E-mail klienta jest opcjonalny (pole `email` w formularzu).

| E-mail | Kiedy |
|---|---|
| Raport gotowy (link + data ważności) | od razu po wygenerowaniu |
| Nie dokończono płatności (link „dokończ płatność”) | `npm run followup`: 2–48 h po utworzeniu nieopłaconego zamówienia |
| Kupiłeś to auto? (przyciski tak/nie) | `npm run followup`: 7 dni po raporcie, jeśli nie było opinii |
| Kod z pakietu 5 raportów | po opłaceniu pakietu |

Treści: jeśli istnieje `content/emails/*.md` (np. `raport-gotowy.md`, `platnosc-niedokonczona.md`, `czy-kupiles.md`,
`kupon-pakiet.md`) – są źródłem; w przeciwnym razie treść wbudowana (`lib/email-templates.ts`). Temat: pierwsza linia
`temat: …`, nagłówek YAML albo `# Nagłówek`. Zmienne: `{{link}}`, `{{data_waznosci}}`, `{{link_tak}}`, `{{link_nie}}`,
`{{kod}}`, `{{liczba_raportow}}`, `{{model}}` – nieznana zmienna zostaje pusta i trafia do logu jako ostrzeżenie.
Każdy e-mail wysyłamy najwyżej raz na raport (kolumny `*_sent_at`).

## Kupony i pakiet 5 raportów

- „Pakiet 5 raportów” (`PRICE_PAKIET5_GR`, domyślnie 49 zł): `POST /api/coupons/buy` → Stripe Checkout → po opłaceniu
  (webhook albo strona powrotu `/pakiet/dziekujemy?session_id=…` → `GET /api/coupons/<sessionId>`) powstaje kupon na
  5 raportów „Raport”, ważny 365 dni; kod idzie e-mailem i jest pokazywany na stronie.
- Kod: 8 znaków bez mylących znaków (bez 0/O, 1/I/L), wyświetlany jako `ABCD-EFGH`; wielkość liter i myślnik bez znaczenia.
- W formularzu: pole `coupon` w `POST /api/reports` – ważny kod pomija płatność; `uses_left` zmniejszane atomowo
  (jedno `UPDATE … WHERE uses_left > 0` w transakcji `BEGIN IMMEDIATE` razem z utworzeniem raportu).
- Ręcznie (influencerzy): `npm run coupon -- create --uses 5 --days 365 [--offer raport|raport_plus|any] [--count 10] [--note nazwa]`.
  W Dockerze: `docker compose exec app node dist-scripts/coupon.cjs create --uses 5 --days 365`.

## Panel admina

`/admin` – Basic Auth z `ADMIN_USER` / `ADMIN_PASSWORD` (`proxy.ts` – w Next 16 dawne `middleware.ts`); bez tych
zmiennych panel zwraca 404. Zawiera: lejek z 7 i 30 dni (szybkie testy → raporty → opłacone → wygenerowane), przychód
(raporty i pakiety), szacowany koszt AI i tokeny, średni czas generowania, odpowiedzi „czy kupiłeś?”, ostatnie 20 opinii,
ostatnie błędy generowania i listę kuponów.

## Analityka (bez cookies)

Tabela `events` (`lib/analytics.ts`, `track(name, props)`): `szybki_test`, `raport_utworzony`, `platnosc_rozpoczeta`,
`platnosc_oplacona`, `raport_wygenerowany`, `raport_blad`, `feedback`, `pakiet_kupiony`, `kupon_uzyty`. Adres IP zapisujemy
tylko jako skrót SHA-256 z losowym dziennym saltem (salt z poprzedniego dnia jest kasowany – skrótów nie da się odwrócić
ani powiązać między dniami). Brak cookies i zewnętrznych skryptów.

## Jak dodać model do bazy

1. Utwórz plik `data/models/<id>.json` zgodny ze schematem `data/schema/model.schema.json`
   (wzór: `app/fixtures/example-model.json`). `id` = nazwa pliku, małe litery i myślniki, np. `toyota-corolla-e21`.
2. W `aliases` (model i silniki) wpisz warianty nazw z ogłoszeń małymi literami (`"corolla e21"`, `"1.8 hybrid"`) –
   po nich aplikacja rozpoznaje model z tekstu.
3. Nic nie trzeba przebudowywać: formularz czyta katalog przy każdym żądaniu, strony `/usterki/<id>` odświeżają się
   co godzinę (lub od razu po `npm run build`). Pliki niezgodne ze schematem są pomijane z ostrzeżeniem w logu serwera.

Gdy `data/models/` jest pusty, `MODELS_INCLUDE_FIXTURES=1` dołącza przykładowy model z `fixtures/` (tylko do testów).

Opcjonalnie: heurystyki czerwonych flag z `data/red-flags.json` (lub `data/red-flags/*.json`, schemat
`data/schema/red-flags.schema.json`) – trafienia trafiają do promptu jako wskazówki. Wzór umowy (Raport+) – pierwszy
plik `*umowa*.md` w `data/` (strona `/umowa`). Regulamin i polityka – `docs/regulamin.md`, `docs/polityka-prywatnosci.md`.

## Prywatność (RODO w kodzie)

- Telefony, e-maile, numery rejestracyjne, linki i dane kontaktowe wycinane przed zapisem i przed wysłaniem do modelu (VIN zostaje).
- Zdjęcia nie trafiają do bazy. Do czasu wygenerowania raportu leżą na dysku zaszyfrowane AES-256-GCM
  (`IMAGE_ENCRYPTION_KEY`), po raporcie są kasowane; nieużyte – po 48 h (`npm run cleanup`).
- Raporty i dane wejściowe wygasają po 30 dniach (`npm run cleanup`).
- Analityka bez cookies, IP tylko jako dzienny skrót. Logi e-maili z zamaskowanym adresem.

## Docker

Pliki: `Dockerfile` (multi-stage, `node:22-alpine`, Next `output: "standalone"`, kompilacja better-sqlite3 pod musl),
`Dockerfile.dockerignore`, `docker-compose.yml`. Kontekst budowania to **katalog główny repo** (aplikacja czyta
`../data`, `../docs`, `../content`).

```bash
cd app
cp .env.example .env        # uzupełnij: klucze, IMAGE_ENCRYPTION_KEY, APP_URL, e-mail, ADMIN_*
docker compose up -d --build
docker compose ps           # app: healthy (GET /api/health)
docker compose logs -f app
```

- Usługa `app` – serwer na `127.0.0.1:3000`, wolumen `appdata` → `/srv/app/data` (SQLite + zaszyfrowane zdjęcia).
- Usługa `cron` – ten sam obraz, pętla co godzinę: `followup` (e-maile) i `cleanup` (sprzątanie).
- Kopia zapasowa bazy: `docker compose exec app node -e "require('better-sqlite3')('data/app.db').backup('data/backup.db')"`,
  potem `docker compose cp app:/srv/app/data/backup.db ./backup-$(date +%F).db`.

## Wdrożenie na VPS (Ubuntu 24.04, Docker, Caddy)

1. **Serwer**: VPS z 1–2 GB RAM (np. Hetzner CX22 / OVH), Ubuntu 24.04. Rekord DNS `A` (i `AAAA`) domeny → IP serwera.
2. **Podstawy i zapora**:
   ```bash
   sudo apt update && sudo apt -y upgrade
   sudo adduser deploy && sudo usermod -aG sudo deploy      # pracuj jako zwykły użytkownik
   sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
   ```
3. **Docker** (oficjalne repozytorium):
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER && newgrp docker
   ```
4. **Caddy** (reverse proxy z automatycznym HTTPS):
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```
5. **Aplikacja**:
   ```bash
   git clone <repo> sprawdz && cd sprawdz/app
   cp .env.example .env && nano .env
   #   NODE_ENV jest ustawiany przez compose; ustaw: ANTHROPIC_API_KEY, AI_MOCK=0, DEV_SKIP_PAYMENT=0,
   #   STRIPE_SECRET_KEY=sk_live_…, STRIPE_WEBHOOK_SECRET, APP_URL=https://twojadomena.pl, TRUST_PROXY=1,
   #   IMAGE_ENCRYPTION_KEY=$(openssl rand -hex 32), EMAIL_PROVIDER + klucze, ADMIN_USER/ADMIN_PASSWORD
   docker compose up -d --build
   curl -s http://127.0.0.1:3000/api/health
   ```
6. **HTTPS**: `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile`, zamień `twojadomena.pl` na swoją domenę,
   `sudo systemctl reload caddy`. Certyfikat Let's Encrypt pojawi się sam po pierwszym wejściu.
7. **Stripe**: Dashboard → Developers → Webhooks → endpoint `https://twojadomena.pl/api/stripe/webhook`, zdarzenia
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`; sekret `whsec_…`
   do `.env`, potem `docker compose up -d`. Włącz BLIK i Przelewy24 w Payment methods.
8. **E-mail**: zweryfikuj domenę nadawcy u dostawcy (rekordy SPF/DKIM w DNS), ustaw `EMAIL_FROM`.
9. **Aktualizacja**: `git pull && docker compose up -d --build` (migracje bazy wykonują się same przy starcie).
10. **Kopie zapasowe**: codziennie (cron hosta) polecenie z sekcji Docker + skopiowanie pliku poza serwer.
    Sekret `IMAGE_ENCRYPTION_KEY` trzymaj też poza serwerem (bez niego nie odczytasz zdjęć oczekujących raportów).

## Ograniczenia MVP

- Kolejka generowania i rate limit są w pamięci jednego procesu Node – wystarcza na jednym VPS; przy wielu instancjach
  trzeba je przenieść (np. Redis) i współdzielić katalog zdjęć. Stan raportów jest w SQLite, więc restart niczego nie gubi.
- Hosting musi trzymać proces (nie serverless) – generowanie działa w tle.
