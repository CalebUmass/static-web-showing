#!/usr/bin/env node
//One-time import of existing photo points into the editing database.
//
//First export the layer from the GeoPackage on the desktop:
//
//    ogr2ogr -f GeoJSON -t_srs EPSG:4326 photo_points.geojson dig.gpkg photo_points
//
//Then, from the api directory on the server (so better-sqlite3 resolves):
//
//    node scripts/import_photos.mjs photo_points.geojson /home/ubuntu/digmap/photos.db
//
//Adjust FIELD_MAP below to match the QGIS column names. Running the
//import twice upserts by id, so it is safe to re-run. Imported points are
//credited to "import" as their submitter. A layer without a kind column
//leaves each existing point's kind (set on the website) untouched.

import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';

//left side: database field, right side: candidate property names in the
//geojson, checked in order until one is found
const FIELD_MAP = {
  id: ['id', 'photo_id', 'fid'],
  rotation: ['rotation', 'angle', 'bearing'],
  description: ['description', 'desc', 'notes'],
  tags: ['tags', 'keywords'],
  image_url: ['image_url', 'link', 'url', 'image'],
  year: ['year', 'season'],
  //ground, aerial, or artifact; any other value must be a short lowercase name
  kind: ['kind', 'photo_type', 'type'],
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    lon         REAL NOT NULL,
    lat         REAL NOT NULL,
    rotation    REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '',
    image_url   TEXT NOT NULL DEFAULT '',
    year        INTEGER,
    updated_at  TEXT,
    updated_by  TEXT,
    kind        TEXT NOT NULL DEFAULT 'ground',
    created_at  TEXT,
    created_by  TEXT
);
CREATE TABLE IF NOT EXISTS edit_log (
    log_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT,
    action   TEXT,
    editor   TEXT,
    at       TEXT,
    payload  TEXT
);`;

function pick(props, keys, fallback = null) {
  for (const k of keys) {
    if (k in props && props[k] !== null && props[k] !== '') return props[k];
  }
  return fallback;
}

const [, , geojsonPath, dbPath = 'photos.db'] = process.argv;
if (!geojsonPath) {
  console.error('usage: node import_photos.mjs photo_points.geojson [photos.db]');
  process.exit(1);
}

const fc = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
mkdirSync(dirname(dbPath) || '.', { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(SCHEMA);

//same columns the api adds on startup, for a database created before them
const cols = new Set(db.prepare('PRAGMA table_info(photos)').all().map((c) => c.name));
if (!cols.has('kind')) db.exec("ALTER TABLE photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'ground'");
if (!cols.has('created_at')) db.exec('ALTER TABLE photos ADD COLUMN created_at TEXT');
if (!cols.has('created_by')) db.exec('ALTER TABLE photos ADD COLUMN created_by TEXT');

const KIND_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

const upsert = db.prepare(`
  INSERT INTO photos (id, lon, lat, rotation, description, tags,
    image_url, year, updated_at, updated_by, kind, created_at, created_by)
  VALUES (@id, @lon, @lat, @rotation, @description, @tags,
    @image_url, @year, @updated_at, 'import', COALESCE(@kind, 'ground'),
    @updated_at, 'import')
  ON CONFLICT(id) DO UPDATE SET
    lon=excluded.lon, lat=excluded.lat, rotation=excluded.rotation,
    description=excluded.description, tags=excluded.tags,
    image_url=excluded.image_url, year=excluded.year,
    updated_at=excluded.updated_at, updated_by=excluded.updated_by,
    kind=COALESCE(@kind, photos.kind)`);

const now = new Date().toISOString().slice(0, 19) + 'Z';
let count = 0;

const run = db.transaction(() => {
  for (const feat of fc.features || []) {
    const geom = feat.geometry || {};
    if (geom.type !== 'Point') continue;
    const [lon, lat] = geom.coordinates;
    const props = feat.properties || {};

    const rawTags = pick(props, FIELD_MAP.tags, '');
    const tags = (Array.isArray(rawTags) ? rawTags : String(rawTags).split(','))
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0)
      .join(',');
    const rawYear = pick(props, FIELD_MAP.year);
    const year = rawYear === null ? null : parseInt(rawYear, 10);
    const rawKind = pick(props, FIELD_MAP.kind);
    const kind = rawKind === null ? null : String(rawKind).trim().toLowerCase();
    if (kind !== null && !KIND_PATTERN.test(kind)) {
      throw new Error(`feature ${JSON.stringify(props)}: kind "${rawKind}" is not a short lowercase name`);
    }

    //stable fallback id derived from the feature itself, so re-running
    //the import updates rather than duplicates unlabeled points
    const fallbackId = createHash('sha1')
      .update(`${lon},${lat},${pick(props, FIELD_MAP.description, '')}`)
      .digest('hex')
      .slice(0, 8);

    upsert.run({
      id: String(pick(props, FIELD_MAP.id, fallbackId)),
      lon,
      lat,
      rotation: ((Number(pick(props, FIELD_MAP.rotation, 0)) % 360) + 360) % 360,
      description: String(pick(props, FIELD_MAP.description, '')),
      tags,
      image_url: String(pick(props, FIELD_MAP.image_url, '')),
      year: Number.isInteger(year) ? year : null,
      kind,
      updated_at: now,
    });
    count += 1;
  }
});
run();
db.close();
console.log(`imported ${count} photo points into ${dbPath}`);
