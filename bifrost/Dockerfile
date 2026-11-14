# syntax=docker/dockerfile:1
# The Bifrost gateway for Render: the official image, pinned, plus config.json. The config holds
# no secret, only env.NAME references, so it is safe in git. It runs file-only: no config store,
# so no admin dashboard to reach from the internet, and every model call needs the virtual key.
FROM maximhq/bifrost:v2.5.1

USER root
RUN mkdir -p /app/gateway && chown appuser:0 /app/gateway && chmod g=rwX /app/gateway
COPY --chown=appuser:0 config.json /app/gateway/config.json
USER appuser

ENV APP_DIR=/app/gateway \
    APP_HOST=0.0.0.0 \
    APP_PORT=10000 \
    LOG_STYLE=json
EXPOSE 10000
