# Base image manifests verified against the registries on 2026-10-09.
# Builder/runtime use the same Debian family; update digests deliberately.
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS client
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY scripts/offlinePlugin.ts ./scripts/offlinePlugin.ts
COPY public ./public
COPY src ./src
RUN npm run build:server

FROM hexpm/elixir:1.19.5-erlang-28.2-debian-bookworm-20260824-slim@sha256:246d62ac57f0e6424a346c527f152efd8bb97bc7aca0ce8b484ac27b67c5ad7c AS server
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /build
ENV MIX_ENV=prod
RUN mix local.hex --force && mix local.rebar --force
COPY api/mix.exs api/mix.lock ./
COPY api/config ./config
RUN mix deps.get --only prod && mix deps.compile
COPY api/lib ./lib
COPY api/priv/gettext ./priv/gettext
COPY api/priv/repo ./priv/repo
COPY api/priv/static/robots.txt api/priv/static/favicon.ico ./priv/static/
COPY --from=client /build/api/priv/static/app ./priv/static/app
RUN mix compile && mix release --path /release

FROM debian:bookworm-20261005-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 ca-certificates curl && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 izzy && useradd --uid 10001 --gid izzy --home-dir /app --no-create-home --shell /usr/sbin/nologin izzy
WORKDIR /app
COPY --from=server --chown=izzy:izzy /release ./
RUN install -d -o izzy -g izzy -m 0700 /app/tmp
# Supply PUBLIC_ORIGIN and SECRET_KEY_BASE at runtime, never as build args.
# Distribution is disabled: this app deliberately has one session-owning node.
ENV LANG=C.UTF-8 \
    PHX_SERVER=true \
    IZZY_MODE=public \
    PORT=4000 \
    RELEASE_DISTRIBUTION=none \
    ERL_CRASH_DUMP=/dev/null
USER izzy:izzy
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent --show-error --max-time 4 "http://127.0.0.1:${PORT}/health/ready" >/dev/null || exit 1
CMD ["bin/teleprompter", "start"]
