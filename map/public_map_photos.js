//Photo point layer shared by both map pages. index.html uses addPhotoLayer
//for the read-only public layer; admin.html builds its own editable layer
//but takes the icons, the filter state, and the toggle lists from here so
//both pages draw and filter photos the same way.
//
//usage in the main map page, after the map exists:
//
//  <script src="public_map_photos.js"></script>
//  <script>
//    map.on("load", async () => {
//      const fc = await addPhotoLayer(map, "/api/photos");
//      renderPhotoToggles(el, collectPhotoKinds(fc.features), photoFilters.hiddenKinds,
//                         () => applyPhotoFilter(map));
//    });
//    setPhotoYearFilter(map, [1968, 1970]);   //or null for all years
//  </script>

//----------------------------------------------------------------------
//photo kinds: the icon and the form behaviour for each. A new kind only
//needs an entry here plus a drawing in drawPhotoIcon; the api accepts any
//short lowercase name. Points with an unknown kind draw as ground photos
const PHOTO_KINDS = {
  ground: {
    label: "Ground photos",
    single: "Ground photo",
    rotates: true,
    directionLabel: "Camera direction (degrees from north)",
    aimHint: "Click the spot on the map the camera was looking at.",
  },
  aerial: {
    label: "Aerial and drone photos",
    single: "Aerial photo",
    rotates: true,
    directionLabel: "Top of the image faces (degrees from north)",
    aimHint: "Click a spot the top edge of the image faces.",
  },
  artifact: {
    label: "Artifact photos",
    single: "Artifact photo",
    //direction means nothing for an object shot on a table
    rotates: false,
  },
};
const PHOTO_DEFAULT_KIND = "ground";
const PHOTO_UNTAGGED = "__untagged__";
//the public page names its layer photo-points, the editor photo-arrows
const PHOTO_LAYER_IDS = ["photo-points", "photo-arrows"];

function photoKindDef(kind) {
  return PHOTO_KINDS[kind] || PHOTO_KINDS[PHOTO_DEFAULT_KIND];
}

//----------------------------------------------------------------------
//icons, drawn white on a 64px canvas so maplibre can tint them as sdf
function drawPhotoIcon(ctx, kind, s) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  if (kind === "aerial") {
    //image footprint seen from above, with a notch marking the top edge
    ctx.lineWidth = s * 0.09;
    ctx.strokeRect(s * 0.22, s * 0.28, s * 0.56, s * 0.56);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.04); ctx.lineTo(s * 0.67, s * 0.24);
    ctx.lineTo(s * 0.33, s * 0.24);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.56, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "artifact") {
    //amphora: rim, neck, body, foot, two handles
    ctx.fillRect(s * 0.36, s * 0.08, s * 0.28, s * 0.08);
    ctx.fillRect(s * 0.42, s * 0.15, s * 0.16, s * 0.16);
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.58, s * 0.23, s * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(s * 0.43, s * 0.82, s * 0.14, s * 0.1);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(s * 0.43, s * 0.2);
    ctx.quadraticCurveTo(s * 0.2, s * 0.2, s * 0.32, s * 0.45);
    ctx.moveTo(s * 0.57, s * 0.2);
    ctx.quadraticCurveTo(s * 0.8, s * 0.2, s * 0.68, s * 0.45);
    ctx.stroke();
  } else {
    //ground photo: arrow pointing the way the camera faced, north at 0
    ctx.beginPath();
    ctx.moveTo(s * 0.44, s * 0.86); ctx.lineTo(s * 0.56, s * 0.86);
    ctx.lineTo(s * 0.56, s * 0.38); ctx.lineTo(s * 0.44, s * 0.38);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.10); ctx.lineTo(s * 0.76, s * 0.42);
    ctx.lineTo(s * 0.24, s * 0.42);
    ctx.closePath(); ctx.fill();
  }
}

function photoIconImage(kind) {
  const s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  drawPhotoIcon(ctx, kind, s);
  return ctx.getImageData(0, 0, s, s);
}

//adds photo-icon-ground, photo-icon-aerial, ... to the map's sprite
function registerPhotoIcons(map) {
  for (const kind of Object.keys(PHOTO_KINDS)) {
    const name = "photo-icon-" + kind;
    if (!map.hasImage(name)) map.addImage(name, photoIconImage(kind), { sdf: true });
  }
}

//tinted copy of an icon for legends and toggle lists
function photoIconDataUrl(kind, color, px) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  drawPhotoIcon(ctx, kind, 64);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  const out = document.createElement("canvas");
  out.width = out.height = px * 2;
  out.getContext("2d").drawImage(c, 0, 0, px * 2, px * 2);
  return out.toDataURL();
}

function photoKindExpr() {
  return ["coalesce", ["get", "kind"], PHOTO_DEFAULT_KIND];
}

function photoUserExpr() {
  return ["coalesce", ["get", "created_by"], "unknown"];
}

function photoTagsExpr() {
  return ["array", ["coalesce", ["get", "tags"], ["literal", []]]];
}

//icon-image: one icon per known kind, ground arrow for anything else
function photoIconImageExpr() {
  const expr = ["match", photoKindExpr()];
  for (const kind of Object.keys(PHOTO_KINDS)) expr.push(kind, "photo-icon-" + kind);
  expr.push("photo-icon-" + PHOTO_DEFAULT_KIND);
  return expr;
}

//icon-rotate: kinds without a direction always draw upright
function photoIconRotateExpr() {
  const fixed = Object.keys(PHOTO_KINDS).filter(k => !PHOTO_KINDS[k].rotates);
  if (!fixed.length) return ["get", "rotation"];
  return ["case", ["in", photoKindExpr(), ["literal", fixed]], 0,
          ["coalesce", ["get", "rotation"], 0]];
}

//----------------------------------------------------------------------
//filter state shared by every toggle list. The sets hold what is HIDDEN,
//so a tag, kind, or submitter that first appears after the lists were
//built shows by default instead of silently disappearing
const photoFilters = {
  years: null,
  hiddenKinds: new Set(),
  hiddenTags: new Set(),
  hiddenUsers: new Set(),
  //every tag currently in the data; refreshed by collectPhotoTags
  allTags: [],
};

function buildPhotoFilter() {
  const parts = ["all"];
  if (photoFilters.years && photoFilters.years.length) {
    parts.push(["in", ["get", "year"], ["literal", photoFilters.years]]);
  }
  if (photoFilters.hiddenKinds.size) {
    parts.push(["!", ["in", photoKindExpr(), ["literal", [...photoFilters.hiddenKinds]]]]);
  }
  if (photoFilters.hiddenUsers.size) {
    parts.push(["!", ["in", photoUserExpr(), ["literal", [...photoFilters.hiddenUsers]]]]);
  }
  if (photoFilters.hiddenTags.size) {
    //a photo shows when any of its tags is still checked
    const clauses = photoFilters.allTags
      .filter(t => !photoFilters.hiddenTags.has(t))
      .map(t => ["in", t, photoTagsExpr()]);
    if (!photoFilters.hiddenTags.has(PHOTO_UNTAGGED)) {
      clauses.push(["==", ["length", photoTagsExpr()], 0]);
    }
    //["==", 1, 0] would read as a legacy filter and be rejected, so an
    //everything-unchecked state is an explicit false literal
    parts.push(clauses.length ? ["any", ...clauses] : ["literal", false]);
  }
  return parts.length > 1 ? parts : null;
}

function applyPhotoFilter(map) {
  const f = buildPhotoFilter();
  for (const id of PHOTO_LAYER_IDS) {
    if (map.getLayer(id)) map.setFilter(id, f);
  }
}

function setPhotoYearFilter(map, years) {
  photoFilters.years = years;
  applyPhotoFilter(map);
}

//----------------------------------------------------------------------
//toggle list items built from the current features

//tags by frequency, then name; photos with no tags as a final entry
function collectPhotoTags(features) {
  const counts = new Map();
  let untagged = 0;
  for (const f of features) {
    const tags = f.properties.tags || [];
    if (!tags.length) untagged += 1;
    for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
  }
  photoFilters.allTags = [...counts.keys()];
  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: key, count }));
  if (untagged) items.push({ key: PHOTO_UNTAGGED, label: "no tags", count: untagged, muted: true });
  return items;
}

//known kinds in their fixed order, then any unknown kinds in the data
function collectPhotoKinds(features, color) {
  const counts = new Map(Object.keys(PHOTO_KINDS).map(k => [k, 0]));
  for (const f of features) {
    const k = f.properties.kind || PHOTO_DEFAULT_KIND;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const img = document.createElement("img");
    img.className = "ptog-icon";
    img.alt = "";
    img.src = photoIconDataUrl(PHOTO_KINDS[key] ? key : PHOTO_DEFAULT_KIND, color || "#26221c", 16);
    return { key, label: PHOTO_KINDS[key] ? PHOTO_KINDS[key].label : key, count, swatch: img };
  });
}

function ensurePhotoToggleStyles() {
  if (document.getElementById("ptog-styles")) return;
  const style = document.createElement("style");
  style.id = "ptog-styles";
  //selectors are scoped under .ptog so the editor's uppercase label rule
  //and its large default buttons do not leak in
  style.textContent = `
    .ptog { display: flex; flex-direction: column; gap: 1px; }
    .ptog .ptog-item { display: flex; align-items: center; gap: 7px; margin: 0;
      padding: 2px 0; font-size: 13px; text-transform: none; letter-spacing: 0;
      color: inherit; cursor: pointer; }
    .ptog .ptog-item input { accent-color: #b0531c; margin: 0; }
    .ptog .ptog-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; }
    .ptog .ptog-icon { width: 16px; height: 16px; flex: none; }
    .ptog .ptog-count { margin-left: auto; padding-left: 6px; font-size: 11px;
      color: #7a7264; font-variant-numeric: tabular-nums; }
    .ptog .ptog-muted .ptog-text { font-style: italic; color: #7a7264; }
    .ptog.ptog-chips { flex-direction: row; flex-wrap: wrap; gap: 5px; }
    .ptog.ptog-chips .ptog-item { position: relative; gap: 4px; padding: 2px 9px;
      font-size: 12px; border: 1px solid #e2dcd1; border-radius: 999px; background: #fff; }
    .ptog.ptog-chips .ptog-item input { position: absolute; opacity: 0; pointer-events: none; }
    .ptog.ptog-chips .ptog-item:has(input:checked) { border-color: #b0531c; }
    .ptog.ptog-chips .ptog-item:has(input:not(:checked)) { opacity: 0.45; text-decoration: line-through; }
    .ptog.ptog-chips .ptog-item:has(input:focus-visible) { outline: 2px solid #b0531c; }
    .ptog.ptog-chips .ptog-count { margin-left: 2px; padding-left: 0; }
    .ptog-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .ptog-btns button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 5px;
      border: 1px solid #e2dcd1; background: #fff; color: inherit; cursor: pointer; }
    .ptog-btns button:hover { border-color: #b0531c; }
    .ptog-empty { font-size: 12px; color: #7a7264; margin: 0; }
  `;
  document.head.append(style);
}

//renders checkboxes for items into container. hidden is one of the
//photoFilters sets; onChange runs after any toggle. opts.chips draws
//wrapping pills instead of rows; opts.buttons adds extra buttons
function renderPhotoToggles(container, items, hidden, onChange, opts = {}) {
  ensurePhotoToggleStyles();
  container.replaceChildren();
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "ptog-empty";
    p.textContent = opts.emptyText || "None yet";
    container.append(p);
    return;
  }
  const list = document.createElement("div");
  list.className = "ptog" + (opts.chips ? " ptog-chips" : "");
  const boxes = [];
  for (const item of items) {
    const label = document.createElement("label");
    label.className = "ptog-item" + (item.muted ? " ptog-muted" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !hidden.has(item.key);
    cb.addEventListener("change", () => {
      if (cb.checked) hidden.delete(item.key); else hidden.add(item.key);
      onChange();
    });
    boxes.push([cb, item.key]);
    label.append(cb);
    if (item.swatch) label.append(item.swatch);
    const text = document.createElement("span");
    text.className = "ptog-text";
    text.textContent = item.label;
    const count = document.createElement("span");
    count.className = "ptog-count";
    count.textContent = item.count;
    label.append(text, count);
    list.append(label);
  }
  const btns = document.createElement("div");
  btns.className = "ptog-btns";
  const setAll = (on) => {
    for (const [cb, key] of boxes) {
      cb.checked = on;
      if (on) hidden.delete(key); else hidden.add(key);
    }
    onChange();
  };
  const mk = (text, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", fn);
    btns.append(b);
  };
  mk("All", () => setAll(true));
  mk("None", () => setAll(false));
  for (const extra of opts.buttons || []) mk(extra.label, extra.onClick);
  container.append(list, btns);
}

//----------------------------------------------------------------------
//read-only public layer

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

//adds the photo layer and returns the FeatureCollection for building the
//toggle lists. An unreachable api yields an empty layer rather than an
//exception, so the rest of the page (year filter, toggles) still loads
async function addPhotoLayer(map, apiUrl) {
  registerPhotoIcons(map);

  let data = { type: "FeatureCollection", features: [] };
  try {
    const r = await fetch(apiUrl);
    if (!r.ok) throw new Error("HTTP " + r.status);
    data = await r.json();
  } catch (e) {
    console.warn("photo points unavailable:", e.message);
  }
  map.addSource("photos", { type: "geojson", data });

  map.addLayer({
    id: "photo-points",
    type: "symbol",
    source: "photos",
    minzoom: 15,
    layout: {
      "icon-image": photoIconImageExpr(),
      "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.3, 19, 0.55],
      "icon-rotate": photoIconRotateExpr(),
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true
    },
    paint: {
      "icon-color": "#26221c"
    }
  });

  map.on("click", "photo-points", e => {
    const p = e.features[0].properties;
    //maplibre serialises array properties to json strings in events
    const tags = typeof p.tags === "string" ? JSON.parse(p.tags || "[]") : (p.tags || []);
    const kind = photoKindDef(p.kind).single;
    const html = `
      <div style="max-width:240px;font:13px/1.45 system-ui,sans-serif">
        <strong>${escapeHtml(kind)}${p.year ? ", " + escapeHtml(p.year) : ""}</strong><br>
        ${escapeHtml(p.description)}
        ${tags.length ? `<div style="margin-top:4px;color:#7a7264;font-size:12px">${tags.map(escapeHtml).join(" &middot; ")}</div>` : ""}
        ${p.image_url ? `<div style="margin-top:6px"><a href="${escapeHtml(p.image_url)}" target="_blank" rel="noopener">View photograph</a></div>` : ""}
      </div>`;
    new maplibregl.Popup({ offset: 12 })
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(html)
      .addTo(map);
  });
  map.on("mouseenter", "photo-points", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "photo-points", () => map.getCanvas().style.cursor = "");
  return data;
}
