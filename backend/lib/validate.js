'use strict';

/**
 * URL validation / sanitization.
 *
 * Addresses the SSRF Should-Fix raised during story validation: even though
 * yt-dlp is always invoked with an argv array (no shell injection possible),
 * we still must not let arbitrary URLs (file://, internal IPs, other hosts)
 * reach yt-dlp. For the YouTube MVP we accept only http(s) YouTube hosts.
 */

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * Validate a YouTube URL.
 * @param {string} raw
 * @returns {{ ok: true, url: string } | { ok: false, reason: string }}
 */
function validateYouTubeUrl(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'URL must be a string' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: 'URL is empty' };
  }
  if (trimmed.length > 2048) {
    return { ok: false, reason: 'URL is too long' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'URL is malformed' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http(s) URLs are allowed' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: 'Only YouTube URLs are supported' };
  }

  return { ok: true, url: parsed.toString() };
}

module.exports = { validateYouTubeUrl, ALLOWED_HOSTS };
