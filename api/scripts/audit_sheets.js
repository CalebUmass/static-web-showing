/*
Sheet audit, run before trusting the index.

Reports, for every spreadsheet and tab in the Drive folder:
  - the row 1 headers, grouped so any tab that differs stands out
  - column A cells that cassetta.service.ts would skip
  - tabs whose names do not look like a cassetta
  - catalog numbers listed in more than one place

Reads only; changes nothing. Costs two API calls per spreadsheet, the same as
one index build.

Run from the api directory so node finds node_modules:
    cd /var/www/html/api
    CASSETTA_SERVICE_ACCOUNT=/var/lib/dig-map-api/service_account.json \
    CASSETTA_FOLDER_ID=1PkOD8JFhzqVh3qlpiI-DAvzNjuNdanKj \
    node scripts/audit_sheets.js

Piping to a file is often easier to read:
    node scripts/audit_sheets.js > /tmp/audit.txt 2>&1
*/

const path = require('path');
const { drive } = require('@googleapis/drive');
const { sheets, auth: sheetsAuth } = require('@googleapis/sheets');

const KEY_FILE = process.env.CASSETTA_SERVICE_ACCOUNT || path.resolve(process.cwd(), 'service_account.json');
const FOLDER_ID = process.env.CASSETTA_FOLDER_ID;

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

//kept deliberately identical to cassetta.service.ts, so what this script
//reports as skipped is exactly what the index would drop. Both files need
//editing together when a new column label appears in the sheets
const NUMBER_PATTERN = /^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i;

const COLUMN_ALIASES = {
  number: ['object number', 'pc number', 'vdm number', 'catalog number'],
  link: ['open context link', 'open context', 'oc link'],
  relocation: ['in case of relocation - new location'],
  relocationNote: ['if "other" - new location'],
  returnTo: ['return to'],
  notes: ['notes', 'note', 'comments', 'comment'],
  img: ['image', 'image link', 'image url', 'thumbnail', 'thumbnail link',
        'thumbnail url', 'open context image', 'photo'],
};

const FALLBACK_INDEX = { number: 0, link: 1, relocation: 2, relocationNote: 3 };

function normalizeHeader(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[:\s]+$/, '');
}

function mapColumns(headerRow) {
  const norm = (headerRow || []).map(normalizeHeader);
  const index = {};
  const usedFallback = [];
  for (const field of Object.keys(COLUMN_ALIASES)) {
    const found = norm.findIndex((h) => h !== '' && COLUMN_ALIASES[field].includes(h));
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

function colLetter(i) {
  return String.fromCharCode(65 + i);
}

function cleanCell(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function cellKey(value) {
  const cleaned = cleanCell(value).replace(/[-_.,;/]+/g, ' ').replace(/\s+/g, ' ');
  const m = cleaned.match(NUMBER_PATTERN);
  if (!m) return null;
  const site = m[1] && m[1].toUpperCase() !== 'PC' ? 'VdM' : 'PC';
  return `${site} ${m[2]}${m[3]}`.toUpperCase().replace(/\s+/g, '');
}

async function main() {
  if (!FOLDER_ID) {
    console.error('set CASSETTA_FOLDER_ID');
    process.exit(1);
  }

  const gauth = new sheetsAuth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  const driveClient = drive({ version: 'v3', auth: gauth });
  const sheetsClient = sheets({ version: 'v4', auth: gauth });

  const q0 = `mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.folder'`;
  //breadth first walk matching cassetta.service.ts: subfolders are followed,
  //shortcuts are not, and each sheet remembers its folder path
  const files = [];
  const visited = new Set();
  const queue = [{ id: FOLDER_ID, label: '' }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const q = `'${current.id}' in parents and trashed=false and (${q0})`;
    let pageToken;
    do {
      const resp = await driveClient.files.list({
        q, fields: 'nextPageToken, files(id, name, mimeType)', pageSize: 1000, pageToken,
      });
      for (const f of resp.data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: f.id, label: current.label ? `${current.label} / ${f.name}` : f.name });
        } else {
          files.push({ id: f.id, name: f.name, folder: current.label });
        }
      }
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken);
  }

  console.log(`SPREADSHEETS FOUND: ${files.length}`);
  files.forEach((f) => console.log(`  - ${f.folder ? f.folder + ' / ' : '(root) '}${f.name}`));
  console.log('');

  const headerGroups = new Map(); //header signature -> [{file, tab}]
  const oddTabs = [];
  const skippedSamples = [];
  const seen = new Map(); //catalog key -> [locations]
  let totalRows = 0;
  let totalKeys = 0;
  let totalSkipped = 0;
  let withLink = 0;
  let withRelocation = 0;
  let withImg = 0;
  const fallbackTabs = [];   //blank label filled in by position
  const unresolved = [];     //logical column the tab has no home for
  const orphanCells = [];    //data sitting in a column nothing claims

  for (const file of files) {
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId: file.id, fields: 'sheets.properties.title',
    });
    const tabs = (meta.data.sheets || []).map((s) => s.properties.title);
    if (tabs.length === 0) continue;

    const ranges = tabs.map((t) => `'${t.replace(/'/g, "''")}'!A:E`);
    const batch = await sheetsClient.spreadsheets.values.batchGet({ spreadsheetId: file.id, ranges });

    (batch.data.valueRanges || []).forEach((vr, i) => {
      const tab = tabs[i];
      const rows = vr.values || [];

      if (!/cass/i.test(tab)) oddTabs.push(`${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`);

      //row 1 is the header; the signature is what gets compared across tabs
      const header = (rows[0] || []).slice(0, 8).map(cleanCell);
      const sig = JSON.stringify(header);
      if (!headerGroups.has(sig)) headerGroups.set(sig, []);
      headerGroups.get(sig).push(`${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`);

      const where = `${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`;
      const cols = mapColumns(rows[0]);
      const at = (row, field) => {
        const i = cols.index[field];
        return i === undefined || i >= row.length ? '' : cleanCell(row[i]);
      };

      if (cols.usedFallback.length > 0) {
        fallbackTabs.push({ where, fields: cols.usedFallback, header: header });
      }
      //the image column is name only, so an unlabelled one is worth reporting
      for (const field of ['link', 'relocation', 'relocationNote', 'img']) {
        if (cols.index[field] === undefined) unresolved.push({ where, field });
      }
      const claimed = new Set(Object.values(cols.index));

      rows.slice(1).forEach((row, idx) => {
        const raw = cleanCell(row[0]);
        if (raw === '') return; //genuinely blank, not worth reporting
        totalRows++;
        const key = cellKey(at(row, 'number') || row[0]);
        if (!key) {
          totalSkipped++;
          if (skippedSamples.length < 40) {
            skippedSamples.push(`${where} :: row ${idx + 2} :: "${raw}"`);
          }
          return;
        }
        totalKeys++;
        if (/^https?:\/\//i.test(at(row, 'link'))) withLink++;
        if (at(row, 'relocation') !== '') withRelocation++;
        if (/^https?:\/\//i.test(at(row, 'img'))) withImg++;

        //anything in a column no logical field claims is invisible to the index
        row.forEach((cell, i) => {
          if (i > 0 && !claimed.has(i) && cleanCell(cell) !== '') {
            orphanCells.push({ where, col: colLetter(i), value: cleanCell(cell).slice(0, 60) });
          }
        });

        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(where);
      });
    });
  }

  console.log('=== HEADER SIGNATURES (row 1, columns A-H) ===');
  const sorted = [...headerGroups.entries()].sort((a, b) => b[1].length - a[1].length);
  sorted.forEach(([sig, where], n) => {
    console.log(`\n[${n === 0 ? 'MOST COMMON' : 'DIFFERS'}] ${where.length} tab(s)`);
    console.log(`  ${sig}`);
    //the majority signature is presumably correct, so only the outliers are listed
    if (n > 0) where.forEach((w) => console.log(`    ${w}`));
  });

  console.log('\n=== TAB NAMES NOT MATCHING /cass/i ===');
  console.log(oddTabs.length === 0 ? '  none' : oddTabs.map((t) => `  ${t}`).join('\n'));

  console.log('\n=== NON BLANK COLUMN A CELLS THE INDEX WOULD SKIP ===');
  console.log(`  ${totalSkipped} total`);
  skippedSamples.forEach((s) => console.log(`  ${s}`));
  if (totalSkipped > skippedSamples.length) {
    console.log(`  ... and ${totalSkipped - skippedSamples.length} more`);
  }

  console.log('\n=== CATALOG NUMBERS IN MORE THAN ONE PLACE ===');
  const dupes = [...seen.entries()].filter(([, where]) => where.length > 1);
  console.log(`  ${dupes.length} duplicated`);
  dupes.slice(0, 30).forEach(([key, where]) => console.log(`  ${key}: ${where.join(' | ')}`));
  if (dupes.length > 30) console.log(`  ... and ${dupes.length - 30} more`);

  console.log('\n=== TABS WITH A BLANK COLUMN LABEL (read by position instead) ===');
  console.log(`  ${fallbackTabs.length} tab(s). Typing the missing label makes these exact.`);
  fallbackTabs.forEach((f) => {
    console.log(`  ${f.where}`);
    console.log(`      filled in by position: ${f.fields.join(', ')}`);
    console.log(`      header row: ${JSON.stringify(f.header)}`);
  });

  console.log('\n=== COLUMNS THE TAB HAS NO HOME FOR ===');
  const byField = {};
  unresolved.forEach((u) => { (byField[u.field] ||= []).push(u.where); });
  Object.keys(byField).forEach((field) => {
    console.log(`\n  ${field}: missing from ${byField[field].length} tab(s)`);
    //an absent image column is expected until the label is added everywhere
    byField[field].slice(0, 40).forEach((w) => console.log(`      ${w}`));
    if (byField[field].length > 40) console.log(`      ... and ${byField[field].length - 40} more`);
  });

  console.log('\n=== DATA IN COLUMNS NOTHING CLAIMS (invisible to the index) ===');
  const orphanByTab = {};
  orphanCells.forEach((o) => {
    const k = `${o.where} :: col ${o.col}`;
    (orphanByTab[k] ||= []).push(o.value);
  });
  const orphanKeys = Object.keys(orphanByTab).sort((a, b) => orphanByTab[b].length - orphanByTab[a].length);
  console.log(`  ${orphanKeys.length} tab/column pair(s), ${orphanCells.length} cells total`);
  orphanKeys.forEach((k) => {
    const vals = orphanByTab[k];
    console.log(`  ${k}  (${vals.length} cells) e.g. ${JSON.stringify(vals.slice(0, 2))}`);
  });

  console.log('\n=== TOTALS ===');
  console.log(`  rows with something in column A: ${totalRows}`);
  console.log(`  parsed as catalog numbers:       ${totalKeys}`);
  console.log(`  skipped:                         ${totalSkipped}`);
  console.log(`  distinct catalog numbers:        ${seen.size}`);
  console.log(`  with an Open Context link:       ${withLink}`);
  console.log(`  with a relocation recorded:      ${withRelocation}`);
  console.log(`  with a thumbnail url:            ${withImg}`);
}

main().catch((err) => {
  console.error('audit failed:', err.message);
  process.exit(1);
});