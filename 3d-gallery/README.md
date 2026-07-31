# 3D viewer

Interactive 3D scans of artefacts from Poggio Civitate, published to Sketchfab
by specialists and presented here with a tag and filter system matching the
drawing archive.

Originally built by Caleb Richards in 2025 as part of the Poggio Civitate CS Field
School program. Audited and restructured by Cole Adam Reilly; see `shared/docs/AUDIT.md` for
what changed and why.

## Files

| File | Holds |
| --- | --- |
| `index.html` | page structure only, no models |
| `models.css` | the accent colour and the model plate |
| `models.js` | grid rendering, embed loading, event wiring |
| `data/models.js` | **every model and every tag** |
| `imgs/` | optional poster stills |

Shared tokens, components, the filter engine and the header live in
`../shared/`, alongside the drawing archive.

## Adding a model

Two steps, no script. See `shared/docs/GALLERY-ADDING-MODELS.md`.

    1. copy the uid out of the Sketchfab share URL
    2. add a record to data/models.js

Adding a new kind of tag is one entry in the `facets` list in the same file.
Two facets sit there declared and empty right now, `year` and `area`; both
switch themselves on once the data exists, with no code change.

## Loading

A Sketchfab embed is a live WebGL scene, and this page used to start ten at
once. Cards are now stills until picked, with thumbnails fetched once per model
from Sketchfab's oEmbed endpoint and cached in the browser for 30 days. If that
request fails the card falls back to a plain plate and the model still loads on
demand.

## Features

- search across titles, notes and every tag 
- filters that combine rather than override each other
- sorting, light and dark
- zero iframes until a model is picked
