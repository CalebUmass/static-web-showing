/*
Mag map highlighting.

Draws an SVG overlay on top of the mag map image to show where a found object
lives. One image plus coordinates, rather than one image per scaffolding, so a
new shelf means adding a line to MAG_MAP_AREAS below and nothing else.

Coordinates are normalized: each entry is [x, y, width, height] as a fraction
of the image width and height. That way a re-export of the map at a different
resolution keeps working without touching this file, and only a change to the
floor plan itself needs new numbers.

To regenerate after the map is redrawn, open magmap-calibrate.html, load the
new image, drag boxes over the shelves, and paste the output over the table
below.
*/

//extracted from magmap.PNG by colour and checked against the drawing.
const MAG_MAP_AREAS = {
    "1": [0.43357, 0.00000, 0.04536, 0.06500],
    "2": [0.43357, 0.07672, 0.04536, 0.07672],
    "3": [0.43357, 0.16569, 0.04536, 0.18434],
    "4": [0.43357, 0.36281, 0.04536, 0.19552],
    "5": [0.56286, 0.68087, 0.06929, 0.07405],
    "6": [0.64071, 0.68141, 0.19714, 0.07352],
    "7": [0.84679, 0.68141, 0.06036, 0.07352],
    "8": [0.77357, 0.00000, 0.15000, 0.05967],
    "9": [0.00000, 0.08364, 0.04643, 0.28556],
    "10": [0.38429, 0.00586, 0.04107, 0.23388],
    "11": [0.85643, 0.14225, 0.12786, 0.07139],
    "12": [0.38429, 0.25200, 0.04107, 0.22376],
    "13": [0.06357, 0.50240, 0.18714, 0.08418],
    "14": [0.00000, 0.48215, 0.04643, 0.10442],
    "15": [0.05679, 0.00000, 0.08571, 0.06127],
    //named areas, kept for later: objects are sometimes parked on a table
    "Back Table": [0.16643, 0.00000, 0.15607, 0.05168],
    "Table 1": [0.11393, 0.38679, 0.21607, 0.08578],
    "Table 2": [0.12071, 0.24880, 0.21607, 0.08578],
    "Table 3": [0.13000, 0.10975, 0.21607, 0.08578],
    "Front Table": [0.06357, 0.50240, 0.18714, 0.08418],
}

//pulls the map key out of a match. "Scaff. 03 Internal Mag Inventory" -> "3",
//and anything without a number, like "Scaff. Museo", returns null so the map
//still opens with nothing drawn on it
function magMapKey(match) {
    const scaff = String(match.scaff || "")
    const numbered = scaff.match(/scaff\.?\s*0*(\d+)/i)
    if (numbered) return numbered[1]
    //a tab parked on a table rather than a shelf
    const table = scaff.match(/(back table|front table|table\s*\d)/i)
    return table ? table[1].replace(/\s+/g, " ") : null
}

//the overlay has to sit exactly on the image, not on the padded frame around
//it, so the image gets wrapped once and the svg goes in beside it
function magMapOverlay(img) {
    let wrap = img.parentElement
    if (!wrap || !wrap.classList.contains("magmap-wrap")) {
        wrap = document.createElement("div")
        wrap.className = "magmap-wrap"
        img.parentElement.insertBefore(wrap, img)
        wrap.appendChild(img)
    }
    let svg = wrap.querySelector("svg.magmap-overlay")
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("class", "magmap-overlay")
        svg.setAttribute("preserveAspectRatio", "none")
        wrap.appendChild(svg)
    }
    return svg
}

//heading above the map explaining an empty or unusual highlight, created here
//so the page markup does not need an element reserved for it
function magMapNote(text) {
    const frame = document.getElementById("magMapFrame")
    if (!frame) return
    const card = frame.parentElement
    let note = document.getElementById("magMapNote")
    if (!note) {
        note = document.createElement("h3")
        note.id = "magMapNote"
        note.className = "magmap-note"
        //inserted before the frame so it reads as the card heading
        card.insertBefore(note, frame)
    }
    note.textContent = text || ""
    note.style.display = text ? "block" : "none"
}

//draws a highlight for every match that resolves to an area on the plan.
//Called with the same matches array renderResult receives
function drawMagMap(matches) {
    const img = document.getElementById("magMapImage")
    if (!img) return

    //natural size is zero until the file has loaded, and the map is usually
    //still loading the first time this runs, so redraw once it arrives
    if (!img.complete || !img.naturalWidth) {
        img.addEventListener("load", function () { drawMagMap(matches) }, { once: true })
        return
    }

    const w = img.naturalWidth
    const h = img.naturalHeight
    const svg = magMapOverlay(img)
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`)
    svg.innerHTML = ""

    //the same shelf found twice should only be drawn once
    const keys = []
    const unmapped = []
    ;(matches || []).forEach(function (m) {
        const key = magMapKey(m)
        if (key && MAG_MAP_AREAS[key]) {
            if (keys.indexOf(key) === -1) keys.push(key)
        } else {
            unmapped.push(m)
        }
    })

    keys.forEach(function (key) {
        const a = MAG_MAP_AREAS[key]
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
        rect.setAttribute("x", a[0] * w)
        rect.setAttribute("y", a[1] * h)
        rect.setAttribute("width", a[2] * w)
        rect.setAttribute("height", a[3] * h)
        //stroke scales with the image so it reads the same at any display size
        rect.setAttribute("stroke-width", Math.max(6, w * 0.005))
        rect.setAttribute("rx", w * 0.006)
        rect.setAttribute("class", "magmap-hit")
        svg.appendChild(rect)
    })

    if (keys.length === 0) {
        magMapNote(unmapped.length > 0
            ? "This location is not on the mag map."
            : "")
    } else if (unmapped.length > 0) {
        magMapNote("One of the locations found is not on the mag map.")
    } else if (keys.length > 1) {
        magMapNote("This object is listed on more than one shelf, so several are marked.")
    } else {
        magMapNote("")
    }
}