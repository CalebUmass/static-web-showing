import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch'; // or use global fetch in newer Node versions
import { fileURLToPath } from 'url';

const HEADERS = {
  'User-Agent': 'oc-api-client',
  'Accept': 'application/json',
};

function labelFinder(label) {
  if (typeof label !== 'string' || !label.trim()) return null;
  let cleaned = label.replace(/[^a-zA-Z0-9 :,-]+/g, '');
  cleaned = cleaned.replace(/,?\s*insert\s*\d*$/i, '');
  cleaned = cleaned.replace(/:\d+(-\d+)?$/, '');
  cleaned = cleaned.trim();
  return cleaned || null;
}

function authorFinder(label) {
  if (!label) return null;
  const cleaned = label.replace(/[^a-zA-Z ]+/g, '').trim();
  const match = cleaned.match(/Trench Book\s+([A-Z]+)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);
  return match ? match[1] : null;
}

function yearFinder(obj) {
  const ctxs = obj['oc-gen:has-linked-contexts'] || [];
  if (ctxs.length > 5) {
    const raw = ctxs[5].slug || '';
    const match = raw.match(/\d{2}-(\d{4})-/);
    return match ? match[1] : null;
  }
  return null;
}

function jpgFinder(obj) {
  const files = obj['oc-gen:has-files'] || [];
  return files.length > 0 ? files[0].id : null;
}

function trenchFinder(obj) {
  return obj?.["oc-gen:has-linked-contexts"]?.[4]?.label || null;
}

function coordinatesFinder(obj) {
  const features = obj.features || [];
  return features.length > 0 ? features[0].geometry.coordinates : null;
}

async function jpgDownloader(obj, count, baseDir) {
  const jpgUrl = jpgFinder(obj);
  const label = labelFinder(obj.label);
  if (!jpgUrl || !label) return;

  const safeLabel = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const folderPath = path.join(baseDir, 'public', 'trench-books', safeLabel);
  const filename = String(count).padStart(3, '0') + '.jpg';
  const filePath = path.join(folderPath, filename);

  try {
    await fs.mkdir(folderPath, { recursive: true });
    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('⏭ Skipped (already downloaded)');
      return;
    } catch {
      // file doesn't exist, continue to download
    }

    const response = await fetch(jpgUrl, { headers: HEADERS });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const buffer = await response.buffer();
    await fs.writeFile(filePath, buffer);
    console.log(`✅ Downloaded: ${filePath}`);
  } catch (e) {
    console.log(`❌ Failed to download ${jpgUrl}: ${e.message}`);
  }
}

function generateJsonData(obj, count, results) {
  const label = labelFinder(obj.label);
  if (!label) return;

  const author = authorFinder(obj.label);
  const date = yearFinder(obj);
  const coords = coordinatesFinder(obj);
  const trenchName = trenchFinder(obj);

  const safeLabel = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const folderPath = `trench-books/${safeLabel}`;
  const filename = String(count).padStart(3, '0') + '.jpg';
  const filePath = `${folderPath}/${filename}`;

  if (!results[safeLabel]) {
    results[safeLabel] = {
      author,
      date,
      coordinates: [coords[1], coords[0]],
      trenchName: trenchName,
      "trench-book-images": {
        location: folderPath,
        contents: []
      }
    };
  }
  results[safeLabel]["trench-book-images"].contents.push(filePath);
}

async function downloadTrenchBooks(startUrl, baseDir = '.') {
  let url = startUrl;
  let count = 0;
  const results = {};
  const visitedUrls = new Set();
  const outputFilename = path.join(baseDir, 'public', 'OCdata.json');

  while (url) {
    if (visitedUrls.has(url)) {
      console.log(`🔁 Already visited ${url}, stopping to avoid infinite loop.`);
      break;
    }
    visitedUrls.add(url);

    console.log(count);
    count++;

    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const obj = await response.json();

      await jpgDownloader(obj, count, baseDir);
      generateJsonData(obj, count, results);

      let nextPageUrl = null;
      const obsList = obj['oc-gen:has-obs'] || [];
      const nexts = obsList.flatMap(obs => obs['oc-pred:1-next'] || []);

      for (const nextItem of nexts) {
        let candidate = nextItem.id;
        if (candidate && !candidate.endsWith('.json')) candidate += '.json';
        if (candidate !== url && !visitedUrls.has(candidate)) {
          nextPageUrl = candidate;
          console.log('Next page:', nextPageUrl);
          break;
        }
      }

      if (!nextPageUrl) {
        console.log('🛑 No next unvisited page. Stopping.');
        break;
      }
      url = nextPageUrl;
    } catch (e) {
      console.log('Error fetching page:', e.message);
      break;
    }
  }

  // Save JSON
  try {
    let existingData = {};
    try {
      const fileContents = await fs.readFile(outputFilename, 'utf-8');
      existingData = JSON.parse(fileContents);
      console.log(`${outputFilename} already exists. Updating contents...`);
    } catch {
      console.log(`${outputFilename} does not exist. Creating new file...`);
    }

    Object.assign(existingData, results);
    await fs.writeFile(outputFilename, JSON.stringify(existingData, null, 2));
    console.log(`📄 Dictionary successfully written to ${outputFilename}`);
  } catch (e) {
    console.log('Failed to write JSON:', e.message);
  }
}

  const urls = ['https://opencontext.org/media/4d3513f1-4102-41ba-4acf-354c37c6be28.json'];
  for (const url of urls) {
    await downloadTrenchBooks(url);
    console.log(`Downloaded: ${url}`);
  }