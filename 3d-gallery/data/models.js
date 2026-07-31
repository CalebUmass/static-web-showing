/*
  models.js - the single truth for the 3D viewer.

  Same shape as 2d-gallery/data/artworks.js: the two galleries run
  on the same filter engine, so what is learned about one applies to the other.

  See shared/docs/GALLERY_ADDING-MODELS.md. Short version: 
     - publish the model on Sketchfab,
     - copy its uid out of the share URL, add a record below.

  FACETS
  ------
  One entry per collapsible group in the filter rail. A facet with no values
  anywhere in `items` is skipped at render time, which is why `year` can sit
  here now and start working the day scan dates get recorded.

  ITEMS
  -----
    id           stable, unique, lowercase-with-dashes. Never reuse.
    title        shown on the card and above the embed
    uid          the 32-character id from the Sketchfab URL
    author       Sketchfab display name of whoever published it
    authorUrl    link to that person's Sketchfab profile
    year         year the model was made, or null
    poster       optional path to a still image under imgs/
                 When absent, the card asks Sketchfab for the model thumbnail
                 and falls back to a plain plate if that request fails.
    <facet>      array of strings, one per tag
    note         optional longer caption
*/

window.MODEL_DATA = {
  schemaVersion: 1,

  facets: [
    {
      key: "year",
      label: "Year",
      type: "year",
      hint: "Year the model was made",
    },
    {
      key: "material",
      label: "Material",
      type: "text",
      hint: "What the object is made of",
    },
    {
      key: "objectType",
      label: "Object type",
      type: "text",
      hint: "What the object is",
    },
    {
      key: "condition",
      label: "Condition",
      type: "text",
    },
    {
      key: "area",
      label: "Area",
      type: "text",
      hint: "Not yet catalogued",
    },
    {
      key: "author",
      label: "Modelled by",
      type: "text",
      hint: "Specialist who produced the scan",
    },
  ],

  items: [
    {
      id: "worked-antler-medium",
      objectID: "",
      title: "Worked Antler Medium",
      uid: "163ab8952fe740e0906e95dda0c5cbb9",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Antler"],
      objectType: ["Worked object"],
      condition: [],
      area: [],
    },
    {
      id: "statuette-fragment",
      objectID: "PC 19820081",
      title: "Statuette Fragment",
      uid: "8b1e4f6cdef744c39ef7ca978c961a26",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: [],
      objectType: ["Statuette"],
      condition: ["Fragment"],
      area: [],
    },
    {
      id: "ceramic-die",
      objectID: "PC 20090248",
      title: "Ceramic Die",
      uid: "04f2a5de08264ae4b5f3b37b85c948b8",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Ceramic"],
      objectType: ["Die"],
      condition: [],
      area: [],
    },
    {
      id: "worked-antler-fragment",
      objectID: "PC 19760181",
      title: "Worked Antler Fragment",
      uid: "7f48eb5ceda04c9b9b8d941d008b7639",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Antler"],
      objectType: ["Worked object"],
      condition: ["Fragment"],
      area: [],
    },
    {
      id: "bronze-pin",
      objectID: "",
      title: "Bronze Pin",
      uid: "8de3fa75b4bb48b3bd75300ee3733f10",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Bronze"],
      objectType: ["Pin"],
      condition: [],
      area: [],
    },
    {
      id: "burnt-bone",
      objectID: "PC 20080011",
      title: "Burnt Bone",
      uid: "6beb690b3c774dd3b4e060cd6565415e",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Bone"],
      objectType: ["Bone"],
      condition: ["Burnt"],
      area: [],
    },
    {
      id: "ivory-head",
      objectID: "",
      title: "Ivory Head",
      uid: "ab8144ccddf44a02b6d215c21722bb3e",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Ivory"],
      objectType: ["Statuette"],
      condition: ["Fragment"],
      area: [],
    },
    {
      id: "possible-infant-humerus",
      objectID: "",
      title: "Possible Infant Humerus",
      uid: "e5e3d7a5a7c74a4aa2efd7ee6615fd8c",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Bone"],
      objectType: ["Human remains"],
      condition: [],
      area: [],
      note: "Identification is provisional.",
    },
    {
      id: "rocchetti-rika",
      objectID: "PC 20090211",
      title: "Rocchetti Rika",
      uid: "b180c5d00938437d8b998f341b938166",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: [],
      objectType: ["Rocchetto"],
      condition: [],
      area: [],
    },
    {
      id: "possible-human-bone",
      objectID: "",
      title: "Possible Human Bone",
      uid: "1de6a8154b4c4b02929281a016abc97f",
      author: ["3Dig"],
      authorUrl: "https://sketchfab.com/jakerstr",
      year: null,
      material: ["Bone"],
      objectType: ["Human remains"],
      condition: [],
      area: [],
      note: "Identification is provisional.",
    },
  ],
};
