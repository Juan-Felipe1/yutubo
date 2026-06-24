# Changelog

All notable changes to Yutubo are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-23

First stable release. A YouTube downloader with a Node.js/Express backend
(yt-dlp powered, deployed to HuggingFace Spaces via Docker) and a frontend
on Vercel.

### Added

- **yt-dlp Python wrapper** (`backend/ytdlp_analyze.py`) — extracts video/playlist
  metadata via the yt-dlp Python API with `process=False`, so videos whose format
  URLs are withheld (PO-token-gated from datacenter IPs) still return metadata.
  Uses Chrome TLS impersonation to reduce datacenter-IP fingerprint blocking.
- **Cookies upload** (`POST /api/cookies`) — accepts a Netscape-format `cookies.txt`,
  validates it, and stores it as `cookies/<uuid>.txt` for later analyze/download
  calls. Files auto-expire (default 24h) via the cleanup sweeper.
- **Analyze endpoint** (`POST /api/analyze`) — returns normalized metadata for a
  single video or a playlist, with path-traversal-safe `cookiesId` resolution.
- **Download endpoint** (`POST /api/download`) — streams merged MP4 (up to 2160p)
  or extracted MP3 (up to 320 kbps) straight to the client; nothing is persisted.
- **Progress feed** (`GET /api/progress/:id`) — Server-Sent Events for live
  download progress (percent, speed, ETA).
- **Health endpoint** (`GET /api/health`) — status + version.
- **Version endpoint** (`GET /api/version`) — returns `{ version, name }`, sourced
  from `lib/config`. Lets the frontend confirm which build is live after a
  HuggingFace Space rebuild (the old container may serve briefly during a deploy).
- **Docker / HuggingFace deployment** — containerized backend running on a
  HuggingFace Space; frontend hosted on Vercel.

### Known limitations

- **PO token graceful fallback** — `ytdlp_analyze.py` attempts to generate a YouTube
  PO (Proof of Origin) token via `generate-pot.js` to bypass datacenter-IP bot
  detection. On HuggingFace's datacenter IPs, YouTube's BotGuard endpoint rejects
  Node.js TLS, so token generation fails silently and the analysis continues
  without it. This is by design — the system never crashes on a missing PO token.
- **ip_blocked error messaging** — when YouTube returns "Sign in to confirm you're
  not a bot" (`ip_blocked`) *and* cookies were already supplied, the API now responds
  with "Este video requer verificação adicional que não é possível desde servidores
  em nuvem." instead of asking the user to upload cookies they already provided.
  Some PO-gated videos remain unservable from cloud servers regardless of cookies —
  this is a YouTube-side restriction, not a Yutubo bug.

[1.0.0]: https://github.com/Juan-Felipe1/yutubo/releases/tag/v1.0.0
