---
title: Yutubo Backend
emoji: 📥
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Yutubo Backend

API backend para download de vídeos e áudio do YouTube.

## Endpoints

- `POST /api/analyze` — extrai metadata de uma URL (título, canal, duração, qualidades)
- `POST /api/download` — inicia streaming de download (MP4 ou MP3)
- `GET /api/progress/:id` — SSE de progresso do download
- `POST /api/cookies` — upload de cookies.txt (mitigação bloqueio YouTube em datacenters)
- `GET /api/health` — health check: `{ "status": "ok", "version": "1.0.0" }`
