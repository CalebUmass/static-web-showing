# Trench Book Viewer – README

---

## Overview

**Trench Book Viewer** is a full-stack web application built using **NestJS** to support the digital preservation and exploration of archaeological trench books. It offers a streamlined way to browse scanned trench book pages and metadata in a clean, user-friendly interface.

**Key Features:**

* 📚 A NestJS backend for serving book and image metadata
* ⚙️ Modern JavaScript frontend with gesture support and interactive navigation
* 📱 Mobile and desktop viewing compatibility
* 🚀 Easy configuration and deployment

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
# Production
npm run start

# Development (hot reload)
npm run start:dev
```

By default, the server runs on: `http://localhost:3000`

### 3. Set API Endpoint in Frontend

In your `main.js` frontend file:

```js
const API_URL = 'http://<YOUR_IP_ADDRESS>:3000';
```

Replace `<YOUR_IP_ADDRESS>` accordingly.

### 4. Open in Your Browser

Visit:

```text
http://<YOUR_IP_ADDRESS>:3000
```

Replace `<YOUR_IP_ADDRESS>` with your machine’s IP (e.g., `192.168.1.42`).

The frontend is served from the `public/` directory.

### 5. Add Your Own Book Data

* Place your trench book images inside the appropriate folder in `public/`
* Update `OCdata.json` to include metadata for the new books/images
* Supported formats: JPG, PNG, or TIFF (standardized sizes recommended)
* 
* You may also use crawl.js to crawl through 'Poggio Civitate' Trench Books on 'opencontext.org'
* To use, open full project in editor and naviaget to crawl.js, input <url>.json at bottom (should be example already). 
* Go to console and type node crawl.js and watch as it downloads imgs to correct folder, then at end update the .json wirh all correct information.

---

## Features

### 📖 Digital Trench Book Access

* Browse high-resolution scans of handwritten field notes
* Flip pages and zoom in on fine details

### 🧠 Metadata Support

* Display structured data for each trench book
* Compatible with linked open data sources like OpenContext

### 📱 Mobile-Friendly

* Swipe gestures for mobile navigation
* Responsive layout for small screens

### 🗺️ Google Maps API usage

* Uses the Google maps API to plot each coordinate point tied to Trench Books
* Enables users to visually see where everything is located

### 🔍 Powerful Filtering

* Filter books by trench, year, site, or Author

---

## Troubleshooting

### Common Issues:

* **Images or metadata not loading**

  * Check your IP address in `main.js`
  * Confirm that image paths and `OCdata.json` entries match

* **API not responding**

  * Ensure backend is running on the correct port
  * Make sure no firewall is blocking local access

---

## Testing

Run tests for the backend API:

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## Deployment Tips

To deploy on a live server or classroom network:

1. Change the IP and port to match your public host
2. Serve via Nginx or Apache (recommended for static file caching)
3. Consider Dockerizing the application for consistency

---

## Contributing

We welcome pull requests, feedback, and feature requests!

### To contribute:

* Fork the repository
* Make your changes on a feature branch
* Submit a pull request with a clear description

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

**Enjoy exploring the trench books!**

🗺️🏛️📚
