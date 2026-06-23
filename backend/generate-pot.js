#!/usr/bin/env node
/**
 * generate-pot.js — PO token generator for YouTube.
 *
 * Outputs JSON to stdout: { poToken: string, visitorData: string }
 * Called from ytdlp_analyze.py to bypass datacenter-IP bot detection.
 *
 * Exit 0 on success, exit 1 on failure (error on stderr).
 */
'use strict';

// Patch https to log which host gets a TLS failure (datacenter IP diagnostic).
const origTLS = require('tls').connect;
require('tls').connect = function(...args) {
  const sock = origTLS.apply(this, args);
  const host = (args[0] && args[0].host) || 'unknown';
  sock.once('error', (err) => {
    process.stderr.write(`TLS_ERR host=${host} err=${err.message}\n`);
  });
  return sock;
};

const { generate } = require('youtube-po-token-generator');

generate()
  .then((result) => {
    // result = { poToken: string, visitorData: string }
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write('PO token generation failed: ' + (err.message || String(err)) + '\n');
    process.exit(1);
  });
