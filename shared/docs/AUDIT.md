# Audit of the 2D gallery, and what changed

Findings from reviewing `index.html` (934 lines, with all JavaScript inline),
`style.css`, `Adding Images to Gallery.pdf` and the 26 files in `media/`.

Worth saying first: the original works. Filtering, sorting, searching, a year
range and a lightbox all function, written by one student against no framework.
Most of what follows is structural, and the structure is what made adding a
27th drawing hard rather than anything being wrong with the ideas.

---

## 1. Loading

### Every full-resolution file was fetched at startup

The 26 originals total **89.2 MB**, between 5 and 100 megapixels each. The
largest is 18303 x 3380.

Each was referenced twice: once as `href` on an `<a>` for the lightbox, and
once as a `background-image` rule in `style.css`.

```css
#img1 {
    background-image: url("./media/2022/MM-22-10-1.png");
    background-size: cover;
}
```

A CSS background on an element that is in the DOM and not `display: none` is
fetched eagerly. All 26 elements were in the DOM at load, so the browser
downloaded and decoded all 89.2 MB in order to paint tiles 400px tall. On a
conference wifi connection that is a minute or more of blank cards, and the
decode cost alone will stall a phone.

**Fixed.** `tools/build-derivatives.py` generates WebP derivatives at three
sizes. The grid loads the 480px version with a 960px `srcset` for retina, and
the viewer loads a 2200px version one image at a time.

| | Before | After |
| --- | --- | --- |
| Initial page load | 89.2 MB | **0.3 MB** |
| All derivatives on disk | n/a | 5.5 MB |
| Originals on disk | 89.2 MB | 89.2 MB, untouched |

Images also now carry `loading="lazy"`, `decoding="async"` and explicit
`width`/`height`, so tiles below the fold cost nothing and the grid does not
shift as they arrive.

Originals stay exactly where they were and are still reachable, through a
"Full resolution" link in the viewer.

### The 3D gallery had the same problem in a different form

Ten Sketchfab `<iframe>` embeds, all loading at once. Each is a live WebGL
scene with its own textures and its own GPU context. Browsers cap concurrent
WebGL contexts and start discarding the oldest, so on a laptop the page was
heavy and on a phone some models would silently fail to draw.

**Fixed.** Cards render as a still image with a "Load model" cue and swap
themselves for the real embed when picked. Zero iframes at load.

---

## 2. Structure

### Each drawing lived in three places

Adding one drawing meant three edits in two files:

1. an `<a>` with `href`, `id="img27"`, `data-toggle` and `data-gallery`
2. a `<p>` inside it holding the caption, which doubled as the tag data
3. a `#img27` rule in `style.css` repeating the same path

The PDF documented all three, and carried a fourth trap: it instructs

```
"/static-web-showing/Lightbox-Gallery/media/the name of the file's folder/your file name"
```

while the HTML actually used `./media/...`. Following the PDF exactly produces
a broken image on a local checkout.

**Fixed.** One record in `data/artworks.js`, then run the script. `index.html`
and `gallery.css` contain nothing about any specific drawing.

### Tags were parsed out of a display string

The whole tag system read `<p>Kilns, 2018</p>`, split it on the comma, and used
an `index` attribute on each filter to pick which fragment became a tag:

```html
<div class="accordion-item filter" id="Year" index="-1">
<div class="accordion-item filter" id="Trench" index="0">
```

Three consequences, all of which the brief asks to lift:

- **Only ever two facets.** A caption has two comma-separated parts, so there
  are two possible tag groups. Artist, area, subject and medium have nowhere to
  live.
- **One tag per facet per image.** A drawing that is both a loom and a textile
  subject cannot say so.
- **Substring collisions.** Matching ran `text.includes(pillId)` against the
  whole caption, so a pill named `2018` matched any caption containing "2018"
  anywhere, including inside a title.

**Fixed.** Facets are declared in the data file. Adding one is a single entry
plus that key on the items that have a value, with no code change. Values are
compared exactly rather than by substring.

---

## 3. Bugs

Listed roughly by how much they cost a visitor.

### The filters did not compose, and the help modal explained that instead

The modal spent a paragraph on it:

> Please note that not all features are compatible with each other. The filter
> year by range sliders will ignore any of the other filters you select in the
> sidebar, as well as any searches you have made. Using the search bar will
> also override any filters you have selected. Filters, similarly, override the
> searchbar. [...] If you want to apply filters but have already adjusted the
> range slider, you should click restore defaults prior to applying any
> filters.

That is documentation standing in for a fix. Each control cleared the others
on the way in: `searchImages()` wiped the pills, `filterYearwithSlider()` wiped
the pills and the search box, and `filteringImages()` ignored the pills
entirely whenever the slider had moved.

**Fixed.** Search, facets and the year range all apply together. Within a facet
the values OR, across facets they AND. The help text for it is gone because
there is nothing left to warn about.

### Tags were invisible until searched for

```css
.pill {
    visibility: hidden;
    height: 0;
}
```

Pills only became visible once a search term matched them, or once activated.
Since a pill's text was the only way to find it, the sidebar could not be
browsed: the visitor had to already know a tag existed in order to type enough
of it to reveal it. On first load both filter groups looked empty.

**Fixed.** All values render, grouped, with a count beside each.

### Sorting was wired to an event that cannot fire

```js
const sortSelect = document.getElementById('sortSelect');
sortSelect.addEventListener('change', () => { ... });
```

`#sortSelect` is a `<div>`. `change` fires on form controls, not on divs, so
this listener never ran once. Sorting worked only through the separate inline
`onclick="sortImages('yearasc')"` handlers on each button, which meant the
`'default'` branch inside the dead listener was unreachable too.

The Default button instead did:

```html
onclick="window.location.reload()"
```

A full reload discards the visitor's filters and search, and re-downloads all
89.2 MB.

**Fixed.** A real `<select>`, with catalogue order restored in place.

### Pill ids were built from tag text

```js
newTag.id = `${tag}`;
```

That produced `id="EPOC 4"` (a space) and `id="2022"` (a leading digit). Both
are unusable with `querySelector`, since `#EPOC 4` parses as a descendant
selector and `#2022` is not a valid identifier at all. The code survived only
because it used `getElementById` throughout, which is more permissive. Any
later maintainer reaching for `querySelector` would have hit it.

There was also no guard against two facets generating the same id.

**Fixed.** Values are carried in `data-facet` and `data-value` attributes. No
generated ids.

### The unknown-year branch was dead code

```js
try {
    let testingifYear = parseInt(tag);
    newTag.id = `${tag}`;
} catch (error) {
    newTag.id = "Unknown";
}
```

`parseInt` returns `NaN` for unparseable input. It does not throw. The `catch`
could never run, so an undated drawing would have produced a pill labelled
`NaN` rather than "Unknown". The condition never triggered in practice only
because every drawing in `media/` happens to be dated, and `media/unknown/`
was empty.

**Fixed.** `year` is `null` for undated work, with an "Include undated"
checkbox that appears only when undated records exist.

### The accordion expand icons never rendered

```css
background-image: url("data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' ...");
```

The SVG namespace is `http://www.w3.org/2000/svg`. Not a URL to be upgraded:
an exact string constant. Data URIs are parsed as XML, so `https://` makes the
document malformed and the plus and minus markers silently did not draw.

The same wrong namespace appears on every inline `<svg>` in both projects. In
HTML those are parsed leniently and did render, so this one is latent rather
than visible, but it breaks the moment any of that markup is served as XHTML or
processed by an XML tool.

**Fixed.** Correct namespace throughout, and the rail's marker is drawn with
two CSS pseudo-elements rather than a data URI.

### Bootstrap CSS and JS were different versions

```html
<link href=".../bootstrap@5.3.7/dist/css/bootstrap.min.css">
<script src=".../bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js">
```

5.3.7 styling against 5.0.2 behaviour. Nothing was visibly broken, but the
component JavaScript and the CSS it targets are versioned together for a
reason.

### Smaller ones

- `restoreDefaults()` reset the pills, sliders and search fields, but not the
  `isActive` and `hasActive` classes it had put on the accordions. After a
  reset, `getCount()` still counted those accordions as active.
- The slider set `slider--active` on `#containSlider`, but the stylesheet
  targeted `.containSlider`, a class no element has. The rule never applied.
- The year slider ran 1950 to 2050 with defaults of 1975 and 2025, against data
  spanning 1989 to 2022. Roughly half the track was unreachable years, and the
  1975 default sat below every record.
- `.image-item p { visibility: hidden }` meant the caption existed purely as a
  data store. No drawing had a visible label, and since the `<a>` contained no
  `<img>`, none had alt text either. Screen readers got 26 empty links.
- `matchCount` in `filterPills` was incremented and never read.
- `</br>` is not valid HTML. The tag is `<br>`.
- `filterYearwithSlider()` read the year from `splitDescription[1]`, so the
  range control depended on captions being written with exactly one comma. A
  title containing a comma would have broken it.
- The home link points at `../projects/all/`, which does not exist in the
  repository. Left as-is, since it presumably resolves once deployed.

---

## 4. Accessibility

- 26 links containing no text and no image, so no accessible name.
- Filter pills were `<button>` elements with no `aria-pressed`, so their
  on/off state was invisible to assistive technology.
- No skip link, and no visible focus styling beyond the browser default, which
  several rules suppressed.
- The lightbox trapped nothing and restored focus nowhere.

**Fixed.** Every image has alt text, tags are `aria-pressed` buttons, there is
a skip link, focus is visible throughout, and the viewer returns focus to
whatever opened it and closes on Escape.

---

## 5. What was rewritten rather than patched

Two calls worth flagging, both larger than "fix the bug".

**Bootstrap and bs5-lightbox were removed rather than upgraded.** That
resolved the version mismatch, dropped two CDN dependencies and roughly 250 KB,
and made a shared stylesheet across both galleries possible, since the 3D
gallery was already plain CSS with custom properties. The replacement lightbox
is about 80 lines. If keeping Bootstrap matters for familiarity, it can go
back.

**All JavaScript moved out of `index.html`.** It was 520 lines of inline
`<script>` split across seven blocks, several of which existed only to hold
comments describing constants declared in a different block. It is now three
files, two of them shared with the 3D gallery.

**The year range slider became two From/To dropdowns.** The dual-handle slider
was the buggiest control on the page and the one that forced every other filter
to stand down. Two selects populated from the years actually present are less
striking, but they compose with everything, work from the keyboard, and have no
failure modes. This is the one change that is a downgrade in visual interest,
and it is deliberate.

---

## 6. Data left as-is

Tags were only filled in where the source material supports it. `subject`,
`drawingType` and `area` come from the existing captions. `artist` is declared
as a facet and left empty on every record, because nothing in the project says
who drew any of these.

An empty facet is skipped when the page renders, so `artist` is invisible right
now and will appear on its own once the first artist is recorded. No code
change needed. Same arrangement for `year` and `area` in the 3D gallery.

Two 2018 records share the title "EPOC 4" and two 1989 records share
"Southeast Building Roof". Both pairs are genuinely different drawings and have
been given distinct ids, but they will look like duplicates in the grid until
someone who knows the material can differentiate the titles.
