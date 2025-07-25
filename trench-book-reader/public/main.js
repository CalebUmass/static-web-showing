// Will need to change this as I move to differant networks

// const apiBase = 'http://192.168.0.133:3000'; // Mag IP
// const apiBase = 'http://172.20.10.11:3000'; // Hotspot IP
// const apiBase = 'http://192.168.1.153:3000'; // Hotel IP
// const apiBase = 'http://192.168.178.107:3000'; // Hotel2 IP
// const apiBase = 'https://sweet-cobras-sit.loca.lt'; // Ngrok URL
// const apiBase = 'https://192.168.0.54:3000'; // Portable IP
// const apiBase = 'http://3.65.1.225:3000'; // ← my aws server
const apiBase = 'http://44.213.207.207:3000'; // ← poggio-civitate-project aws server


const select = document.getElementById('trenchBookSelect');
const imagesContainer = document.getElementById('imagesContainer');
const currentImage = document.getElementById('currentImage');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
// Add reference to the slider (will be added to HTML)
const pageSlider = document.getElementById('pageSlider');

let images = [];
let currentIndex = 0;
let isLoadingImage = false;

// utility function to round coordinates to 5 decimal places
function roundTo5(num) {
  return Math.round(num * 100000) / 100000;
}

// Initialize cache for images
const cache = new Map();

// Function to load and cache images
function setCache(url, objectURL) {
  cache.set(url, objectURL);
}

// Function to clear the image cache
function clearImageCache() {
  for (const [url, objectURL] of cache.entries()) {
    URL.revokeObjectURL(objectURL); // Free browser memory
  }
  cache.clear();
  console.log('🧹 Image cache cleared');
}

loadAndCacheImage("/images/imageNotFound.jpg");

async function loadAndCacheImage(url) {
  if (cache.has(url)) return cache.get(url);

  try {
    const res = await fetch(url);
    if (!res.ok)
      return cache.get("/images/imageNotFound.jpg"); // Fallback to default image if fetch fails

    const blob = await res.blob();
    const objectURL = URL.createObjectURL(blob);
    setCache(url, objectURL);
    return objectURL;
  } catch (err) {
    return cache.get("/images/imageNotFound.jpg");
  }
}

// Preload next images to improve performance when navigating forward
// This function preloads a specified number of images after the current one
function preloadNextImages(count = 10) {
  for (let i = 1; i <= count; i++) {
    const idx = (currentIndex + i) % images.length;
    const file = images[idx];
    const url = `${apiBase}/trench-books/${select.value}/${file}`;
    if (!cache.has(url)) loadAndCacheImage(url);
  }
}

// Preload previous images to improve performance when navigating back
// This function preloads a specified number of images before the current one
function preloadPreviousImages(count = 5) {
  for (let i = 1; i <= count; i++) {
    const idx = (currentIndex - i + images.length) % images.length;
    const file = images[idx];
    const url = `${apiBase}/trench-books/${select.value}/${file}`;
    if (!cache.has(url)) loadAndCacheImage(url);
  }
}

// Function to show an image based on the current index
// Updates the image source and alt text, and handles slider position and page counter
async function showImage(index) {
  if (isLoadingImage) return; // ⛔ prevent re-entry
  isLoadingImage = true;
  let pathToImage = '/images/imageNotFound.jpg'; // Default image path
  let filename = 'imageNotFound.jpg'; // Default filename


  if (images !== null) {
    if (index < 0) currentIndex = images.length - 1;
    else if (index >= images.length) currentIndex = 0;
    else currentIndex = index;
    const selected = select.value;
    filename = images[currentIndex];

    pathToImage = `${apiBase}/trench-books/${selected}/${filename}`;
  }

  // call the function to load and cache the image
  const cachedURL = await loadAndCacheImage(pathToImage);
  currentImage.src = cachedURL;
  currentImage.alt = filename;

  // Update slider position
  if (images.length > 0 && pageSlider) {
    pageSlider.value = currentIndex + 1;
  }

  // Update page counter text
  const pageCounter = document.getElementById('pageCounter');
  if (pageCounter) {
    pageCounter.textContent = `Page ${currentIndex + 1} of ${images.length}`;
  }

  // Preload next and previous images
  preloadNextImages(10);
  preloadPreviousImages(5);
  
  isLoadingImage = false; // ✅ unlock
}

prevBtn.addEventListener('click', () => {
  showImage(currentIndex - 1);
});

nextBtn.addEventListener('click', () => {
  showImage(currentIndex + 1);
});

select.addEventListener('change', async (e) => {
  const selected = e.target.value;
  clearImageCache(); // ← Clear the previous book's images from memory
  images = [];
  currentIndex = 0;
  // Show default image when no book is selected
  currentImage.src = 'images/default.jpg';
  currentImage.alt = 'No book selected';
  imagesContainer.innerHTML = '';
  if (pageSlider) {
    pageSlider.disabled = true;
    pageSlider.value = 1;
    pageSlider.max = 1;
  }

  if (!selected) return;

  try {
    // Load the selected book
    const loadRes = await fetch(`${apiBase}/trench-book/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookLabel: selected }),
    });

    if (!loadRes.ok) throw new Error('Failed to load book');
    await loadRes.text();

    // Fetch list of images
    const listRes = await fetch(
      `${apiBase}/trench-book/list-images?bookLabel=${encodeURIComponent(selected)}`
    );
    images = await listRes.json();

    if (images.length === 0) {
      imagesContainer.textContent = 'No images found for this book.';
      currentImage.src = '';
      if (pageSlider) {
        pageSlider.disabled = true;
        pageSlider.value = 1;
        pageSlider.max = 1;
      }
      return;
    }

    // Enable and set up the slider
    if (pageSlider) {
      pageSlider.max = images.length;
      pageSlider.value = 1;
      pageSlider.disabled = false;
      // Remove previous event listener if any
      pageSlider.oninput = null;
      // Attach event listener for slider navigation
      pageSlider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10) - 1;
        showImage(idx);
      });
    }
    // Show first image
    showImage(0);
  } catch (error) {
    if (pageSlider) {
      pageSlider.disabled = true;
      pageSlider.value = 1;
      pageSlider.max = 1;
    }
  }


  fetch('OCdata.json')
    .then(response => response.json())
    .then(data => {
      const selectedLabel = select.value;
      const selectedBook = data[selectedLabel];

      if (selectedBook) {
        infoTitle.textContent = selectedBook.trenchName || '-';
        infoAuthor.textContent = selectedBook.author || '-';
        infoDate.textContent = selectedBook.date || '-';
        infoCoords.textContent = selectedBook.coordinates
          ? selectedBook.coordinates.map(roundTo5).join(', ')
          : '-';

        // Plot map if coordinates are available
        if (selectedBook.coordinates) {
          plotMap(selectedBook.coordinates);
        } else {
          document.getElementById('map').innerHTML = '';
        }
      } else {
        infoTitle.textContent = '-';
        infoAuthor.textContent = '-';
        infoDate.textContent = '-';
        infoCoords.textContent = '-';
        document.getElementById('map').innerHTML = '';
      }
    })
    .catch(error => {
      infoTitle.textContent = '-';
      infoAuthor.textContent = '-';
      infoDate.textContent = '-';
      infoCoords.textContent = '-';
      console.error('Error loading JSON:', error);
    });
});


// --- Fullscreen support ---
// Add fullscreen functionality to the image viewer
document.addEventListener('DOMContentLoaded', () => {
  const imageViewer = document.getElementById('imageViewer');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      imageViewer.requestFullscreen().catch(err => {
        console.error(`Error attempting to enter fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
});

// --- Google Maps integration ---
// Function to plot the trench location on a Google Map

function plotMap(coords) {
  if (!coords || coords.length !== 2) return;
  const mapDiv = document.getElementById('map');
  const latLng = { lat: coords[0], lng: coords[1] };
  if (!mapDiv) return; // Ensure mapDiv exists
  const map = new google.maps.Map(mapDiv, {
    center: latLng,
    zoom: 12,
    mapTypeId: 'terrain',
    controlSize: 27
  });
  new google.maps.Marker({
    position: latLng,
    map: map,
    title: 'Trench Location'
  });
}


// --- Book info display ---
// Populate trench info table based on selected book
const infoTitle = document.getElementById('infoTitle');
const infoAuthor = document.getElementById('infoAuthor');
const infoDate = document.getElementById('infoDate');
const infoCoords = document.getElementById('infoCoords');


// --- Swipe support ---
let touchStartX = 0;
let touchEndX = 0;

currentImage.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

currentImage.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleGesture();
});

function handleGesture() {
  if (touchEndX < touchStartX - 30) {
    // Swipe left → next image
    showImage(currentIndex + 1);
  }
  if (touchEndX > touchStartX + 30) {
    // Swipe right → previous image
    showImage(currentIndex - 1);
  }
}

// Fetch all books from OCdata.json
let allBooks = {};
fetch('OCdata.json')
  .then(res => res.json())
  .then(data => {
    allBooks = data;
    renderFilteredBooks();
  });


// Function to render filtered books based on user input
function renderFilteredBooks() {
  const author = document.getElementById('authorFilter').value.toLowerCase();
  const date = document.getElementById('dateFilter').value.toLowerCase();
  const trenchName = document.getElementById('trenchNameFilter').value.toLowerCase();
  const filteredBooksDiv = document.getElementById('filteredBooks');
  filteredBooksDiv.innerHTML = '';

  Object.entries(allBooks).forEach(([label, book]) => {
    if (
      (!author || (book.author && book.author.toLowerCase().includes(author))) &&
      (!date || (book.date && book.date.toLowerCase().includes(date))) &&
      (!trenchName || (book.trenchName && book.trenchName.toLowerCase().includes(trenchName)))
    ) {
      const div = document.createElement('div');
      div.className = 'filtered-book';
      div.style = 'padding:8px;margin-bottom:8px;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);cursor:pointer;';
      div.innerHTML = `<strong>${label}</strong><br>
        Author: ${book.author}<br>
        Date: ${book.date}<br>
        Trench Name: ${book.trenchName}`;
      div.onclick = () => {
        document.getElementById('trenchBookSelect').value = label;
        document.getElementById('trenchBookSelect').dispatchEvent(new Event('change'));
      };
      filteredBooksDiv.appendChild(div);
    }
  });
}

// Add event listeners for filters
['authorFilter', 'dateFilter', 'trenchNameFilter'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderFilteredBooks);
});
document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('authorFilter').value = '';
  document.getElementById('dateFilter').value = '';
  document.getElementById('trenchNameFilter').value = '';
  renderFilteredBooks();
});
