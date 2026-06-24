'use strict';

/**
 * POST /api/analyze
 *
 * Body: { url: string, cookiesId?: string }
 * Runs `yt-dlp --dump-single-json` and returns normalized metadata for a single
 * video or a playlist (see lib/ytdlp.analyze).
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const ytdlp = require('../lib/ytdlp');
const { validateYouTubeUrl } = require('../lib/validate');
const config = require('../lib/config');

const router = express.Router();

/**
 * Resolve a cookies file path from a cookiesId, guarding against path traversal.
 * @param {string|undefined} cookiesId
 * @returns {string|null} absolute path or null if absent/invalid/missing.
 */
function resolveCookiesPath(cookiesId) {
  if (!cookiesId) return null;
  // Only allow uuid-like ids: hex + dashes. Prevents "../" traversal.
  if (!/^[a-f0-9-]{8,64}$/i.test(cookiesId)) return null;
  const full = path.join(config.paths.cookies, `${cookiesId}.txt`);
  if (!full.startsWith(config.paths.cookies)) return null;
  return fs.existsSync(full) ? full : null;
}

router.post('/analyze', async (req, res) => {
  const { url, cookiesId } = req.body || {};

  const check = validateYouTubeUrl(url);
  if (!check.ok) {
    return res.status(400).json({ error: 'invalid_url', message: check.reason });
  }

  const cookiesPath = resolveCookiesPath(cookiesId);

  try {
    const data = await ytdlp.analyze(check.url, { cookiesPath });
    return res.json(data);
  } catch (err) {
    if (err.timedOut) {
      return res.status(504).json({
        error: 'analyze_timeout',
        message: 'Analysis timed out. The video may be very long or unavailable.',
      });
    }
    // yt-dlp typically writes the actionable message to stderr.
    const stderr = err.stderr || '';
    const blocked = /Sign in to confirm|not a bot|HTTP Error 429|Too Many Requests|Precondition check failed|PO Token|po_token|This video is not available in your country|blocked it|has blocked it|TLS\/SSL|SSL connection|connection has been closed|EOF.*ssl|ssl.*EOF/i.test(stderr);
    const private_ = /Private video|This video is private|members only|unavailable/i.test(stderr);
    let message;
    if (blocked) {
      message = cookiesPath
        ? 'Este video requer verificação adicional que não é possível desde servidores em nuvem.'
        : 'YouTube está bloqueando este servidor. Sube tu cookies.txt para continuar.';
    } else if (private_) {
      message = 'Este video es privado o solo para miembros.';
    } else {
      message = 'No se pudo analizar. El video puede ser privado o no disponible.';
    }
    return res.status(400).json({
      error: blocked ? 'ip_blocked' : 'analyze_failed',
      message,
      detail: config.nodeEnv === 'development' ? stderr.slice(0, 500) : undefined,
    });
  }
});

module.exports = { router, resolveCookiesPath };
