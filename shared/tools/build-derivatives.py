#!/usr/bin/env python3
"""
build-derivatives.py

Generates the small images the gallery actually displays, and records each
original's pixel dimensions back into 2d-gallery/data/artworks.js.

The originals in media/ are 5 to 18 megapixels each and total ~90 MB. Serving
those directly to a grid of 400px tiles is the whole reason the site was slow.
This script produces three WebP derivatives per artwork:

    grid     longest edge  480px   - the tile on the gallery page
    grid@2x  longest edge  960px   - the same tile on a high-density screen
    view     longest edge 2200px   - what the lightbox opens

Originals are never modified and stay in place, so "download the full
resolution file" still works.

Usage
    python3 shared/tools/build-derivatives.py            regenerate anything stale
    python3 shared/tools/build-derivatives.py --force    regenerate everything
    python3 shared/tools/build-derivatives.py --check    report only, write nothing

Requires Pillow:  pip install Pillow
"""

import argparse
import json
import os
import re
import sys
import unicodedata

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required. Install it with:  pip install Pillow")

# these drawings are legitimately enormous, so lift Pillow's bomb guard
Image.MAX_IMAGE_PIXELS = None

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
GALLERY = os.path.join(ROOT, "2d-gallery")
MEDIA = os.path.join(GALLERY, "media")
DERIVED = os.path.join(MEDIA, "derived")
DATA_FILE = os.path.join(GALLERY, "data", "artworks.js")

PRESETS = [
    ("grid", 480, 72),
    ("grid@2x", 960, 66),
    ("view", 2200, 80),
]

DATA_HEADER = None  # the comment block at the top of the data file, preserved
DATA_GLOBAL = "GALLERY_DATA"  # which window.<NAME> the data file assigns


def slugify(value):
    """Filename-safe key derived from the original path. No spaces, no commas."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-").lower()
    return re.sub(r"-{2,}", "-", value)


def read_data(path=None):
    """Pull the object literal out of a data file and parse it as JSON."""
    global DATA_HEADER, DATA_GLOBAL
    path = path or DATA_FILE
    with open(path, "r", encoding="utf-8") as handle:
        source = handle.read()

    match = re.search(r"window\.([A-Z_]+)\s*=", source)
    if not match:
        raise SystemExit(f"{path} does not assign a window.<NAME> object")
    DATA_GLOBAL = match.group(1)

    start = source.index("{", match.start())
    end = source.rindex("}") + 1
    DATA_HEADER = source[:start].replace(f"window.{DATA_GLOBAL} =", "").rstrip()
    body = source[start:end]

    # tolerate trailing commas and unquoted keys, which are legal JS but not JSON
    body = re.sub(r",(\s*[}\]])", r"\1", body)
    body = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)', r'\1"\2"\3', body)
    return json.loads(body)


def compact_arrays(text):
    """Put arrays of plain strings back on one line. Nicer to hand-edit."""
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


def write_data(data, path=None):
    """Write the data file back out, keeping the explanatory header comment."""
    body = compact_arrays(json.dumps(data, indent=2, ensure_ascii=False))
    with open(path or DATA_FILE, "w", encoding="utf-8") as handle:
        handle.write(DATA_HEADER)
        handle.write(f"\n\nwindow.{DATA_GLOBAL} = ")
        handle.write(body)
        handle.write(";\n")


def audit_tags(data):
    """
    Catch the ways a hand-maintained tag list quietly forks.

    A tag vocabulary typed by hand drifts: "Kiln" and "kiln" become two
    filters, "Roof " and "Roof" become two more, and nobody notices because
    both still look right on the page. Everything here is a warning rather
    than an error, since a real vocabulary sometimes wants near-duplicates.
    """
    warnings = []
    facets = [f for f in data.get("facets", []) if f.get("type") != "year"]
    items = data.get("items", [])

    for facet in facets:
        key = facet["key"]
        seen = {}
        for item in items:
            values = item.get(key) or []
            if isinstance(values, str):
                warnings.append(
                    f'{item.get("id")}: {key} should be a list, not a bare string'
                )
                values = [values]
            for value in values:
                if value != value.strip():
                    warnings.append(f'{key}: "{value}" has stray whitespace')
                seen.setdefault(value.strip().lower(), set()).add(value)

        for variants in seen.values():
            if len(variants) > 1:
                joined = ", ".join(f'"{v}"' for v in sorted(variants))
                warnings.append(f"{key}: same tag written two ways: {joined}")

        if not seen:
            warnings.append(f'{key}: declared as a facet but nothing is tagged with it')

    untagged = [
        item.get("id")
        for item in items
        if not any(item.get(f["key"]) for f in facets)
    ]
    for item_id in untagged:
        warnings.append(f"{item_id}: has no tags in any facet")

    return warnings


def is_stale(source_path, target_path):
    if not os.path.exists(target_path):
        return True
    return os.path.getmtime(source_path) > os.path.getmtime(target_path)


def check_tags_only(path):
    """Run the vocabulary audit against any data file, images not required."""
    warnings = audit_tags(read_data(path))
    for line in warnings:
        print(f"  warning: {line}", file=sys.stderr)
    print(f"\n{os.path.relpath(path, ROOT)}: {len(warnings)} warning(s)")
    return 0


def build(force=False, check_only=False):
    data = read_data()
    items = data.get("items", [])

    seen_ids = set()
    seen_files = set()
    problems = []
    original_bytes = 0
    derived_bytes = 0
    written = 0

    for item in items:
        item_id = item.get("id")
        rel = item.get("file")

        if not item_id or not rel:
            problems.append(f"item is missing an id or a file: {item}")
            continue
        if item_id in seen_ids:
            problems.append(f"duplicate id: {item_id}")
        seen_ids.add(item_id)
        if rel in seen_files:
            problems.append(f"two records point at the same file: {rel}")
        seen_files.add(rel)

        source = os.path.join(MEDIA, rel)
        if not os.path.exists(source):
            problems.append(f"{item_id}: no such file, media/{rel}")
            continue

        original_bytes += os.path.getsize(source)
        key = slugify(os.path.splitext(rel)[0])

        with Image.open(source) as image:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            item["width"], item["height"] = image.size

            derived = {}
            for name, longest_edge, quality in PRESETS:
                out_name = f"{key}.{slugify(name)}.webp"
                out_path = os.path.join(DERIVED, out_name)
                derived[name] = f"derived/{out_name}"

                if check_only:
                    continue
                if not force and not is_stale(source, out_path):
                    derived_bytes += os.path.getsize(out_path)
                    continue

                os.makedirs(DERIVED, exist_ok=True)
                copy = image.copy()
                copy.thumbnail((longest_edge, longest_edge), Image.LANCZOS)
                copy.save(out_path, "WEBP", quality=quality, method=6)
                derived_bytes += os.path.getsize(out_path)
                written += 1

            item["derived"] = derived

    for line in problems:
        print(f"  error:   {line}", file=sys.stderr)
    for line in audit_tags(data):
        print(f"  warning: {line}", file=sys.stderr)

    if not check_only:
        write_data(data)

    print(f"\n{len(items)} records, {written} derivative files written")
    if original_bytes:
        print(f"originals   {original_bytes / 1048576:8.1f} MB")
    if derived_bytes:
        print(f"derivatives {derived_bytes / 1048576:8.1f} MB")
        grid_only = sum(
            os.path.getsize(os.path.join(DERIVED, name))
            for name in os.listdir(DERIVED)
            if name.endswith(".grid.webp")
        )
        print(f"first paint {grid_only / 1048576:8.1f} MB  (grid tiles only)")

    return 1 if problems else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="rebuild every file")
    parser.add_argument("--check", action="store_true", help="report only")
    parser.add_argument(
        "--tags",
        metavar="DATA_FILE",
        help="audit tag spelling in any data file and stop, e.g. "
        "shared/tools/build-derivatives.py --tags 3d-gallery/data/models.js",
    )
    args = parser.parse_args()

    if args.tags:
        sys.exit(check_tags_only(os.path.join(ROOT, args.tags)))
    sys.exit(build(force=args.force, check_only=args.check))