//Photo point service for the dig map.
//Owns the SQLite database that stores the archival photo points. This is
//the single source of truth for the photo layer; everything else on the
//map stays as static PMTiles.
//
//Configuration (environment variables):
//  PHOTO_DB          absolute path to the sqlite file. Keep it OUTSIDE the
//                    Apache htdocs tree so it is never web-downloadable and
//                    never touched by git pull. e.g. /home/ubuntu/digmap/photos.db
//  PHOTO_EDIT_TOKEN  shared passphrase for edits (checked by EditTokenGuard)

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

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
    updated_by  TEXT
);
CREATE TABLE IF NOT EXISTS edit_log (
    log_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT,
    action   TEXT,
    editor   TEXT,
    at       TEXT,
    payload  TEXT
);
`;

export interface PhotoFields {
  lon?: number;
  lat?: number;
  rotation?: number;
  description?: string;
  tags?: string;
  image_url?: string;
  year?: number | null;
}

interface PhotoRow {
  id: string;
  lon: number;
  lat: number;
  rotation: number;
  description: string;
  tags: string;
  image_url: string;
  year: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

@Injectable()
export class PhotosService implements OnModuleDestroy {
  private db: Database.Database;

  constructor() {
    const dbPath =
      process.env.PHOTO_DB || path.join(process.cwd(), 'photos.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  onModuleDestroy() {
    this.db.close();
  }

  private now(): string {
    return new Date().toISOString().slice(0, 19) + 'Z';
  }

  private logEdit(
    photoId: string,
    action: string,
    editor: string,
    payload: unknown,
  ) {
    this.db
      .prepare(
        'INSERT INTO edit_log (photo_id, action, editor, at, payload) VALUES (?,?,?,?,?)',
      )
      .run(photoId, action, editor, this.now(), JSON.stringify(payload));
  }

  //validate and normalise an incoming edit payload; only known fields pass
  cleanFields(body: unknown, requireCoords = false): PhotoFields {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('expected a JSON object');
    }
    const raw = body as Record<string, unknown>;
    const fields: PhotoFields = {};

    if ('lon' in raw) {
      const lon = Number(raw.lon);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180)
        throw new BadRequestException('lon must be a number in [-180, 180]');
      fields.lon = lon;
    }
    if ('lat' in raw) {
      const lat = Number(raw.lat);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        throw new BadRequestException('lat must be a number in [-90, 90]');
      fields.lat = lat;
    }
    if (requireCoords && (fields.lon === undefined || fields.lat === undefined))
      throw new BadRequestException('lon and lat are required');

    if ('rotation' in raw) {
      const rot = Number(raw.rotation);
      if (!Number.isFinite(rot))
        throw new BadRequestException('rotation must be a number');
      fields.rotation = ((rot % 360) + 360) % 360;
    }
    if ('year' in raw) {
      if (raw.year === null || raw.year === '') {
        fields.year = null;
      } else {
        const year = Number(raw.year);
        if (!Number.isInteger(year))
          throw new BadRequestException('year must be an integer');
        fields.year = year;
      }
    }
    if ('tags' in raw) {
      const parts = Array.isArray(raw.tags)
        ? raw.tags.map((t) => String(t).trim())
        : String(raw.tags ?? '')
            .split(',')
            .map((t) => t.trim());
      fields.tags = parts.filter((p) => p.length > 0).join(',');
    }
    if ('description' in raw) fields.description = String(raw.description ?? '');
    if ('image_url' in raw) fields.image_url = String(raw.image_url ?? '');

    return fields;
  }

  private rowToFeature(r: PhotoRow) {
    return {
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: {
        id: r.id,
        rotation: r.rotation,
        description: r.description,
        tags: (r.tags || '').split(',').filter((t) => t.length > 0),
        image_url: r.image_url,
        year: r.year,
        updated_at: r.updated_at,
        updated_by: r.updated_by,
      },
    };
  }

  featureCollection() {
    const rows = this.db
      .prepare('SELECT * FROM photos ORDER BY id')
      .all() as PhotoRow[];
    return {
      type: 'FeatureCollection',
      features: rows.map((r) => this.rowToFeature(r)),
    };
  }

  private getRow(id: string): PhotoRow {
    const row = this.db
      .prepare('SELECT * FROM photos WHERE id=?')
      .get(id) as PhotoRow | undefined;
    if (!row) throw new NotFoundException('no such photo point');
    return row;
  }

  create(body: unknown, editor: string) {
    const f = this.cleanFields(body, true);
    const id = randomUUID().slice(0, 8);
    this.db
      .prepare(
        `INSERT INTO photos (id, lon, lat, rotation, description, tags,
         image_url, year, updated_at, updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        f.lon,
        f.lat,
        f.rotation ?? 0,
        f.description ?? '',
        f.tags ?? '',
        f.image_url ?? '',
        f.year ?? null,
        this.now(),
        editor,
      );
    this.logEdit(id, 'create', editor, f);
    return this.rowToFeature(this.getRow(id));
  }

  update(id: string, body: unknown, editor: string) {
    const f = this.cleanFields(body);
    const keys = Object.keys(f) as (keyof PhotoFields)[];
    if (keys.length === 0)
      throw new BadRequestException('no editable fields in payload');
    this.getRow(id);
    const sets = keys.map((k) => `${k}=?`).join(', ');
    const values = keys.map((k) => f[k] ?? null);
    this.db
      .prepare(`UPDATE photos SET ${sets}, updated_at=?, updated_by=? WHERE id=?`)
      .run(...values, this.now(), editor, id);
    this.logEdit(id, 'update', editor, f);
    return this.rowToFeature(this.getRow(id));
  }

  remove(id: string, editor: string) {
    const result = this.db.prepare('DELETE FROM photos WHERE id=?').run(id);
    if (result.changes === 0)
      throw new NotFoundException('no such photo point');
    this.logEdit(id, 'delete', editor, {});
    return { deleted: id };
  }
}
