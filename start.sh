#!/bin/sh

# Start bgutil PO token server (pre-compiled from official image, listens on 4416)
echo "[bgutil] Starting PO token server..."
node /opt/bgutil/index.js &
BGUTIL_PID=$!

# Wait up to 15s for bgutil HTTP server to respond
echo "[bgutil] Waiting for server to be ready..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:4416/ > /dev/null 2>&1 || \
     curl -sf http://localhost:4416/health > /dev/null 2>&1; then
    echo "[bgutil] Server ready (${i}s)"
    break
  fi
  sleep 1
done

echo "[yutubo] Starting backend on port ${PORT}..."
exec node /app/server.js
