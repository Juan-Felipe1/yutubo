'use strict';

/**
 * In-memory progress registry shared between the download route (writer) and the
 * progress/SSE route (reader).
 *
 * A download is keyed by its client-supplied `downloadId`. The download route
 * publishes progress snapshots as yt-dlp emits them; the SSE route subscribes and
 * forwards each snapshot to the browser.
 *
 * This is intentionally process-local (single Node instance behind nginx). For a
 * multi-instance deployment this would move to Redis pub/sub, but that is out of
 * scope for the MVP.
 */

const { EventEmitter } = require('events');

/** @typedef {{ percent:number, speed:string, eta:string, status:string }} Snapshot */

/** @type {Map<string, { snapshot: Snapshot, emitter: EventEmitter }>} */
const registry = new Map();

function ensure(id) {
  let entry = registry.get(id);
  if (!entry) {
    entry = {
      snapshot: { percent: 0, speed: '', eta: '', status: 'queued' },
      emitter: new EventEmitter(),
    };
    // Many SSE clients could subscribe; avoid the default 10-listener warning.
    entry.emitter.setMaxListeners(0);
    registry.set(id, entry);
  }
  return entry;
}

/**
 * Publish a progress update for a download.
 * @param {string} id downloadId
 * @param {Partial<Snapshot>} patch
 */
function update(id, patch) {
  if (!id) return;
  const entry = ensure(id);
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.emitter.emit('update', entry.snapshot);
}

/**
 * Mark a download as finished (status 'done' | 'error') and emit a final event.
 * The entry is retained briefly so late SSE subscribers still see the result,
 * then garbage-collected.
 * @param {string} id
 * @param {'done'|'error'} status
 * @param {string} [message]
 */
function finish(id, status, message) {
  if (!id) return;
  const entry = ensure(id);
  entry.snapshot = {
    ...entry.snapshot,
    status,
    percent: status === 'done' ? 100 : entry.snapshot.percent,
    message: message || '',
  };
  entry.emitter.emit('update', entry.snapshot);
  entry.emitter.emit('end', entry.snapshot);
  // Retain 30s for late subscribers, then drop.
  setTimeout(() => registry.delete(id), 30_000).unref();
}

/**
 * Read the current snapshot for a download.
 * @param {string} id
 * @returns {Snapshot | null}
 */
function get(id) {
  const entry = registry.get(id);
  return entry ? entry.snapshot : null;
}

/**
 * Subscribe to updates for a download.
 * @param {string} id
 * @param {(snap: Snapshot) => void} onUpdate
 * @param {(snap: Snapshot) => void} onEnd
 * @returns {() => void} unsubscribe
 */
function subscribe(id, onUpdate, onEnd) {
  const entry = ensure(id);
  entry.emitter.on('update', onUpdate);
  entry.emitter.on('end', onEnd);
  return () => {
    entry.emitter.off('update', onUpdate);
    entry.emitter.off('end', onEnd);
  };
}

module.exports = { update, finish, get, subscribe };
