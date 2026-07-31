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
  //subfolder path the sheet was found in ("Research", "Conservation", ...);
  //omitted for sheets sitting directly in the root folder, like the museum inventory.
  folder?: string;
  //columns B to E, each omitted when the cell is empty so the index stays small
  link?: string;           //Open Context url, column B
  relocation?: string;     //the options field, column C
  relocationNote?: string; //free text used when the relocation column says Other
  returnTo?: string;       //"Return to:" column, used by the Scaff. 00 fun boxes
  notes?: string;          //free text notes column, carried through unused for now
  img?: string;            //url to object thumbnail
}

interface CassettaIndex {
  builtAt: number; //epoch ms
  sheetCount: number;
  entries: Record<string, CassettaMatch[]>;
}

//paths resolve from the api/ working directory the service runs in
const KEY_FILE = process.env.CASSETTA_SERVICE_ACCOUNT || path.resolve(process.cwd(), 'service_account.json');
const FOLDER_ID = process.env.CASSETTA_FOLDER_ID || '1PkOD8JFhzqVh3qlpiI-DAvzNjuNdanKj';
const CACHE_FILE = process.env.CASSETTA_CACHE_FILE || path.resolve(process.cwd(), 'data', 'cassetta_index.json');
const TTL_HOURS = Number(process.env.CASSETTA_TTL_HOURS) || 12;
const MIN_REFRESH_MINUTES = Number(process.env.CASSETTA_MIN_REFRESH_MIN) || 10;

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const NUMBER_PATTERN = /^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i;

//logical columns, with every spelling seen across the inventory sheets.
//  So columns are located by name, never by position.
//Compared after normalizeHeader, so:
//  case, trailing colons, curly quotes,  doubled spaces 
// do not need listing here.
const COLUMN_ALIASES: Record<string, string[]> = {
  number: ['object number', 'pc number', 'vdm number', 'catalog number'],
  link: ['open context link', 'open context', 'oc link'],
  relocation: ['in case of relocation - new location'],
  relocationNote: ['if "other" - new location'],
  returnTo: ['return to'],
  notes: ['notes', 'note', 'comments', 'comment'],
  //notes and images missing from FALLBACK_INDEX below: the image column doesnt
  //exist in any sheet yet, so it must be labelled with one of these to be
  //read at all.
  img: ['image', 'image link', 'image url', 'thumbnail', 'thumbnail link',
        'thumbnail url', 'open context image', 'photo'],
};

//the layout 265 of the 293 tabs use. Consulted only when the header cell at
//that index exists but is empty, which means the label was never typed and the
//column still holds what the majority layout says it holds. A column carrying
//some other label is something else and stays unread a column with no header
//cell at all also stays unread, and shows up in the audit script instead
const FALLBACK_INDEX: Record<string, number> = {
  number: 0,
  link: 1,
  relocation: 2,
  relocationNote: 3,
};

interface ColumnMap {
  index: Record<string, number | undefined>;
  usedFallback: string[];
}

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

  //the sheets carry zero width spaces in the relocation column, which would
  //otherwise read as a real value; also collapses stray whitespace
  private cleanCell(value: unknown): string {
    if (value === undefined || value === null) return '';
    return String(value).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  }

  //header labels vary by case, trailing colon, quote style and spacing, so they
  //get flattened before being compared to the alias lists
  private normalizeHeader(value: unknown): string {
    return this.cleanCell(value)
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[:\s]+$/, '');
  }

  //works out which column holds what for one tab, by name first and by the
  //majority position only where a label is blank
  private mapColumns(headerRow: unknown[]): ColumnMap {
    const norm = (headerRow ?? []).map((h) => this.normalizeHeader(h));
    const index: Record<string, number | undefined> = {};
    const usedFallback: string[] = [];

    for (const field of Object.keys(COLUMN_ALIASES)) {
      const aliases = COLUMN_ALIASES[field];
      const found = norm.findIndex((h) => h !== '' && aliases.includes(h));
      if (found >= 0) index[field] = found;
    }

    for (const field of Object.keys(FALLBACK_INDEX)) {
      const idx = FALLBACK_INDEX[field];
      if (index[field] === undefined && idx < norm.length && norm[idx] === '') {
        index[field] = idx;
        usedFallback.push(field);
      }
    }

    return { index, usedFallback };
  }

  //reads one cell by logical column, empty when the tab has no such column
  private cellAt(row: unknown[], index: number | undefined): string {
    if (index === undefined || index < 0 || index >= row.length) return '';
    return this.cleanCell(row[index]);
  }

  //turns a column A cell into the same canonical key a typed search produces,
  //or null when the cell is not a catalog number at all (header rows, notes,
  //blanks). Running the cell through the same cleanup as parseNumber matters:
  //a sheet reading "PC 2017-0001" has to match someone typing "PC 20170001"
  private cellKey(value: unknown): string | null {
    const cleaned = this.cleanCell(value).replace(/[-_.,;/]+/g, ' ').replace(/\s+/g, ' ');
    const m = cleaned.match(NUMBER_PATTERN);
    if (!m) return null;
    const site = m[1] && m[1].toUpperCase() !== 'PC' ? 'VdM' : 'PC';
    return this.normalizeKey(`${site} ${m[2]}${m[3]}`);
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

    //walks the folder tree breadth first, collecting spreadsheets at every
    //level and remembering which subfolder each came from. The visited set
    //guards against a folder reachable twice; shortcuts are ignored since
    //following them could leave the tree entirely
    const files: { id: string; name: string; folder: string }[] = [];
    const visited = new Set<string>();
    const queue: { id: string; label: string }[] = [{ id: FOLDER_ID, label: '' }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);

      const q = `'${current.id}' in parents and trashed=false and ` +
        `(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.folder')`;
      let pageToken: string | undefined;
      do {
        const resp = await this.withBackoff(() =>
          driveClient.files.list({
            q, fields: 'nextPageToken, files(id, name, mimeType)', pageSize: 1000, pageToken,
          }),
        );
        for (const f of resp.data.files ?? []) {
          if (!f.id || !f.name) continue;
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            queue.push({ id: f.id, label: current.label ? `${current.label} / ${f.name}` : f.name });
          } else {
            files.push({ id: f.id, name: f.name, folder: current.label });
          }
        }
        pageToken = resp.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    if (files.length === 0) throw new Error('no Google Sheets found in the folder');

    const entries: Record<string, CassettaMatch[]> = {};
    let skipped = 0; //cells that were not catalog numbers, logged as a sanity check
    let fallbackTabs = 0; //tabs where a blank column label was filled in by position
    for (const file of files) {
      const meta = await this.withBackoff(() =>
        sheetsClient.spreadsheets.get({ spreadsheetId: file.id, fields: 'sheets.properties.title' }),
      );
      const tabs = (meta.data.sheets ?? [])
        .map((s) => s.properties?.title)
        .filter((t): t is string => !!t);
      if (tabs.length === 0) continue;

      //single quotes inside a tab name double up in A1 notation
      const ranges = tabs.map((t) => `'${t.replace(/'/g, "''")}'!A:H`);
      const batch = await this.withBackoff(() =>
        sheetsClient.spreadsheets.values.batchGet({ spreadsheetId: file.id, ranges }),
      );

      (batch.data.valueRanges ?? []).forEach((vr, i) => {
        const rows = vr.values ?? [];
        if (rows.length === 0) return;

        //row 1 carries the labels in every tab seen so far. It is still passed
        //to cellKey below rather than skipped outright, so a tab that starts
        //straight into data does not lose its first object
        const cols = this.mapColumns(rows[0]);
        if (cols.usedFallback.length > 0) fallbackTabs++;

        for (const row of rows) {
          const key = this.cellKey(row[cols.index.number ?? 0]);
          //skips header rows, blanks and anything that is not a catalog number
          if (!key) {
            skipped++;
            continue;
          }
          const entry: CassettaMatch = { scaff: file.name, cass: tabs[i] };
          if (file.folder) entry.folder = file.folder;

          const link = this.cellAt(row, cols.index.link);
          const relocation = this.cellAt(row, cols.index.relocation);
          const note = this.cellAt(row, cols.index.relocationNote);
          const returnTo = this.cellAt(row, cols.index.returnTo);
          const notes = this.cellAt(row, cols.index.notes);
          const img = this.cellAt(row, cols.index.img);

          //only http links go in, so a stray value cannot become a javascript: href
          if (/^https?:\/\//i.test(link)) entry.link = link;
          if (relocation) entry.relocation = relocation;
          if (note) entry.relocationNote = note;
          if (returnTo) entry.returnTo = returnTo;
          if (notes) entry.notes = notes;
          //same check for the thumbnail, which ends up in an img src
          if (/^https?:\/\//i.test(img)) entry.img = img;

          (entries[key] ??= []).push(entry);
        }
      });
    }

    //a skipped count in the thousands would mean a sheet uses a format cellKey
    //does not recognise, rather than just header rows and blank cells
    this.logger.log(
      `index built: ${Object.keys(entries).length} objects, ${files.length} sheets, ` +
      `${skipped} cells skipped, ${fallbackTabs} tabs with an unlabelled column`,
    );
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