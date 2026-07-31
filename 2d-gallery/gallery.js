/*
  gallery.js - renders the drawing archive from data/artworks.js.

  Nothing here hardcodes an artwork. Adding a drawing means adding a record to
  the data file and running tools/build-derivatives.py; this file picks it up
  with no edits.
*/
(function () {
  var data = window.GALLERY_DATA;
  if (!data) {
    document.getElementById('gallery').textContent =
      'data/artworks.js did not load.';
    return;
  }

  var items = data.items || [];
  var grid = document.getElementById('gallery');
  var register = document.getElementById('register');
  var emptyMessage = document.getElementById('empty');
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var railElement = document.getElementById('filter-rail');
  var scrim = document.querySelector('.rail-scrim');
  var activeBadge = document.querySelector('[data-active-count]');

  /*Tags shown on a card. Year gets its own slot, so it is left out here.*/
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

  SiteHeader.mount({
    mount: '#site-header',
    section: 'Drawing archive',
    home: '../projects/all/',
    sibling: { label: '3D models', href: '../3d-gallery/' },
    help: '#help-modal',
  });

  /* --- grid -------------------------------------------------------------- */

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

  function cardMarkup(item) {
    var derived = item.derived || {};
    var ratio = item.width && item.height ? item.width / item.height : 1;

    var gridSource = 'media/' + (derived.grid || item.file);
    var srcset = derived['grid@2x']
      ? ' srcset="' +
        escapeAttribute('media/' + derived.grid) +
        ' 1x, ' +
        escapeAttribute('media/' + derived['grid@2x']) +
        ' 2x"'
      : '';

    return (
      '<article class="card' +
      (ratio > 1.9 ? ' card--wide' : '') +
      '" data-id="' +
      escapeAttribute(item.id) +
      '">' +
      '<button class="card__plate" type="button" data-open="' +
      escapeAttribute(item.id) +
      '" aria-label="Open ' +
      escapeAttribute(item.title) +
      ' in the viewer">' +
      '<img src="' +
      escapeAttribute(gridSource) +
      '"' +
      srcset +
      ' width="' +
      (item.width || 0) +
      '" height="' +
      (item.height || 0) +
      '" loading="lazy" decoding="async" alt="' +
      escapeAttribute(item.title) +
      '">' +
      '</button>' +
      '<div class="card__body">' +
      '<h2 class="card__title">' +
      escapeHtml(item.title) +
      '</h2>' +
      '<p class="card__meta reg">' +
      (item.year || 'Undated') +
      '</p>' +
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
  }

  function renderRegister(summary) {
    register.innerHTML =
      escapeHtml(summary.query) +
      '<span class="register__count">' +
      '&nbsp;&nbsp;\u00b7&nbsp;&nbsp;' +
      summary.count +
      ' of ' +
      summary.total +
      ' records</span>';

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
    searchFields: ['title', 'note', 'credit', 'id'],
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

  /*Clicking a tag on a card filters by it, so the grid navigates itself.*/
  grid.addEventListener('click', function (event) {
    var tag = event.target.closest('[data-tag-facet]');
    if (tag) {
      controller.toggleValue(tag.dataset.tagFacet, tag.dataset.tagValue);
      return;
    }
    var opener = event.target.closest('[data-open]');
    if (opener) openViewer(opener.dataset.open);
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

  /* --- viewer ------------------------------------------------------------ */

  var viewer = document.getElementById('viewer');
  var viewerImage = document.getElementById('viewer-image');
  var viewerTitle = document.getElementById('viewer-title');
  var viewerMeta = document.getElementById('viewer-meta');
  var viewerNote = document.getElementById('viewer-note');
  var viewerTags = document.getElementById('viewer-tags');
  var viewerPosition = document.getElementById('viewer-position');
  var viewerOriginal = document.getElementById('viewer-original');
  var viewerIndex = 0;
  var lastFocused = null;

  function showAt(index) {
    if (!visibleItems.length) return;
    viewerIndex = (index + visibleItems.length) % visibleItems.length;
    var item = visibleItems[viewerIndex];
    var derived = item.derived || {};

    viewerImage.src = 'media/' + (derived.view || item.file);
    viewerImage.alt = item.title;
    viewerTitle.textContent = item.title;

    var meta = [item.year || 'Undated'];
    if (item.width && item.height) meta.push(item.width + ' \u00d7 ' + item.height);
    if (item.credit) meta.push(item.credit);
    viewerMeta.textContent = meta.join('  \u00b7  ');

    viewerNote.textContent = item.note || '';
    viewerNote.hidden = !item.note;
    viewerTags.innerHTML = tagMarkup(item);
    viewerPosition.textContent =
      viewerIndex + 1 + ' / ' + visibleItems.length + '  \u00b7  ' + item.id;
    viewerOriginal.href = 'media/' + item.file;
  }

  function openViewer(id) {
    var index = visibleItems.findIndex(function (item) {
      return item.id === id;
    });
    if (index === -1) return;
    lastFocused = document.activeElement;
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    showAt(index);
    viewer.querySelector('[data-viewer-close]').focus();
  }

  function closeViewer() {
    viewer.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  viewer.addEventListener('click', function (event) {
    if (event.target.closest('[data-viewer-close]')) return closeViewer();
    if (event.target.closest('[data-viewer-prev]')) return showAt(viewerIndex - 1);
    if (event.target.closest('[data-viewer-next]')) return showAt(viewerIndex + 1);

    /*a tag in the caption filters the archive behind the viewer*/
    var tag = event.target.closest('[data-tag-facet]');
    if (tag) {
      controller.toggleValue(tag.dataset.tagFacet, tag.dataset.tagValue);
      closeViewer();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (viewer.hidden) return;
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowLeft') showAt(viewerIndex - 1);
    if (event.key === 'ArrowRight') showAt(viewerIndex + 1);
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