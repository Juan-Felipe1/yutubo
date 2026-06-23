#!/usr/bin/env python3
"""
yt-dlp metadata extractor using Python API.

Key difference from CLI --dump-single-json:
  process=False skips format selection, so videos that need PO tokens for
  format URL access (common from datacenter IPs) still return metadata.

Usage: python3 ytdlp_analyze.py [--cookies /path] [--flat-playlist] URL
"""
import json
import sys


def main():
    args = sys.argv[1:]
    cookies_path = None
    url = None
    is_playlist = False

    i = 0
    while i < len(args):
        if args[i] == '--cookies' and i + 1 < len(args):
            cookies_path = args[i + 1]
            i += 2
        elif args[i] == '--flat-playlist':
            is_playlist = True
            i += 1
        elif not args[i].startswith('-'):
            url = args[i]
            i += 1
        else:
            i += 1

    if not url:
        sys.stderr.write('ERROR: no url provided\n')
        sys.exit(1)

    try:
        import yt_dlp
    except ImportError:
        sys.stderr.write('ERROR: yt-dlp not installed\n')
        sys.exit(1)

    opts = {
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'extractor_args': {'youtube': {'player_client': ['tv_embedded', 'ios', 'android_embedded', 'android', 'web']}},
    }

    # Set up Chrome TLS impersonation — needed to bypass YouTube's TLS fingerprint
    # blocking of datacenter IPs.
    # Import from yt_dlp.networking.impersonate (the exact module used internally)
    # to avoid isinstance() mismatches that cause AssertionError in is_supported_target.
    try:
        from yt_dlp.networking.impersonate import ImpersonateTarget as _IT
        opts['impersonate'] = _IT(client='chrome')
    except Exception:
        # Older yt-dlp or different structure — string form triggers internal conversion
        opts['impersonate'] = 'chrome'

    if cookies_path:
        import os
        if not os.path.exists(cookies_path):
            sys.stderr.write(f'ERROR: Cookie file not found: {cookies_path}\n')
            sys.exit(1)
        # Use cookiejar (pre-loaded object) instead of cookiefile (file path).
        # cookiefile in Python API can silently fail to load if os.access() check fails.
        # Pre-loading and passing the jar object is more reliable.
        try:
            from yt_dlp.cookies import YoutubeDLCookieJar
        except ImportError:
            try:
                from yt_dlp.utils import YoutubeDLCookieJar
            except ImportError:
                YoutubeDLCookieJar = None

        if YoutubeDLCookieJar is not None:
            jar = YoutubeDLCookieJar(cookies_path)
            jar.load(ignore_discard=True, ignore_expires=True)
            cookie_count = sum(1 for _ in jar)
            sys.stderr.write(f'DEBUG: loaded {cookie_count} cookies from jar\n')
            opts['cookiejar'] = jar
        else:
            opts['cookiefile'] = cookies_path  # fallback

    # Playlists: extract_flat=True returns stub entries (like --flat-playlist)
    # Single videos: process=False below avoids format selection
    if is_playlist:
        opts['extract_flat'] = True

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            # process=False: skip format selection step
            # Avoids "Requested format not available" when YouTube withholds
            # format URLs (PO token requirement) but metadata is accessible.
            # For playlists with extract_flat=True, process=True is fine
            # (flat entries don't trigger format selection).
            process = is_playlist
            info = ydl.extract_info(url, download=False, process=process)
            if info is None:
                sys.stderr.write('ERROR: [yt-dlp] Could not extract info\n')
                sys.exit(1)
            print(json.dumps(info))
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        msg = str(e) or repr(e)
        sys.stderr.write('ERROR: ' + msg + '\n')
        sys.stderr.write(tb)
        sys.exit(1)


main()
