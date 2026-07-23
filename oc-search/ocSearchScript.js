
/**
 * -- GLOBAL VARIABLES --
 * Constant variables are references to elements.
 * Vars are usually arrays or other iterables to help the code run.
 */

// SubSelects (dropdowns which appear under the search bar)
const subFilter = document.getElementsByClassName("subSelect");         // HTMLCollection of elements
var subFilterList = Array.from(subFilter).map(element => element.id);   // Array of subSelect IDs


// RadioInputs (single-select choices which appear under the search bar)
const radioInput = document.querySelectorAll('input[type="radio"]');    // HTMLCollection of radio selects
var radioList1 = Array.from(radioInput).map(element => element.id);     // Array of radio select IDs
var radioList2 = Array.from(radioInput).map(element => element.value);  // Array of radio select values
var radioMap = new Object();    // Object similar to a map, associating radiolists to their possible values
for (let i = 0; i < radioList1.length; i++){
    radioMap[`${radioList1[i]}`] = [`${radioList2[i]}`];
}


// Selects that will open their own selects
const selectsWithSubs = Array.from(document.getElementsByClassName("hasSub"));
const selectsWithSubsIds = new Array(selectsWithSubs.length);
for (let i = 0; i < selectsWithSubs.length; i++){
    selectsWithSubsIds[i] = selectsWithSubs[i].id;
}


// Map corresponding a select to its list of subSelects
// NOTE: Currently only includes object-type, as it's the only select besides prime that has subs.
// The map is included as a solution if other selects ever have children
var subsMap = new Map();
let objectTypeChildren = document.getElementById("objectTypeChildren").children;
let objectTypeChildrenIds = new Array(objectTypeChildren.length);

for (let i = 0; i < objectTypeChildren.length; i++){        // Populating ID list
    objectTypeChildrenIds[i] = objectTypeChildren[i].id;
}

subsMap.set("object-type", objectTypeChildrenIds);          // Again, just object-type for now
addListenerToSelect("object-type", objectTypeChildrenIds)   // To make modular in the future!


// Element of the main search (searchPrime)
const searchSelectElement = document.getElementById("searchSelect");


// Text box inside the yellow square that will show the search path
let pathTextBox = document.getElementById("pathText");


// Stores the ID strings of the path the user has created
let currentPath = [];




/**
 * -- EVENT LISTENERS --
 */

// Listens for enter key to be pressed. Then, triggers the search event.
document.addEventListener("keyup", function(event){
    event.preventDefault();
    if (event.keyCode === 13){
        document.getElementById('searchButton').click();
    }
});


// Listens for a change in the value of the main search. Then, opens the corresponding dropdown menu,
// hides the main dropdown menu, and adds selection to path.
// If PC Number is selected, reveals PC number entry field.
searchSelectElement.addEventListener("change", function(){

    x = searchSelectElement.value;  // Fetch user-selected value
    currentPath.push(x);             // Update path with value
    updatePath();                   // Update text box to display value

        if (x != ""){ // "" represents the initial value, and means we should not process it

            // Swap visible dropdown
            searchSelectElement.style.visibility = "hidden";
            document.getElementById(`${x}`).style.visibility = "visible";

            // Display the buttons!
            document.getElementById("clearButton").style.visibility = "visible";
            document.getElementById('searchButton').style.visibility = "visible";

            // Apply to all searches except PC lookups
            if (x != "pcnum"){
                document.getElementById("fragmentSelect").style.visibility = "visible";
                document.getElementById("conservation-material").style.visibility = "visible";
                document.getElementById("conservation-action").style.visibility = "visible";
            }

            // SubSelects that only apply to biological-related finds
            let biologicalFilters = ['taxon', 'element', 'common-name'];
            if (biologicalFilters.includes(searchSelectElement.value)){
                document.getElementById("preserved").style.visibility = "visible";
                document.getElementById("proximal-fused").style.visibility = "visible";
                document.getElementById("distal-fused").style.visibility = "visible";
                document.getElementById("side").style.visibility = "visible";
                document.getElementById("age-category").style.visibility = "visible";
                document.getElementById("skeletal-area").style.visibility = "visible";
                document.getElementById("sexSelect").style.visibility = "visible";
            }
        }
});




/**
 * -- CUSTOM FUNCTIONS w/ ANNOTATIONS --
 */

/**
 * Helper function for hasSub selects. Adds a a listener to the parent to detect and open any
 * child dropdowns according to selection. IDs must be strings.
 * @param {String} parentID The ID of the parent element. Listener will be added to this element.
 * @param {Iterable<String>} childrenIDList An iterable containing all values of the parent that should open 
 * a corresponding dropdown. The value field of the option in the parent should be exactly the id of the 
 * corresponding dropdown.
 */
function addListenerToSelect(parentID, childrenIDList) {
    document.getElementById(parentID).addEventListener("change", function(){

        e = document.getElementById(parentID);
        x = e.value;

        // We know there will only be one match so break unnecessary
        for (let child of childrenIDList) {
            if (x == child){
                e.style.visibility = "hidden";
                
                e = document.getElementById(x).style.visibility = "visible";

                currentPath.push(x);
                updatePath();
            }
        }
    });
}


/**
 * Generates URL to open based on a PC number entry. PC numbers can be written in the following ways:
 * - PC 12345678
 * -  12345678 (space at beginnning)
 * - 12345678
 * - PC12345678
 * @returns URL corresponding to entered PC number.
 */
function fetchByPC(){
    pcNumber = document.getElementById("pcnum").value;
    if (pcNumber.includes("PC") && pcNumber.includes(" ")){
        let URL = (`https://opencontext.org/query/?q=${pcNumber}&type=subjects#tab=3`);
        return URL;
    } else {
        if (pcNumber.includes("PC") == false && pcNumber.includes(" ")){
            let URL = (`https://opencontext.org/query/?q=PC${pcNumber}&type=subjects#tab=3`);
            return URL;
        } else {
            if (pcNumber.includes("PC") && pcNumber.includes(" ") == false){
                justNum = pcNumber.slice(2, 10);
                let URL = (`https://opencontext.org/query/?q=PC-${justNum}&type=subjects#tab=3`);
                return URL;
            } else {
                if (pcNumber.includes("PC") == false && pcNumber.includes(" ") == false){
                let URL = (`https://opencontext.org/query/?q=PC-${pcNumber}&type=subjects#tab=3`); 
                return URL;
                }
            }
        }
    }
}


/**
 * Generates URL to be opened when a search is performed.
 * 
 * - If path is more than two options deep, iterates through the currentPath in order, then
 * fetches the value in the last dropdown to complete the link.
 * 
 * - Otherwise, gets the value of the main select and the next dropdown.
 * 
 * Iterates through subSelects to append any remaining filters. Finally, appends the subjects filter
 * and returns the URL.
 * @returns Complete URL with all selected filters applied.
 */
function typeSearch(){
    // Current value of main search
    searchType = searchSelectElement.value;
    let link = `https://opencontext.org/query/?proj=24-murlo&project-map=True&prop=`;   // Base link

    // More than two searches deep 
    if (selectsWithSubsIds.includes(searchType)){
        
        for (let i = 0; i < currentPath.length; i++){    // Add all values from the path to link
            link = link.concat(`24-${currentPath[i]}---`);
        }

        // Fetch and add final value to path, update text to display final path
        let last = document.getElementById(currentPath[currentPath.length - 1]).value
        link = link.concat(`24-${last}`);
        currentPath.push(document.getElementById(currentPath[currentPath.length - 1]).value)
        updatePath();
        
    // One or two selects deep
    } else {
        // Second selected type
        selectedType = document.getElementById(`${searchType}`).value;

        // Add and update path
        currentPath.push(selectedType);
        updatePath();

        link = link.concat(`24-${searchType}---24-${selectedType}`);
    }

    // Uses subSearch to find applicable sub
    let appendList = subSearch();
    console.log(appendList);
    for (let i = 0; i < appendList.length; i++){
        link = link.concat(`${appendList[i]}`);
    }

    // Done!
    let finalLink = link.concat('&type=subjects#tab=3');
    return finalLink;
}

/**
 * Opens a new tab with user's search, whether PC number or select search.
 */
function openTab(){
    if (document.getElementById("pcnum").value.trim().length != 0){
        window.open(fetchByPC(), "_blank");
        document.getElementById("1").reset();
    } else { 
        window.open(typeSearch(), "_blank");
    } 
}

/**
 * Resets all elements to their default values, clears path, and hides subSelects.
 */
function clearSearch(){
    // Open main select and clear value
    searchSelectElement.style.visibility = "visible";
    searchSelectElement.value = "";

    // Clear all select options that were modified
    for (let i = 0; i < currentPath.length; i++){
        document.getElementById(`${currentPath[i]}`).style.visibility = "hidden";
        document.getElementById(`${currentPath[i]}`).value = "";
    }

    // Hide all subfilters
    for (let i = 0; i < subFilterList.length; i++){
        document.getElementById(`${subFilterList[i]}`).style.visibility = "hidden";
    }

    // Hide radio selects
    document.getElementById("fragmentSelect").style.visibility = "hidden"
    document.getElementById("sexSelect").style.visibility = "hidden"

    // Reset path
    currentPath = new Array();

    // Display default path value
    pathTextBox.innerText = "Your search path will appear here!";
}


/**
 * Brings the user to the projects page of poggiocivitate.net.
 */
function returnHome(){
    window.open("https://poggiocivitate.net/projects/all/", "_self");
}


/**
 * Iterates through subSelects and radioSelects, and returns all chosen fields.
 * @returns An array of filter URL entries, for appending to the final URL.
 */
function subSearch(){
    let addTo = [];
    for (let i = 0; i < subFilterList.length; i++){
        x = document.getElementById(`${subFilterList[i]}`).value;
        if (x){
            addTo.push(`&prop=24-${subFilterList[i]}---24-${x}`);
        }
    }
    radioOptions = Object.keys(radioMap);
    for (let ind = 0; ind < radioOptions.length; ind++){
        if (document.getElementById(`${radioOptions[ind]}`).checked){
            addTo.push(`&prop=24-${radioMap[radioOptions[ind]]}---24-${radioOptions[ind]}`);
        }
    }
    return addTo;
}


/**
 * Updates path text box with current path.
 */
function updatePath(){
    // Initial path text
    text = `Current Path: ${currentPath[0]}`;

    // Add deeper filters
    for (let i = 1; i < currentPath.length; i++){
        text = text.concat(` :: ${currentPath[i]}`);
    }

    // Display text
    pathTextBox.innerText = text;
} 