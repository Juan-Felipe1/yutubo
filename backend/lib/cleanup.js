'use strict';

/**
 * Periodic cleanup of temporary artifacts.
 *
 * Downloads are streamed straight to the client (no permanent file), but yt-dlp may
 * still create transient files in tmp/ (e.g. when merging mp4+m4a it writes part
 * files before muxing). This sweeper removes anything stale so the Always-Free disk
 * does not fill up. It also expires uploaded cookies.txt files after a grace period.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Ensure tmp/ and cookies/ directories exist.
 */
function ensureDirs() {
  for (const dir of [config.paths.tmp, config.paths.cookies]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Delete files in a directory older than maxAgeMs.
 * @param {string} dir
 * @param {number} maxAgeMs
 * @returns {number} count of files removed
 */
function sweepDir(dir, maxAgeMs) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0; // directory may not exist yet
  }

  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // file vanished or is locked — ignore and continue
    }
  }
  return removed;
}

/**
 * Run one cleanup pass.
 * @returns {{ tmp: number, cookies: number }}
 */
function runOnce() {
  const tmp = sweepDir(config.paths.tmp, config.cleanup.maxAgeMs);
  const cookies = sweepDir(config.paths.cookies, config.cleanup.cookieMaxAgeMs);
  return { tmp, cookies };
}

let timer = null;

/**
 * Start the periodic sweeper. Idempotent.
 * @param {(result: {tmp:number, cookies:number}) => void} [onSweep]
 */
function start(onSweep) {
  ensureDirs();
  if (timer) return;
  timer = setInterval(() => {
    const result = runOnce();
    if (onSweep && (result.tmp > 0 || result.cookies > 0)) onSweep(result);
  }, config.cleanup.intervalMs);
  // Do not keep the event loop alive solely for cleanup.
  if (timer.unref) timer.unref();
}

/** Stop the sweeper (tests / graceful shutdown). */
function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { ensureDirs, sweepDir, runOnce, start, stop };
