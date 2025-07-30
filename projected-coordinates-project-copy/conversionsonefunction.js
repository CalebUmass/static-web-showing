async function convert(event) { //this is an async function so that the output screen does not appear UNTIL all conversions have been done, and makes sure the loader works properly
    event.preventDefault() //prevents the page from reloading

    var loaderElement = document.getElementById("loader-overlay"); //gets the loader overlay and the loader(a child of loader-overlay)
    
    //calls loader element
    if (loaderElement != null) { //this makes sure that the code can access the loader element and prevents any error if it can't. If the loaderElement is found, it will display the loader as soon as the function is called.
        loaderElement.style.display = "block";
    }

    //getting input from the html input
    var x = parseFloat(document.getElementById("xcoord").value); //get the inputted x value
    var y = parseFloat(document.getElementById("ycoord").value); //get the inputted y value

    //converts var x and var y to espg coordinates automatically
    const espgx = (x * 0.999221692962) + (y * 0.0447248683267) + 1695135.19719; 
    const espgy = (x * (-0.0439247185204)) + (y * 0.999281902346) + 4780651.43589;

    //get the URL of the Open Context which can convert coordinates to WGS.
    var url = `https://opencontext.org/utilities/reproject?format=geojson&geometry=Point&input-proj=poggio-civitate&output-proj=EPSG:4326&x=${x}&y=${y}` //Used literals for the URL so that we pass the inputted x and y coordinates immediately to the website
    
    //initializing a try-catch-finally here so that if the webpage does not return results, or the input is invalid, or if there is any other error on the side of Open Context, the code will not break.
    try {

        const response = await fetch(url); //awaits the information from the website -- does not run until it receives it
        const data = await response.json(); //after the previous code is run, we convert the information to JSON
        const dataArray = data['coordinates']; //accessing the coordinates returned by fetching them by key ('coordinates')
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


