#!/usr/bin/env node
/**
 * generate-pot.js — PO token generator for YouTube.
 *
 * Outputs JSON to stdout: { poToken: string, visitorData: string }
 * Called from ytdlp_analyze.py to bypass datacenter-IP bot detection.
 *
 * NOTE: On datacenter IPs, Node.js TLS connections to www.youtube.com may be
 * blocked at the TLS fingerprint level. This script handles that gracefully.
 *
 * Exit 0 on success, exit 1 on failure (error on stderr).
 */
'use strict';

const { generate } = require('youtube-po-token-generator');

generate()
  .then((result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write('PO token generation failed: ' + (err.message || String(err)) + '\n');
    process.exit(1);
  });
