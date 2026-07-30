/*
Local development server for the Object Finder.

Serves the files in this folder and fakes the cassetta API, so the page can be
worked on with no credentials, no internet, and no connection to the live
server. Node only, no npm install needed.

    cd mag-search
    node mock-api.js

then open http://localhost:8000

The fake data below covers the cases that are awkward to find in the real
sheets: an object with a thumbnail, one without, one listed in two places, one
that is relocated, and one that does not exist at all. Catalog numbers to try
are printed at startup.

Not used in production and not deployed; delete nothing on the server if this
file is missing there.
*/

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;

//stands in for an Open Context thumbnail. Served by this file so the success
//path works offline; the real column E holds an https url instead
const SAMPLE_IMG = '/mock-thumb.svg';

//keys match what the real API produces: uppercase, no spaces
const FAKE_DATA = {
    //ordinary case: one location, has a thumbnail
    PC20170001: [
        {
            scaff: 'Scaff. 03 Internal Mag Inventory',
            cass: 'Cass. 55',
            folder: 'Catalog - Research Mag Scaffale',
            link: 'https://opencontext.org/subjects/example-1',
            img: SAMPLE_IMG,
        },
    ],
    //no image in column E, so the placeholder path runs
    PC19720072: [
        {
            scaff: 'Scaff. 02 Internal Mag Inventory',
            cass: 'Cass. 25',
            folder: 'Catalog - Research Mag Scaffale',
            link: 'https://opencontext.org/subjects/example-2',
        },
    ],
    //a Scaff. 00 fun box: sitting in the box now, belongs in Cass. 204. Also
    //carries a note, which the api returns but nothing displays yet
    PC19710056: [
        {
            scaff: 'Scaff. 00 Internal Mag Inventory',
            cass: 'Tonys Fun Box 25 (but not 26)',
            folder: 'Catalog - Research Mag Scaffale',
            link: 'https://opencontext.org/subjects/example-6',
            returnTo: 'Cass. 204',
            notes: 'Not found',
        },
    ],
    //listed in two places, so the ALSO FOUND divider appears. Only the second
    //carries an image, which is why the first match is not always the right
    //one to pull the thumbnail from
    PC19880101: [
        {
            scaff: 'Scaff. Museo',
            cass: 'Cass. Suspected in Museo',
        },
        {
            scaff: 'Scaff. 06 Internal Mag Inventory',
            cass: 'Cass. 181',
            folder: 'Catalog - Research Mag Scaffale',
            img: SAMPLE_IMG,
        },
    ],
    //relocation notice and a thumbnail together, to check they do not collide
    PC20090211: [
        {
            scaff: 'Scaff. 09 Internal Mag Inventory',
            cass: 'Cass. 281 / E2',
            folder: 'Conservation Mag Scaffale',
            relocation: 'Other',
            relocationNote: 'On loan to the conservation lab until August',
            link: 'https://opencontext.org/subjects/example-4',
            img: SAMPLE_IMG,
        },
    ],
    //broken url, to check the onerror fallback rather than the missing one
    PC19850003: [
        {
            scaff: 'Scaff. 10 Internal Mag Inventory',
            cass: 'Cass. 300',
            folder: 'Conservation Mag Scaffale',
            img: '/this-image-does-not-exist.jpg',
        },
    ],
};

const NUMBER_PATTERN = /^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i;

//same parsing the real service does, so a number typed loosely still matches
function parseNumber(raw, defaultSite) {
    const cleaned = String(raw).trim().replace(/[-_.,;/]+/g, ' ').replace(/\s+/g, ' ');
    const m = cleaned.match(NUMBER_PATTERN);
    if (!m) return null;
    let site = defaultSite === 'VdM' ? 'VdM' : 'PC';
    if (m[1]) site = m[1].toUpperCase() === 'PC' ? 'PC' : 'VdM';
    const display = `${site} ${m[2]}${m[3]}`;
    return { display, key: display.toUpperCase().replace(/\s+/g, '') };
}

const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.ico': 'image/x-icon', '.webp': 'image/webp',
};

function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        //no caching, so an edited file always shows up on refresh
        'Cache-Control': 'no-store',
    });
    res.end(text);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const route = url.pathname;

    //stand-in thumbnail, drawn here so no image file is needed
    if (route === SAMPLE_IMG) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
<rect width="400" height="300" fill="#d5d8cb"/>
<circle cx="200" cy="130" r="60" fill="#88a2a0"/>
<text x="200" y="240" font-family="serif" font-size="24" fill="#166b53" text-anchor="middle">sample object</text>
</svg>`;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return res.end(svg);
    }

    if (route === '/api/cassetta/status') {
        return sendJson(res, 200, {
            ready: true,
            refreshing: false,
            objects: Object.keys(FAKE_DATA).length,
            sheets: 3,
            builtAt: Date.now() - 3600000, //an hour old, so the line reads naturally
            ageHours: 1,
        });
    }

    if (route === '/api/cassetta/find') {
        const parsed = parseNumber(url.searchParams.get('number') || '', url.searchParams.get('site') || 'PC');
        if (!parsed) {
            return sendJson(res, 400, { message: 'number not recognized, expected forms like PC 19720072' });
        }
        const matches = FAKE_DATA[parsed.key] || [];
        return sendJson(res, 200, {
            number: parsed.display,
            found: matches.length > 0,
            matches,
            indexedAt: Date.now() - 3600000,
        });
    }

    if (route === '/api/cassetta/refresh') {
        return sendJson(res, 202, { started: true });
    }

    //everything else is a static file from this folder
    const rel = route === '/' ? 'index.html' : decodeURIComponent(route).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    //stops a request like /../../etc/passwd escaping the folder
    if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end('forbidden');
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end(`not found: ${rel}`);
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  Object Finder running at http://localhost:${PORT}\n`);
    console.log('  catalog numbers to try:');
    console.log('    PC 20170001   found, one location, has a thumbnail');
    console.log('    PC 19720072   found, no image, shows a placeholder');
    console.log('    PC 19880101   found in two places, only the second has an image');
    console.log('    PC 20090211   found, relocated, has a thumbnail');
    console.log('    PC 19850003   found, image url is broken, tests the fallback');
    console.log('    PC 19710056   found in a fun box, belongs in Cass. 204');
    console.log('    PC 99999999   not found');
    console.log('\n  ctrl-c to stop\n');
});