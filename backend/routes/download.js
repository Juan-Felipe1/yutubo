'use strict';

/**
 * POST /api/download
 *
 * Body: { url, format: 'mp4'|'mp3', quality, downloadId, cookiesId? }
 *
 * Streams the media directly to the HTTP response (no permanent file on disk).
 * Concurrency is gated to maxConcurrentDownloads; excess requests get 429 + Retry-After.
 * Progress is published to the in-memory progress registry, keyed by downloadId, so
 * GET /api/progress/:id (SSE) can forward it live to the browser.
 */

const express = require('express');
const readline = require('readline');

const ytdlp = require('../lib/ytdlp');
const queue = require('../lib/queue');
const progress = require('../lib/progress');
const { validateYouTubeUrl } = require('../lib/validate');
const { resolveCookiesPath } = require('./analyze');

const router = express.Router();

router.post('/download', async (req, res) => {
  const { url, format, quality, downloadId, cookiesId } = req.body || {};

  // --- Validation -----------------------------------------------------------
  const check = validateYouTubeUrl(url);
  if (!check.ok) {
    return res.status(400).json({ error: 'invalid_url', message: check.reason });
  }
  if (!downloadId || typeof downloadId !== 'string') {
    return res
      .status(400)
      .json({ error: 'missing_download_id', message: 'downloadId is required' });
  }
  try {
    ytdlp.normalizeFormatQuality(format, quality);
  } catch (err) {
    return res.status(400).json({ error: 'invalid_format', message: err.message });
  }

  const cookiesPath = resolveCookiesPath(cookiesId);

  // --- Concurrency gate (AC-7) ----------------------------------------------
  const slot = queue.acquireSlot();
  if (!slot.ok) {
    res.set('Retry-After', String(slot.retryAfterSeconds));
    return res.status(429).json({
      error: 'queue_full',
      message: `Maximum of ${slot.max} simultaneous downloads reached. Please retry shortly.`,
      active: slot.active,
      max: slot.max,
      retryAfterSeconds: slot.retryAfterSeconds,
    });
  }

  progress.update(downloadId, { status: 'starting', percent: 0 });

  // --- Resolve a nice filename (best-effort; never blocks the download) -----
  const ext = format.toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
  let filename;
  try {
    const meta = await ytdlp.analyze(check.url, { cookiesPath });
    filename = ytdlp.safeFilename(meta.title, ext);
  } catch {
    filename = ytdlp.safeFilename('youtube-' + downloadId.slice(0, 8), ext);
  }

  // --- Spawn yt-dlp and stream ----------------------------------------------
  let child;
  try {
    child = ytdlp.spawnDownload({ url: check.url, format, quality, cookiesPath });
  } catch (err) {
    slot.release();
    progress.finish(downloadId, 'error', err.message);
    return res.status(400).json({ error: 'spawn_failed', message: err.message });
  }

  const { subprocess, mimeType } = child;

  res.set('Content-Type', mimeType);
  res.set(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  // Hint to nginx not to buffer (mirrors `proxy_buffering off`).
  res.set('X-Accel-Buffering', 'no');

  let settled = false;
  const cleanup = () => {
    if (settled) return;
    settled = true;
    slot.release();
  };

  // Track whether any media bytes reached the client. If yt-dlp fails before
  // writing anything, we can still surface a clean JSON error instead of a
  // truncated/empty 200 response.
  let bytesSent = false;

  // Pipe media bytes to the client. { end: false } keeps control of res.end()
  // in our hands so the 'close' handler decides success vs. error.
  subprocess.stdout.on('data', () => {
    bytesSent = true;
  });
  subprocess.stdout.pipe(res, { end: false });

  // Parse stderr line-by-line for progress.
  const rl = readline.createInterface({ input: subprocess.stderr });
  rl.on('line', (line) => {
    const parsed = ytdlp.parseProgressLine(line);
    if (parsed) {
      progress.update(downloadId, { ...parsed, status: 'downloading' });
    }
  });

  // Client aborted (closed tab / navigated away) — kill yt-dlp to free the slot.
  req.on('close', () => {
    if (!res.writableEnded && !settled) {
      subprocess.kill('SIGKILL');
      progress.finish(downloadId, 'error', 'client_disconnected');
      cleanup();
    }
  });

  subprocess.on('error', (err) => {
    progress.finish(downloadId, 'error', err.message);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: 'download_failed', message: err.message });
    } else {
      res.destroy(err);
    }
  });

  subprocess.on('close', (code) => {
    rl.close();
    cleanup();

    if (code === 0) {
      progress.finish(downloadId, 'done');
      if (!res.writableEnded) res.end();
      return;
    }

    // Non-zero exit.
    progress.finish(downloadId, 'error', `yt-dlp exited with code ${code}`);
    if (!res.headersSent && !bytesSent) {
      // Nothing streamed yet — safe to return a JSON error with a proper status.
      res
        .status(502)
        .json({ error: 'download_failed', message: `yt-dlp exited with code ${code}` });
    } else if (!res.writableEnded) {
      // Partial stream already sent — we cannot change the status code, so just
      // terminate the connection to signal truncation to the client.
      res.destroy(new Error(`yt-dlp exited with code ${code}`));
    }
  });
});

module.exports = { router };
