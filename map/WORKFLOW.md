# Photo digitisation workflow: paper sketch to live map

```
boss annotates a paper plan      ("taken here, facing the north wall, square E5")
        |
student opens map/admin.html     (plan + grid on screen match the paper)
        |  places the point in E5, aims the arrow, fills in metadata
        |
SQLite via the unified api       (/var/lib/digmap/photos.db, edit_log per change)
        |
map/index.html shows it          (within the 60 second cache)
        |
CSV export                       (/api/photos/export.csv, joins back to the archive)
```

The grid is the shared coordinate language between paper and screen, so the
plan and grid go onto both pages before students start.

## 0. Prerequisite check on the server

The systemd unit in SERVER.md previously had `PHOTO_DB` and
`PHOTO_EDIT_TOKEN` commented out. Without the token every save returns 503
("PHOTO_EDIT_TOKEN is not configured"); without `PHOTO_DB` the database
falls back to `photos.db` inside the api checkout. Check what the running
service actually has (prints `<set>`, never the passphrase):

```bash
P=$(systemctl show -p MainPID --value dig-map-api)
sudo cat /proc/$P/environ | tr '\0' '\n' | grep '^PHOTO_DB='
sudo cat /proc/$P/environ | tr '\0' '\n' | grep -q '^PHOTO_EDIT_TOKEN=.' && echo "PHOTO_EDIT_TOKEN=<set>"
```

Both lines must print. If either is missing, follow SERVER.md, "systemd
unit" (the token goes in `/etc/dig-map-api.env`).

## 1. One time: the georeferenced site plan image

A single image source is the right first version; tiled PMTiles only pays
off with many plans or one very large one. From the GeoTIFF the QGIS
georeferencer saved, in the OSGeo4W shell (or any terminal with QGIS's GDAL
on PATH):

```bash
#north-up in EPSG:4326, then a web-sized png (3000 px wide, height auto)
gdalwarp -t_srs EPSG:4326 -r bilinear site_plan.tif site_plan_4326.tif
gdal_translate -of PNG -outsize 3000 0 site_plan_4326.tif site_plan.png

#prints the planImage block to paste into both pages
python3 map/tools/plan_corners.py site_plan_4326.tif
```

Upload the png (tiles are gitignored and travel by scp):

```bash
scp site_plan.png ubuntu@server:/var/www/html/map/tiles/
```

Paste the printed block as `planImage` in the CONFIG of `index.html` and
the CONTEXT of `admin.html`.

## 2. One time: the labeled site grid

`map/tools/make_grid.py` writes grid lines plus E5-style square labels
(needs `pip install pyproj` once):

```bash
python3 map/tools/make_grid.py --crs EPSG:32632 --origin 695200 4781300 \
    --size 10 --cols 20 --rows 15 --rotation 0 --out grid.geojson
scp grid.geojson ubuntu@server:/var/www/html/map/tiles/
```

- `--crs` is the site's projected CRS, `--origin` the grid's southwest
  corner in that CRS (read off the QGIS canvas), `--size` the square size
  in meters.
- `--rotation` is degrees counterclockwise, for a grid not aligned to true
  north.
- `--reverse-cols` / `--reverse-rows` flip the lettering direction to match
  the established site convention. Check a couple of known squares against
  the paper plan before students start.

Then set `gridUrl: "tiles/grid.geojson"` in both pages. Labels appear past
zoom 17 on the public map and 16.5 in the editor.

QGIS alternative: Vector > Research Tools > Create Grid in the site CRS,
add a label field, export with `ogr2ogr -f GeoJSON -t_srs EPSG:4326`.

## 3. The student workflow (onboarding note)

Each student worker gets the admin URL, an htpasswd login (one per person:
`sudo htpasswd /etc/apache2/.htpasswd-digmap name`), the edit passphrase,
and these steps:

1. Open admin.html, enter a real name under "Your name" (it goes into the
   edit history) and the passphrase. The browser remembers both.
2. Find the grid square written on the paper sketch; on-screen labels match
   the paper lettering.
3. Add photo point, then click the spot the photograph was taken from.
4. Aim at a map click, then click what the camera was looking at. Fine-tune
   with the slider if the sketch gives a precise bearing.
5. Fill in description, tags, year, and the image link if the scan is
   online. Save.
6. Write the point id shown in the panel (e.g. `7ee2b791`) back onto the
   paper sketch. That id is the join key between the physical archive, the
   CSV, and the website.

Mistakes are cheap: Revert restores the last saved version, every change is
recorded in edit_log with the editor's name, and the daily backup covers
anything worse.

## 4. Getting the data out

- CSV: `https://poggiocivitate.net/api/photos/export.csv`, also the
  "Download CSV" button in admin.html. Columns: id, lon, lat, rotation_deg,
  year, tags, description, image_url, updated_at, updated_by. Opens directly
  in Excel (UTF-8 BOM included).
- GeoJSON: `https://poggiocivitate.net/api/photos`, what the public map
  renders.
- GeoPackage for QGIS: `./map/sync_to_qgis.sh https://poggiocivitate.net`.

The CSV is a live export of the SQLite table, not a second copy to keep in
sync. SQLite stays the store because several students save at once; a CSV
edited concurrently is a corruption risk.

## 5. Deploying this change

No Apache change (`/api/` already proxies wholesale to 3001) and no schema
change:

```bash
cd /var/www/html && git pull
cd api
NODE_OPTIONS="--max-old-space-size=1024" npm run build
sudo systemctl restart dig-map-api
curl -s http://127.0.0.1:3001/photos/export.csv | head -2
```
