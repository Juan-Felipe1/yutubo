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
