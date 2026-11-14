#!/bin/sh
# Starts the Bifrost gateway in the background, waits for /health, then runs Foreword in the foreground.
# If either process exits the container exits, so Railway restarts it.
GATEWAY_URL="http://127.0.0.1:${APP_PORT:-10001}"

# The entrypoint execs /app/main from /app, so run it from there.
sed 's#/app/main#/app/gateway-bin/main#' /app/gateway-bin/docker-entrypoint.sh > /tmp/gateway-entrypoint.sh
sh /tmp/gateway-entrypoint.sh &
GATEWAY_PID=$!

i=0
until wget -q -O /dev/null "$GATEWAY_URL/health" 2>/dev/null; do
  i=$((i + 1))
  if ! kill -0 "$GATEWAY_PID" 2>/dev/null; then echo "Gateway exited during startup"; exit 1; fi
  if [ "$i" -ge 120 ]; then echo "Gateway not healthy after 120s; starting Foreword anyway"; break; fi
  sleep 1
done

PORT="${PORT:-8080}" node server.js &
APP_PID=$!
trap 'kill $GATEWAY_PID $APP_PID 2>/dev/null' TERM INT
wait -n $GATEWAY_PID $APP_PID
kill $GATEWAY_PID $APP_PID 2>/dev/null
exit 1
