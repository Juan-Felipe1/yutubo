#!/bin/sh

# Start bgutil PO token server in background (generates YouTube PO tokens without user cookies)
echo "[bgutil] Starting PO token server on port 4416..."
cd /opt/bgutil/server && npm start &

# Give bgutil a few seconds to initialize before accepting requests
sleep 4

echo "[yutubo] Starting backend on port ${PORT}..."
exec node /app/server.js
