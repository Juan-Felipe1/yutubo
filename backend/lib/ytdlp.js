'use strict';

/**
 * yt-dlp subprocess wrapper.
 *
 * Responsibilities:
 *  - analyze(url): run `yt-dlp --dump-json` and normalize the metadata into the
 *    shape the frontend expects (video | playlist).
 *  - buildDownloadArgs({...}): translate a format+quality request into yt-dlp CLI args.
 *  - spawnDownload({...}): start a yt-dlp download process whose stdout is the media
 *    file bytes (for direct streaming) and whose stderr carries progress lines.
 *  - parseProgressLine(line): turn a yt-dlp progress line into { percent, speed, eta }.
 *
 * Security note: every URL is validated upstream (see lib/validate.js) before reaching
 * here. yt-dlp is always invoked with an argv array (never a shell string), so user
 * input cannot inject shell metacharacters.
 */

const { execa } = require('execa');
const config = require('./config');

/** Map UI MP4 quality labels -> max height (px). */
const MP4_HEIGHTS = {
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
};

/** Map UI MP3 quality labels -> yt-dlp --audio-quality (kbps). */
const MP3_BITRATES = {
  '320 kbps': 320,
  '256 kbps': 256,
  '192 kbps': 192,
  '128 kbps': 128,
};

const MP4_QUALITIES = Object.keys(MP4_HEIGHTS);
const MP3_QUALITIES = Object.keys(MP3_BITRATES);

/**
 * Format a duration in seconds to HH:MM:SS (or MM:SS when under an hour).
 * @param {number|null|undefined} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const total = Math.floor(Number(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Build a short human "meta" line, e.g. "842K vistas · hace 3 semanas"-ish.
 * yt-dlp does not give relative dates, so we use absolute upload date when present.
 * @param {object} info raw yt-dlp json
 * @returns {string}
 */
function buildMeta(info) {
  const parts = [];
  if (typeof info.view_count === 'number') {
    parts.push(`${formatViewCount(info.view_count)} vistas`);
  }
  if (info.upload_date && /^\d{8}$/.test(info.upload_date)) {
    const y = info.upload_date.slice(0, 4);
    const mo = info.upload_date.slice(4, 6);
    const d = info.upload_date.slice(6, 8);
    parts.push(`${d}/${mo}/${y}`);
  }
  return parts.join(' · ');
}

/**
 * Compact a view count: 842000 -> "842K", 1200000 -> "1.2M".
 * @param {number} n
 * @returns {string}
 */
function formatViewCount(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Pick the best thumbnail URL from yt-dlp metadata.
 * @param {object} info
 * @returns {string}
 */
function pickThumbnail(info) {
  if (typeof info.thumbnail === 'string' && info.thumbnail) return info.thumbnail;
  if (Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
    // thumbnails are usually ordered worst -> best
    const last = info.thumbnails[info.thumbnails.length - 1];
    if (last && last.url) return last.url;
  }
  return '';
}

/**
 * Analyze a URL: returns normalized metadata for a single video or a playlist.
 *
 * @param {string} url Already-validated YouTube URL.
 * @param {object} [opts]
 * @param {string} [opts.cookiesPath] Absolute path to a cookies.txt file.
 * @returns {Promise<object>} { type: 'video'|'playlist', ... }
 * @throws {Error} with .code='ANALYZE_FAILED' and .stderr on failure.
 */
async function analyze(url, opts = {}) {
  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--flat-playlist',
    '--impersonate', 'chrome',
    url,
  ];
  if (opts.cookiesPath) {
    args.unshift('--cookies', opts.cookiesPath);
  }

  let result;
  try {
    result = await execa(config.ytdlpBin, args, {
      timeout: config.analyzeTimeoutMs,
      maxBuffer: 64 * 1024 * 1024, // 64 MB — large playlists produce big JSON
    });
  } catch (err) {
    const e = new Error('yt-dlp analyze failed');
    e.code = 'ANALYZE_FAILED';
    e.stderr = err.stderr || err.shortMessage || String(err);
    e.timedOut = Boolean(err.timedOut);
    throw e;
  }

  let info;
  try {
    info = JSON.parse(result.stdout);
  } catch (parseErr) {
    const e = new Error('Failed to parse yt-dlp JSON output');
    e.code = 'ANALYZE_FAILED';
    e.stderr = String(parseErr);
    throw e;
  }

  // Playlists / multi_video report _type 'playlist' and carry an `entries` array.
  if (info._type === 'playlist' || Array.isArray(info.entries)) {
    const entries = Array.isArray(info.entries) ? info.entries : [];
    return {
      type: 'playlist',
      title: info.title || 'Playlist',
      channel: info.channel || info.uploader || '',
      count: entries.length,
      items: entries.map((entry, idx) => ({
        id: entry.id || String(idx + 1),
        title: entry.title || `Video ${idx + 1}`,
        duration: formatDuration(entry.duration),
      })),
    };
  }

  // Single video
  return {
    type: 'video',
    id: info.id || '',
    title: info.title || 'Video',
    channel: info.channel || info.uploader || '',
    duration: formatDuration(info.duration),
    meta: buildMeta(info),
    thumbnail: pickThumbnail(info),
  };
}

/**
 * Validate and normalize a download request's format/quality.
 * @param {string} format
 * @param {string} quality
 * @returns {{format:'mp4'|'mp3', quality:string}}
 * @throws {Error} code='INVALID_FORMAT' when out of range.
 */
function normalizeFormatQuality(format, quality) {
  const fmt = String(format || '').toLowerCase();
  if (fmt !== 'mp4' && fmt !== 'mp3') {
    const e = new Error(`Unsupported format "${format}" (expected mp4 or mp3)`);
    e.code = 'INVALID_FORMAT';
    throw e;
  }

  const validQualities = fmt === 'mp4' ? MP4_QUALITIES : MP3_QUALITIES;
  if (!validQualities.includes(quality)) {
    const e = new Error(
      `Unsupported quality "${quality}" for ${fmt} (allowed: ${validQualities.join(', ')})`,
    );
    e.code = 'INVALID_FORMAT';
    throw e;
  }

  return { format: fmt, quality };
}

/**
 * Build yt-dlp argv for a download that streams the merged/encoded file to stdout.
 *
 * Streaming to stdout requires `-o -`. For MP4 we use the matroska/mp4 merge; yt-dlp
 * can mux to stdout. For MP3 we extract audio to stdout.
 *
 * @param {object} req
 * @param {string} req.url validated URL
 * @param {'mp4'|'mp3'} req.format
 * @param {string} req.quality UI quality label
 * @param {string} [req.cookiesPath]
 * @returns {{args:string[], ext:string, mimeType:string}}
 */
function buildDownloadArgs({ url, format, quality, cookiesPath }) {
  const { format: fmt, quality: q } = normalizeFormatQuality(format, quality);

  const args = ['--no-warnings', '--no-playlist', '--impersonate', 'chrome'];

  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  let ext;
  let mimeType;

  if (fmt === 'mp4') {
    const height = MP4_HEIGHTS[q];
    // Prefer mp4 video + m4a audio within the height cap, fall back to best <= height.
    args.push(
      '-f',
      `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}]`,
      '--merge-output-format',
      'mp4',
    );
    ext = 'mp4';
    mimeType = 'video/mp4';
  } else {
    const bitrate = MP3_BITRATES[q];
    args.push(
      '-f',
      'bestaudio/best',
      '--extract-audio',
      '--audio-format',
      'mp3',
      // yt-dlp --audio-quality accepts a kbps value or 0..10 (0=best). Use kbps.
      '--audio-quality',
      `${bitrate}K`,
    );
    ext = 'mp3';
    mimeType = 'audio/mpeg';
  }

  // Stream to stdout. --progress-template forces machine-parseable progress on stderr.
  args.push(
    '-o',
    '-',
    '--newline',
    '--progress',
    url,
  );

  return { args, ext, mimeType };
}

/**
 * Resolve a filesystem-safe filename for the Content-Disposition header.
 * @param {string} title
 * @param {string} ext
 * @returns {string}
 */
function safeFilename(title, ext) {
  const base = String(title || 'download')
    .replace(/[\\/:*?"<>| -]/g, '') // strip path/control chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'download';
  return `${base}.${ext}`;
}

/**
 * Spawn a yt-dlp download. Returns the execa child process.
 * stdout = media bytes (pipe to HTTP response).
 * stderr = progress + diagnostics.
 *
 * @param {object} req see buildDownloadArgs
 * @returns {{subprocess: import('execa').ExecaChildProcess, ext:string, mimeType:string}}
 */
function spawnDownload(req) {
  const { args, ext, mimeType } = buildDownloadArgs(req);
  const subprocess = execa(config.ytdlpBin, args, {
    buffer: false, // stream, do not buffer the whole file in memory
    stdout: 'pipe',
    stderr: 'pipe',
    encoding: null, // stdout is binary
  });
  return { subprocess, ext, mimeType };
}

/**
 * Parse a single yt-dlp progress line.
 * Lines look like: "[download]  45.3% of 12.34MiB at 1.50MiB/s ETA 00:07"
 *
 * @param {string} line
 * @returns {{percent:number, speed:string, eta:string}|null} null if not a progress line.
 */
function parseProgressLine(line) {
  if (!line || line.indexOf('[download]') === -1) return null;

  const percentMatch = line.match(/(\d{1,3}(?:\.\d+)?)%/);
  if (!percentMatch) return null;

  const speedMatch = line.match(/at\s+([\d.]+\s*[KMG]?i?B\/s)/i);
  const etaMatch = line.match(/ETA\s+([\d:]+)/i);

  return {
    percent: Math.min(100, parseFloat(percentMatch[1])),
    speed: speedMatch ? speedMatch[1].replace(/\s+/g, '') : '',
    eta: etaMatch ? etaMatch[1] : '',
  };
}

module.exports = {
  analyze,
  buildDownloadArgs,
  spawnDownload,
  parseProgressLine,
  normalizeFormatQuality,
  safeFilename,
  formatDuration,
  MP4_QUALITIES,
  MP3_QUALITIES,
};
