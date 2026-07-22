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
    CASSETTA_FOLDER_ID=1CWjwIGOu3AJHeweNKe-yZZYwDDeIKfuf \
    node scripts/audit-sheets.js

Piping to a file is often easier to read:
    node scripts/audit-sheets.js > /tmp/audit.txt 2>&1
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
//reports as skipped is exactly what the index would drop
const NUMBER_PATTERN = /^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i;

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

  for (const file of files) {
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId: file.id, fields: 'sheets.properties.title',
    });
    const tabs = (meta.data.sheets || []).map((s) => s.properties.title);
    if (tabs.length === 0) continue;

    const ranges = tabs.map((t) => `'${t.replace(/'/g, "''")}'!A:D`);
    const batch = await sheetsClient.spreadsheets.values.batchGet({ spreadsheetId: file.id, ranges });

    (batch.data.valueRanges || []).forEach((vr, i) => {
      const tab = tabs[i];
      const rows = vr.values || [];

      if (!/cass/i.test(tab)) oddTabs.push(`${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`);

      //row 1 is the header; the signature is what gets compared across tabs
      const header = (rows[0] || []).slice(0, 4).map(cleanCell);
      const sig = JSON.stringify(header);
      if (!headerGroups.has(sig)) headerGroups.set(sig, []);
      headerGroups.get(sig).push(`${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`);

      rows.slice(1).forEach((row, idx) => {
        const raw = cleanCell(row[0]);
        if (raw === '') return; //genuinely blank, not worth reporting
        totalRows++;
        const key = cellKey(row[0]);
        if (!key) {
          totalSkipped++;
          if (skippedSamples.length < 40) {
            skippedSamples.push(`${file.name} :: ${tab} :: row ${idx + 2} :: "${raw}"`);
          }
          return;
        }
        totalKeys++;
        if (/^https?:\/\//i.test(cleanCell(row[1]))) withLink++;
        if (cleanCell(row[2]) !== '') withRelocation++;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(`${file.folder ? file.folder + " / " : ""}${file.name} :: ${tab}`);
      });
    });
  }

  console.log('=== HEADER SIGNATURES (row 1, columns A-D) ===');
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

  console.log('\n=== TOTALS ===');
  console.log(`  rows with something in column A: ${totalRows}`);
  console.log(`  parsed as catalog numbers:       ${totalKeys}`);
  console.log(`  skipped:                         ${totalSkipped}`);
  console.log(`  distinct catalog numbers:        ${seen.size}`);
  console.log(`  with an Open Context link:       ${withLink}`);
  console.log(`  with a relocation recorded:      ${withRelocation}`);
}

main().catch((err) => {
  console.error('audit failed:', err.message);
  process.exit(1);
});