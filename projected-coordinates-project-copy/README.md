## READ ME
*Created by Malie Geery*

### Explaining this project!
This project consists of three main files-- the HTML file, the CSS file, and the Javascript file. All of these files work together to make this code work properly. The **converter.html** file contains all the basics of the website and takes input from the user, as well as displaying the results. The input and output screens both exist on the same page in this file, but using *display* in <style> tags allows us to control which one is shown at any given time. The **converterstyling.css** file stylizes the website, but also plays a very important role in making the loader animation worker correctly. The **conversionsonefunction.js** gets called by the HTML. This includes exactly one function, which first calls the loader. It automatically does the conversion to ESPG coordinates within the body of the code, but retrieves information from Open Context in order to convert the input into WGS coordinates. Finally, it hides the loader and reveals the results, giving the user the option to also make a new search. 

### About this project
This project was created by Malie Geery in 2025 as a part of the Poggio Civitate Data Science program. In the initial weeks of this program, we were working with a lot of data from the trenchbooks and learned that the coordinate system used in trenchbooks does not have immediate real-world applications, and that depending on what type of coordinate you wanted, you would have to use a different method to do conversions, whether it be doing math manually, or passing coordinates through Open Content. I wanted to create a way for users to be able to do the coordinate conversion all in one place, as quickly as possible. This project does the math for you, and passes information through OpenContext so that the user can quickly get the coordinates they need without any additional hassle.

### Acknowledgements
I want to extend my gratitude to Cole Reilly, Anthony Tuck, and the rest of the staff at Poggio Civitate for their support on this project and for the opportunity to work with the team this summer. I also want to thank my fellow data science students for all their help on this project and other projects over the summer.

### References
[Image by Engjell Gjepali](https://unsplash.com/photos/house-in-middle-of-grass-field-M0OIyN5u8ZM) <br />
[Source code used for creating loader](https://codepen.io/tashfene/pen/raEqrJ)
