/*
Cassetta Finder, server-backed version.
The index lives on the Lightsail server (cassetta_api.py), which owns the
service account and re-pulls the Drive folder when its copy goes stale.
Each search here is one tiny GET; no Google APIs, no keys, no localStorage
copy of the sheets on each device.
*/

//same-origin when the static site and the API live on the same Lightsail box;
//change to a full URL (and enable CORS server-side) if they ever split
const API_BASE = "/api/cassetta"

//ui state
let defaultSite = "PC" //PC | VdM, prepended when the typed number omits a site
let statusTimer = null //polling handle while the server rebuilds its index

//search history, newest first, persisted in localStorage so it survives
//reloads. Re-finding recently searched objects is core to how the tool is
//used in the mag, so this is essential (functional) data - no opt-in needed.
const HISTORY_KEY = "magSearchHistory"
const HISTORY_MAX = 200
const HISTORY_PAGE_SIZE = 8
let historyEntries = loadHistory()
let historyPage = 0

/*=============== input parsing ===============*/

//forces a messy catalog number into "PC 19720072" / "VdM 19720072" shape
//before sending; the server runs the same normalization as a second check
function parseCatalogNumber(raw) {
    const cleaned = raw.trim().replace(/[-_.,;/]+/g, " ").replace(/\s+/g, " ")
    const m = cleaned.match(/^(PC|VDM)?\s*(\d{4})\s*(\d{4})$/i)
    if (!m) return null
    let site = defaultSite
    if (m[1]) site = m[1].toUpperCase() === "PC" ? "PC" : "VdM"
    return `${site} ${m[2]}${m[3]}`
}

/*=============== api calls ===============*/

async function apiJson(path, options) {
    const res = await fetch(API_BASE + path, options)
    const body = await res.json().catch(function () { return {} })
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
    return body
}

/*=============== status line ===============*/

function setStatus(text) {
    document.getElementById("indexStatus").textContent = text
}

function describeStatus(s) {
    if (!s.ready) {
        return s.refreshing
            ? "Server is building the index for the first time..."
            : "Index not built yet. The first search builds it (takes a minute)."
    }
    const when = new Date(s.builtAt).toLocaleString()
    const base = `Found: ${s.objects} objects, ${s.sheets} sheets. Updated ${when}.`
    return s.refreshing ? base + " Refreshing now..." : base
}

async function refreshStatusLine() {
    try {
        const s = await apiJson("/status")
        setStatus(describeStatus(s))
        document.getElementById("refreshBtn").style.display = s.ready ? "inline-block" : "none"
        //keep polling while a rebuild is running so the line updates itself
        if (s.refreshing && !statusTimer) {
            statusTimer = setInterval(refreshStatusLine, 5000)
        } else if (!s.refreshing && statusTimer) {
            clearInterval(statusTimer)
            statusTimer = null
        }
    } catch (err) {
        setStatus(`Could not reach the server: ${err.message}`)
    }
}

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

/*=============== history ===============*/

//shortens a raw Drive folder path to the mag name people say.
//only the deepest folder matters since scaffale numbers are unique across
//mags, so a future "Conservation / (EMPTY) Vescovado di Murlo" sheet reads
//as just "Vescovado di Murlo" with no chain. "(EMPTY)" is a placeholder
//marker on the folder, not information. Examples:
//  "Catalog / Research Mag Scaffale"  -> "Research"
//  "Conservation Mag Scaffale"        -> "Conservation"
//  ".. / (EMPTY) Vescovado di Murlo"  -> "Vescovado di Murlo"
function cleanFolderLabel(folderPath) {
    if (!folderPath) return ""
    const last = folderPath.split("/").pop()
    return last
        .replace(/\(empty\)/ig, "")
        .replace(/mag scaffale/ig, "")
        .replace(/catalog/ig, "")
        .replace(/\s+/g, " ")
        .trim()
}

//the short label in front of the colon. Folder name when there is one;
//root sheets like "Scaff. Museo" lend their own name ("Museo") instead
function locationLabel(match) {
    const fromFolder = cleanFolderLabel(match.folder)
    if (fromFolder) return fromFolder
    const named = cleanScaff(match.scaff).match(/^scaff\.?\s+(\D.*)$/i)
    return named ? named[1].trim() : ""
}

function cleanScaff(scaff) {
    return scaff.replace(/internal mag inventory/i, "").replace(/\s+/g, " ").trim()
}

//normalizes the tab name: numeric tabs gain the "Cass." people expect,
//and a "Cass." glued onto words rather than a number ("Cass. Suspected
//in Museo") is sheet-naming noise and comes off. Examples:
//  "55"                     -> "Cass. 55"
//  "281 / E2"               -> "Cass. 281 / E2"
//  "Cass. 281 / E2"         -> "Cass. 281 / E2"
//  "Cass. Suspected in Museo" -> "Suspected in Museo"
function cleanCass(cass) {
    const t = cass.trim()
    if (/^\d/.test(t)) return `Cass. ${t}`
    const m = t.match(/^cass\.?\s*(.+)$/i)
    if (m) return /^\d/.test(m[1]) ? `Cass. ${m[1].trim()}` : m[1].trim()
    return t
}

//puts the pieces together, dropping the scaffolding part when it only
//repeats the label ("Scaff. Museo" under the label "Museo" says nothing):
//  "Conservation: Scaff. 09 Cass. 281 / E2"
//  "Museo: Suspected in Museo"
//  "Research: Scaff. 02 Cass. 25"
function formatLocation(match) {
    const label = locationLabel(match)
    const scaff = cleanScaff(match.scaff)
    const scaffRemainder = scaff.replace(/^scaff\.?\s*/i, "").trim()
    const scaffPart = label && scaffRemainder.toLowerCase() === label.toLowerCase() ? "" : scaff
    const where = [scaffPart, cleanCass(match.cass)].filter(Boolean).join(" ")
    return label ? `${label}: ${where}` : where
}

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

function addToHistory(display, matches) {
    historyEntries.unshift({ display: display, matches: matches, at: Date.now() })
    if (historyEntries.length > HISTORY_MAX) historyEntries.length = HISTORY_MAX
    saveHistory()
    historyPage = 0 //a new search always shows on the first page
    renderHistory()
}

function clearHistory() {
    if (!confirm("Clear the entire search history?")) return
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
        const div = document.createElement("div")
        div.className = "history-entry"
        const outcome = entry.matches.length === 0
            ? `<span class="history-miss">not found</span>`
            : entry.matches.map(function (m) {
                const moved = m.relocation
                    ? ` <span class="history-moved">(relocated: ${escapeHtml(describeRelocation(m))})</span>`
                    : ""
                return escapeHtml(formatLocation(m)) + moved
            }).join(`<br><span class="also-found">also found</span><br>`)
        //the object link is a property of the object, so one per entry is enough
        const linked = entry.matches.find(function (m) { return m.link })
        const link = linked
            ? ` <a class="history-link" href="${encodeURI(linked.link)}" target="_blank" rel="noopener noreferrer">Open Context</a>`
            : ""
        const when = entry.at
            ? `<span class="history-time">${new Date(entry.at).toLocaleString()}</span>`
            : ""
        div.innerHTML =
            `<span class="history-input">${escapeHtml(entry.display)}${when}</span>` +
            `<span class="history-out">${outcome}${link}</span>`
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
    const lines = [`Mag Object Finder - search history, exported ${new Date().toLocaleString()}`, ""]
    historyEntries.forEach(function (entry) {
        const when = entry.at ? new Date(entry.at).toLocaleString() : "unknown time"
        lines.push(`[${when}] ${entry.display}`)
        if (entry.matches.length === 0) {
            lines.push("  Not found")
        } else {
            entry.matches.forEach(function (m, i) {
                if (i > 0) lines.push("  ALSO FOUND")
                lines.push(`  Location: ${formatLocation(m)}`)
                if (m.relocation) lines.push(`  Currently relocated: ${describeRelocation(m)}`)
            })
            const linked = entry.matches.find(function (m) { return m.link })
            if (linked) lines.push(`  URL: ${linked.link}`)
        }
        lines.push("")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `mag-search-history-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
}

/*=============== output rendering ===============*/

//spreadsheet cells are free text, so they get escaped before going anywhere
//near innerHTML
function escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

//column C is an options field; when it says Other the real destination is the
//free text in column D
/*=============== thumbnails ===============*/

//placeholders shown when a row carries no image url, or when the url it does
//carry fails to load. Replace these names with the real files once they exist
const FALLBACK_IMAGES = ["TEMP1", "TEMP2", "TEMP3", "TEMP4"]

function randomFallbackImage() {
    return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)]
}

//the src to use for a match: the sheet's column E url when there is one,
//otherwise a placeholder picked at random
function thumbnailFor(match) {
    return match.img || randomFallbackImage()
}

//covers the other way an image goes missing: the url exists but the file is
//gone or the request fails. Clearing onerror first stops an endless loop if
//the placeholder itself fails to load
function useFallbackImage(imgEl) {
    imgEl.onerror = null
    imgEl.src = randomFallbackImage()
}

//NOTE, for Ellie who adds the image to the page: renderResult below already has
//the matches array, so the src is thumbnailFor(matches[0]). Wire the dead link
//case with imgEl.onerror = function () { useFallbackImage(this) }

function describeRelocation(m) {
    if (/other/i.test(m.relocation) && m.relocationNote) return m.relocationNote
    return m.relocationNote ? `${m.relocation} (${m.relocationNote})` : m.relocation
}

function renderResult(display, matches) {
    const found = matches.length > 0
    document.getElementById("foundCard").style.display = found ? "flex" : "none"
    document.getElementById("notFoundCard").style.display = found ? "none" : "flex"

    if (found) {
        document.getElementById("foundCatNumber").textContent = display
        //multiple locations usually mean a data error 
        //each goes on its own line with a divider
        document.getElementById("locationDisplay").innerHTML =
            matches.map(function (m) { return `<strong>${escapeHtml(formatLocation(m))}</strong>` })
                .join(`<br><span class="also-found">also found</span><br>`)

        //a temporary move means the shelf location above is where it belongs,
        //not where it currently is, so it needs to be hard to miss
        const notice = document.getElementById("relocationNotice")
        const moved = matches.filter(function (m) { return m.relocation })
        if (moved.length > 0) {
            notice.style.display = "block"
            notice.innerHTML = moved.map(function (m) {
                return `<strong>Currently relocated:</strong> ${escapeHtml(describeRelocation(m))}`
            }).join("<br>")
        } else {
            notice.style.display = "none"
        }

        //the database link is a property of the object, so the first match that
        //carries one wins; duplicates across cassette would repeat it
        const linked = matches.find(function (m) { return m.link })
        document.getElementById("objectLinks").innerHTML = linked
            ? `<a class="object-link" href="${encodeURI(linked.link)}" target="_blank" rel="noopener noreferrer">View in Open Context</a>`
            : ""
    } else {
        document.getElementById("missingCatNumber").textContent = display
    }

    document.getElementById("input").style.display = "none"
    document.getElementById("output").style.display = "flex"
}

//switches back to the input screen
function switchToInput() {
    document.getElementById("output").style.display = "none"
    document.getElementById("input").style.display = "flex"
    document.getElementById("catNumber").focus()
}

//Hello this is an ellie thing hi hi hi (TEMP MESSAGE CHANGE THIS LOL)
// Displays mag map when corresponding button is clicked
function showMap() {
    document.getElementById("magmap").style.display = "block";
    document.getElementById("magmapbtn").style.display = "none";
}

/*=============== main search handler ===============*/

async function runSearch(event) {
    event.preventDefault()

    const field = document.getElementById("catNumber")
    const display = parseCatalogNumber(field.value)
    if (!display) {
        field.setCustomValidity("Format not recognized. Try something like PC 19720072")
        field.reportValidity()
        field.setCustomValidity("")
        return
    }

    const submitBtn = document.getElementById("submit")
    submitBtn.disabled = true
    setStatus("Searching...")
    try {
        const data = await apiJson(`/find?number=${encodeURIComponent(display)}`)
        addToHistory(data.number, data.matches)
        renderResult(data.number, data.matches)
        field.value = ""
        refreshStatusLine()
    } catch (err) {
        setStatus(`Search failed: ${err.message}`)
    } finally {
        submitBtn.disabled = false
    }
}

/*=============== manual refresh ===============*/

async function requestRefresh() {
    try {
        const resp = await apiJson("/refresh", { method: "POST" })
        if (resp.started) {
            setStatus("Server is re-pulling the sheets...")
            if (!statusTimer) statusTimer = setInterval(refreshStatusLine, 5000)
        } else {
            //server declined because the index is younger than its minimum
            refreshStatusLine()
        }
    } catch (err) {
        setStatus(`Could not start a refresh: ${err.message}`)
    }
}

/*=============== copy button ===============*/

function copyText(id, btn) {
    const text = document.getElementById(id).innerText
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
    wireToggle("siteToggle", function (v) { defaultSite = v })
    document.getElementById("searchform").addEventListener("submit", runSearch)
    document.getElementById("refreshBtn").addEventListener("click", requestRefresh)
    document.getElementById("historyPrev").addEventListener("click", function () { turnHistoryPage(-1) })
    document.getElementById("historyNext").addEventListener("click", function () { turnHistoryPage(1) })
    document.getElementById("historyExport").addEventListener("click", exportHistory)
    document.getElementById("historyClear").addEventListener("click", clearHistory)
    //on the results page "back" means back to the search, same as New Search;
    //only from the search page does it leave for the projects page
    document.getElementById("backArrow").addEventListener("click", function (e) {
        if (document.getElementById("output").style.display !== "none") {
            e.preventDefault()
            switchToInput()
        }
    })
    renderHistory() //restore the stored history on page load
    refreshStatusLine()
})