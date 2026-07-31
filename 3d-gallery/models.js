/*
  models.js - renders the 3D viewer from data/models.js.

  The one thing worth knowing about this file: a Sketchfab embed is a live
  WebGL scene, and the old page started ten of them at once. Here each card is
  a still image until someone picks it. Thumbnails come from Sketchfab's
  oEmbed endpoint, one small JSON request per model, cached in localStorage so
  later visits do not repeat it. If that request fails, or the browser is
  offline, the card falls back to a plain plate and still works.
*/
(function () {
  var data = window.MODEL_DATA;
  if (!data) {
    document.getElementById('models').textContent = 'data/models.js did not load.';
    return;
  }

  var items = data.items || [];
  var grid = document.getElementById('models');
  var register = document.getElementById('register');
  var emptyMessage = document.getElementById('empty');
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var railElement = document.getElementById('filter-rail');
  var scrim = document.querySelector('.rail-scrim');
  var activeBadge = document.querySelector('[data-active-count]');

  var THUMB_CACHE_KEY = 'pc-sketchfab-thumbs';
  var CACHE_TTL_DAYS = 30;

  var CARD_FACETS = data.facets
    .filter(function (facet) {
      return facet.type !== 'year';
    })
    .map(function (facet) {
      return facet.key;
    });

  var byId = new Map();
  items.forEach(function (item) {
    byId.set(item.id, item);
  });

  var visibleItems = [];
  var loadedEmbeds = new Set();

  SiteHeader.mount({
    mount: '#site-header',
    section: '3D models',
    home: '../projects/all/',
    sibling: { label: 'Drawing archive', href: '../2d-gallery/' },
    help: '#help-modal',
  });

  /* --- thumbnail cache --------------------------------------------------- */

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(THUMB_CACHE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function writeCache(cache) {
    try {
      localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      /*a full or disabled localStorage just means fetching again next time*/
    }
  }

  var thumbCache = readCache();

  function cachedThumb(uid) {
    var entry = thumbCache[uid];
    if (!entry) return null;
    var ageDays = (Date.now() - entry.at) / 86400000;
    return ageDays < CACHE_TTL_DAYS ? entry.url : null;
  }

  function fetchThumb(item, plate) {
    var modelUrl = 'https://sketchfab.com/3d-models/' + item.uid;
    var endpoint =
      'https://sketchfab.com/oembed?format=json&maxwidth=640&url=' +
      encodeURIComponent(modelUrl);

    fetch(endpoint)
      .then(function (response) {
        return response.ok ? response.json() : Promise.reject();
      })
      .then(function (payload) {
        if (!payload.thumbnail_url) return Promise.reject();
        thumbCache[item.uid] = { url: payload.thumbnail_url, at: Date.now() };
        writeCache(thumbCache);
        paintThumb(plate, payload.thumbnail_url, item.title);
      })
      .catch(function () {
        /*fallback plate is already on screen, so there is nothing to undo*/
      });
  }

  function paintThumb(plate, url, title) {
    if (!plate || plate.querySelector('img')) return;
    var image = new Image();
    image.alt = title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = url;
    image.addEventListener('load', function () {
      var fallback = plate.querySelector('.plate__fallback');
      if (fallback) fallback.remove();
      plate.insertBefore(image, plate.firstChild);
    });
  }

  /* --- grid -------------------------------------------------------------- */

  var CUE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6Z"/><path d="M4 7.6 12 12l8-4.4M12 12v8.8"/></svg>';

  function tagMarkup(item) {
    var tags = [];
    CARD_FACETS.forEach(function (key) {
      (item[key] || []).forEach(function (value) {
        tags.push(
          '<button type="button" class="tag" data-tag-facet="' +
            key +
            '" data-tag-value="' +
            escapeAttribute(value) +
            '">' +
            escapeHtml(value) +
            '</button>'
        );
      });
    });
    return tags.join('');
  }

  function plateMarkup(item) {
    var thumb = item.poster || cachedThumb(item.uid);
    return (
      '<button class="plate" type="button" data-load="' +
      escapeAttribute(item.id) +
      '" data-uid="' +
      escapeAttribute(item.uid) +
      '" aria-label="Load the interactive model of ' +
      escapeAttribute(item.title) +
      '">' +
      (thumb
        ? '<img src="' +
          escapeAttribute(thumb) +
          '" alt="' +
          escapeAttribute(item.title) +
          '" loading="lazy" decoding="async">'
        : '<span class="plate__fallback"><span>3D model</span></span>') +
      '<span class="plate__cue">' +
      CUE_ICON +
      'Load model</span>' +
      '</button>'
    );
  }

  function cardMarkup(item) {
    var authors = (item.author || []).join(', ');
    return (
      '<article class="card" data-id="' +
      escapeAttribute(item.id) +
      '">' +
      plateMarkup(item) +
      '<div class="card__body">' +
      '<h2 class="card__title">' +
      escapeHtml(item.title) +
      '</h2>' +
      '<p class="card__credit">' +
      (authors
        ? 'Modelled by ' +
          (item.authorUrl
            ? '<a href="' +
              escapeAttribute(item.authorUrl) +
              '" target="_blank" rel="noopener">' +
              escapeHtml(authors) +
              '</a>'
            : escapeHtml(authors)) +
          ' \u00b7 '
        : '') +
      '<a href="https://sketchfab.com/3d-models/' +
      escapeAttribute(item.uid) +
      '" target="_blank" rel="noopener">Sketchfab</a>' +
      '</p>' +
      (item.note ? '<p class="card__note">' + escapeHtml(item.note) + '</p>' : '') +
      '<div class="card__tags">' +
      tagMarkup(item) +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderGrid(list) {
    visibleItems = list;
    grid.innerHTML = list.map(cardMarkup).join('');
    emptyMessage.hidden = list.length > 0;

    /*re-open any embed the reader had already loaded before filtering*/
    list.forEach(function (item) {
      if (loadedEmbeds.has(item.id)) {
        var plate = grid.querySelector('[data-load="' + item.id + '"]');
        if (plate) swapInEmbed(plate, item);
      }
    });

    /*ask Sketchfab for any thumbnail not already cached*/
    list.forEach(function (item) {
      if (item.poster || cachedThumb(item.uid) || loadedEmbeds.has(item.id)) return;
      var plate = grid.querySelector('[data-load="' + item.id + '"]');
      if (plate) fetchThumb(item, plate);
    });
  }

  function swapInEmbed(plate, item) {
    var frame = document.createElement('iframe');
    frame.className = 'embed';
    frame.title = item.title;
    frame.src =
      'https://sketchfab.com/models/' +
      item.uid +
      '/embed?autostart=1&ui_theme=dark';
    frame.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    plate.replaceWith(frame);
    loadedEmbeds.add(item.id);
  }

  function renderRegister(summary) {
    register.innerHTML =
      escapeHtml(summary.query) +
      '<span class="register__count">&nbsp;&nbsp;\u00b7&nbsp;&nbsp;' +
      summary.count +
      ' of ' +
      summary.total +
      ' models</span>';

    if (activeBadge) {
      activeBadge.hidden = summary.active === 0;
      activeBadge.textContent = summary.active;
    }
  }

  /* --- filtering --------------------------------------------------------- */

  var controller = Facets.create({
    mount: railElement,
    facets: data.facets,
    items: items,
    searchFields: ['title', 'note', 'id'],
    onChange: function (visible, state, summary) {
      renderGrid(Facets.sortItems(visible, sortSelect.value));
      renderRegister(summary);
    },
  });

  searchInput.addEventListener('input', function () {
    controller.setQuery(searchInput.value);
  });

  sortSelect.addEventListener('change', function () {
    renderGrid(Facets.sortItems(visibleItems, sortSelect.value));
  });

  grid.addEventListener('click', function (event) {
    var tag = event.target.closest('[data-tag-facet]');
    if (tag) {
      controller.toggleValue(tag.dataset.tagFacet, tag.dataset.tagValue);
      return;
    }
    var plate = event.target.closest('[data-load]');
    if (plate) {
      plate.classList.add('is-loading');
      swapInEmbed(plate, byId.get(plate.dataset.load));
    }
  });

  document.querySelector('[data-reset-all]').addEventListener('click', function () {
    searchInput.value = '';
    controller.reset();
  });

  /* --- filter rail on narrow screens ------------------------------------- */

  function setRail(open) {
    railElement.classList.toggle('is-open', open);
    scrim.hidden = !open;
  }

  document.querySelector('[data-rail-open]').addEventListener('click', function () {
    setRail(!railElement.classList.contains('is-open'));
  });
  scrim.addEventListener('click', function () {
    setRail(false);
  });

  /* --- helpers ----------------------------------------------------------- */

  function escapeHtml(value) {
    return String(value).replace(/[&<>]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character];
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }
})();
