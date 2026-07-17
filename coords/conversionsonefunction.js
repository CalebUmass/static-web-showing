//register the Italian Monte Mario / Italy zone 1 projection (EPSG:3003) with its datum shift
proj4.defs("EPSG:3003", "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs")

//affine parameters mapping each site grid to EPSG:3003 (forward direction)
const TRANSFORMS = {
    PC: {
        name: "Poggio Civitate",
        a: 0.999221692962, b: 0.0447248683267,
        c: -0.0439247185204, d: 0.999281902346,
        tx: 1695135.19719, ty: 4780651.43589
    },
    VESCO: {
        name: "Vescovado di Murlo",
        a: 0.87120992587, b: 0.486029300286,
        c: -0.487297729938, d: 0.873675651295,
        tx: 1694396.08449, ty: 4782618.57257
    }
}

//labels and batch placeholders for each input mode
const MODE_CONFIG = {
    site: { label1: "x-coordinate:", label2: "y-coordinate:", short: "Site", placeholder: "One point per line: x, y\nExample:\n173, -49\n10 20" },
    epsg: { label1: "X (easting):", label2: "Y (northing):", short: "EPSG:3003", placeholder: "One point per line: X, Y\nExample:\n1695305.871, 4780594.872" },
    wgs:  { label1: "Longitude:", label2: "Latitude:", short: "WGS84", placeholder: "One point per line: longitude, latitude\nExample:\n11.4016854, 43.1527744" }
}

//ui state
let inputMode = "site"   //site | epsg | wgs, which CRS the user is entering
let siteSystem = "PC"    //PC | VESCO, which affine to use for the site grid
let entryMode = "single" //single | batch

//history of converted points, newest first, persisted in localStorage so it
//survives reloads. Looking back up recent conversions is core to how the
//tool is used, so this is essential (functional) data - no opt-in needed.
const HISTORY_KEY = "coordConverterHistory"
const HISTORY_MAX = 200
const HISTORY_PAGE_SIZE = 8
let historyEntries = loadHistory()
let historyPage = 0

/*=============== conversion math ===============*/

//site grid -> EPSG:3003
function siteToEpsg(x, y, t) {
    return [t.a * x + t.b * y + t.tx, t.c * x + t.d * y + t.ty]
}

//EPSG:3003 -> site grid (inverse of the affine above)
function epsgToSite(X, Y, t) {
    const det = t.a * t.d - t.b * t.c
    const dx = X - t.tx
    const dy = Y - t.ty
    return [(t.d * dx - t.b * dy) / det, (-t.c * dx + t.a * dy) / det]
}

//converts one point from the current input mode into all three systems
function convertPoint(v1, v2) {
    const t = TRANSFORMS[siteSystem]
    let site, epsg, wgs

    if (inputMode === "site") {
        site = [v1, v2]
        epsg = siteToEpsg(v1, v2, t)
        wgs = proj4("EPSG:3003", "WGS84", epsg)
    } else if (inputMode === "epsg") {
        epsg = [v1, v2]
        site = epsgToSite(v1, v2, t)
        wgs = proj4("EPSG:3003", "WGS84", epsg)
    } else {
        //wgs input is entered as longitude, latitude
        wgs = [v1, v2]
        epsg = proj4("WGS84", "EPSG:3003", wgs)
        site = epsgToSite(epsg[0], epsg[1], t)
    }
    return { site, epsg, wgs }
}

/*=============== formatting helpers ===============*/

function fmtSite(p) { return `${p[0].toFixed(3)}, ${p[1].toFixed(3)}` }
function fmtEpsg(p) { return `${p[0].toFixed(3)}, ${p[1].toFixed(3)}` }
function fmtWgs(p) { return `${p[0].toFixed(7)}, ${p[1].toFixed(7)}` }

/*=============== toggle wiring ===============*/

//generic handler: activates the clicked button within its group and returns its data value
function wireToggle(groupId, onChange) {
    const group = document.getElementById(groupId)
    group.addEventListener("click", function (e) {
        const btn = e.target.closest("button")
        if (!btn) return
        group.querySelectorAll("button").forEach(function (b) { b.classList.remove("active") })
        btn.classList.add("active")
        onChange(btn.dataset.value)
    })
}

function refreshInputLabels() {
    const cfg = MODE_CONFIG[inputMode]
    document.getElementById("label1").textContent = cfg.label1
    document.getElementById("label2").textContent = cfg.label2
    document.getElementById("batchInput").placeholder = cfg.placeholder
}

function refreshEntryMode() {
    const single = entryMode === "single"
    document.getElementById("singleEntry").style.display = single ? "block" : "none"
    document.getElementById("batchEntry").style.display = single ? "none" : "block"
    //required must only apply to visible fields or the form will refuse to submit
    document.getElementById("coord1").required = single
    document.getElementById("coord2").required = single
    document.getElementById("batchInput").required = !single
}

/*=============== batch parsing ===============*/

//parses textarea content into {points: [[v1,v2],...], errors: [lineNumber,...]}
function parseBatch(text) {
    const points = []
    const errors = []
    const lines = text.split("\n")
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line === "") continue
        //accept comma and/or whitespace as separators
        const parts = line.split(/[,\s]+/).filter(function (p) { return p !== "" })
        const v1 = parseFloat(parts[0])
        const v2 = parseFloat(parts[1])
        if (parts.length !== 2 || isNaN(v1) || isNaN(v2)) {
            errors.push(i + 1)
        } else {
            points.push([v1, v2])
        }
    }
    return { points, errors }
}

/*=============== history ===============*/

function loadHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem(HISTORY_KEY))
        if (Array.isArray(stored)) return stored
    } catch (err) { /*corrupt or unavailable storage: start fresh*/ }
    return []
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyEntries))
    } catch (err) { /*private mode or quota: history stays session-only*/ }
}

function addToHistory(result) {
    historyEntries.unshift({
        mode: inputMode,
        system: siteSystem,
        result: result,
        at: Date.now()
    })
    if (historyEntries.length > HISTORY_MAX) historyEntries.length = HISTORY_MAX
    saveHistory()
    historyPage = 0 //a new conversion always shows on the first page
    renderHistory()
}

function clearHistory() {
    if (!confirm("Clear the entire conversion history?")) return
    historyEntries = []
    try { localStorage.removeItem(HISTORY_KEY) } catch (err) { /*ignore*/ }
    historyPage = 0
    renderHistory()
}

function renderHistory() {
    const card = document.getElementById("historyCard")
    const list = document.getElementById("historyList")
    if (historyEntries.length === 0) {
        card.style.display = "none"
        return
    }
    card.style.display = "block"
    list.innerHTML = ""

    const pageCount = Math.ceil(historyEntries.length / HISTORY_PAGE_SIZE)
    if (historyPage >= pageCount) historyPage = pageCount - 1
    const start = historyPage * HISTORY_PAGE_SIZE
    const pageEntries = historyEntries.slice(start, start + HISTORY_PAGE_SIZE)

    pageEntries.forEach(function (entry) {
        const r = entry.result
        const div = document.createElement("div")
        div.className = "history-entry"
        const inputLabel = MODE_CONFIG[entry.mode].short
        const when = entry.at
            ? `<span class="history-time">${new Date(entry.at).toLocaleString()}</span>`
            : ""
        div.innerHTML =
            `<span class="history-input">${inputLabel} in (${TRANSFORMS[entry.system].name}): ` +
            `${entry.mode === "site" ? fmtSite(r.site) : entry.mode === "epsg" ? fmtEpsg(r.epsg) : fmtWgs(r.wgs)}${when}</span>` +
            `<span class="history-out">Site: ${fmtSite(r.site)} &nbsp;|&nbsp; WGS84: ${fmtWgs(r.wgs)} &nbsp;|&nbsp; EPSG:3003: ${fmtEpsg(r.epsg)}</span>`
        list.appendChild(div)
    })

    //pager only appears once the history spills past one page
    const pager = document.getElementById("historyPager")
    pager.style.display = pageCount > 1 ? "flex" : "none"
    if (pageCount > 1) {
        document.getElementById("historyPageLabel").textContent = `Page ${historyPage + 1} of ${pageCount}`
        document.getElementById("historyPrev").disabled = historyPage === 0
        document.getElementById("historyNext").disabled = historyPage === pageCount - 1
    }
}

function turnHistoryPage(delta) {
    historyPage += delta
    renderHistory()
}

//plain-text export of the full history (not just the visible page)
function exportHistory() {
    const lines = [`Coordinate Converter - conversion history, exported ${new Date().toLocaleString()}`, ""]
    historyEntries.forEach(function (entry) {
        const r = entry.result
        const when = entry.at ? new Date(entry.at).toLocaleString() : "unknown time"
        lines.push(`[${when}] Input: ${MODE_CONFIG[entry.mode].short} (${TRANSFORMS[entry.system].name})`)
        lines.push(`  Site:      ${fmtSite(r.site)}`)
        lines.push(`  WGS84:     ${fmtWgs(r.wgs)}`)
        lines.push(`  EPSG:3003: ${fmtEpsg(r.epsg)}`)
        lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `coord-history-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
}

/*=============== output rendering ===============*/

function renderSingle(result) {
    const sysName = TRANSFORMS[siteSystem].name
    document.getElementById("localSystemName").textContent = sysName

    document.getElementById("input-display").innerHTML =
        `<strong>X</strong>: ${result.site[0].toFixed(3)}<br><strong>Y</strong>: ${result.site[1].toFixed(3)}`
    document.getElementById("wgs-display").innerHTML =
        `<strong>Longitude</strong>: ${result.wgs[0].toFixed(7)}<br><strong>Latitude</strong>: ${result.wgs[1].toFixed(7)}`
    document.getElementById("espg-display").innerHTML =
        `<strong>X</strong>: ${result.epsg[0].toFixed(3)}<br><strong>Y</strong>: ${result.epsg[1].toFixed(3)}`

    //mark which card holds the values the user entered
    document.getElementById("badge-site").style.display = inputMode === "site" ? "inline-block" : "none"
    document.getElementById("badge-wgs").style.display = inputMode === "wgs" ? "inline-block" : "none"
    document.getElementById("badge-epsg").style.display = inputMode === "epsg" ? "inline-block" : "none"

    document.getElementById("singleOutput").style.display = "flex"
    document.getElementById("batchCard").style.display = "none"
}

function renderBatch(results, errors) {
    const sysName = TRANSFORMS[siteSystem].name
    let html = `<table class="batch-table"><thead><tr>` +
        `<th>#</th><th>Site X (${sysName})</th><th>Site Y</th>` +
        `<th>Longitude</th><th>Latitude</th><th>EPSG X</th><th>EPSG Y</th></tr></thead><tbody>`
    results.forEach(function (r, i) {
        html += `<tr><td>${i + 1}</td>` +
            `<td>${r.site[0].toFixed(3)}</td><td>${r.site[1].toFixed(3)}</td>` +
            `<td>${r.wgs[0].toFixed(7)}</td><td>${r.wgs[1].toFixed(7)}</td>` +
            `<td>${r.epsg[0].toFixed(3)}</td><td>${r.epsg[1].toFixed(3)}</td></tr>`
    })
    html += "</tbody></table>"
    if (errors.length > 0) {
        html += `<p class="batch-errors">Skipped invalid line${errors.length > 1 ? "s" : ""}: ${errors.join(", ")}</p>`
    }
    document.getElementById("batchResults").innerHTML = html

    //stash a TSV copy of the table for the copy button
    let tsv = `Site X\tSite Y\tLongitude\tLatitude\tEPSG X\tEPSG Y\n`
    results.forEach(function (r) {
        tsv += `${r.site[0].toFixed(3)}\t${r.site[1].toFixed(3)}\t${r.wgs[0].toFixed(7)}\t${r.wgs[1].toFixed(7)}\t${r.epsg[0].toFixed(3)}\t${r.epsg[1].toFixed(3)}\n`
    })
    document.getElementById("batchCard").dataset.tsv = tsv

    document.getElementById("singleOutput").style.display = "none"
    document.getElementById("batchCard").style.display = "block"
}

/*=============== main convert handler ===============*/

function convert(event) {
    event.preventDefault()

    let results = []
    let errors = []

    if (entryMode === "single") {
        const v1 = parseFloat(document.getElementById("coord1").value)
        const v2 = parseFloat(document.getElementById("coord2").value)
        results.push(convertPoint(v1, v2))
    } else {
        const parsed = parseBatch(document.getElementById("batchInput").value)
        errors = parsed.errors
        if (parsed.points.length === 0) {
            document.getElementById("batchInput").setCustomValidity("No valid points found. Use one point per line, e.g. 173, -49")
            document.getElementById("batchInput").reportValidity()
            document.getElementById("batchInput").setCustomValidity("")
            return
        }
        parsed.points.forEach(function (p) {
            results.push(convertPoint(p[0], p[1]))
        })
    }

    //record every converted point in the session history
    results.forEach(addToHistory)

    if (entryMode === "single") {
        renderSingle(results[0])
        document.getElementById("coord1").value = ""
        document.getElementById("coord2").value = ""
    } else {
        renderBatch(results, errors)
    }

    document.getElementById("output").scrollIntoView({ behavior: "auto" })
    document.getElementById("input").style.display = "none"
    document.getElementById("output").style.display = "flex"
}

/*=============== copy buttons ===============*/

function copyText(id, btn) {
    const text = document.getElementById(id).innerText
    writeClipboard(text, btn)
}

function copyBatch(btn) {
    writeClipboard(document.getElementById("batchCard").dataset.tsv || "", btn)
}

function writeClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
        const original = btn.textContent
        btn.textContent = "Copied!"
        setTimeout(function () { btn.textContent = original }, 1500)
    }).catch(function () {
        btn.textContent = "Copy failed"
        setTimeout(function () { btn.textContent = "Copy" }, 1500)
    })
}

/*=============== init ===============*/

document.addEventListener("DOMContentLoaded", function () {
    wireToggle("modeToggle", function (v) { inputMode = v; refreshInputLabels() })
    wireToggle("siteToggle", function (v) { siteSystem = v })
    wireToggle("entryToggle", function (v) { entryMode = v; refreshEntryMode() })
    document.getElementById("historyPrev").addEventListener("click", function () { turnHistoryPage(-1) })
    document.getElementById("historyNext").addEventListener("click", function () { turnHistoryPage(1) })
    document.getElementById("historyExport").addEventListener("click", exportHistory)
    document.getElementById("historyClear").addEventListener("click", clearHistory)
    refreshInputLabels()
    refreshEntryMode()
    renderHistory() //restore the stored history on page load
})
