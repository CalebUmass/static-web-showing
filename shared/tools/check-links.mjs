/*
  check-links.mjs - renders each gallery in a fake DOM and resolves every image
  URL it would actually request against the filesystem.

  This exists because of a bug that shipped: `src` was written with the media/
  prefix and `srcset` without it. When both attributes are present the browser
  uses srcset and ignores src, so all 26 drawings requested a path that did not
  exist, while a test asserting only that srcset was non-empty passed happily.

  Checking that an attribute exists is not the same as checking it points at a
  file. This checks the file.

  Optional dev tool, not needed to run or deploy either gallery.

    npm install jsdom
    node shared/tools/check-links.mjs
*/

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  Walk up from this file until the folder holding both galleries turns up.
  The tools live in shared/tools/, but counting directory levels breaks the
  next time anything moves. Looking for the two gallery folders does not.
*/
function findRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    const hasBoth = ['2d-gallery', '3d-gallery'].every((name) =>
      fs.existsSync(path.join(dir, name))
    );
    if (hasBoth) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(
    'Could not find the repo root. Expected a folder containing both ' +
      '2d-gallery/ and 3d-gallery/ somewhere above this script.'
  );
}

const ROOT = findRoot(path.dirname(fileURLToPath(import.meta.url)));

const GALLERIES = [
  {
    name: '2d-gallery',
    scripts: [
      '2d-gallery/data/artworks.js',
      'shared/site-header.js',
      'shared/facets.js',
      '2d-gallery/gallery.js',
    ],
  },
  {
    name: '3d-gallery',
    scripts: [
      '3d-gallery/data/models.js',
      'shared/site-header.js',
      'shared/facets.js',
      '3d-gallery/models.js',
    ],
  },
];

/*Pull every URL a browser would fetch: src, each srcset candidate, and any
  download link. Remote URLs are reported but not resolved.*/
function collectUrls(document) {
  const urls = new Set();

  for (const image of document.querySelectorAll('img')) {
    const src = image.getAttribute('src');
    if (src) urls.add(src);
    for (const candidate of (image.getAttribute('srcset') || '').split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) urls.add(url);
    }
  }
  for (const link of document.querySelectorAll('a[download], a[href$=".jpg"], a[href$=".png"]')) {
    const href = link.getAttribute('href');
    if (href) urls.add(href);
  }
  for (const sheet of document.querySelectorAll('link[rel="stylesheet"]')) {
    urls.add(sheet.getAttribute('href'));
  }
  for (const script of document.querySelectorAll('script[src]')) {
    urls.add(script.getAttribute('src'));
  }

  return [...urls].filter(Boolean);
}

let failures = 0;

for (const gallery of GALLERIES) {
  const dir = path.join(ROOT, gallery.name);
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: `http://localhost/${gallery.name}/`,
  });

  /*no network in this harness, so thumbnail fetches fail into their fallback*/
  dom.window.fetch = () => Promise.reject(new Error('offline'));

  for (const script of gallery.scripts) {
    dom.window.eval(fs.readFileSync(path.join(ROOT, script), 'utf8'));
  }

  const urls = collectUrls(dom.window.document);
  const missing = [];
  let remote = 0;
  let resolved = 0;

  for (const url of urls) {
    if (/^(https?:)?\/\//.test(url) || url.startsWith('#') || url.startsWith('data:')) {
      remote += 1;
      continue;
    }
    if (fs.existsSync(path.join(dir, url))) resolved += 1;
    else missing.push(url);
  }

  console.log(
    `${gallery.name}: ${resolved} resolved, ${remote} remote, ${missing.length} missing`
  );
  for (const url of missing) console.log(`  missing: ${url}`);
  failures += missing.length;
}

/*The viewer swaps images in from JavaScript rather than from markup, so those
  paths never appear in the DOM at load. Resolve them straight off the data.*/
const dataSource = fs.readFileSync(
  path.join(ROOT, '2d-gallery/data/artworks.js'),
  'utf8'
);
const context = {};
new Function('window', dataSource)(context);

let viewerMissing = 0;
for (const item of context.GALLERY_DATA.items) {
  for (const relative of [item.derived?.view, item.file]) {
    if (!relative) continue;
    if (!fs.existsSync(path.join(ROOT, '2d-gallery/media', relative))) {
      console.log(`  missing: viewer path media/${relative}`);
      viewerMissing += 1;
    }
  }
}
console.log(
  `2d-gallery viewer paths: ${context.GALLERY_DATA.items.length * 2 - viewerMissing} resolved, ${viewerMissing} missing`
);

process.exit(failures + viewerMissing > 0 ? 1 : 0);
