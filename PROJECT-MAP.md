# Yutubo — Project Map

A YouTube audio-only downloader. Backend: Node.js/Express + yt-dlp (Python). Frontend: vanilla HTML/JavaScript on Vercel.

## Directory Structure

```
yutubo/
├── backend/                          # Node.js/Express backend
│   ├── lib/
│   │   ├── config.js                 # Configuration (version, timeouts, limits)
│   │   ├── validate.js               # URL validation
│   │   ├── ytdlp.js                  # yt-dlp subprocess wrapper
│   │   └── cleanup.js                # Auto-expire temp files & cookies
│   ├── routes/
│   │   ├── health.js                 # GET /api/health
│   │   ├── version.js                # GET /api/version
│   │   ├── cookies.js                # POST /api/cookies (upload)
│   │   ├── analyze.js                # POST /api/analyze (metadata)
│   │   ├── download.js               # POST /api/download (stream)
│   │   └── progress.js               # GET /api/progress/:id (SSE)
│   ├── ytdlp_analyze.py              # yt-dlp Python API wrapper (process=False)
│   ├── generate-pot.js               # PO token generator (Node.js)
│   ├── server.js                     # Express app
│   ├── tmp/                          # Temp files (auto-cleaned, gitignored)
│   ├── cookies/                      # Uploaded cookies (auto-cleaned, gitignored)
│   └── node_modules/                 # Dependencies (gitignored)
├── Descargador.dc.html               # Frontend HTML
├── support.js                        # Frontend utilities
├── Dockerfile                        # Docker build (includes bgutil Script Mode)
├── docker-compose.yaml               # Local dev: bgutil + backend
├── package.json                      # Dependencies
├── .env                              # AIOX config (gitignored)
├── .env.example                      # AIOX template (gitignored by default)
├── .gitignore                        # Ignore sensitive data & runtime files
├── cookies.txt                       # User cookies (gitignored)
├── CHANGELOG.md                      # Version history
└── PROJECT-MAP.md                    # This file

## Sensitive Data — Protected

| File | Reason | Action |
|------|--------|--------|
| `.env` | AIOX API keys (DeepSeek, OpenRouter, etc.) | Gitignored ✓ |
| `cookies.txt` | User's YouTube session cookies | Gitignored ✓ |
| `backend/cookies/` | Uploaded cookies (ephemeral) | Gitignored ✓ |
| `docker-compose.local.yaml` | Local overrides with secrets | Gitignored ✓ |
| `docker-compose.override.yaml` | Docker Compose local override | Gitignored ✓ |

**Note:** The committed `docker-compose.yaml` contains no secrets — it references environment variables only (e.g., `${CORS_ORIGINS}`) and uses public Docker images. Local development may override it via `docker-compose.override.yaml` with actual values.

## Key Components

### Backend API

- **`POST /api/cookies`** — Upload Netscape-format `cookies.txt`
- **`POST /api/analyze`** — Extract video/playlist metadata
- **`POST /api/download`** — Stream MP3 or MP4 (direct to browser)
- **`GET /api/progress/:id`** — Server-Sent Events for download progress
- **`GET /api/health`** — Status check
- **`GET /api/version`** — Current app version

### Frontend

- Single HTML file with embedded CSS/JavaScript (no build)
- Vanilla JS, no frameworks
- Fetches `/api/version` on mount → displays `v X.Y.Z` in footer
- YouTube-only, audio-only (MP3 format)

### yt-dlp Integration

- **`ytdlp_analyze.py`** — Python API wrapper with `process=False` (skips format selection)
  - Loads cookies via `YoutubeDLCookieJar` (pre-loaded, more reliable than `cookiefile`)
  - Attempts to generate PO tokens via `generate-pot.js` subprocess (8s timeout)
  - Uses Chrome TLS impersonation to bypass datacenter-IP fingerprint blocking
  - `player_client` list: `android_testsuite`, `mweb`, `web_creator`, `android_vr`, `web_embedded`, `ios`, `android`, `web`

- **`generate-pot.js`** — Generates YouTube PO tokens using `youtube-po-token-generator` (Node.js)
  - Calls YouTube's BotGuard endpoint — fails silently on datacenter IPs (Node.js TLS blocked by YouTube)

- **bgutil Script Mode** — Alternative PO token provider (Dockerfile)
  - Builds `bgutil-ytdlp-pot-provider` 1.3.1 at `~/bgutil-ytdlp-pot-provider`
  - Runs as Node.js subprocess (no HTTP server) when yt-dlp needs a PO token for `web` client
  - Calls Google APIs, not YouTube (bypasses Node.js TLS block)

## Deployment

### HuggingFace Spaces (Backend)
- Dockerfile built and deployed to: `https://juanfelipe1-yutubo-backend.hf.space`
- Environment: `NODE_ENV=production`, `ANALYZE_TIMEOUT_MS=90000`

### Vercel (Frontend)
- Static HTML hosted at: `https://yutubo.vercel.app`
- Fetches API from HF Space

## Development

### Running Locally

```bash
# Backend only (requires Python, yt-dlp, Node.js)
npm install
npm start

# Backend + bgutil (requires Docker)
docker-compose up

# Frontend
Open Descargador.dc.html in browser
```

### Environment Variables

No secrets are required for local development. The app works with defaults:
- `PORT=3000` (backend)
- `CORS_ORIGINS=*` (allow any origin — safe for localhost)
- `ANALYZE_TIMEOUT_MS=60000` (60 seconds, overridden to 90s in production)

## Security Notes

1. **No persistent storage** — all downloads and cookies are ephemeral (auto-deleted)
2. **Cookies are not logged** — `console.error` in production is disabled
3. **URL validation** — all URLs are validated upstream before reaching yt-dlp
4. **Subprocess safety** — yt-dlp spawned with argv array, never shell strings
5. **CORS default to `*`** — intentional for localhost; production uses `https://yutubo.vercel.app` only

## Version History

- **1.2.0** (2026-06-24) — bgutil Script Mode + expanded player_client list
- **1.1.0** (2026-06-23) — YouTube audio-only refactor + version endpoint
- **1.0.0** (2026-06-23) — Initial release

See `CHANGELOG.md` for details.
