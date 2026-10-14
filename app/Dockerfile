# syntax=docker/dockerfile:1
#
# Obraz produkcyjny (Next.js standalone + SQLite). Kontekst budowania = KATALOG GŁÓWNY REPO
# (aplikacja czyta ../data, ../docs, ../content):
#   docker build -f app/Dockerfile -t sprawdz-ogloszenie .
# albo po prostu: cd app && docker compose up -d --build

ARG NODE_IMAGE=node:22-alpine

# ── 1. Zależności (better-sqlite3 to moduł natywny – kompilacja pod musl wymaga python3/make/g++) ──
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /repo/app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2. Build ──
FROM ${NODE_IMAGE} AS builder
WORKDIR /repo
COPY . .
COPY --from=deps /repo/app/node_modules ./app/node_modules
WORKDIR /repo/app
ENV NEXT_TELEMETRY_DISABLED=1
# Katalogi opcjonalne – muszą istnieć dla COPY w etapie 3.
RUN mkdir -p public prompts fixtures /repo/content /repo/docs /repo/data \
 && npm run build \
 && npm run build:scripts

# ── 3. Runtime ──
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S -G app app
WORKDIR /srv/app

# Serwer standalone (outputFileTracingRoot = katalog repo, więc server.js ląduje w app/).
COPY --from=builder /repo/app/.next/standalone /srv/
COPY --from=builder /repo/app/.next/static /srv/app/.next/static
COPY --from=builder /repo/app/public /srv/app/public
# Pliki czytane z dysku w runtime (nie wykrywa ich śledzenie zależności Next).
COPY --from=builder /repo/app/prompts /srv/app/prompts
COPY --from=builder /repo/app/fixtures /srv/app/fixtures
COPY --from=builder /repo/data /srv/data
COPY --from=builder /repo/docs /srv/docs
COPY --from=builder /repo/content /srv/content
# Skrypty crona (zbundlowane esbuildem) + pełny moduł natywny SQLite dla nich.
COPY --from=builder /repo/app/dist-scripts /srv/app/dist-scripts
COPY --from=builder /repo/app/node_modules/better-sqlite3 /srv/app/node_modules/better-sqlite3
COPY --from=builder /repo/app/node_modules/node-addon-api /srv/app/node_modules/node-addon-api

RUN mkdir -p /srv/app/data && chown -R app:app /srv/app/data
USER app
VOLUME ["/srv/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
