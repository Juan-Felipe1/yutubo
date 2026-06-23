#!/bin/sh

# Start bgutil PO token server in background (generates YouTube PO tokens without user cookies)
echo "[bgutil] Starting PO token server on port 4416..."
cd /opt/bgutil/server && npm start &

# Wait for bgutil HTTP server to be ready
echo "[bgutil] Waiting for server to be ready..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:4416/ > /dev/null 2>&1 || \
     curl -sf http://localhost:4416/health > /dev/null 2>&1; then
    echo "[bgutil] Server ready after ${i}s"
    break
  fi
  sleep 1
done

echo "[yutubo] Starting backend on port ${PORT}..."
exec node /app/server.js
