'use strict';

/**
 * Centralized configuration for the Yutubo backend.
 * All paths, limits and environment-driven values live here so routes/libs
 * never hardcode them independently.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const config = {
  version: '1.0.0',

  // HTTP
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS — comma-separated list of allowed origins. '*' allows any origin.
  // Example: CORS_ORIGINS="https://yutubo.vercel.app,https://yutubo.pages.dev"
  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // Filesystem
  paths: {
    root: ROOT,
    tmp: path.join(ROOT, 'tmp'),
    cookies: path.join(ROOT, 'cookies'),
  },

  // yt-dlp binary (overridable for environments where it is not on PATH)
  ytdlpBin: process.env.YTDLP_BIN || 'yt-dlp',
  // Python wrapper for analyze — uses Python API with process=False to bypass
  // format selection (avoids "Requested format not available" for PO-gated videos)
  ytdlpAnalyzePy: process.env.YTDLP_ANALYZE_PY || require('path').join(__dirname, '..', 'ytdlp_analyze.py'),

  // Timeouts (ms)
  analyzeTimeoutMs: parseInt(process.env.ANALYZE_TIMEOUT_MS, 10) || 60000,

  // Download queue
  maxConcurrentDownloads:
    parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 2,
  // Rough estimate (seconds) used to compute ETA for queued requests when full
  estimatedSecondsPerDownload:
    parseInt(process.env.ESTIMATED_SECONDS_PER_DOWNLOAD, 10) || 90,

  // Cookies upload limits
  maxCookieBytes: parseInt(process.env.MAX_COOKIE_BYTES, 10) || 1024 * 1024, // 1 MB

  // Cleanup
  cleanup: {
    // Delete tmp files older than this (ms). Default 1 hour.
    maxAgeMs: parseInt(process.env.TMP_MAX_AGE_MS, 10) || 60 * 60 * 1000,
    // How often the sweeper runs (ms). Default 15 minutes.
    intervalMs:
      parseInt(process.env.CLEANUP_INTERVAL_MS, 10) || 15 * 60 * 1000,
    // Cookies older than this are removed too. Default 24 hours.
    cookieMaxAgeMs:
      parseInt(process.env.COOKIE_MAX_AGE_MS, 10) || 24 * 60 * 60 * 1000,
  },
};

module.exports = config;
