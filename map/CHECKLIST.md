# Project checklist: finalized QGIS map to live site

## Phase 1: data preparation in QGIS

1. Finalize attributes on every layer that will be published. Stable unique
   id column on trenches, finds, and photo points (not row order); integer
   `year` column on all three; `db_url` (or the record id the database
   URLs are built from) on trenches and finds; `rotation`, `description`,
   `tags`, `link`, and `year` columns on the photo layer. Strip internal
   working columns from the publish set.
2. Verify geometry and CRS. Working CRS can stay as is; every export
   reprojects to EPSG:4326 with `-t_srs`, which tippecanoe requires.
3. Export the vector layers to GeoJSON with ogr2ogr, one file per layer
   (trenches, finds, photo_points for the one-time import only).
4. Build the vector tile archive with tippecanoe, one `-L name:file.geojson`
   per layer. The `-L` names become the source-layer names in MapLibre, so
   note them for the index.html CONFIG.
5. Tile the georeferenced site plans with GDAL into a raster PMTiles
   archive (`plans.pmtiles`), max zoom around 20 to 22 for excavation-scale
   detail.
6. Wrap steps 3 to 5 in a single `publish.sh` ending with an scp/rsync of
   the pmtiles files to `map/tiles/` on the server. From now on,
   publishing the map is one command after any QGIS session.

## Phase 2: server and API

7. Prepare the Ubuntu instance: install Node LTS, `apache2-utils`, and
   `sqlite3`; enable the Apache modules `proxy`, `proxy_http`, `headers`,
   `ssl`. Confirm HTTPS works (certbot if the new instance has no cert yet).
8. Add the `api/` project to the repo, then on the server: `npm install`
   and `npm run build` inside it.
9. Create `/home/ubuntu/digmap`, install the `dig-map-api` systemd unit
   with `API_PORT`, `PHOTO_DB`, and a long `PHOTO_EDIT_TOKEN`; enable and
   start it. Verify locally: `curl http://127.0.0.1:3001/photos`.
10. Add the proxy rules to the Apache vhost, `/api/photos` to 3001 BEFORE
    `/api` to 3000, plus the `<Files admin.html>` basic auth block; create
    the htpasswd file; `apachectl configtest` and reload. Verify publicly:
    `curl https://poggiocivitate.net/api/photos` returns an empty
    FeatureCollection.
11. One-time photo import: export the photo layer to GeoJSON on the
    desktop, adjust FIELD_MAP in `scripts/import_photos.mjs`, run it on the
    server against `/home/ubuntu/digmap/photos.db`, restart the api, and
    confirm the features now appear at `/api/photos`.
12. Delete the photo layer from `publish.sh`. The server database is now
    the only authoritative copy; QGIS pulls it down, never pushes it up.

## Phase 3: the public map (index.html)

13. Create the `map/` folder in the repo with `index.html` and
    `public_map_photos.js`; add `map/tiles/` to `.gitignore` and upload the
    pmtiles archives there.
14. Edit the CONFIG block in `index.html`: center and zoom, tile paths, the
    tippecanoe layer names from step 4, the years array, the trench
    attribute names, the `trenchDbUrl` link template, and the basemap
    choice (keep OSM, switch to a vector style, or remove it entirely for
    the plan-only mapgenie look).
15. Style pass: trench fill and outline colors, find point sizing, zoom
    thresholds, optional labels. Confirm the year checkboxes filter
    trenches, finds, and photo arrows together, and that trench popups link
    into the database.
16. Confirm the photo layer: arrows render at the right spots, rotation
    matches the QGIS arrow convention, popups show description, tags, and
    the image link.
17. Add the map to the projects landing page the same way as the other
    projects, and give it a quick check on a phone.
18. Update the excavation years dropdown to be work a bit better, 60 different clickable options is not great. Filter by decade? or just type?

## Phase 4: the editor (admin.html)

19. Add `admin.html` to `map/` and set its START center and zoom. The API
    constant already points at `/api/photos`.
20. Verify both gates in a private browser window: Apache basic auth
    prompts first, then a save attempt without the passphrase fails with
    "bad passphrase", and with it succeeds.
21. Onboard the editors: URL, htpasswd credentials, the passphrase, and a
    five-minute walkthrough of select, edit, Move point, Aim at a map
    click, and Save. Confirm a saved edit shows up on the public map
    (within the 60 second cache window).
22. Finish the safety net: install the daily backup cron for the database
    and run `sync_to_qgis.sh` once end to end to prove the round trip back
    into QGIS works.
