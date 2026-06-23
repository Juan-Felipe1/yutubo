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
- `POST /api/cookies` — upload de cookies.txt (fallback para vídeos com restrição de idade)
- `GET /api/health` — health check: `{ "status": "ok", "version": "1.0.0" }`

## Sobre o bloqueio do YouTube

Este backend usa o **bgutil PO token provider** para gerar tokens de autenticação automaticamente,
sem precisar de cookies do usuário. O bgutil roda como serviço interno no mesmo container.

Casos que ainda precisam de cookies.txt:
- Vídeos com restrição de idade
- Vídeos de membros (membership-only)
