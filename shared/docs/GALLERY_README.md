# Poggio Civitate galleries

- **`2d-gallery/`** the drawing archive. Excavation drawings, reconstructions
  and illustrations, filterable by year, subject, area and drawing type.
- **`3d-gallery/`** the 3D viewer. Artefacts scanned by specialists and
  published to Sketchfab, filterable by material, object type and condition.

They are separate utilities and stay separate. What they share is a design
layer and a filter engine, so that learning one teaches the other.

## Layout

```
2d-gallery/
  index.html            no per-image markup
  gallery.css           accent colour and the viewer
  gallery.js            grid, viewer, wiring
  data/artworks.js      every drawing and every tag
  media/                originals, untouched
  media/derived/        generated WebP, safe to delete and rebuild

3d-gallery/
  index.html
  models.css            accent colour and the model plate
  models.js             grid, embed loading, wiring
  data/models.js        every model and every tag
  imgs/

shared/
  theme.css             design tokens, page furniture, components
  facets.js             the filter engine both galleries run on
  site-header.js        the header both galleries render
  theme-init.js         light/dark, applied before first paint
  tools/
    build-derivatives.py  image derivatives and tag checks
  docs/
    AUDIT.md              what was wrong with the old 2D gallery
    GALLERY-ADDING-IMAGES.md      how to add a drawing or a tag
    GALLERY-ADDING-MODELS.md      how to add a model or a tag
    This Readme
```

## Deployment

`shared/` is referenced as `../shared/` from both galleries, so the two folders
have to stay siblings. They already are, both under `static-web-showing/`.
Moving one without the other breaks its styling.

Everything is static. No build step is required to deploy, and no server-side
anything. `shared/tools/build-derivatives.py` runs on a developer's machine when
drawings are added, and its output is committed.

Data lives in `.js` files assigning a global rather than in `.json`,
deliberately: `fetch` of a local JSON file is blocked under `file://`, and
opening `index.html` by double-clicking it is a realistic way for someone to
check their work. Editing is identical either way.

## Adding things

Adding a drawing, a model, or an entirely new kind of tag is a data edit. See
`shared/docs/ADDING-IMAGES.md` and `shared/docs/ADDING-MODELS.md`.

Before committing:

```
python3 tools/build-derivatives.py
python3 tools/build-derivatives.py --tags 3d-gallery/data/models.js
```

The first regenerates any stale image derivatives and reports problems. The
second checks the 3D tag vocabulary. Both flag the ways a hand-typed tag list
drifts apart, which is the main thing that goes wrong once several people are
adding records.

## How the filtering behaves

Consistent across both galleries:

- Picking two tags in the same group **widens** the results.
- Picking tags in different groups **narrows** them.
- Search and the year range apply on top of whatever is selected.
- The number beside a tag is how many records would remain if it were added,
  so it is never a dead end.
- Clicking a tag on a card filters by it.

## The shared look

Both galleries are records of the same site, so they share paper, ink, hairline
rules, the type scale and all page furniture: rail, toolbar, grid, header.

One variable separates them. The drawing archive takes burnt sienna, the
pigment of the terracottas most of its drawings record. The 3D viewer takes
patina, the colour the bronze in its collection has gone. Setting
`--accent-light` and `--accent-dark` in a gallery's own stylesheet is the whole
of its visual identity; everything else comes from `shared/theme.css`.

Catalogue values are set in monospace throughout: years, record ids, counts,
tag names. Above each grid is a register line stating the current query and how
many records answer it, which is also how a visitor can tell what is filtered.

Both galleries follow the system light/dark setting and remember an override.

## Credit

The 2D gallery was built by Malie Geery in 2025 as part of the Poggio Civitate
Data Science program. The 3D viewer is by the same program. This pass is an
audit, a restructure and a shared design layer over both; the original design
thinking, and the filter and sort features, are theirs.
