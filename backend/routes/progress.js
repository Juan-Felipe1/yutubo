'use strict';

/**
 * GET /api/progress/:id  (Server-Sent Events)
 *
 * Streams progress events for a download identified by :id (the downloadId the client
 * sent to POST /api/download). Each event payload is JSON:
 *   { percent, speed, eta, status }  // status: queued|starting|downloading|done|error
 *
 * The stream closes automatically once the download reaches a terminal status
 * (done | error). Falls back to an immediate snapshot if one already exists.
 */

const express = require('express');
const progress = require('../lib/progress');

const router = express.Router();

router.get('/progress/:id', (req, res) => {
  const { id } = req.params;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering for SSE
  });
  res.flushHeaders?.();

  const send = (snap) => {
    res.write(`data: ${JSON.stringify(snap)}\n\n`);
  };

  // Send current snapshot immediately (if the download already started).
  const current = progress.get(id);
  if (current) {
    send(current);
    if (current.status === 'done' || current.status === 'error') {
      return res.end();
    }
  } else {
    // No record yet — tell the client we're waiting for the download to register.
    send({ percent: 0, speed: '', eta: '', status: 'pending' });
  }

  const onUpdate = (snap) => send(snap);
  const onEnd = (snap) => {
    send(snap);
    res.end();
  };

  const unsubscribe = progress.subscribe(id, onUpdate, onEnd);

  // Heartbeat keeps proxies from closing an idle SSE connection.
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15_000);
  if (heartbeat.unref) heartbeat.unref();

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = { router };
