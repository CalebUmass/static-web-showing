/*
  facets.js - the filtering engine behind both galleries.

  It knows nothing about drawings or 3D models. Hand it a list of records and
  a list of facet definitions and it builds the filter rail, keeps the state,
  and calls back with whatever is still visible.

  Filter semantics, which is the part worth getting right:

    within one facet   OR    picking "Kiln" and "Loom" shows both
    across facets      AND   "Kiln" plus year 2018 shows 2018 kilns only
    search             AND   applied on top of whatever is selected
    year range         AND   same

  The old gallery made these mutually exclusive and had to explain it in a
  help modal. They compose here, so there is nothing to explain.

  Counts next to each tag are computed with that tag's own facet excluded, so
  a count of 3 means "3 records would remain", never "0, dead end".

    var controller = Facets.create({
      mount: '#filter-rail',
      facets: data.facets,
      items: data.items,
      searchFields: ['title', 'note'],
      onChange: function (visible, state) { render(visible); }
    });
*/
(function () {
  function toArray(value) {
    if (value === null || value === undefined || value === '') return [];
    return Array.isArray(value) ? value : [value];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }

  /*One lowercase blob per record, built once, so search stays cheap.*/
  function buildSearchIndex(items, facets, searchFields) {
    var keys = facets.map(function (facet) {
      return facet.key;
    });
    var index = new Map();

    items.forEach(function (item) {
      var parts = [];
      searchFields.forEach(function (field) {
        if (item[field]) parts.push(item[field]);
      });
      keys.forEach(function (key) {
        toArray(item[key]).forEach(function (value) {
          parts.push(value);
        });
      });
      index.set(item, parts.join(' ').toLowerCase());
    });

    return index;
  }

  /*Distinct values per text facet, in the order a reader would expect.*/
  function collectValues(items, facet) {
    var values = new Set();
    items.forEach(function (item) {
      toArray(item[facet.key]).forEach(function (value) {
        values.add(String(value));
      });
    });
    return Array.from(values).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  function matchesFacet(item, facet, selected) {
    if (!selected || selected.size === 0) return true;
    var values = toArray(item[facet.key]).map(String);
    for (var index = 0; index < values.length; index += 1) {
      if (selected.has(values[index])) return true;
    }
    return false;
  }

  function matchesYear(item, state, yearFacet) {
    if (!yearFacet) return true;
    var year = item[yearFacet.key];
    if (year === null || year === undefined) return state.includeUndated;
    if (state.yearFrom !== null && year < state.yearFrom) return false;
    if (state.yearTo !== null && year > state.yearTo) return false;
    return true;
  }

  function create(options) {
    var host =
      typeof options.mount === 'string'
        ? document.querySelector(options.mount)
        : options.mount;
    var items = options.items || [];
    var searchFields = options.searchFields || ['title'];

    /*Skip any facet that nothing has a value for. Facets can then be declared
      in the data file before the cataloguing work behind them is done.*/
    var allFacets = (options.facets || []).slice();
    var yearFacet = null;
    var textFacets = [];

    allFacets.forEach(function (facet) {
      if (facet.type === 'year') {
        yearFacet = facet;
        return;
      }
      if (collectValues(items, facet).length > 0) textFacets.push(facet);
    });

    var years = items
      .map(function (item) {
        return yearFacet ? item[yearFacet.key] : null;
      })
      .filter(function (year) {
        return typeof year === 'number';
      })
      .sort(function (a, b) {
        return a - b;
      });

    var hasUndated =
      yearFacet &&
      items.some(function (item) {
        return item[yearFacet.key] === null || item[yearFacet.key] === undefined;
      });

    var bounds = {
      min: years.length ? years[0] : null,
      max: years.length ? years[years.length - 1] : null,
    };

    var searchIndex = buildSearchIndex(items, allFacets, searchFields);

    var state = {
      query: '',
      selected: {},
      yearFrom: bounds.min,
      yearTo: bounds.max,
      includeUndated: true,
    };
    textFacets.forEach(function (facet) {
      state.selected[facet.key] = new Set();
    });

    /*Apply every filter except the one named, which is how honest counts work.*/
    function filter(exceptFacetKey) {
      var query = state.query.trim().toLowerCase();
      return items.filter(function (item) {
        if (query && searchIndex.get(item).indexOf(query) === -1) return false;
        if (
          (!yearFacet || exceptFacetKey !== yearFacet.key) &&
          !matchesYear(item, state, yearFacet)
        ) {
          return false;
        }
        for (var index = 0; index < textFacets.length; index += 1) {
          var facet = textFacets[index];
          if (facet.key === exceptFacetKey) continue;
          if (!matchesFacet(item, facet, state.selected[facet.key])) return false;
        }
        return true;
      });
    }

    function activeCount() {
      var total = 0;
      textFacets.forEach(function (facet) {
        total += state.selected[facet.key].size;
      });
      if (yearFacet && (state.yearFrom !== bounds.min || state.yearTo !== bounds.max)) {
        total += 1;
      }
      if (state.query.trim()) total += 1;
      if (hasUndated && !state.includeUndated) total += 1;
      return total;
    }

    /*A one-line description of the current query, set in mono on the page.*/
    function summary(visibleCount) {
      var parts = [];
      if (state.query.trim()) parts.push('"' + state.query.trim() + '"');
      if (
        yearFacet &&
        (state.yearFrom !== bounds.min || state.yearTo !== bounds.max)
      ) {
        parts.push(
          yearFacet.label +
            ' ' +
            state.yearFrom +
            (state.yearFrom === state.yearTo ? '' : '\u2013' + state.yearTo)
        );
      }
      textFacets.forEach(function (facet) {
        var chosen = Array.from(state.selected[facet.key]);
        if (chosen.length) parts.push(facet.label + ' ' + chosen.join(', '));
      });
      if (hasUndated && !state.includeUndated) parts.push('Dated only');

      return {
        query: parts.length ? parts.join('  \u00b7  ') : 'All records',
        count: visibleCount,
        total: items.length,
        active: activeCount(),
      };
    }

    function emit() {
      renderCounts();
      var visible = filter(null);
      if (options.onChange) options.onChange(visible, state, summary(visible.length));
    }

    /* --- rail markup ---------------------------------------------------- */

    function yearGroupMarkup() {
      if (!yearFacet || bounds.min === null) return '';
      var choices = [];
      for (var year = bounds.min; year <= bounds.max; year += 1) {
        choices.push(year);
      }
      var optionsFor = function (selected) {
        return choices
          .map(function (year) {
            return (
              '<option value="' +
              year +
              '"' +
              (year === selected ? ' selected' : '') +
              '>' +
              year +
              '</option>'
            );
          })
          .join('');
      };

      return (
        '<details class="rail__group" open>' +
        '<summary class="rail__summary"><span>' +
        escapeHtml(yearFacet.label) +
        '</span><span class="rail__marker" aria-hidden="true"></span></summary>' +
        (yearFacet.hint
          ? '<p class="rail__hint">' + escapeHtml(yearFacet.hint) + '</p>'
          : '') +
        '<div class="rail__range">' +
        '<label class="visually-hidden" for="year-from">Earliest year</label>' +
        '<select class="field field--compact" id="year-from" data-year="from">' +
        optionsFor(state.yearFrom) +
        '</select>' +
        '<span class="rail__range-dash" aria-hidden="true">to</span>' +
        '<label class="visually-hidden" for="year-to">Latest year</label>' +
        '<select class="field field--compact" id="year-to" data-year="to">' +
        optionsFor(state.yearTo) +
        '</select>' +
        '</div>' +
        (hasUndated
          ? '<label class="rail__check"><input type="checkbox" data-undated checked> ' +
            'Include undated</label>'
          : '') +
        '</details>'
      );
    }

    function textGroupMarkup(facet) {
      var values = collectValues(items, facet);
      return (
        '<details class="rail__group" data-facet="' +
        escapeHtml(facet.key) +
        '"' +
        (values.length <= 8 ? ' open' : '') +
        '>' +
        '<summary class="rail__summary"><span>' +
        escapeHtml(facet.label) +
        '</span><span class="rail__marker" aria-hidden="true"></span></summary>' +
        (facet.hint ? '<p class="rail__hint">' + escapeHtml(facet.hint) + '</p>' : '') +
        '<div class="rail__tags">' +
        values
          .map(function (value) {
            return (
              '<button type="button" class="tag" aria-pressed="false" ' +
              'data-facet="' +
              escapeHtml(facet.key) +
              '" data-value="' +
              escapeHtml(value) +
              '">' +
              escapeHtml(value) +
              '<span class="tag__count" aria-hidden="true"></span></button>'
            );
          })
          .join('') +
        '</div>' +
        '</details>'
      );
    }

    function render() {
      if (!host) return;
      host.innerHTML =
        '<div class="rail__head">' +
        '<span class="reg">Filters</span>' +
        '<button type="button" class="rail__reset" data-reset>Clear all</button>' +
        '</div>' +
        yearGroupMarkup() +
        textFacets.map(textGroupMarkup).join('');

      host.addEventListener('click', function (event) {
        var tag = event.target.closest('.tag[data-facet]');
        if (tag) {
          var chosen = state.selected[tag.dataset.facet];
          if (chosen.has(tag.dataset.value)) chosen.delete(tag.dataset.value);
          else chosen.add(tag.dataset.value);
          tag.setAttribute('aria-pressed', String(chosen.has(tag.dataset.value)));
          emit();
          return;
        }
        if (event.target.closest('[data-reset]')) reset();
      });

      host.addEventListener('change', function (event) {
        var select = event.target.closest('[data-year]');
        if (select) {
          var value = parseInt(select.value, 10);
          if (select.dataset.year === 'from') {
            state.yearFrom = value;
            if (state.yearTo < value) {
              state.yearTo = value;
              host.querySelector('[data-year="to"]').value = String(value);
            }
          } else {
            state.yearTo = value;
            if (state.yearFrom > value) {
              state.yearFrom = value;
              host.querySelector('[data-year="from"]').value = String(value);
            }
          }
          emit();
          return;
        }
        if (event.target.matches('[data-undated]')) {
          state.includeUndated = event.target.checked;
          emit();
        }
      });
    }

    function renderCounts() {
      if (!host) return;
      textFacets.forEach(function (facet) {
        var pool = filter(facet.key);
        var counts = new Map();
        pool.forEach(function (item) {
          toArray(item[facet.key]).forEach(function (value) {
            var key = String(value);
            counts.set(key, (counts.get(key) || 0) + 1);
          });
        });
        host
          .querySelectorAll('.tag[data-facet="' + facet.key + '"]')
          .forEach(function (tag) {
            var count = counts.get(tag.dataset.value) || 0;
            tag.querySelector('.tag__count').textContent = count;
            tag.classList.toggle(
              'tag--empty',
              count === 0 && tag.getAttribute('aria-pressed') !== 'true'
            );
          });
      });
    }

    function reset() {
      state.query = '';
      state.yearFrom = bounds.min;
      state.yearTo = bounds.max;
      state.includeUndated = true;
      textFacets.forEach(function (facet) {
        state.selected[facet.key].clear();
      });
      if (host) {
        host.querySelectorAll('.tag[data-facet]').forEach(function (tag) {
          tag.setAttribute('aria-pressed', 'false');
        });
        var from = host.querySelector('[data-year="from"]');
        var to = host.querySelector('[data-year="to"]');
        if (from) from.value = String(bounds.min);
        if (to) to.value = String(bounds.max);
        var undated = host.querySelector('[data-undated]');
        if (undated) undated.checked = true;
      }
      emit();
    }

    function setQuery(value) {
      state.query = value || '';
      emit();
    }

    /*Turn a tag on a card into a filter, so the grid itself is navigable.*/
    function toggleValue(facetKey, value) {
      var chosen = state.selected[facetKey];
      if (!chosen) return;
      if (chosen.has(value)) chosen.delete(value);
      else chosen.add(value);
      if (host) {
        var tag = host.querySelector(
          '.tag[data-facet="' + facetKey + '"][data-value="' + value + '"]'
        );
        if (tag) {
          tag.setAttribute('aria-pressed', String(chosen.has(value)));
          var group = tag.closest('details');
          if (group) group.open = true;
        }
      }
      emit();
    }

    render();
    emit();

    return {
      state: state,
      bounds: bounds,
      facets: allFacets,
      reset: reset,
      setQuery: setQuery,
      toggleValue: toggleValue,
      refresh: emit,
    };
  }

  var SORTS = {
    'year-desc': function (a, b) {
      return (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title);
    },
    'year-asc': function (a, b) {
      return (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title);
    },
    'title-asc': function (a, b) {
      return a.title.localeCompare(b.title);
    },
    'title-desc': function (a, b) {
      return b.title.localeCompare(a.title);
    },
  };

  /*Returns a new array. "default" keeps the order the data file is written in.*/
  function sortItems(items, mode) {
    if (!SORTS[mode]) return items.slice();
    return items.slice().sort(SORTS[mode]);
  }

  window.Facets = { create: create, sortItems: sortItems, sorts: Object.keys(SORTS) };
})();
