import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch'; // or use global fetch in newer Node versions
import { fileURLToPath } from 'url';

// Set the headers for the fetch requests
const HEADERS = {
  'User-Agent': 'oc-api-client',
  'Accept': 'application/json',
};

// Finds the label 
function labelFinder(label) {
  if (typeof label !== 'string' || !label.trim()) return null;
  let cleaned = label.replace(/[^a-zA-Z0-9 :,-]+/g, '');
  cleaned = cleaned.replace(/,?\s*insert\s*\d*$/i, '');
  cleaned = cleaned.replace(/:\d+(-\d+)?$/, '');
  cleaned = cleaned.trim();
  return cleaned || null;
}

// Finds the author from the label
function authorFinder(label) {
  if (!label) return null;
  const cleaned = label.replace(/[^a-zA-Z ]+/g, '').trim();
  const match = cleaned.match(/Trench Book\s+([A-Z]+)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/);
  return match ? match[1] : null;
}

// Finds the year from the linked contexts
function yearFinder(obj) {
  const ctxs = obj['oc-gen:has-linked-contexts'] || [];
  if (ctxs.length > 5) {
    const raw = ctxs[5].slug || '';
    const match = raw.match(/\d{2}-(\d{4})-/);
    return match ? match[1] : null;
  }
  return null;
}

// Finds the first JPG file from the object
function jpgFinder(obj) {
  const files = obj['oc-gen:has-files'] || [];
  return files.length > 0 ? files[0].id : null;
}

// Finds the trench name from the linked contexts
function trenchFinder(obj) {
  return obj?.["oc-gen:has-linked-contexts"]?.[4]?.label || null;
}

// Finds the coordinates from the features
function coordinatesFinder(obj) {
  const features = obj.features || [];
  return features.length > 0 ? features[0].geometry.coordinates : null;
}

// Downloads the JPG file and saves it to the specified directory
async function jpgDownloader(obj, count, baseDir) {
  const jpgUrl = jpgFinder(obj);
  const label = labelFinder(obj.label);
  if (!jpgUrl || !label) return;

  const safeLabel = label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const folderPath = path.join(baseDir, 'public', 'trench-books', safeLabel);
  const filename = String(count).padStart(3, '0') + '.jpg';
  const filePath = path.join(folderPath, filename);

  // Ensure the directory exists
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

// Generates JSON data for the trench book
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

  // Initialize results for this label IF NOT ALREADY PRESENT
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

// Downloads trench books starting from the given URL
async function downloadTrenchBooks(startUrl, baseDir = '.') {
  let url = startUrl;
  let count = 0;
  const results = {};
  const visitedUrls = new Set();
  const outputFilename = path.join(baseDir, 'public', 'OCdata.json');

  // Make sure the URL hasn't been visited before
  while (url) {
    if (visitedUrls.has(url)) {
      console.log(`🔁 Already visited ${url}, stopping to avoid infinite loop.`);
      break;
    }
    visitedUrls.add(url);

    console.log(count);
    count++;

    // Fetch the JSON data from the URL
    // Ensure the URL exists
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const obj = await response.json();

      await jpgDownloader(obj, count, baseDir);
      generateJsonData(obj, count, results);

      let nextPageUrl = null;
      const obsList = obj['oc-gen:has-obs'] || [];
      const nexts = obsList.flatMap(obs => obs['oc-pred:1-next'] || []);

      // Find the next unvisited page URL
      for (const nextItem of nexts) {
        let candidate = nextItem.id;
        if (candidate && !candidate.endsWith('.json')) candidate += '.json';
        if (candidate !== url && !visitedUrls.has(candidate)) {
          nextPageUrl = candidate;
          console.log('Next page:', nextPageUrl);
          break;
        }
      }

      // If no next page found, stop the loop
      if (!nextPageUrl) {
        console.log('🛑 No next unvisited page. Stopping.');
        break;
      }
      url = nextPageUrl;

      // Catch any errors during the fetch or processing
    } catch (e) {
      console.log('Error fetching page:', e.message);
      break;
    }
  }

  // Save JSON to file
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

// Example usage
// To add more URLs, add them to the `urls` array
  const urls = ['https://opencontext.org/media/4d3513f1-4102-41ba-4acf-354c37c6be28.json'];
  for (const url of urls) {
    await downloadTrenchBooks(url);
    console.log(`Downloaded: ${url}`);
  }


/* === Variable Reference ===

HEADERS        - HTTP headers used in all fetch requests

label          - Cleaned and simplified version of the original label
cleaned        - Cleaned version of label text
match          - Match result from operations

ctxs           - Linked contexts array from OpenContext data
raw            - Raw slug string to extract year
files          - Files array from OpenContext data
features       - GeoJSON features array from object
jpgUrl         - URL of the first JPG image in an object
safeLabel      - URL/filename-safe version of a label

folderPath     - Directory path where JPG files are saved
filename       - JPG file name based on count (e.g., '001.jpg')
filePath       - Full path to the saved JPG image

author         - Extracted author name from label
date           - Extracted excavation year from object
coords         - Coordinates extracted from geometry
trenchName     - Name of the trench from linked context

startUrl       - Starting URL for the recursive download loop
baseDir        - Base directory where images and JSON data are saved
url            - Current page's URL being processed
count          - Counter for downloaded images (used in filenames)
results        - Object storing metadata and image paths for each trench book
visitedUrls    - Set to track and avoid re-visiting URLs
outputFilename - Final path to write the OCdata.json file

response       - Fetch response object
obj            - Parsed JSON object from response

obsList        - List of observation objects in OpenContext format
nexts          - Array of next page references from observations
candidate      - URL candidate for the next page
nextPageUrl    - Selected unvisited URL for next page

fileContents   - Contents of existing OCdata.json file
existingData   - Parsed existing data from OCdata.json

urls           - Array of initial trench book URLs to fetch
*/