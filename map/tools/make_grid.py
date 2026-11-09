#!/usr/bin/env python3
"""Generate a labeled site grid as GeoJSON for the web map.

The grid is defined in the site's projected CRS (meters) and written out in
EPSG:4326 for MapLibre. Output contains LineString features for the grid
lines and Point features at square centers carrying a "label" property
(column letter + row number, e.g. E5).

Requires pyproj:  pip install pyproj

Example (10 m squares, 20 columns x 15 rows, origin at the grid's
southwest corner in UTM 32N):

    python3 make_grid.py --crs EPSG:32632 --origin 695200 4781300 \
        --size 10 --cols 20 --rows 15 --rotation 0 --out grid.geojson

Rotation is degrees counterclockwise about the origin, for site grids not
aligned to true north. Column letters run A, B, ... Z, AA, AB west to east;
row numbers run 1..n south to north. Flip either with --reverse-cols /
--reverse-rows to match the established site convention.
"""

import argparse
import json
import math

from pyproj import Transformer


def column_letter(i):
    #0 -> A, 25 -> Z, 26 -> AA
    label = ""
    i += 1
    while i > 0:
        i, rem = divmod(i - 1, 26)
        label = chr(65 + rem) + label
    return label


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--crs", required=True, help="projected site CRS, e.g. EPSG:32632")
    ap.add_argument("--origin", nargs=2, type=float, required=True,
                    metavar=("X", "Y"), help="grid southwest corner in site CRS meters")
    ap.add_argument("--size", type=float, required=True, help="square size in meters")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--rotation", type=float, default=0.0,
                    help="grid rotation in degrees counterclockwise about the origin")
    ap.add_argument("--reverse-cols", action="store_true")
    ap.add_argument("--reverse-rows", action="store_true")
    ap.add_argument("--out", default="grid.geojson")
    args = ap.parse_args()

    ox, oy = args.origin
    theta = math.radians(args.rotation)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    tf = Transformer.from_crs(args.crs, "EPSG:4326", always_xy=True)

    def to_lonlat(gx, gy):
        #local grid meters -> rotated site CRS coords -> lon/lat
        x = ox + gx * cos_t - gy * sin_t
        y = oy + gx * sin_t + gy * cos_t
        lon, lat = tf.transform(x, y)
        return [round(lon, 7), round(lat, 7)]

    features = []
    w, h = args.cols * args.size, args.rows * args.size

    #vertical lines (constant local x), then horizontal lines (constant local y)
    for c in range(args.cols + 1):
        gx = c * args.size
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString",
                         "coordinates": [to_lonlat(gx, 0), to_lonlat(gx, h)]},
            "properties": {},
        })
    for r in range(args.rows + 1):
        gy = r * args.size
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString",
                         "coordinates": [to_lonlat(0, gy), to_lonlat(w, gy)]},
            "properties": {},
        })

    #labeled point at each square center
    for c in range(args.cols):
        for r in range(args.rows):
            ci = args.cols - 1 - c if args.reverse_cols else c
            ri = args.rows - 1 - r if args.reverse_rows else r
            label = f"{column_letter(ci)}{ri + 1}"
            cx, cy = (c + 0.5) * args.size, (r + 0.5) * args.size
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": to_lonlat(cx, cy)},
                "properties": {"label": label},
            })

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh)
    lines = (args.cols + 1) + (args.rows + 1)
    print(f"wrote {args.out}: {lines} grid lines, {args.cols * args.rows} labeled squares")


if __name__ == "__main__":
    main()
