#!/usr/bin/env python3
"""
fetch-posters.py

Downloads each model's thumbnail from Sketchfab once, saves it under
3d-gallery/imgs/posters/, and records the path in the `poster` field of
data/models.js.

Why this exists: the gallery can ask Sketchfab for thumbnails from the browser
at page load, but that is a cross-origin request, and whether it succeeds
depends on Sketchfab sending an Access-Control-Allow-Origin header. Their
oEmbed documentation does not commit to one. Fetching from here instead sidesteps
the question entirely, since CORS is a browser rule and this is not a browser.

Run it once now, and again whenever models are added. After that the gallery
never makes the request at all: posters are local files, they work offline, and
they cannot break because a third party changed a header.

Usage
    python3 shared/tools/fetch-posters.py             fetch anything missing
    python3 shared/tools/fetch-posters.py --force     re-fetch everything
    python3 shared/tools/fetch-posters.py --clear     drop all poster fields again

Uses only the standard library.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

def find_root(start):
    """
    Walk up from this file until the folder holding both galleries turns up.

    The tools live in shared/tools/, but counting directory levels breaks the
    next time anything moves. Looking for the two gallery folders does not.
    """
    path = start
    while path != os.path.dirname(path):
        if all(
            os.path.isdir(os.path.join(path, name))
            for name in ("2d-gallery", "3d-gallery")
        ):
            return path
        path = os.path.dirname(path)
    raise SystemExit(
        "Could not find the repo root. Expected a folder containing both "
        "2d-gallery/ and 3d-gallery/ somewhere above this script."
    )


ROOT = find_root(os.path.dirname(os.path.abspath(__file__)))
GALLERY = os.path.join(ROOT, "3d-gallery")
DATA_FILE = os.path.join(GALLERY, "data", "models.js")
POSTER_DIR = os.path.join(GALLERY, "imgs", "posters")
OEMBED = "https://sketchfab.com/oembed"
TIMEOUT = 20

DATA_HEADER = None
DATA_GLOBAL = "MODEL_DATA"


def read_data():
    global DATA_HEADER, DATA_GLOBAL
    with open(DATA_FILE, "r", encoding="utf-8") as handle:
        source = handle.read()

    match = re.search(r"window\.([A-Z_]+)\s*=", source)
    DATA_GLOBAL = match.group(1)
    start = source.index("{", match.start())
    end = source.rindex("}") + 1
    DATA_HEADER = source[:start].replace(f"window.{DATA_GLOBAL} =", "").rstrip()

    body = source[start:end]
    body = re.sub(r",(\s*[}\]])", r"\1", body)
    body = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)', r'\1"\2"\3', body)
    return json.loads(body)


def compact_arrays(text):
    """Keep short string arrays on one line so the file stays hand-editable."""
    lines = text.split("\n")
    out = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.rstrip().endswith("["):
            values = []
            scan = index + 1
            while scan < len(lines) and re.fullmatch(r'\s*"[^"]*",?', lines[scan]):
                values.append(lines[scan].strip().rstrip(","))
                scan += 1
            closer = lines[scan].strip() if scan < len(lines) else ""
            joined = line.rstrip() + ", ".join(values) + closer
            if closer in ("]", "],") and len(joined) <= 96:
                out.append(joined)
                index = scan + 1
                continue
        out.append(line)
        index += 1
    return "\n".join(out)


def write_data(data):
    body = compact_arrays(json.dumps(data, indent=2, ensure_ascii=False))
    with open(DATA_FILE, "w", encoding="utf-8") as handle:
        handle.write(DATA_HEADER)
        handle.write(f"\n\nwindow.{DATA_GLOBAL} = ")
        handle.write(body)
        handle.write(";\n")


def oembed(uid):
    """Ask Sketchfab about one model. Returns the parsed JSON, or None."""
    query = urllib.parse.urlencode(
        {
            "format": "json",
            "maxwidth": 640,
            "url": f"https://sketchfab.com/3d-models/{uid}",
        }
    )
    request = urllib.request.Request(
        f"{OEMBED}?{query}",
        headers={"User-Agent": "poggio-civitate-gallery/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as error:
        print(f"    oembed failed: {error}", file=sys.stderr)
        return None


def download(url, target):
    request = urllib.request.Request(
        url, headers={"User-Agent": "poggio-civitate-gallery/1.0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            payload = response.read()
    except (urllib.error.URLError, urllib.error.HTTPError) as error:
        print(f"    download failed: {error}", file=sys.stderr)
        return False

    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "wb") as handle:
        handle.write(payload)
    return True


def main(force=False, clear=False):
    data = read_data()
    items = data.get("items", [])

    if clear:
        for item in items:
            item.pop("poster", None)
        write_data(data)
        print(f"cleared poster from {len(items)} records")
        return 0

    fetched = 0
    skipped = 0
    failed = []

    for item in items:
        item_id = item.get("id")
        uid = item.get("uid")
        if not uid:
            failed.append(f"{item_id}: no uid")
            continue

        target = os.path.join(POSTER_DIR, f"{item_id}.jpg")
        relative = f"imgs/posters/{item_id}.jpg"

        if not force and os.path.exists(target):
            item["poster"] = relative
            skipped += 1
            continue

        print(f"  {item_id}")
        payload = oembed(uid)
        if not payload or not payload.get("thumbnail_url"):
            failed.append(f"{item_id}: no thumbnail_url in the oembed response")
            continue

        if download(payload["thumbnail_url"], target):
            item["poster"] = relative
            fetched += 1
        else:
            failed.append(f"{item_id}: thumbnail download failed")

    write_data(data)

    print(f"\n{fetched} fetched, {skipped} already present, {len(failed)} failed")
    for line in failed:
        print(f"  failed: {line}", file=sys.stderr)
    if failed:
        print(
            "\nRecords that failed keep working: the gallery falls back to asking\n"
            "the browser, and then to a plain plate if that fails too.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-fetch everything")
    parser.add_argument("--clear", action="store_true", help="remove poster fields")
    args = parser.parse_args()
    sys.exit(main(force=args.force, clear=args.clear))