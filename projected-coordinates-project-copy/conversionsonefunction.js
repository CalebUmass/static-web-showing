async function convert(event) {
    event.preventDefault()

    var loaderElement = document.getElementById("loader-overlay");
    if (loaderElement != null) {
        loaderElement.style.display = "block";
    }

    var x = parseFloat(document.getElementById("xcoord").value); //get the inputted x value
    var y = parseFloat(document.getElementById("ycoord").value); //get the inputted y value

    const espgx = (x * 0.999221692962) + (y * 0.0447248683267) + 1695135.19719;
    const espgy = (x * (-0.0439247185204)) + (y * 0.999281902346) + 4780651.43589;

    var url = `https://opencontext.org/utilities/reproject?format=geojson&geometry=Point&input-proj=poggio-civitate&output-proj=EPSG:4326&x=${x}&y=${y}`
    try {
        const response = await fetch(url);
        const data = await response.json();
        const dataArray = data['coordinates'];
        const longitude = dataArray[0];
        const latitude = dataArray[1];

        document.getElementById("input-display").innerHTML = `
    <strong>X</strong>: ${x}<br>
    <strong>Y</strong>: ${y}`;

        document.getElementById("wgs-display").innerHTML = `
    <strong>Longitude</strong>: ${longitude}<br>
    <strong>Latitude</strong>: ${latitude}`;

        document.getElementById("espg-display").innerHTML = `
    <strong>X</strong>: ${espgx}<br>
    <strong>Y</strong>: ${espgy}`;

        document.getElementById("xcoord").value = "";
        document.getElementById("ycoord").value = "";
    } catch (error) {
        document.getElementById("input-display").innerHTML =
            `X: ${x}<br>
            Y: ${y}`;
        document.getElementById("wgs-display").innerHTML = "Could not load results"
        document.getElementById("espg-display").innerHTML = "Could not load results"
        console.error(error);
    } finally {
        // Scroll to output section instantly *before* hiding the loader
        document.getElementById("output").scrollIntoView({ behavior: "auto" });

        // Hide the loader overlay afterward
        var loaderOverlay = document.getElementById("loader-overlay");
        if (loaderOverlay != null) {
            loaderOverlay.style.display = "none";
        }
        document.getElementById("input").style.display = "none";
        document.getElementById("output").style.display = "flex";
    }
}


