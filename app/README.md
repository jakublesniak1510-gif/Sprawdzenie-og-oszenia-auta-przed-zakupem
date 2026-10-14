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
| `npm run test` | testy jednostkowe (vitest): anonimizacja, parser CEPiK, reguły raportu |
| `npm run typecheck` | sprawdzenie typów |
| `npm run cleanup` | kasuje raporty starsze niż 30 dni (uruchamiaj z crona raz dziennie) |

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
2. `POST /api/reports` – walidacja (zod), **anonimizacja** (`lib/anonymize.ts`) tekstu ogłoszenia, historii i ofert,
   zapis do SQLite (bez zdjęć), zdjęcia tylko w pamięci procesu (`lib/image-cache.ts`, TTL 2 h).
3. Płatność Stripe → webhook `POST /api/stripe/webhook` → status `paid` → generowanie (`lib/generate.ts`).
4. `lib/ai/` – prompt `prompts/raport.md`, wywołanie Claude z jednym narzędziem `zapisz_raport` (JSON Schema ze
   `lib/report-schema.ts`, `strict: true`), walidacja zod + jedna ponowna próba. Potem twarde reguły (`postProcess`):
   usterki wyłącznie z bazy (koszty z bazy), przebiegi z naszego parsera, sekcje zależne od pakietu.
5. `/raport/[id]` – odświeża się co 3 s do gotowości; wersja do druku przez `@media print`.

Statusy raportu: `pending_payment → paid → generating → done | error` (przy `error` jest przycisk „Spróbuj ponownie”).

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
- Zdjęcia nie są zapisywane na dysku ani w bazie.
- Raporty i dane wejściowe wygasają po 30 dniach (`npm run cleanup`).

## Ograniczenia MVP

- Zdjęcia czekają na płatność w pamięci procesu – po restarcie serwera między płatnością a generowaniem raport powstanie bez zdjęć.
  Wymaga to też jednego procesu Node (nie serverless). Generowanie działa w tle (`after()`), więc hosting musi trzymać proces.
- Brak wysyłki e-maili i limitu zapytań (rate limit) na `/api/reports`.
