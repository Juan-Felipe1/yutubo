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
        'impersonate': 'chrome',
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
    }
    if cookies_path:
        opts['cookiefile'] = cookies_path
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
        msg = str(e)
        if not msg.startswith('ERROR:'):
            msg = 'ERROR: ' + msg
        sys.stderr.write(msg + '\n')
        sys.exit(1)


main()
