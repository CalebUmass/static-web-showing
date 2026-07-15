//Owns everything Google-facing: authenticates with the service account,
//downloads the Drive folder of inventory spreadsheets into an index, and
//answers lookups from that cache. The controller stays thin on purpose.
//
//Freshness model (stale-while-revalidate):
//- index older than TTL_HOURS: requests are still answered from the old
//  copy instantly while a background rebuild pulls fresh data
//- very first request (no index on disk): builds synchronously, one-time wait
//- manual refresh is ignored when the index is younger than
//  MIN_REFRESH_MINUTES so the public button cannot burn API quota

//@googleapis/drive and @googleapis/sheets are the per-API packages. The
//monolithic googleapis package carries type definitions for every Google
//API at once, which is enough to exhaust the heap when tsc runs on a small
//instance; these two pull in only what this service touches.
import { Injectable, Logger } from '@nestjs/common';
import { drive_v3, drive } from '@googleapis/drive';
import { sheets_v4, sheets, auth as sheetsAuth } from '@googleapis/sheets';
import * as fs from 'fs';
import * as path from 'path';

export interface CassettaMatch {
  scaff: string; //spreadsheet title, the scaffolding
  cass: string;  //tab title, the cassetta
}

interface CassettaIndex {
  builtAt: number; //epoch ms
  sheetCount: number;
  entries: Record<string, CassettaMatch[]>;
}

//paths resolve from the api/ working directory the service runs in
const KEY_FILE = process.env.CASSETTA_SERVICE_ACCOUNT || path.resolve(process.cwd(), 'service_account.json');
const FOLDER_ID = process.env.CASSETTA_FOLDER_ID || '1L8nX2erpvzC7tOjMUTGGU3tu8dxsxX9F';
const CACHE_FILE = process.env.CASSETTA_CACHE_FILE || path.resolve(process.cwd(), 'data', 'cassetta_index.json');
const TTL_HOURS = Number(process.env.CASSETTA_TTL_HOURS) || 12;
const MIN_REFRESH_MINUTES = Number(process.env.CASSETTA_MIN_REFRESH_MIN) || 10;

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const NUMBER_PATTERN = /^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i;

@Injectable()
export class CassettaService {
  private readonly logger = new Logger(CassettaService.name);
  private index: CassettaIndex | null = null;
  private rebuilding: Promise<void> | null = null; //guards concurrent rebuilds

  /*=============== input parsing ===============*/

  //forces a messy catalog number into "PC 19720072" / "VdM 19720072" shape;
  //returns null when the input cannot be understood
  parseNumber(raw: string, defaultSite: string): { display: string; key: string } | null {
    const cleaned = raw.trim().replace(/[-_.,;/]+/g, ' ').replace(/\s+/g, ' ');
    const m = cleaned.match(NUMBER_PATTERN);
    if (!m) return null;
    let site = defaultSite === 'VdM' ? 'VdM' : 'PC';
    if (m[1]) site = m[1].toUpperCase() === 'PC' ? 'PC' : 'VdM';
    const display = `${site} ${m[2]}${m[3]}`;
    return { display, key: this.normalizeKey(display) };
  }

  //uppercase with all whitespace removed, so "PC 19720072", "pc19720072"
  //and "PC 1972 0072" in a sheet cell all compare as "PC19720072"
  private normalizeKey(value: unknown): string {
    return String(value).toUpperCase().replace(/\s+/g, '');
  }

  /*=============== public api used by the controller ===============*/

  async find(key: string): Promise<{ matches: CassettaMatch[]; indexedAt: number }> {
    const index = await this.ensureIndex();
    return { matches: index.entries[key] || [], indexedAt: index.builtAt };
  }

  status() {
    const index = this.index ?? this.loadCache();
    if (!index) return { ready: false, refreshing: this.rebuilding !== null };
    return {
      ready: true,
      refreshing: this.rebuilding !== null,
      objects: Object.keys(index.entries).length,
      sheets: index.sheetCount,
      builtAt: index.builtAt,
      ageHours: Math.round(this.ageHours(index) * 100) / 100,
    };
  }

  requestRefresh(): { started: boolean; reason?: string } {
    const index = this.index ?? this.loadCache();
    if (index && this.ageHours(index) * 60 < MIN_REFRESH_MINUTES) {
      return { started: false, reason: 'index is recent enough' };
    }
    if (this.rebuilding) return { started: false, reason: 'a rebuild is already running' };
    //the catch matters: nothing awaits this promise, and an unhandled
    //rejection takes the whole process down on node 15+, so a bad key or a
    //Google outage would kill the photos endpoints too
    this.startRebuild().catch(() => undefined);
    return { started: true };
  }

  /*=============== index lifecycle ===============*/

  //guarantees an index exists; blocks only on the very first build, a stale
  //index is served as-is while a background rebuild runs
  private async ensureIndex(): Promise<CassettaIndex> {
    if (!this.index) this.index = this.loadCache();
    if (!this.index) {
      //nothing to serve stale, so the first request waits for the build
      await (this.rebuilding ?? this.startRebuild());
      if (!this.index) throw new Error('index build produced no data');
      return this.index;
    }
    if (this.ageHours(this.index) > TTL_HOURS && !this.rebuilding) {
      //fire and forget; the catch stops an unhandled rejection from crashing node
      this.startRebuild().catch(() => undefined);
    }
    return this.index;
  }

  private startRebuild(): Promise<void> {
    this.rebuilding = this.buildIndex()
      .then((built) => {
        this.index = built;
        this.saveCache(built);
        this.logger.log(`index rebuilt: ${Object.keys(built.entries).length} objects, ${built.sheetCount} sheets`);
      })
      .catch((err) => {
        this.logger.error(`index rebuild failed: ${err.message}`);
        throw err;
      })
      .finally(() => {
        this.rebuilding = null;
      });
    return this.rebuilding;
  }

  private ageHours(index: CassettaIndex): number {
    return (Date.now() - index.builtAt) / 3600000;
  }

  /*=============== google apis ===============*/

  //downloads the whole folder: two API calls per spreadsheet, tab titles
  //then a batchGet of column A of every tab at once
  private async buildIndex(): Promise<CassettaIndex> {
    const gauth = new sheetsAuth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    const driveClient: drive_v3.Drive = drive({ version: 'v3', auth: gauth as any });
    const sheetsClient: sheets_v4.Sheets = sheets({ version: 'v4', auth: gauth as any });

    //same query as the original python script
    const q = `'${FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const files: { id: string; name: string }[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await this.withBackoff(() =>
        driveClient.files.list({ q, fields: 'nextPageToken, files(id, name)', pageSize: 1000, pageToken }),
      );
      for (const f of resp.data.files ?? []) {
        if (f.id && f.name) files.push({ id: f.id, name: f.name });
      }
      pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (files.length === 0) throw new Error('no Google Sheets found in the folder');

    const entries: Record<string, CassettaMatch[]> = {};
    for (const file of files) {
      const meta = await this.withBackoff(() =>
        sheetsClient.spreadsheets.get({ spreadsheetId: file.id, fields: 'sheets.properties.title' }),
      );
      const tabs = (meta.data.sheets ?? [])
        .map((s) => s.properties?.title)
        .filter((t): t is string => !!t);
      if (tabs.length === 0) continue;

      //single quotes inside a tab name double up in A1 notation
      const ranges = tabs.map((t) => `'${t.replace(/'/g, "''")}'!A:A`);
      const batch = await this.withBackoff(() =>
        sheetsClient.spreadsheets.values.batchGet({ spreadsheetId: file.id, ranges }),
      );

      (batch.data.valueRanges ?? []).forEach((vr, i) => {
        for (const row of vr.values ?? []) {
          if (row[0] === undefined || String(row[0]).trim() === '') continue;
          const key = this.normalizeKey(row[0]);
          (entries[key] ??= []).push({ scaff: file.name, cass: tabs[i] });
        }
      });
    }

    return { builtAt: Date.now(), sheetCount: files.length, entries };
  }

  //exponential backoff on rate limits and server errors, per the Sheets docs
  private async withBackoff<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const code = Number(err?.code ?? err?.response?.status);
      if ((code === 429 || code >= 500) && attempt < 5) {
        const wait = 2 ** attempt * 500 + Math.random() * 300;
        await new Promise((r) => setTimeout(r, wait));
        return this.withBackoff(fn, attempt + 1);
      }
      throw err;
    }
  }

  /*=============== disk cache ===============*/

  private saveCache(index: CassettaIndex): void {
    try {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      //atomic write so a crash mid-save never leaves a half-written cache
      const tmp = CACHE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(index));
      fs.renameSync(tmp, CACHE_FILE);
    } catch (err: any) {
      this.logger.warn(`could not write cache file: ${err.message}`);
    }
  }

  private loadCache(): CassettaIndex | null {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CassettaIndex;
    } catch {
      return null;
    }
  }
}
