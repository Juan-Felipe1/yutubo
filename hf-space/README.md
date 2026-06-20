---
title: Yutubo Backend
emoji: 📥
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
---

# Yutubo Backend

API backend para download de vídeos e áudio do YouTube, Facebook, Instagram e TikTok.

## Endpoints

- `POST /api/analyze` — extrai metadata de uma URL (título, canal, duração, qualidades)
- `POST /api/download` — inicia streaming de download (MP4 ou MP3)
- `GET /api/progress/:id` — SSE de progresso do download
- `POST /api/cookies` — upload de cookies.txt (mitigação bloqueio YouTube em datacenters)
- `GET /api/health` — health check: `{ "status": "ok", "version": "1.0.0" }`

## Nota sobre bloqueio do YouTube

O YouTube bloqueia IPs de datacenters em 2026. Se downloads falharem com erro "Sign in to confirm you're not a bot", exporte seus cookies do browser com a extensão "Get cookies.txt locally" e faça upload via `POST /api/cookies`.
