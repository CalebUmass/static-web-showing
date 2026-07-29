# Adding the thumbnail card to the Object Finder

Reference for the thumbnail preview task. The API side is finished; everything
below happens in the three files inside `mag-search/`.

## Goal

When an object is found, a second glass card appears to the right of the
location card showing a thumbnail of the object, pulled from Open Context. If
the sheet has no image for that object, or the image fails to load, one of four
placeholder images shows instead.

```
        +------------------------+   +----------------+
        |   Object Located       |   |   Preview      |
        |   PC 20170001          |   |                |
        |   Research: Scaff. 03  |   |   [ image ]    |
        |   Cass. 55             |   |                |
        |   [View in Open Ctx]   |   +----------------+
        |   [Copy]               |
        +------------------------+
```

## Files involved

| File | Role |
| --- | --- |
| `index.html` | markup for the new card |
| `cassetteFinderStyling.css` | side by side layout, card and image sizing |
| `cassetteFinder.js` | filling the card in when a result renders |

No build step and no server restart. These are static files: copy them up, then
hard-refresh the browser (Ctrl-Shift-R) to get past the cache.

## Running a local copy

Opening `index.html` by double-clicking it will not work. The page asks the
server for results at `/api/cassetta`, and a file opened straight from disk has
no server behind it, so every search fails and no result card ever renders.

`mock-api.js` solves this. It serves the folder and answers those same requests
with invented data, so the page runs with no credentials, no internet, and no
connection to the live site. It needs Node and nothing else. Check whether Node
is already installed:

```
node --version
```

Anything v18 or newer is fine. If the command is not found, install it from
nodejs.org.

Then, from inside the `mag-search` folder:

```
node mock-api.js
```

and open <http://localhost:8000>. Stop it later with Ctrl-C.

Editing a file and saving it is enough to see the change; the mock tells the
browser not to cache anything, so a normal refresh picks it up. The
Ctrl-Shift-R habit only matters against the real server.

### Catalog numbers the mock knows

The fake data covers the cases that are awkward to find in the real sheets.
These are printed at startup as a reminder.

| Number | What it exercises |
| --- | --- |
| `PC 20170001` | ordinary result, one location, has a thumbnail |
| `PC 19720072` | no image in the sheet, so a placeholder shows |
| `PC 19880101` | listed in two places, and only the second has an image |
| `PC 20090211` | relocated and has a thumbnail, to check they do not collide |
| `PC 19850003` | image url is broken, to check the error fallback |
| `PC 99999999` | not found |

The third and fifth rows are worth attention. They are the two cases most
likely to be got wrong, and the two least likely to turn up by accident when
testing against real data.

### The other option

Since the live API allows cross-origin requests, pointing the local page at the
real server also works: change the `API_BASE` value at the top of
`cassetteFinder.js` to the full live URL rather than the relative path. That
gives real data, at the cost of needing the internet and hitting production on
every search.

If that route is taken, **revert the change before committing**. A live URL left
in `API_BASE` breaks the deployed page in a way that looks like a server fault.

Running the real API locally is not worth attempting. It needs the Google
service account key, which should not be copied onto extra machines.

## What the API already sends

A search hits `/api/cassetta/find` and gets back JSON like this:

```json
{
  "number": "PC 20170001",
  "found": true,
  "matches": [
    {
      "scaff": "Scaff. 03 Internal Mag Inventory",
      "cass": "Cass. 55",
      "folder": "Catalog / Research Mag Scaffale",
      "link": "https://opencontext.org/subjects/...",
      "img": "https://opencontext.org/media/..."
    }
  ],
  "indexedAt": 1753800000000
}
```

`img` is column E of the inventory sheets. It is **absent** when that cell is
empty, so `match.img` is `undefined` most of the time until the column gets
filled in. That is expected, and it means the placeholder path is the one that
will be exercised first.

`matches` is an array because an object can be listed in more than one cassetta.

## Helpers that already exist

Three things are already written in `cassetteFinder.js`, in a section marked
`thumbnails`. Nothing calls them yet; wiring them up is part of the task.

- `FALLBACK_IMAGES`, an array of the four placeholder filenames
- `thumbnailFor(match)`, which returns that match's image url, or a random
  placeholder when the match has no `img`
- `useFallbackImage(imgEl)`, which swaps a placeholder into an `img` element
  that failed to load

---

## Step 1: the placeholder images

Add four images to the `mag-search/` folder. Anything works as long as they read
as "no preview available" rather than looking like real objects.

Then update `FALLBACK_IMAGES` with the real filenames, **including the file
extension**. The names sitting in that array now are placeholders with no
extension, so nothing will resolve until they are replaced. This is the first
thing to fix, and skipping it looks like broken fallback logic rather than
wrong filenames.

## Step 2: the markup

In `index.html`, find the Output Section. `foundCard` and `notFoundCard`
currently sit as siblings directly inside `#output`.

`#output` is a vertical column (`flex-direction: column` in the CSS), so
anything added as another sibling lands *below* rather than beside. Two cards
side by side means wrapping them in a row container first.

What the markup needs:

- A wrapper element around `foundCard` and the new card, carrying the class
  `result-row`. This wrapper is what the CSS below turns into a row.
- A new card inside that wrapper, with the class `glass-card thumb-card` so it
  picks up the shared glass look, plus an id of `thumbCard` for the JavaScript
  to find.
- Inside the new card, a heading styled like the other card titles, and an
  `img` element with an id of `objectThumb`. Give the `img` an empty `alt`
  attribute for now; the JavaScript fills it in per object.
- `notFoundCard` stays outside the wrapper, exactly where it is.

Have the new card start hidden, matching how `foundCard` already does it. With
both cards hidden the wrapper has no visible children and collapses to nothing,
so no extra JavaScript is needed to manage the wrapper itself.

## Step 3: the styling

Add to `cassetteFinderStyling.css`, in the Output Page section.

**Put these rules after the `.glass-card` rule, not before.** `.glass-card` sets
`padding: 40px`, and with equal specificity whichever comes last in the file
wins. A `.thumb-card` rule placed above it will silently lose its padding.

```css
/*#output is a column, so the side by side pair needs its own row wrapper*/
.result-row {
    display: flex;
    align-items: flex-start; /*each card keeps its own height*/
    justify-content: center;
    gap: 30px;
    max-width: 100%;
}

.thumb-card {
    width: 300px;
    padding: 24px;
    text-align: center;
    flex-shrink: 0; /*stops the card being squeezed by a tall location card*/
    display: flex;
    flex-direction: column;
    gap: 18px;
}

#objectThumb {
    display: block;
    width: 100%;
    height: auto; /*keeps the aspect ratio whatever Open Context sends*/
    border-radius: 16px;
}
```

Then let the pair stack on narrow screens. There is already a
`@media (max-width: 560px)` block at the bottom of the file, but two cards side
by side run out of room well before a phone width, so this needs its own
breakpoint:

```css
@media (max-width: 900px) {
    .result-row {
        flex-direction: column;
        align-items: center;
    }
}
```

Colors worth reusing rather than inventing: `#166b53` (green text), `#d5d8cb`
(pale background), `#8a3b2e` (rust, used for problems and warnings).

## Step 4: the JavaScript

All of this goes in `renderResult(display, matches)`, which already has an
`if (found) { ... } else { ... }` structure. The `objectLinks` block just above
is a close model for what is needed here.

In the found branch:

- Show the thumbnail card by setting its `style.display` to `"flex"`, not
  `"block"`. The `.thumb-card` rule uses flex for its internal layout, and
  `block` breaks that spacing without producing any console error.
- Pick which match supplies the image. A thumbnail belongs to the object rather
  than to a shelf location, so the first match that carries an `img` should win,
  falling back to the first match overall when none do. The existing
  `objectLinks` code does exactly this for the Open Context link and can be
  copied in shape.
- Attach the error handler **before** setting `src`. A fast or cached failure
  can fire before a later-attached handler exists, and then no placeholder ever
  appears. The handler should call `useFallbackImage` on the element that
  failed.
- Set `src` from `thumbnailFor`, passing the match chosen above.
- Set a meaningful `alt` including the catalog number, since a screen reader
  otherwise announces nothing useful.

In the else branch, hide the thumbnail card again the same way `foundCard` gets
hidden. Without this, a thumbnail from a previous search stays on screen next to
a Not Found card.

## Step 5: checking the work

Against the real server, column E is (i think) still empty in the sheets, every
search shows a placeholder. That is correct behavior. The mock is the
faster way to see both paths, since its data covers them deliberately.

Things worth confirming, with the mock number that exercises each:

1. `PC 20170001` shows two cards side by side, aligned at the top, with the
   sample image in the right-hand one.
2. `PC 19720072` shows a placeholder instead, and the placeholder varies between
   searches since it is picked at random.
3. `PC 19880101` pulls its thumbnail from the second location, the only one
   carrying an image. A blank card here means the code is looking only at the
   first match.
4. `PC 20090211` shows the relocation notice and the thumbnail together without
   either crowding the other.
5. `PC 19850003` falls back to a placeholder rather than showing a broken image
   icon.
6. `PC 99999999` shows only the Not Found card, with no empty gap where the
   thumbnail row would be.
7. Searching again after a found result does not leave a stale image behind.
8. Narrowing the browser window stacks the cards instead of overflowing.

## Things that will trip you up

**Browser caching.** A plain refresh often keeps serving the old JS and CSS. Use
Ctrl-Shift-R, or open the dev tools Network tab and tick "Disable cache".

**CSS rule order.** Covered above, and worth repeating because it fails
silently: `.glass-card` sets padding, so anything meant to override it belongs
later in the file.

**Duplicate ids.** `id="bg-container"` already appears twice in the HTML, once
per page. That is inherited from an older template and technically invalid.
Avoid adding to the problem: every new id here should be unique.

**`display: none` vs the flex layout.** Both cards toggle between `none` and
`flex`. Setting one to `block` by accident breaks its internal spacing without
any error in the console.

## When it is working

The three files go in `mag-search/` on the server, or through the repo with a
`git pull`. Nothing needs compiling and the API does not need restarting. A
hard refresh is enough to see the change.

`mock-api.js` is a development tool. It can live in the repo alongside the other
files, but it is never run on the server and the live site ignores it.