# Yutubo — Opções de Deployment Gratuito

> Pesquisa conduzida em 2026-06-19
> Report completo: `DSN/docs/research/2026-06-19-free-hosting-yutubo/`

---

## Resposta Direta: Vercel serve para o Yutubo?

**Vercel NÃO serve para o backend.** Serve apenas para o frontend.

| Parte do App | Vercel funciona? | Por quê |
|--------------|-----------------|---------|
| Frontend (Descargador.dc.html + support.js) | ✅ SIM | Arquivos estáticos, CDN gratuito |
| Backend (POST /api/analyze, /api/download) | ❌ NÃO | Timeout de 10s, sem subprocess, sem binários |

---

## Por que Vercel não serve para o backend

1. **Timeout de 10 segundos** no free tier (um download de vídeo leva 30s a 10min)
2. **Impossível executar yt-dlp** — ambiente serverless, sem subprocess para CLI Python
3. **Impossível incluir ffmpeg** — limite de 50 MB no bundle total
4. **Sem filesystem persistente** — não pode salvar arquivos temporários
5. **Sem streaming de arquivos grandes** — limite de tamanho de resposta

---

## Opções Reais e Gratuitas (2026)

### Opção 1 — Oracle Cloud Always Free ⭐ MELHOR

**Para quê:** Backend completo do Yutubo (yt-dlp + ffmpeg + API)

| Recurso | Valor |
|---------|-------|
| CPU | 2 OCPUs ARM Ampere |
| RAM | 12 GB |
| Storage | 200 GB |
| Bandwidth | 10 TB/mês |
| Timeout | Ilimitado |
| Custo | $0 para sempre |

- URL: https://cloud.oracle.com/free
- Requer cartão para verificação (não cobra)
- Setup mais trabalhoso (VM raw = você configura nginx, SSL, systemd)
- Instala yt-dlp, ffmpeg, Deno, Node.js livremente

---

### Opção 2 — Render Free Tier ⭐ MAIS SIMPLES (para MVP)

**Para quê:** Deploy rápido para testar/demonstrar o Yutubo

| Recurso | Valor |
|---------|-------|
| CPU | 0.1 vCPU (muito limitado) |
| RAM | 512 MB |
| Timeout | Ilimitado |
| Spin-down | Sim (15 min inatividade → 30-60s cold start) |
| Custo | $0, sem cartão |

- URL: https://render.com
- Deploy via Dockerfile (inclua yt-dlp + ffmpeg no container)
- 0.1 vCPU = downloads LENTOS em produção, OK para MVP

---

### Opção 3 — Koyeb Free Tier (Alternativa ao Render)

Especificações idênticas ao Render (0.1 vCPU, 512 MB, scale-to-zero).
Sem cartão de crédito. Suporte a Docker + Node.js/Python.

- URL: https://koyeb.com

---

### Opção 4 — Google Cloud Run (Praticamente grátis, mais escalável)

| Recurso | Valor |
|---------|-------|
| Requests grátis | 2 milhões/mês |
| Timeout | 60 minutos |
| CPU/RAM | Configurável por request |
| Custo | $0 dentro dos limites free |

- Requer cartão (não cobra dentro do free tier)
- Melhor para escalar no futuro

---

## Arquitetura Recomendada (Split — Gratuito Total)

```
Frontend (arquivos estáticos)     →  Vercel ou Cloudflare Pages ($0)
Backend API + yt-dlp + ffmpeg     →  Oracle Cloud Free VM ($0)
```

---

## ⚠️ Alerta Crítico: YouTube Bloqueia IPs de Datacenters

Em 2026, YouTube bloqueia ativamente os IPs de AWS, GCP, Oracle, Render — TODOS
os servidores cloud. Qualquer plataforma escolhida terá este problema.

**Erro típico:**
```
ERROR: Sign in to confirm you're not a bot.
Use --cookies-from-browser or --cookies for authentication.
```

**Mitigação (necessária em qualquer plataforma):**
- Adicionar upload de `cookies.txt` na UI do Yutubo
- O usuário exporta os próprios cookies do YouTube (extensão "Get cookies.txt locally")
- Backend usa `yt-dlp --cookies cookies.txt URL`

**Requisito adicional em 2026:**
- yt-dlp agora requer **Deno** instalado para resolver assinaturas YouTube
- Sem Deno = erros 403 mesmo com proxy

---

## Plataformas Descartadas

| Plataforma | Motivo |
|------------|--------|
| Fly.io | Free tier extinto em 2026 |
| Railway | Apenas $5 de crédito (não é permanente) |
| Heroku | Free tier extinto desde 2022 |
| Netlify Functions | 10s timeout (mesma limitação do Vercel) |

---

## Próximos Passos

1. Criar `Dockerfile` para o backend (Node.js + yt-dlp + ffmpeg + Deno)
2. Escolher plataforma (Oracle Cloud ou Render para MVP)
3. Implementar suporte a cookies do usuário no backend e na UI
4. Hospedar frontend no Vercel ou Cloudflare Pages
5. Configurar CORS no backend para aceitar requests do domínio do frontend

---

> Para implementação → @dev | Para priorização → @pm
> Research completo: `DSN/docs/research/2026-06-19-free-hosting-yutubo/`
