# Trench Book Viewer – README

---

## Overview

**Trench Book Viewer** is a web application built by Caleb Richards to support the digital preservation and exploration of archaeological trench books. It offers a way to browse scanned trench book pages and metadata in a clean, user-friendly interface.

**Key Features:**

* Backend endpoints for book and image metadata (part of the consolidated site API in `../api`)
* JavaScript frontend with gesture support and interactive navigation
* Mobile and desktop viewing compatibility
* Easy configuration and deployment

**Layout:** this folder now holds only the static frontend (`public/`) and the
`crawl.js` data tool. The NestJS backend that used to live in `src/` was merged
into the repo-wide API at `../api/src/trench-book/`, so one Node process serves
the whole site. Apache serves `public/` (including the scans in
`public/trench-books/`) directly and proxies `/api/*` to that process.

---

## Getting Started (local testing - to use on poggiocivitate.net see broad README.md)

### 1. Install and Start the Site API

```bash
cd ../api
npm install
npm run build
npm start
```

The API listens on `127.0.0.1:3001`. The trench book endpoints are
`POST /trench-book/load` and `GET /trench-book/list-images`; on the live site
Apache exposes them under `/api/`. The backend finds `public/OCdata.json` and
the scans relative to the repo; set `TRENCH_DATA_DIR` if they live elsewhere.

### 2. Serve the Frontend

`public/` is plain static files. For local testing serve the repo root with any
static server (so `/api` can be proxied or stubbed), or just deploy: on the
live server Apache already serves `reader/public/` and proxies `/api`.

### 3. Add Your Own Book Data

* Place your trench book images inside the appropriate folder in `public/`
* Update `OCdata.json` to include metadata for the new books/images
* Supported formats: JPG, or PNG, (testing was done all using standardized JPG)
* 
* You may also use crawl.js to crawl through 'Poggio Civitate' Trench Books on 'opencontext.org'
* To use, open full project in editor and naviaget to crawl.js, input <url>.json at bottom (should be example already). 
* Go to console and type node crawl.js and watch as it downloads imgs to correct folder, then at end update the .json wirh all correct information.

---

## Features

### Digital Trench Book Access

* Browse high-resolution scans of handwritten field notes
* Flip pages and zoom in on fine details

### Metadata Support

* Display structured data for each trench book
* Compatible with linked open data sources like OpenContext

### Mobile-Friendly(ish)

* Swipe gestures for mobile navigation
* Responsive layout for small screens

### Google Maps API usage

* Uses the Google maps API to plot each coordinate point tied to Trench Books
* Enables users to visually see where everything is located

### Filtering

* Filter books by trench, year, site, or Author

---

## Troubleshooting

### Common Issues:

* **Images or metadata not loading**

  * Confirm that image paths and `OCdata.json` entries match
  * The scans are fetched relative to the page (`trench-books/...`), so make
    sure the web server serves this `public/` folder

* **API not responding**

  * Ensure the site API (`../api`) is running on port 3001
  * Check that Apache's `ProxyPass /api/trench-book` rule points at it

---

## Deployment Tips

See `serverCreation.txt` at the repo root for the Apache + ProxyPass setup on
poggiocivitate.net. The short version: Apache serves this folder statically and
proxies `/api/*` to the consolidated Node API on `127.0.0.1:3001`.

---

## Contributing

Any pull requests, feedback, and feature requests are much appreciated and wanted!

### To contribute:

* Fork the repository
* Make your changes on a feature branch
* Submit a pull request with a clear description

---

## Special Thanks

I want to firstly thank professor Cole Reilly for supporting and helping me through this whole process, they have been such an
amazing mentor, and I have learning an incredible amount from them in such a short amount of time. I would also like to thank professor Anthony Tuck for helping generate much of the ideas for the features you now see in this e-book reader. His suggestions and feedback were fundumental in shaping the (soon)final product. I lastley would like to thank all the people in the Poggio Civitate program that inspired me to put in the time and effort to make this project actually happen. Thank you everyone!

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
You can check out the starting code for this at: https://github.com/CalebUmass/prototype1

---

##Agnol

**Enjoy exploring the trench books!**
