//register the Italian Monte Mario / Italy zone 1 projection (EPSG:3003) with its datum shift
proj4.defs("EPSG:3003", "+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs")

function convert(event) {
    event.preventDefault()

    var x = parseFloat(document.getElementById("xcoord").value)
    var y = parseFloat(document.getElementById("ycoord").value)

    //site grid (x,y) -> EPSG:3003 projected coords
    const espgx = (x * 0.999221692962) + (y * 0.0447248683267) + 1695135.19719
    const espgy = (x * (-0.0439247185204)) + (y * 0.999281902346) + 4780651.43589
    //site grid (x,y) VESCO -> EPSG:3003 projected coords
    const Vespgx = (x * 0.87120992587 ) + (y * 0.486029300286 ) + 1694396.08449
    const Vespgy = (x * (-0.487297729938 )) + (y * 0.873675651295) + 4782618.57257
    //EPSG:3003 -> WGS84 lon/lat, done locally with proj4 (no API, no proxy)
    const [longitude, latitude] = proj4("EPSG:3003", "WGS84", [espgx, espgy])
    const [Vlong,Vlat] = proj4("EPSG:3003", "WGS84", [Vespgx, Vespgy])

    document.getElementById("input-display").innerHTML =
        `<strong>X</strong>: ${x}<br><strong>Y</strong>: ${y}`
    document.getElementById("wgs-display").innerHTML =
        `<strong>Longitude</strong>: ${longitude.toFixed(7)}<br><strong>Latitude</strong>: ${latitude.toFixed(7)}`
    document.getElementById("espg-display").innerHTML =
    `<strong>X</strong>: ${espgx.toFixed(3)}<br><strong>Y</strong>: ${espgy.toFixed(3)}`

    document.getElementById("Vwgs-display").innerHTML =
        `<strong>Longitude</strong>: ${Vlong.toFixed(7)}<br><strong>Latitude</strong>: ${Vlat.toFixed(7)}`
    document.getElementById("Vespg-display").innerHTML =
        `<strong>X</strong>: ${Vespgx.toFixed(3)}<br><strong>Y</strong>: ${Vespgy.toFixed(3)}`

    document.getElementById("xcoord").value = ""
    document.getElementById("ycoord").value = ""

    document.getElementById("output").scrollIntoView({ behavior: "auto" })
    document.getElementById("input").style.display = "none"
    document.getElementById("output").style.display = "flex"
}
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