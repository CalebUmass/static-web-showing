/*
  artworks.js - the single source of truth for the 2D gallery.

  Everything on the page is built from this file: the grid, the filter rail,
  the tag pills, the search index and the lightbox. Nothing about an artwork is
  stored in index.html or gallery.css any more.

  See shared/docs/GALLERY-ADDING-IMAGES.md for the full walkthrough. Short version:

    1. Drop the original file in media/<year>/  (or media/unknown/)
    2. Add a record to `items` below
    3. Run `python3 tools/build-derivatives.py`

  FACETS
  ------
  Each entry in `facets` becomes one collapsible group in the filter rail.
  Adding a whole new way to tag things is one entry here plus the matching key
  on the items that have a value for it.

    key      the property name to read off each item
    label    heading shown in the rail
    type     "year" for the numeric year facet, "text" for everything else
    hint     optional one-line description, shown under the heading

  A facet with no values anywhere in `items` is skipped at render time, so a
  facet can be declared before the research to fill it in has been done.

  ITEMS
  -----
    id        stable, unique, lowercase-with-dashes. Never reuse or renumber.
    title     shown on the card and in the viewer
    caption   a sentence or two explaining the drawing, shown in the viewer
              under the title. Leave as "" when there is nothing to say: the
              paragraph is hidden entirely rather than left blank, so an
              uncaptioned record does not look like it lost its text.
    file      path under media/, exactly as it sits on disk
    year      number, or null when unknown
    <facet>   array of strings, one per tag. Omit or leave [] when unknown.
    credit    optional line of attribution or provenance

  `width`, `height` and `derived` are filled in automatically by
  tools/build-derivatives.py. Leave them alone.
*/

window.GALLERY_DATA = {
  "schemaVersion": 1,
  "facets": [
    {
      "key": "year",
      "label": "Year",
      "type": "year",
      "hint": "Year the drawing was made"
    },
    {
      "key": "subject",
      "label": "Subject",
      "type": "text",
      "hint": "What the drawing depicts"
    },
    {
      "key": "drawingType",
      "label": "Drawing type",
      "type": "text",
      "hint": "How the subject is rendered"
    },
    {
      "key": "area",
      "label": "Area",
      "type": "text",
      "hint": "Structure or part of the site"
    },
    {
      "key": "artist",
      "label": "Artist",
      "type": "text",
      "hint": "Not yet catalogued for most drawings"
    }
  ],
  "items": [
    {
      "id": "mm-22-10",
      "title": "Alphabet",
      "caption": "",
      "file": "2022/MM-22-10-1.png",
      "year": 2022,
      "subject": ["Alphabet", "Inscription"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 1563,
      "height": 2200,
      "derived": {
        "grid": "derived/2022-mm-22-10-1.grid.webp",
        "grid@2x": "derived/2022-mm-22-10-1.grid-2x.webp",
        "view": "derived/2022-mm-22-10-1.view.webp"
      }
    },
    {
      "id": "mm-22-9",
      "title": "Misc Drawing",
      "caption": "",
      "file": "2022/MM-22-9-1.png",
      "year": 2022,
      "subject": [],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 1700,
      "height": 1073,
      "derived": {
        "grid": "derived/2022-mm-22-9-1.grid.webp",
        "grid@2x": "derived/2022-mm-22-9-1.grid-2x.webp",
        "view": "derived/2022-mm-22-9-1.view.webp"
      }
    },
    {
      "id": "floreak-cheese-making",
      "title": "Cheese Making Illustration",
      "caption": "",
      "file": "2022/FloreakCheeseMakingIllustration-1.png",
      "year": 2022,
      "subject": ["Cheese making", "Daily life"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 1567,
      "height": 2200,
      "derived": {
        "grid": "derived/2022-floreakcheesemakingillustration-1.grid.webp",
        "grid@2x": "derived/2022-floreakcheesemakingillustration-1.grid-2x.webp",
        "view": "derived/2022-floreakcheesemakingillustration-1.view.webp"
      }
    },
    {
      "id": "alphabet-rough-sketch",
      "title": "Alphabet Rough Sketch",
      "caption": "",
      "file": "2022/alphabetroughsketch-1.png",
      "year": 2022,
      "subject": ["Alphabet", "Inscription"],
      "drawingType": ["Sketch"],
      "area": [],
      "artist": [],
      "width": 1700,
      "height": 1888,
      "derived": {
        "grid": "derived/2022-alphabetroughsketch-1.grid.webp",
        "grid@2x": "derived/2022-alphabetroughsketch-1.grid-2x.webp",
        "view": "derived/2022-alphabetroughsketch-1.view.webp"
      }
    },
    {
      "id": "roof-reconstruction-c",
      "title": "Roof Reconstruction",
      "caption": "",
      "file": "2018/RoofReconstructionC.JPG",
      "year": 2018,
      "subject": ["Roof"],
      "drawingType": ["Reconstruction"],
      "area": [],
      "artist": [],
      "width": 5076,
      "height": 3258,
      "derived": {
        "grid": "derived/2018-roofreconstructionc.grid.webp",
        "grid@2x": "derived/2018-roofreconstructionc.grid-2x.webp",
        "view": "derived/2018-roofreconstructionc.view.webp"
      }
    },
    {
      "id": "pathway-illustration",
      "title": "Pathway",
      "caption": "",
      "file": "2018/PathwayIllustration.jpg",
      "year": 2018,
      "subject": ["Pathway"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 7014,
      "height": 4962,
      "derived": {
        "grid": "derived/2018-pathwayillustration.grid.webp",
        "grid@2x": "derived/2018-pathwayillustration.grid-2x.webp",
        "view": "derived/2018-pathwayillustration.view.webp"
      }
    },
    {
      "id": "mm2018-weaving",
      "title": "Weaving",
      "caption": "",
      "file": "2018/MM2018llustrationWeaving.jpg",
      "year": 2018,
      "subject": ["Weaving", "Textiles", "Daily life"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 6600,
      "height": 5100,
      "derived": {
        "grid": "derived/2018-mm2018llustrationweaving.grid.webp",
        "grid@2x": "derived/2018-mm2018llustrationweaving.grid-2x.webp",
        "view": "derived/2018-mm2018llustrationweaving.view.webp"
      }
    },
    {
      "id": "mm2018-women",
      "title": "Women",
      "caption": "",
      "file": "2018/MM2018IllustrationWomen.jpg",
      "year": 2018,
      "subject": ["Figures", "Daily life"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 7014,
      "height": 4962,
      "derived": {
        "grid": "derived/2018-mm2018illustrationwomen.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationwomen.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationwomen.view.webp"
      }
    },
    {
      "id": "mm2018-loom",
      "title": "Loom",
      "caption": "",
      "file": "2018/MM2018IllustrationLoom.jpg",
      "year": 2018,
      "subject": ["Loom", "Weaving", "Textiles"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 6600,
      "height": 5100,
      "derived": {
        "grid": "derived/2018-mm2018illustrationloom.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationloom.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationloom.view.webp"
      }
    },
    {
      "id": "mm2018-kilns",
      "title": "Kilns",
      "caption": "",
      "file": "2018/MM2018IllustrationKilns.jpg",
      "year": 2018,
      "subject": ["Kiln", "Production"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 7014,
      "height": 4962,
      "derived": {
        "grid": "derived/2018-mm2018illustrationkilns.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationkilns.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationkilns.view.webp"
      }
    },
    {
      "id": "mm2018-infill-of-well",
      "title": "Infill of Well",
      "caption": "",
      "file": "2018/MM2018IllustrationInfillofWell.jpg",
      "year": 2018,
      "subject": ["Well"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 6600,
      "height": 5100,
      "derived": {
        "grid": "derived/2018-mm2018illustrationinfillofwell.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationinfillofwell.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationinfillofwell.view.webp"
      }
    },
    {
      "id": "mm2018-epoc4-b",
      "title": "EPOC 4",
      "caption": "",
      "file": "2018/MM2018IllustrationEPOC42.jpg",
      "year": 2018,
      "subject": ["EPOC 4"],
      "drawingType": ["Illustration"],
      "area": ["EPOC"],
      "artist": [],
      "width": 7014,
      "height": 4962,
      "derived": {
        "grid": "derived/2018-mm2018illustrationepoc42.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationepoc42.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationepoc42.view.webp"
      }
    },
    {
      "id": "mm2018-epoc4-a",
      "title": "EPOC 4",
      "caption": "",
      "file": "2018/MM2018IllustrationEPOC4.jpg",
      "year": 2018,
      "subject": ["EPOC 4"],
      "drawingType": ["Illustration"],
      "area": ["EPOC"],
      "artist": [],
      "width": 6600,
      "height": 5100,
      "derived": {
        "grid": "derived/2018-mm2018illustrationepoc4.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationepoc4.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationepoc4.view.webp"
      }
    },
    {
      "id": "mm2018-domestic-architecture",
      "title": "Domestic Architecture",
      "caption": "",
      "file": "2018/MM2018IllustrationDomesticArchitecture.jpg",
      "year": 2018,
      "subject": ["Architecture", "Daily life"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 6600,
      "height": 5100,
      "derived": {
        "grid": "derived/2018-mm2018illustrationdomesticarchitecture.grid.webp",
        "grid@2x": "derived/2018-mm2018illustrationdomesticarchitecture.grid-2x.webp",
        "view": "derived/2018-mm2018illustrationdomesticarchitecture.view.webp"
      }
    },
    {
      "id": "kiln-reconstruction",
      "title": "Kiln Reconstruction",
      "caption": "",
      "file": "2018/KilnReconstruction.JPG",
      "year": 2018,
      "subject": ["Kiln", "Production"],
      "drawingType": ["Reconstruction"],
      "area": [],
      "artist": [],
      "width": 5498,
      "height": 3861,
      "derived": {
        "grid": "derived/2018-kilnreconstruction.grid.webp",
        "grid@2x": "derived/2018-kilnreconstruction.grid-2x.webp",
        "view": "derived/2018-kilnreconstruction.view.webp"
      }
    },
    {
      "id": "wolf-drawing",
      "title": "Wolf",
      "caption": "",
      "file": "2015/WolfDrawing.jpg",
      "year": 2015,
      "subject": ["Animals"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 6614,
      "height": 4680,
      "derived": {
        "grid": "derived/2015-wolfdrawing.grid.webp",
        "grid@2x": "derived/2015-wolfdrawing.grid-2x.webp",
        "view": "derived/2015-wolfdrawing.view.webp"
      }
    },
    {
      "id": "section-orientalizing-archaic-1995",
      "title": "Orientalizing and Archaic Phases",
      "caption": "Section through the Orientalizing and Archaic phases.",
      "file": "1995/Section-OrientalizingandArchaicPhases,1995.jpg",
      "year": 1995,
      "subject": ["Stratigraphy", "Architecture"],
      "drawingType": ["Section"],
      "area": [],
      "artist": [],
      "width": 10797,
      "height": 5419,
      "derived": {
        "grid": "derived/1995-section-orientalizingandarchaicphases-1995.grid.webp",
        "grid@2x": "derived/1995-section-orientalizingandarchaicphases-1995.grid-2x.webp",
        "view": "derived/1995-section-orientalizingandarchaicphases-1995.view.webp"
      }
    },
    {
      "id": "reconstruction-upper-building-1995",
      "title": "Upper Building",
      "caption": "",
      "file": "1995/ReconstructionUpperBuilding,1995.jpg",
      "year": 1995,
      "subject": ["Architecture"],
      "drawingType": ["Reconstruction"],
      "area": ["Upper Building"],
      "artist": [],
      "width": 10797,
      "height": 7098,
      "derived": {
        "grid": "derived/1995-reconstructionupperbuilding-1995.grid.webp",
        "grid@2x": "derived/1995-reconstructionupperbuilding-1995.grid-2x.webp",
        "view": "derived/1995-reconstructionupperbuilding-1995.view.webp"
      }
    },
    {
      "id": "mm94-06",
      "title": "Structure",
      "caption": "",
      "file": "1994/MM94-06.jpg",
      "year": 1994,
      "subject": ["Architecture"],
      "drawingType": ["Reconstruction"],
      "area": [],
      "artist": [],
      "width": 10797,
      "height": 6161,
      "derived": {
        "grid": "derived/1994-mm94-06.grid.webp",
        "grid@2x": "derived/1994-mm94-06.grid-2x.webp",
        "view": "derived/1994-mm94-06.view.webp"
      }
    },
    {
      "id": "mm94-04",
      "title": "Structure Roof",
      "caption": "",
      "file": "1994/MM94-04.jpg",
      "year": 1994,
      "subject": ["Roof", "Architecture"],
      "drawingType": ["Reconstruction"],
      "area": [],
      "artist": [],
      "width": 10797,
      "height": 9291,
      "derived": {
        "grid": "derived/1994-mm94-04.grid.webp",
        "grid@2x": "derived/1994-mm94-04.grid-2x.webp",
        "view": "derived/1994-mm94-04.view.webp"
      }
    },
    {
      "id": "mm94-02",
      "title": "Antefix",
      "caption": "",
      "file": "1994/MM94-02.jpg",
      "year": 1994,
      "subject": ["Antefix", "Terracotta"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 8209,
      "height": 5906,
      "derived": {
        "grid": "derived/1994-mm94-02.grid.webp",
        "grid@2x": "derived/1994-mm94-02.grid-2x.webp",
        "view": "derived/1994-mm94-02.view.webp"
      }
    },
    {
      "id": "mm94-01",
      "title": "Antefix",
      "caption": "",
      "file": "1994/MM94-01.jpg",
      "year": 1994,
      "subject": ["Antefix", "Terracotta"],
      "drawingType": ["Illustration"],
      "area": [],
      "artist": [],
      "width": 18303,
      "height": 3380,
      "derived": {
        "grid": "derived/1994-mm94-01.grid.webp",
        "grid@2x": "derived/1994-mm94-01.grid-2x.webp",
        "view": "derived/1994-mm94-01.view.webp"
      }
    },
    {
      "id": "se-building-section-1989",
      "title": "Southeast Building",
      "caption": "",
      "file": "1989/ReconstructedSection1S.E.Building,1989.jpg",
      "year": 1989,
      "subject": ["Architecture"],
      "drawingType": ["Section", "Reconstruction"],
      "area": ["Southeast Building"],
      "artist": [],
      "width": 6073,
      "height": 4419,
      "derived": {
        "grid": "derived/1989-reconstructedsection1s-e-building-1989.grid.webp",
        "grid@2x": "derived/1989-reconstructedsection1s-e-building-1989.grid-2x.webp",
        "view": "derived/1989-reconstructedsection1s-e-building-1989.view.webp"
      }
    },
    {
      "id": "se-building-roof-1989-a",
      "title": "Southeast Building Roof",
      "caption": "",
      "file": "1989/ReconstructedRoofElementsS.E.Building,Version2-1989.jpg",
      "year": 1989,
      "subject": ["Roof", "Terracotta"],
      "drawingType": ["Reconstruction"],
      "area": ["Southeast Building"],
      "artist": [],
      "width": 9025,
      "height": 5111,
      "derived": {
        "grid": "derived/1989-reconstructedroofelementss-e-building-version2-1989.grid.webp",
        "grid@2x": "derived/1989-reconstructedroofelementss-e-building-version2-1989.grid-2x.webp",
        "view": "derived/1989-reconstructedroofelementss-e-building-version2-1989.view.webp"
      }
    },
    {
      "id": "se-building-roof-1989-b",
      "title": "Southeast Building Roof",
      "caption": "",
      "file": "1989/ReconstructedRoofElementsS.E.Building,Version2-1989-2.jpg",
      "year": 1989,
      "subject": ["Roof", "Terracotta"],
      "drawingType": ["Reconstruction"],
      "area": ["Southeast Building"],
      "artist": [],
      "width": 6201,
      "height": 8187,
      "derived": {
        "grid": "derived/1989-reconstructedroofelementss-e-building-version2-1989-2.grid.webp",
        "grid@2x": "derived/1989-reconstructedroofelementss-e-building-version2-1989-2.grid-2x.webp",
        "view": "derived/1989-reconstructedroofelementss-e-building-version2-1989-2.view.webp"
      }
    },
    {
      "id": "se-building-elevation-1989",
      "title": "Southeast Building",
      "caption": "",
      "file": "1989/ReconstructedElevationS.E.Building,1989.jpg",
      "year": 1989,
      "subject": ["Architecture"],
      "drawingType": ["Elevation", "Reconstruction"],
      "area": ["Southeast Building"],
      "artist": [],
      "width": 8777,
      "height": 5676,
      "derived": {
        "grid": "derived/1989-reconstructedelevations-e-building-1989.grid.webp",
        "grid@2x": "derived/1989-reconstructedelevations-e-building-1989.grid-2x.webp",
        "view": "derived/1989-reconstructedelevations-e-building-1989.view.webp"
      }
    }
  ]
};