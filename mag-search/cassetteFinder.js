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

//session-only history of searches, newest first
const historyEntries = []
const HISTORY_MAX = 12

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
    const base = `Index: ${s.objects} objects across ${s.sheets} sheets. Updated ${when}.`
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

//"Scaff. 03 Internal Mag Inventory" + "Cass. 55" -> "Scaff. 03 Cass. 55".
//the spreadsheet titles carry a boilerplate suffix that is the same on every
//sheet, so it says nothing and only crowds the result; the "cass." prefix is
//added only when the tab name does not already carry one
function formatLocation(match) {
    const scaff = match.scaff.replace(/\s*internal mag inventory\s*/i, " ").trim()
    const cass = /cass/i.test(match.cass) ? match.cass : `cass. ${match.cass}`
    return `${scaff} ${cass}`
}

function addToHistory(display, matches) {
    historyEntries.unshift({ display: display, matches: matches })
    if (historyEntries.length > HISTORY_MAX) historyEntries.pop()
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
    historyEntries.forEach(function (entry) {
        const div = document.createElement("div")
        div.className = "history-entry"
        const outcome = entry.matches.length === 0
            ? `<span class="history-miss">not found</span>`
            : entry.matches.map(formatLocation).join(" &nbsp;|&nbsp; ")
        div.innerHTML =
            `<span class="history-input">${entry.display}</span>` +
            `<span class="history-out">${outcome}</span>`
        list.appendChild(div)
    })
}

/*=============== output rendering ===============*/

function renderResult(display, matches) {
    const found = matches.length > 0
    document.getElementById("foundCard").style.display = found ? "flex" : "none"
    document.getElementById("notFoundCard").style.display = found ? "none" : "flex"

    if (found) {
        document.getElementById("foundCatNumber").textContent = display
        document.getElementById("locationDisplay").innerHTML =
            matches.map(function (m) { return `<strong>${formatLocation(m)}</strong>` }).join("<br>")
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
    refreshStatusLine()
})