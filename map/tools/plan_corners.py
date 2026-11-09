#!/usr/bin/env python3
"""Print the planImage CONFIG block for a georeferenced plan.

Reads the corner coordinates of a north-up EPSG:4326 GeoTIFF via gdalinfo
(ships with QGIS) and prints the block to paste into index.html and
admin.html. Prepare the tif first:

    gdalwarp -t_srs EPSG:4326 -r bilinear site_plan.tif site_plan_4326.tif
    gdal_translate -of PNG -outsize 3000 0 site_plan_4326.tif site_plan.png
    python3 plan_corners.py site_plan_4326.tif

Then upload site_plan.png to map/tiles/ and paste the printed block.
"""

import json
import subprocess
import sys


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "site_plan_4326.tif"
    try:
        raw = subprocess.check_output(["gdalinfo", "-json", path])
    except FileNotFoundError:
        sys.exit("gdalinfo not found on PATH; run from the OSGeo4W shell or a terminal with QGIS on PATH")
    info = json.loads(raw)

    wkt = (info.get("coordinateSystem") or {}).get("wkt", "")
    if "4326" not in wkt and "GEOGCRS" not in wkt and "GEOGCS" not in wkt:
        print("warning: raster does not look like EPSG:4326;")
        print("warp it first: gdalwarp -t_srs EPSG:4326 in.tif out.tif\n")

    cc = info["cornerCoordinates"]
    corners = [cc["upperLeft"], cc["upperRight"], cc["lowerRight"], cc["lowerLeft"]]
    block = {
        "url": "tiles/site_plan.png",
        "coordinates": [[round(x, 7), round(y, 7)] for x, y in corners],
    }
    print("planImage: " + json.dumps(block, indent=2) + ",")


if __name__ == "__main__":
    main()
