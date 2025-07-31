/* Event listener for enter key trigger */
    document.addEventListener("keyup", function(event){
        event.preventDefault();
        if (event.keyCode === 13){
            document.getElementById('searchButton').click();
        }
    });

/* Event listener for selecting what to search by */
    document.getElementById("searchSelect").addEventListener("change", function(){
  /*Gets searchSelect value, pulling up the corresponding dropdown and hides searchSelect*/
        x = document.getElementById("searchSelect").value
         if (x != "inital") {
            document.getElementById("searchSelect").style.visibility = "hidden"
            document.getElementById(`${x}`).style.visibility = "visible"

        /*General sub-filters that apply to every category, makes them visible*/

            document.getElementById("resetButton").style.visibility = "visible"
            document.getElementById('searchButton').style.visibility = "visible"

         if (x != "pcnum") {
            document.getElementById("fragmentSelect").style.visibility = "visible"
            document.getElementById("conservation-material").style.visibility = "visible"
            document.getElementById("conservation-action").style.visibility = "visible"
        }

        /*Sub-filters that apply only to biologicalFilters*/
        var biologicalFilters = ['taxon', 'element', 'common-name']
        if(biologicalFilters.includes(document.getElementById("searchSelect").value)) {
            document.getElementById("preserved").style.visibility = "visible"
            document.getElementById("proximal-fused").style.visibility = "visible"
            document.getElementById("distal-fused").style.visibility = "visible"
            document.getElementById("side").style.visibility = "visible"
            document.getElementById("age-category").style.visibility = "visible"
            document.getElementById("skeletal-area").style.visibility = "visible"
            document.getElementById("sexSelect").style.visibility = "visible"
        }
    }
}
);

/* Functions that fetch link based on user input */

    function fetchByPC() {
        pcNumber = document.getElementById("pcnum").value;
        if (pcNumber.includes("PC") && pcNumber.includes(" ")) {
            var URL = (`https://opencontext.org/query/?q=${pcNumber}&type=subjects#tab=3`);
            return URL
        } else {
            if (pcNumber.includes("PC") == false && pcNumber.includes(" ")){
                var URL = (`https://opencontext.org/query/?q=PC${pcNumber}&type=subjects#tab=3`);
                return URL
            }
            else {
            if(pcNumber.includes("PC") && pcNumber.includes(" ") == false) {
                justNum = pcNumber.slice(2, 10)
                var URL = (`https://opencontext.org/query/?q=PC-${justNum}&type=subjects#tab=3`);
                return URL
            } else {
                if(pcNumber.includes("PC") == false && pcNumber.includes(" ") == false){
                var URL = (`https://opencontext.org/query/?q=PC-${pcNumber}&type=subjects#tab=3`); 
                return URL
                }
            }
        }
    }
    }


    /*Fills in the link dependng on the dropdown and option selected*/
    function typeSearch(){
        searchType = document.getElementById("searchSelect").value
        selectedType = document.getElementById(`${searchType}`).value
        let link = `https://opencontext.org/query/?proj=24-murlo&project-map=True&prop=24-${searchType}---24-${selectedType}`

        /* Calls the subSearch function to look for any sub-filters that was inputted*/
        var appendList = subSearch()
        console.log(appendList)
        for (let i = 0; i < appendList.length; i++){
            link = link.concat(`${appendList[i]}`)
        }
        let finalLink = link.concat('&type=subjects#tab=3')
        return finalLink
    }

    /* Button functions */
    function openTab(){
        if (document.getElementById("pcnum").value.trim().length != 0) {
            window.open(fetchByPC(), "_blank");
            document.getElementById("1").reset();
        } else { 
            window.open(typeSearch(), "_blank");
        } 
    }

function reset(){
        document.getElementById("searchSelect").style.visibility = "visible" 
        document.getElementById(`${document.getElementById("searchSelect").value}`).style.visibility = "hidden"
        document.getElementById("fragmentSelect").style.visibility = "hidden"
        document.getElementById("conservation-material").style.visibility = "hidden"
        document.getElementById("conservation-action").style.visibility = "hidden"
        document.getElementById('searchButton').style.visibility = "hidden"
        document.getElementById("preserved").style.visibility = "hidden"
        document.getElementById("proximal-fused").style.visibility = "hidden"
        document.getElementById("distal-fused").style.visibility = "hidden"
        document.getElementById("side").style.visibility = "hidden"
        document.getElementById("age-category").style.visibility = "hidden"
        document.getElementById("skeletal-area").style.visibility = "hidden"
        document.getElementById("sexSelect").style.visibility = "hidden"
        document.getElementById("resetButton").style.visibility = "hidden"
    }

    /* An array and dictionary of all sub-filter ids, to fetch their value if needed and append them to the link*/

    let subFilterList = ['preserved', 'proximal-fused', 'distal-fused', 'side', 'age-category', 'skeletal-area', 'conservation-action', 'conservation-material']
    let radioDict = {true:'fragment-noted', false:'fragment-noted', female:'sex', male: 'sex'};

    function subSearch(){
        var addTo = [];
        for (let i = 0; i < subFilterList.length; i++){
            x = document.getElementById(`${subFilterList[i]}`).value
            if(x) {
                console.log("a")
                addTo.push(`&prop=24-${subFilterList[i]}---24-${x}`);
            }
        }
        radioOptions = Object.keys(radioDict)
        for (let ind = 0; ind < radioOptions.length; ind++){
            if(document.getElementById(`${radioOptions[ind]}`).checked){
                addTo.push(`&prop=24-${radioDict[radioOptions[ind]]}---24-${radioOptions[ind]}`);
            }
        }
       return addTo
    }
