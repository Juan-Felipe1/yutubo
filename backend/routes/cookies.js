'use strict';

/**
 * POST /api/cookies  (multipart/form-data, field name: "cookies")
 *
 * Accepts a Netscape-format cookies.txt exported from the user's browser
 * (e.g. via the "Get cookies.txt locally" extension) and stores it as
 * cookies/<uuid>.txt. Returns { cookiesId } which the client then passes to
 * /api/analyze and /api/download to bypass YouTube's datacenter IP blocking (2026).
 *
 * Files are short-lived: lib/cleanup expires them after config.cleanup.cookieMaxAgeMs.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const config = require('../lib/config');

const router = express.Router();

// Store directly to cookies/ with a generated uuid filename.
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdir(config.paths.cookies, { recursive: true }, (err) =>
      cb(err, config.paths.cookies),
    );
  },
  filename(req, _file, cb) {
    const id = uuidv4();
    req.cookiesId = id;
    cb(null, `${id}.txt`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxCookieBytes, files: 1 },
  fileFilter(_req, file, cb) {
    // Accept text uploads only. Browsers often send text/plain or
    // application/octet-stream for .txt — allow both, reject anything else.
    const ok =
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream' ||
      /\.txt$/i.test(file.originalname);
    cb(null, ok);
  },
});

router.post('/cookies', (req, res) => {
  upload.single('cookies')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(413)
          .json({ error: 'file_too_large', message: 'cookies.txt is too large' });
      }
      return res.status(400).json({ error: 'upload_failed', message: err.message });
    }
    if (!req.file || !req.cookiesId) {
      return res
        .status(400)
        .json({ error: 'no_file', message: 'No cookies file uploaded (field "cookies")' });
    }

    // Light sanity check: a Netscape cookies.txt usually starts with a comment
    // header or contains tab-separated cookie lines. Reject obviously wrong files.
    try {
      const sample = fs.readFileSync(
        path.join(config.paths.cookies, `${req.cookiesId}.txt`),
        'utf8',
      );
      const looksLikeCookies =
        /# Netscape HTTP Cookie File/i.test(sample) ||
        /\t/.test(sample) ||
        /youtube\.com/i.test(sample);
      if (!looksLikeCookies) {
        fs.unlink(
          path.join(config.paths.cookies, `${req.cookiesId}.txt`),
          () => {},
        );
        return res.status(400).json({
          error: 'invalid_cookies',
          message: 'File does not look like a cookies.txt export',
        });
      }
    } catch {
      // If we cannot read it back, fall through — the download will surface errors.
    }

    return res.json({ cookiesId: req.cookiesId });
  });
});

module.exports = { router };
