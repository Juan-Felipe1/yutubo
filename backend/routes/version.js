'use strict';

/**
 * GET /api/version
 *
 * Returns the running backend's semantic version and name so the frontend
 * (and `curl`) can confirm which build is live — useful after a HuggingFace
 * Space rebuild, when the old container may still be serving for a few minutes.
 *
 * Version is sourced from lib/config (single source of truth, kept in sync
 * with package.json), not read from disk per-request.
 */

const express = require('express');

const config = require('../lib/config');

const router = express.Router();

router.get('/version', (_req, res) => {
  res.json({ version: config.version, name: 'yutubo-backend' });
});

module.exports = { router };
