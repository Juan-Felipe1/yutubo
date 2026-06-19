# Yutubo Backend API

Node.js + Express backend that powers the Yutubo downloader. It wraps
[`yt-dlp`](https://github.com/yt-dlp/yt-dlp) as a subprocess to analyze YouTube
URLs and stream downloads (MP4 video / MP3 audio) directly to the client —
nothing is stored permanently on the server.

## Requirements

| Dependency | Version | Why |
|------------|---------|-----|
| Node.js    | 20.x    | Runtime |
| Python 3   | 3.x     | Required by yt-dlp |
| yt-dlp     | latest  | Download engine (`pip3 install yt-dlp`) |
| ffmpeg     | latest  | Merging video+audio, MP3 extraction |
| Deno       | latest  | **Required in 2026** to resolve YouTube signatures |

> Without Deno installed, yt-dlp downloads fail with HTTP 403 even with a proxy.

## Install

```bash
cd backend
npm install

# System deps (Ubuntu)
sudo apt install -y python3 python3-pip ffmpeg
pip3 install yt-dlp
curl -fsSL https://deno.land/install.sh | sh   # then add ~/.deno/bin to PATH
```

## Run

```bash
npm start          # production (PORT=3000 by default)
npm run dev        # auto-restart on changes (node --watch)
```

## Configuration (environment variables)

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` on the server |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins (e.g. `https://yutubo.vercel.app`) |
| `YTDLP_BIN` | `yt-dlp` | Path/name of the yt-dlp binary |
| `MAX_CONCURRENT_DOWNLOADS` | `2` | Simultaneous download limit (returns 429 beyond this) |
| `ANALYZE_TIMEOUT_MS` | `30000` | Timeout for `/api/analyze` |
| `MAX_COOKIE_BYTES` | `1048576` | Max cookies.txt upload size (1 MB) |
| `TMP_MAX_AGE_MS` | `3600000` | Stale tmp file TTL (1h) |
| `COOKIE_MAX_AGE_MS` | `86400000` | Uploaded cookies TTL (24h) |

## API

### `GET /api/health`
```json
{ "status": "ok", "version": "1.0.0" }
```

### `POST /api/analyze`
Request:
```json
{ "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw", "cookiesId": "optional-uuid" }
```
Video response:
```json
{
  "type": "video",
  "id": "jNQXAC9IVRw",
  "title": "...",
  "channel": "...",
  "duration": "0:19",
  "meta": "300M vistas · 23/04/2005",
  "thumbnail": "https://..."
}
```
Playlist response:
```json
{
  "type": "playlist",
  "title": "...",
  "channel": "...",
  "count": 10,
  "items": [{ "id": "...", "title": "...", "duration": "4:32" }]
}
```
Errors: `400 invalid_url`, `400 analyze_failed`, `400 ip_blocked`, `504 analyze_timeout`.

### `POST /api/download`
Request:
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "mp4",
  "quality": "1080p",
  "downloadId": "client-generated-uuid",
  "cookiesId": "optional-uuid"
}
```
- `format`: `mp4` | `mp3`
- `quality` (mp4): `2160p` `1440p` `1080p` `720p` `480p` `360p`
- `quality` (mp3): `320 kbps` `256 kbps` `192 kbps` `128 kbps`

Streams the file with `Content-Disposition: attachment`. Returns `429 queue_full`
(with `Retry-After`) when the concurrency limit is reached.

### `GET /api/progress/:id` (SSE)
Server-Sent Events keyed by the `downloadId`. Each event:
```
data: {"percent":45.3,"speed":"1.5MiB/s","eta":"00:07","status":"downloading"}
```
`status`: `pending` → `starting` → `downloading` → `done` | `error`.

### `POST /api/cookies` (multipart/form-data)
Field `cookies` = a Netscape `cookies.txt` exported from your browser. Returns:
```json
{ "cookiesId": "uuid" }
```
Pass `cookiesId` to `/api/analyze` and `/api/download` to bypass YouTube's
datacenter IP blocking.

## Smoke test (curl)

```bash
# Health
curl http://localhost:3000/api/health

# Analyze
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=jNQXAC9IVRw"}'

# Download (writes file to disk)
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=jNQXAC9IVRw","format":"mp4","quality":"720p","downloadId":"test-123"}' \
  --output test.mp4
```

## Project layout

```
backend/
├── server.js          Express app + middleware + startup
├── routes/
│   ├── analyze.js     POST /api/analyze
│   ├── download.js    POST /api/download (streaming + queue)
│   ├── progress.js    GET  /api/progress/:id (SSE)
│   └── cookies.js     POST /api/cookies (upload)
├── lib/
│   ├── config.js      Centralized config (env-driven)
│   ├── ytdlp.js       yt-dlp subprocess wrapper + quality mapping
│   ├── validate.js    URL validation (SSRF guard)
│   ├── queue.js       Concurrency gate (max 2)
│   ├── progress.js    In-memory progress registry (for SSE)
│   └── cleanup.js     Periodic tmp/cookies sweeper
├── tmp/               Transient yt-dlp files (gitignored)
└── cookies/           Uploaded cookies.txt (gitignored)
```

## Deployment

See `../deploy/nginx.conf` and `../deploy/yutubo-backend.service` for the
nginx reverse-proxy and systemd unit templates used on Oracle Cloud.
Deploy the service to `/opt/yutubo-backend`.
