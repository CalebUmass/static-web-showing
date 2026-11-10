#!/usr/bin/env python3
"""Print the planXyz CONFIG block for a folder of plan tiles.

Reads the z/x/y.png folder written by gdal2tiles and prints the zoom range
and bounds to paste into index.html (CONFIG) and admin.html (CONTEXT).
Standard library only, so any python works, including the one in the
OSGeo4W shell. Make the tiles first (--xyz is required):

    gdal2tiles --xyz -r average --processes=4 site_plan.tif plan_tiles
    python map/tools/plan_tiles.py plan_tiles

Then upload the folder to map/tiles/plan/ and paste the printed block.
"""

import json
import math
import os
import sys


def tile_lon(x, z):
    return x / 2 ** z * 360.0 - 180.0


def tile_lat(y, z):
    n = math.pi - 2.0 * math.pi * y / 2 ** z
    return math.degrees(math.atan(math.sinh(n)))


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "plan_tiles"
    ext = sys.argv[2] if len(sys.argv) > 2 else "png"
    if not os.path.isdir(folder):
        sys.exit(f"no such folder: {folder}")

    zooms = sorted(int(d) for d in os.listdir(folder)
                   if d.isdigit() and os.path.isdir(os.path.join(folder, d)))
    if not zooms:
        sys.exit(f"no zoom folders (0, 1, ... 22) inside {folder}; is this gdal2tiles output?")
    zmin, zmax = zooms[0], zooms[-1]

    #tile range at the deepest zoom gives the tightest tile-aligned bounds
    top = os.path.join(folder, str(zmax))
    xs, ys, count = [], [], 0
    for xd in os.listdir(top):
        if not xd.isdigit():
            continue
        for f in os.listdir(os.path.join(top, xd)):
            stem, dot, e = f.rpartition(".")
            if dot and e == ext and stem.isdigit():
                xs.append(int(xd))
                ys.append(int(stem))
                count += 1
    if not xs:
        sys.exit(f"no .{ext} tiles under {top}")

    west, east = tile_lon(min(xs), zmax), tile_lon(max(xs) + 1, zmax)
    north, south = tile_lat(min(ys), zmax), tile_lat(max(ys) + 1, zmax)
    block = {
        "url": f"tiles/plan/{{z}}/{{x}}/{{y}}.{ext}",
        "minzoom": zmin,
        "maxzoom": zmax,
        "bounds": [round(west, 7), round(south, 7), round(east, 7), round(north, 7)],
    }
    clat = (north + south) / 2
    print(f"//{count} tiles at zoom {zmax}; center {(west + east) / 2:.5f}, {clat:.5f}")
    if clat < 0:
        print("//warning: center is in the southern hemisphere; the tiles were")
        print("//probably made without --xyz. Re-run gdal2tiles with --xyz.")
    print("planXyz: " + json.dumps(block, indent=2) + ",")


if __name__ == "__main__":
    main()
