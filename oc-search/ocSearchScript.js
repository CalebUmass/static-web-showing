/* Event listener for enter key trigger */
document.addEventListener("keyup", function(event){
    event.preventDefault();
    if (event.keyCode === 13){
        document.getElementById('searchButton').click();
    }
});

/* An array and dictionary of all sub-filter ids, to fetch their value if needed and append them to the link*/

// subSelects
const subFilter = document.getElementsByClassName("subSelect");
var subFilterList = Array.from(subFilter).map(element => element.id);

// radioInput
const radioInput = document.querySelectorAll('input[type="radio"]');
var radioList1 = Array.from(radioInput).map(element => element.id);
var radioList2 = Array.from(radioInput).map(element => element.value);
var radioMap = new Object();                                // This could just be a map????
for (let i = 0; i < radioList1.length; i++){                // Ok I tried to make it a map and it broke
    radioMap[`${radioList1[i]}`] = [`${radioList2[i]}`];    // No maps I suppose
}

/* Will add the custom listener function to anything in here (only Object Type at the moment) */
const selectsWithSubs = Array.from(document.getElementsByClassName("hasSub"));
const selectsWithSubsIds = new Array(selectsWithSubs.length);
for (let i = 0; i < selectsWithSubs.length; i++){
    selectsWithSubsIds[i] = selectsWithSubs[i].id;
}

//debug
// function click(){
//     console.log("meow");
// }

/* To map corresponding selects to their child selects */
var subsMap = new Map();
let objectTypeChildren = document.getElementById("objectTypeChildren").children;
let objectTypeChildrenIds = new Array(objectTypeChildren.length);

for (let i = 0; i < objectTypeChildren.length; i++){
    objectTypeChildrenIds[i] = objectTypeChildren[i].id;
}

// For now doing this manually since there's only one with subs
subsMap.set("object-type", objectTypeChildrenIds);
addListenerToSelect("object-type", objectTypeChildrenIds)

// We use this so many times it should definitely be a variable
const searchSelectElement = document.getElementById("searchSelect");

/* Text box where path will appear */ 
let pathTextBox = document.getElementById("pathText");

/* ArrayList implementation for the created search path */
let currentPath = {
    
    nextIndex: 0,                   // To loop thru use this as length
    capacity: 10,                   // Size of array (change if needed)
    list: new Array(this.capacity),  // Size can be bigger/smaller just change it

    // For use when reset button is clicked
    reset(){
        this.nextIndex = 0;
        this.list = new Array(this.capacity);
    },

    // Add new element (assumes sufficient capacity)
    add(toAdd){
        this.list[this.nextIndex] = toAdd;
        this.nextIndex++;
        console.log(this.list)
    },

    // Get element (assumes in bounds)
    get(i){
        return this.list[i];
    }
};

/* Event listener for selecting what to search by */
searchSelectElement.addEventListener("change", function(){
/*Gets searchSelect value, pulling up the corresponding dropdown and hides searchSelect*/
    x = searchSelectElement.value;
    currentPath.add(x);
    updatePath();

    //pathTextBox.innerText 

        if (x != "inital"){
            searchSelectElement.style.visibility = "hidden";
            document.getElementById(`${x}`).style.visibility = "visible";

        /*General sub-filters that apply to every category, makes them visible*/

            document.getElementById("clearButton").style.visibility = "visible";
            document.getElementById('searchButton').style.visibility = "visible";

            if (x != "pcnum"){
                document.getElementById("fragmentSelect").style.visibility = "visible";
                document.getElementById("conservation-material").style.visibility = "visible";
                document.getElementById("conservation-action").style.visibility = "visible";
            }

            /*Sub-filters that apply only to biologicalFilters*/
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


/* Functions that fetch link based on user input */
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


/* Adds a listener to specified select menu to watch for specified selection */
function addListenerToSelect(parentID, childrenIDList) {
    document.getElementById(parentID).addEventListener("change", function(){

        e = document.getElementById(parentID);
        x = e.value;

        // We know there will only be one match so break unnecessary
        for (let child of childrenIDList) {
            if (x == child){
                e.style.visibility = "hidden";
                
                e = document.getElementById(x).style.visibility = "visible";

                currentPath.add(x);
                updatePath();
            }
        }
    });
}


/*Fills in the link dependng on the dropdown and option selected*/
function typeSearch(){
    searchType = searchSelectElement.value;
    let link = `https://opencontext.org/query/?proj=24-murlo&project-map=True&prop=`;

    if (selectsWithSubsIds.includes(searchType)){
        
        for (let i = 0; i < currentPath.nextIndex; i++){
            link = link.concat(`24-${currentPath.get(i)}---`);
        }
        link = link.concat(`24-${document.getElementById(currentPath.get(currentPath.nextIndex - 1)).value}`);
        console.log(`Added last (${currentPath.get(currentPath.nextIndex - 1)})`)
        
    } else {
        selectedType = document.getElementById(`${searchType}`).value;

        currentPath.add(selectedType);
        console.log(currentPath.list);
        updatePath();

        link = link.concat(`https://opencontext.org/query/?proj=24-murlo&project-map=True&prop=24-${searchType}---24-${selectedType}`);
    }
    /* Calls the subSearch function to look for any sub-filters that was inputted*/
    let appendList = subSearch();
    console.log(appendList);
    for (let i = 0; i < appendList.length; i++){
        link = link.concat(`${appendList[i]}`);
    }
    let finalLink = link.concat('&type=subjects#tab=3');
    return finalLink;
}

/* Button functions */
function openTab(){
    if (document.getElementById("pcnum").value.trim().length != 0){
        window.open(fetchByPC(), "_blank");
        document.getElementById("1").reset();
    } else { 
        window.open(typeSearch(), "_blank");
    } 
}

function clearSearch(){
    searchSelectElement.style.visibility = "visible";
    document.getElementById(`${searchSelectElement.value}`).style.visibility = "hidden";
    for (let i = 0; i < subFilterList.length; i++){
        document.getElementById(`${subFilterList[i]}`).style.visibility = "hidden";
    }

    document.getElementById("fragmentSelect").style.visibility = "hidden"
    document.getElementById("sexSelect").style.visibility = "hidden"

    // document.getElementById("conservation-material").style.visibility = "hidden"
    // document.getElementById("conservation-action").style.visibility = "hidden"
    // document.getElementById('searchButton').style.visibility = "hidden"
    // document.getElementById("preserved").style.visibility = "hidden"
    // document.getElementById("proximal-fused").style.visibility = "hidden"
    // document.getElementById("distal-fused").style.visibility = "hidden"
    // document.getElementById("side").style.visibility = "hidden"
    // document.getElementById("age-category").style.visibility = "hidden"
    // document.getElementById("skeletal-area").style.visibility = "hidden"
    // document.getElementById("resetButton").style.visibility = "hidden"

    currentPath.reset();

    pathTextBox.innerText = "Your search path will appear here!";
}

function returnHome(){
    window.open("https://poggiocivitate.net/projects/all/", "_self");
}

// The subSearch function appends any extra sub-filter categories to the URL

function subSearch(){
    let addTo = [];
    for (let i = 0; i < subFilterList.length; i++){
        x = document.getElementById(`${subFilterList[i]}`).value;
        if (x){
            console.log("a");
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

function updatePath(){
    text = `Current Path: ${currentPath.get(0)}`;
    for (let i = 1; i < currentPath.nextIndex; i++){
        text = text.concat(` : ${currentPath.get(i)}`);
    }
    console.log(text);
    pathTextBox.innerText = text;
} 