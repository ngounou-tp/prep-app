# syntax=docker/dockerfile:1
# The Bifrost gateway beside Foreword, on Railway (private) or Render (public): the official image,
# pinned, plus config.json. The config holds no secret, only env.NAME references, so it is safe in git. The
# dashboard needs the admin login and every model call needs the virtual key. The image runs as an
# unprivileged user (UID 1000). It listens on :: so both IPv4 and IPv6 private networking reach it.
FROM maximhq/bifrost:v2.5.1

USER root
RUN mkdir -p /app/gateway && chown appuser:0 /app/gateway && chmod g=rwX /app/gateway
COPY --chown=appuser:0 config.json /app/gateway/config.json
USER appuser

ENV APP_DIR=/app/gateway \
    APP_HOST=:: \
    APP_PORT=10000 \
    LOG_STYLE=json
EXPOSE 10000
