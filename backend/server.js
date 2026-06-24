'use strict';

/**
 * Yutubo backend API — entry point.
 *
 * Express app exposing:
 *   POST /api/analyze        — metadata for a video/playlist
 *   POST /api/download       — streamed media download (mp4/mp3)
 *   GET  /api/progress/:id   — Server-Sent Events progress feed
 *   POST /api/cookies        — upload cookies.txt (multipart)
 *   GET  /api/version        — backend semantic version + name
 *   GET  /api/health         — health check
 *
 * Backed by yt-dlp (subprocess via execa). Downloads are streamed straight to the
 * client; nothing is persisted permanently. See README.md for deploy details.
 */

const express = require('express');
const cors = require('cors');

const config = require('./lib/config');
const cleanup = require('./lib/cleanup');

const analyze = require('./routes/analyze');
const download = require('./routes/download');
const progress = require('./routes/progress');
const cookies = require('./routes/cookies');
const version = require('./routes/version');

const app = express();

// --- Middleware -------------------------------------------------------------

// CORS: '*' allows any origin; otherwise restrict to the configured frontend hosts.
const corsOptions =
  config.corsOrigins.includes('*')
    ? { origin: true }
    : { origin: config.corsOrigins };
app.use(cors(corsOptions));

// Body parsing. JSON for analyze/download API clients; urlencoded for the frontend's
// hidden-form download POST (which lets the browser stream the file natively to disk).
// The cookies route uses multipart (multer) and ignores these parsers.
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// --- Routes -----------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: config.version });
});

app.use('/api', analyze.router);
app.use('/api', download.router);
app.use('/api', progress.router);
app.use('/api', cookies.router);
app.use('/api', version.router);

// 404 for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Unknown endpoint' });
});

// --- Error handler ----------------------------------------------------------

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
app.use((err, _req, res, _next) => {
  // Body-parser JSON errors land here.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'Malformed JSON body' });
  }
  console.error('[yutubo] Unhandled error:', err);
  if (res.headersSent) return undefined;
  return res
    .status(500)
    .json({ error: 'internal_error', message: 'Unexpected server error' });
});

// --- Startup ----------------------------------------------------------------

function start() {
  cleanup.ensureDirs();
  cleanup.start((result) => {
    console.log(
      `[yutubo] cleanup removed ${result.tmp} tmp file(s), ${result.cookies} cookie file(s)`,
    );
  });

  const server = app.listen(config.port, () => {
    console.log(
      `[yutubo] backend v${config.version} listening on :${config.port} (${config.nodeEnv})`,
    );
  });

  // Streamed downloads can run long; raise the socket timeout to match nginx (10 min).
  server.requestTimeout = 0; // disable Node's 5-min default request timeout
  server.headersTimeout = 60_000;

  const shutdown = (signal) => {
    console.log(`[yutubo] received ${signal}, shutting down...`);
    cleanup.stop();
    server.close(() => process.exit(0));
    // Force exit if connections linger.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Only auto-start when run directly (allows importing app in tests).
if (require.main === module) {
  start();
}

module.exports = { app, start };
