# Adding drawings to the archive

Replaces `Adding Images to Gallery.pdf`. That process needed three separate
edits per drawing, in three files, with a URL format that did not match what
the site actually used. This one is a single edit plus a script.

## The short version

1. Put the original file in `2d-gallery/media/<year>/`
2. Add a record to `items` in `2d-gallery/data/artworks.js`
3. Run `python3 tools/build-derivatives.py`

Nothing in `index.html` or `gallery.css` needs touching. Both are now empty of
per-image detail.

---

## 1. The original file

Drop it in the folder for the year it was drawn, creating the folder if it does
not exist yet. Undated work goes in `media/unknown/`.

Filenames may contain spaces and commas without breaking anything, since the
gallery no longer references them from CSS. Avoiding both is still worth doing
for anyone who later has to type one into a terminal.

Originals are never modified or moved. They stay full resolution and stay
downloadable from the viewer.

## 2. The record

Open `2d-gallery/data/artworks.js` and add an entry to `items`. A complete one
looks like this:

```js
{
  "id": "se-building-elevation-1989",
  "title": "Southeast Building",
  "file": "1989/ReconstructedElevationS.E.Building,1989.jpg",
  "year": 1989,
  "subject": ["Architecture"],
  "drawingType": ["Elevation", "Reconstruction"],
  "area": ["Southeast Building"],
  "artist": [],
  "note": "Optional. Longer caption, shown in the viewer only."
}
```

| Field | Notes |
| --- | --- |
| `id` | Unique, lowercase, dashes. Stable forever: it appears in the viewer and is what a colleague quotes when reporting a problem. Never reuse or renumber one. |
| `title` | Shown on the card and in the viewer. |
| `file` | Path under `media/`, exactly as on disk. |
| `year` | A number, or `null` when unknown. Not a string. |
| `note` | Optional. |
| `credit` | Optional. Attribution or provenance. |

Every other key is a facet, and holds a list of tags. Omit a facet or leave it
`[]` when the answer is not known; an empty list is honest and costs nothing.

The old `id="img27"` numbering is gone. Order in the file is the "Catalogue
order" sort option and nothing else depends on it, so records can be added
anywhere in the list.

## 3. The script

```
python3 tools/build-derivatives.py
```

It reads every record, works out the pixel dimensions, and writes three WebP
derivatives per drawing into `media/derived/`:

| Derivative | Longest edge | Used for |
| --- | --- | --- |
| `grid` | 480px | the tile on the gallery page |
| `grid@2x` | 960px | the same tile on a high-density screen |
| `view` | 2200px | what the viewer opens |

It then writes `width`, `height` and the derivative paths back into the record.
Those three fields are generated, so hand edits to them get overwritten.

Only stale files are rebuilt, so re-running after adding one drawing takes a
second or two. `--force` rebuilds everything, `--check` reports without writing.

Requires Pillow: `pip install Pillow`.

---

## Adding a new kind of tag

Two edits, both in `data/artworks.js`.

Add an entry to `facets`:

```js
{
  "key": "period",
  "label": "Period",
  "type": "text",
  "hint": "Archaeological phase depicted"
}
```

Then add that key to whichever items have a value:

```js
"period": ["Orientalizing"]
```

That is the whole change. The filter rail picks it up, tags render on the
cards, search covers the new values, and the counts work. No JavaScript, HTML
or CSS edits.

`type` is `"text"` for everything except the single year facet, which is
`"year"` and drives the From/To range control.

A facet with no values anywhere is skipped when the page renders, so a facet
can be declared before the research behind it has been done. `artist` sits in
the file that way now: declared, empty, invisible, and working the moment the
first artist is recorded.

## Checking tags for drift

```
python3 tools/build-derivatives.py --check
```

Warnings appear for the two ways a hand-typed tag list quietly splits in half:

```
warning: subject: same tag written two ways: "Kiln", "kiln"
warning: subject: "Production " has stray whitespace
```

Both would otherwise produce two filters that look identical on screen. Also
flagged: records with no tags at all, and facets declared but never used.

Errors, as opposed to warnings, are duplicate ids, two records pointing at one
file, and records whose file is missing.

The same audit runs against the 3D gallery:

```
python3 tools/build-derivatives.py --tags 3d-gallery/data/models.js
```

## Removing a drawing

Delete its record. The derivatives left behind in `media/derived/` are
harmless; delete the folder and re-run the script to clear them out.
