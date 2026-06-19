'use strict';

/**
 * Download concurrency control.
 *
 * Enforces AC-7: at most `maxConcurrentDownloads` (default 2) downloads run at once.
 * Unlike a classic queue that buffers work, this is a *slot gate*: a download either
 * acquires a slot immediately or is rejected with 429 + an estimated wait time. This
 * matches the story requirement ("Requests além do limite recebem resposta 429 com
 * tempo estimado de espera") and keeps long-lived streaming responses simple.
 */

const config = require('./config');

let activeCount = 0;

/**
 * Try to acquire a download slot.
 * @returns {{ ok: true, release: () => void } | { ok: false, retryAfterSeconds: number, active: number, max: number }}
 */
function acquireSlot() {
  if (activeCount >= config.maxConcurrentDownloads) {
    return {
      ok: false,
      active: activeCount,
      max: config.maxConcurrentDownloads,
      // Rough ETA: assume one of the in-flight downloads frees up after the
      // configured average duration.
      retryAfterSeconds: config.estimatedSecondsPerDownload,
    };
  }

  activeCount += 1;
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return; // idempotent — safe to call on both 'close' and 'error'
      released = true;
      activeCount = Math.max(0, activeCount - 1);
    },
  };
}

/** @returns {number} downloads currently holding a slot. */
function getActiveCount() {
  return activeCount;
}

/** Reset internal state. Intended for tests only. */
function _reset() {
  activeCount = 0;
}

module.exports = { acquireSlot, getActiveCount, _reset };
