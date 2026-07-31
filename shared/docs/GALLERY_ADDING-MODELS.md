# Adding models to the 3D viewer

The data file is shaped exactly like the drawing archive's, so anything learned
from `GALLERY-ADDING-IMAGES.md` transfers. The differences are that models live on
Sketchfab rather than on disk, and there is no build step.

## The short version

1. Publish the model on Sketchfab
2. Copy its uid out of the share URL
3. Add a record to `items` in `3d-gallery/data/models.js`

## Finding the uid

A Sketchfab model URL looks like this:

```
https://sketchfab.com/3d-models/bronze-pin-8de3fa75b4bb48b3bd75300ee3733f10
                                          └──────────── uid ─────────────┘
```

The uid is the 32 characters of hex after the last dash. It is what the embed
runs on, and the only part of that URL worth storing.

## The record

```js
{
  "id": "bronze-pin",
  "title": "Bronze Pin",
  "uid": "8de3fa75b4bb48b3bd75300ee3733f10",
  "author": ["3Dig"],
  "authorUrl": "https://sketchfab.com/jakerstr",
  "year": null,
  "material": ["Bronze"],
  "objectType": ["Pin"],
  "condition": [],
  "area": [],
  "note": "Optional. Shown under the title on the card."
}
```

| Field | Notes |
| --- | --- |
| `id` | Unique, lowercase, dashes. Stable forever. |
| `title` | Shown on the card and used as the embed's accessible title. |
| `uid` | From the URL, above. |
| `author` | A list, so a model with two modellers records both. It doubles as the "Modelled by" facet. |
| `authorUrl` | Optional link to the Sketchfab profile. |
| `year` | Year the model was made, or `null`. |
| `poster` | Optional path under `imgs/` to a still image. See below. |

Everything else is a facet holding a list of tags, same as the drawing archive.

## Thumbnails

Cards show a still image until someone picks one, so that opening the page does
not start ten WebGL scenes at once. That still comes from one of three places,
in order:

1. `poster`, when the record names a local file under `imgs/`
2. Sketchfab's own thumbnail, fetched once per model and cached in the browser
   for 30 days
3. A hatched fallback plate, when neither is available

Nothing breaks when the thumbnail request fails or the browser is offline. The
fallback plate is already on screen and the model still loads when picked.

### Downloading the thumbnails instead

Option 2 is a cross-origin request, so whether it works depends on Sketchfab
sending an `Access-Control-Allow-Origin` header, which their documentation does
not commit to. To stop depending on it:

```
python3 tools/fetch-posters.py
```

That downloads every thumbnail once, saves them under `imgs/posters/`, and
fills in the `poster` field on each record. After running it the gallery never
makes the request at all. Posters become local files: they work offline, they
load faster, and they cannot break because a third party changed a header.

Worth running once now and again whenever models are added. `--force`
re-fetches everything, `--clear` removes the poster fields and goes back to
asking the browser.

## Adding a new kind of tag

Identical to the drawing archive. Add an entry to `facets` in
`data/models.js`, then add that key to the items that have a value:

```js
{
  "key": "technique",
  "label": "Capture technique",
  "type": "text",
  "hint": "How the scan was made"
}
```

A facet with no values anywhere is skipped at render. Two are sitting in the
file that way right now:

- `year`, waiting on scan dates. Recording `year` on a few models makes the
  From/To range control appear on its own.
- `area`, waiting on trench and area data.

Neither needs a code change to switch on. Filling in the data is the switch.

## Checking tags

```
python3 tools/build-derivatives.py --tags 3d-gallery/data/models.js
```

Reports the same drift warnings as the drawing archive: a tag written two ways,
stray whitespace, records with no tags, facets declared but unused.

## A note on credit

Sketchfab's terms ask that the model title and its author stay visible wherever
an embed appears. The card renders both from `title`, `author` and `authorUrl`,
so keeping those filled in is not optional.