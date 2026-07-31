# Drawing archive

Searchable archive of excavation drawings, reconstructions and illustrations
from Poggio Civitate.

Originally built by Malie Geery in 2025 as part of the Poggio Civitate CS Field
School program. Audited and restructured by Cole Adam Reilly; see `shared/docs/AUDIT.md` for
what changed and why.

## Files

| File | Holds |
| --- | --- |
| `index.html` | page structure only, no drawings |
| `gallery.css` | the accent colour and the viewer |
| `gallery.js` | grid rendering, the viewer, event wiring |
| `data/artworks.js` | **every drawing and every tag** |
| `media/` | originals, never modified |
| `media/derived/` | generated WebP, safe to delete and rebuild |

Shared tokens, components, the filter engine and the header live in
`../shared/`, alongside the 3D viewer.

## Adding a drawing

Three steps, one of them a script. See `shared/docs/GALLERY-ADDING-IMAGES.md`.

    1. put the original in media/<year>/
    2. add a record to data/artworks.js
    3. python3 ../tools/build-derivatives.py

Adding a new kind of tag is one entry in the `facets` list in the same file.

## Features

- search across titles, notes and every tag
- filters that combine rather than override each other
- year range, sorting, light and dark
- viewer with keyboard navigation and a full-resolution download
- 0.3 MB to first paint, against 89.2 MB before
