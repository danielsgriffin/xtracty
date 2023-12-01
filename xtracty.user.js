// ==UserScript==
// @name         xtracty
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Extract URL, username, name, date, images, and text from a tweet link
// @author       You
// @match        https://twitter.com/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    function extractInfo() {
        // Get the tweet link from the page
        var tweetLink = window.location.href;

        // Remove anything in the URL after (and including) the `?`
        tweetLink = tweetLink.split('?')[0];
        console.log("xtracty:tweetLink:", tweetLink);

        // Extract the username from the tweet link
        var username = tweetLink.split('/')[3];

        // Extract the statusID from the tweet link
        var statusID = tweetLink.split('/')[5];

        // Extract the name
        var nameElement = document.querySelector('a[href="/' + username + '"] div[dir="ltr"] > span:first-child > span');
        var name = "Name not found";
        if (nameElement) {
            name = nameElement.textContent.trim();
        }
        console.log("xtracty:name=", name);


        function get_datetime(tweetLink) {
            let datetime;
            // get all anchor elements
            let a = document.getElementsByTagName('a');
            // filter all anchor elements for anchors with href attr matching the statusID, check all TIME elements in children of those anchors for datetime attr
            for (let i = 0; i < a.length; i++) {
                if (a[i].href.includes(statusID)) {
                    // check for time element in children
                    let children = a[i].children;
                    for (let j = 0; j < children.length; j++) {
                        if (children[j].tagName === "TIME") {
                            datetime = children[j].getAttribute('datetime');
                            break;
                        }
                    }
                }
            }
            // if no datetime found, alert user of failure and crash.
            if (!datetime) {
                alert("xtracty: No datetime found. Please try again or submit an issue at https://github.com/danielsgriffin/xtracty/issues/new/");
                throw new Error("xtracty: No datetime found. Please try again.");
            }
            return datetime;
            
        }    
        let fullDatetime = get_datetime(tweetLink);

        // create a new URL object and get the pathname
        var tweetPath = new URL(tweetLink).pathname;

        // find 'a' element with the href attribute equal to tweetPath
        var aElement = document.querySelector('a[href="' + tweetPath + '"]');

        var textElement;

        if (aElement) {
            // go up six levels
            var ancestor = aElement;
            for (var i = 0; i < 6 && ancestor != null; i++) {
                ancestor = ancestor.parentElement;
            }

            // find the 'div' containing the tweet text within the ancestor
            if (ancestor) {
                textElement = ancestor.querySelector('div[dir="auto"][data-testid="tweetText"]');
            }
        }

        // if no specific tweet is found, get the first tweetText
        if (!textElement) {
            textElement = document.querySelector('div[dir="auto"][data-testid="tweetText"]');
        }

        if (textElement) {
            console.log(textElement.textContent); // or whatever you want to do with the text
        }
        var text = textElement ? textElement.textContent.trim() : "Text not found";



        // Extract image URLs from the tweet
        var images = extractImageUrlsFromTweet(tweetPath);

        function extractImageUrlsFromTweet(tweetPath) {
            console.log("xtracty: Starting extraction of image URLs from the tweet");
            console.log("xtracty: tweetPath: ", tweetPath);

            // Select all link elements that have href attribute starting with tweetPath and ending with /photo/*
            var linkElements = document.querySelectorAll(`a[href^="${tweetPath}/photo/"]`);
            console.log("xtracty: linkElements: ", linkElements);
            var images = [];

            linkElements.forEach(function (linkElement) {
                // Check if the link contains an img element
                var imgElement = linkElement.querySelector('img');
                if (imgElement && imgElement.src) {
                    console.log("xtracty: Found image URL: ", imgElement.src);
                    images.push(imgElement.src);
                } else {
                    console.log("xtracty: No img element or src found in linkElement: ", linkElement);
                }
            });

            console.log("xtracty: Finished extraction of image URLs. Total images found: ", images.length);
            console.log("xtracty: images: ", images);
            return images;
        }

        // Function to download an image
        async function downloadImage(imageUrl, filename) {
            try {
                // Fetch the image from the URL
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                // Get the Blob from the response
                const blob = await response.blob();

                // Create a URL for the Blob
                const url = window.URL.createObjectURL(blob);

                // Create a temporary link element
                var link = document.createElement('a');
                link.href = url;
                link.download = filename;

                // Append the link to the document
                document.body.appendChild(link);

                // Programmatically click the link to trigger the download
                link.click();

                // Clean up by revoking the Object URL and removing the link
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);
            } catch (error) {
                console.error('Error downloading image:', error);
            }
        }

        // Check if there are images
        if (images && images.length > 0) {

            // Get the user's directory preference from local storage
            var dir = localStorage.getItem('imageDirectoryPreference');

            // Function to prompt the user to select a directory
            async function selectDirectory() {
                if ('showDirectoryPicker' in window) {
                    try {
                        // Ensure the correct context for 'showDirectoryPicker'
                        const handle = await window.showDirectoryPicker();
                        console.log('Directory selected:', handle);
                        return handle;
                    } catch (e) {
                        console.error('Directory selection was cancelled or failed:', e);
                        // See possible bug: https://github.com/Tampermonkey/tampermonkey/issues/1876
                        return null;
                    }
                } else {
                    console.log('The File System Access API is not supported in this browser.');
                    return null;
                }
            }

            // Check if directory is null or "null"
            if (dir == null || dir === "null") {
                selectDirectory().then((selectedDir) => {
                    if (selectedDir) {
                        // Save the selected directory to local storage
                        localStorage.setItem('imageDirectoryPreference', selectedDir);
                        dir = selectedDir;
                    } else {
                        console.log('No directory was selected.');
                    }
                });
            }

            var imageFilenames = []
            // Download each image
            images.forEach(function (imageUrl) {

                // Extract the image path from the URL
                var imagePath = imageUrl.split('/').pop();
                // Remove everything to the right of a '?', inclusive
                imagePath = imagePath.split('?')[0];
                // Add .jpeg to the image path
                imagePath += ".jpeg";
                // Construct the filename:
                if (dir == null || dir === "null") {
                    var filename = imagePath
                } else {
                    var filename = dir + '/' + imagePath;
                }
                // Download the image
                // Add each filename to imageFilenames
                imageFilenames.push(filename);

                downloadImage(imageUrl, filename).then(() => {
                    console.log('Image downloaded successfully');
                }).catch((error) => {
                    console.error('Error downloading image:', error);
                });
            });

        }

        // Prepare JSON for display and clipboard
        var tweetInfo = {
            'URL': tweetLink,
            'Username': username,
            'Name': name,
            'Status ID': statusID,
            'Full Datetime': fullDatetime,
            'Text': text,
            'Images': imageFilenames
        };

        // Convert the JSON to YAML.
        const yamlItem = convertToYaml(tweetInfo);

        // Copy the YAML to the clipboard
        GM_setClipboard(yamlItem);
        var yamlNoticeBox = document.createElement("div");
        yamlNoticeBox.innerHTML = "YAML copied to clipboard! <hr>" + yamlItem.replace(/\n/g, "<br>");
        yamlNoticeBox.id = "yaml-notice-box";
        yamlNoticeBox.style.position = "fixed";
        yamlNoticeBox.style.zIndex = 10001;  // Ensure the alert box is always on top
        yamlNoticeBox.style.width = "50%";
        yamlNoticeBox.style.height = "50%";
        yamlNoticeBox.style.left = "25%";
        yamlNoticeBox.style.top = "25%";
        yamlNoticeBox.style.padding = "20px";
        yamlNoticeBox.style.backgroundColor = "white";
        yamlNoticeBox.style.border = "1px solid black";
        yamlNoticeBox.style.overflow = "auto";
        document.body.appendChild(yamlNoticeBox);

        // Add a big dismiss button about 1/4 way up
        var dismissButton = document.createElement("button");
        dismissButton.textContent = "Dismiss";
        dismissButton.style.position = "absolute";
        dismissButton.style.bottom = "25%";
        dismissButton.style.left = "50%";
        dismissButton.style.transform = "translate(-50%, -50%)";
        dismissButton.style.padding = "10px";
        dismissButton.style.backgroundColor = "blue";
        dismissButton.style.border = "2px solid darkblue";
        dismissButton.style.borderRadius = "5px";
        dismissButton.style.color = "white";
        dismissButton.style.textAlign = "center";
        dismissButton.style.textDecoration = "none";
        dismissButton.style.display = "inline-block";
        dismissButton.style.fontSize = "30px";
        dismissButton.style.cursor = "pointer";
        dismissButton.addEventListener("click", function () {
            document.body.removeChild(yamlNoticeBox);
        });
        yamlNoticeBox.appendChild(dismissButton);

        // Dismiss the alert box when Enter key is pressed
        window.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                document.body.removeChild(yamlNoticeBox);
            }
        });
    }


    function convertToYaml(data) {

        /*
        * Here is the code from _includes/weblinks.html that the images field has to integrate with:
        * {% if weblink.images %}
        * {% for image in weblink.images %}
        * <img src="/images/{{ image[0] }}" class="card-img-bottom border p-0 m-0" alt="{{ image[1] | escape }}">
        * {% endfor %}
        * {% endif %}
        * {% if weblink.images %}
        * {% for image in weblink.images %}
        * <img src="/images/{{ image[0] }}" class="card-img-bottom border p-0 m-0" alt="{{ image[1] | escape }}">
        * {% endfor %}
        * {% endif %}
        *
        * Here is an example of a single item images array in weblinks.yml:
        * ```
        *   images:
        *     - ["F40voNGa4AAGiQI.png", "The word 'skip' is highlighted in the sentence: The robot is not, in my opinion, a skip."]
        * ```
        */
        // Convert the images array to a string that functions as an array in YAML
        function convertImagesArrayToYaml(images) {
            var imagesListAsStr = `
  images:
`;
            for (var i = 0; i < images.length; i++) {
                imagesListAsStr += '    - ["' + images[i] + '", "Image ' + (i + 1) + '"]';
                if (i < images.length - 1) {
                    imagesListAsStr += '\n';
                }
            }
            return imagesListAsStr;
        }

        var imagesListAsStr = '';
        var images = data['Images']
        if (images && images.length > 0) {
            imagesListAsStr = convertImagesArrayToYaml(images);
        }
        const username = data['Username'];
        const tweetUrl = data['URL'];
        const text = data['Text'];
        const name = data["Name"]
        const fullDatetime = new Date(data['Full Datetime']);
        const dateStr = fullDatetime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        let lines = text.split('\n');
        let newText = lines.map(line => '    ' + line).join('<br>\n');
        let yamlItem = `${tweetUrl}:
  username: ${username}
  name: ${name}
  source: Twitter
  date: ${dateStr}${imagesListAsStr}
  text: |
${newText}

{% include weblinks.html url="${tweetUrl}" center=true %}
`
        return yamlItem;
    }

    var svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-stars" viewBox="0 0 16 16"><path transform="rotate(90 8 8)" d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z" /><path transform="rotate(45 8 8)" d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z" /></svg>`
    svgIcon = svgIcon.replace('fill="currentColor"', 'fill="#FFFF00"');

    // Create a floating button with nice formatting
    var btn = document.createElement("button");
    btn.style.position = "fixed";
    btn.style.top = "20px";
    btn.style.left = "50%";
    btn.style.transform = "translateX(-50%)";
    btn.style.zIndex = "10000";  // Ensure the button is always on top
    btn.style.borderRadius = "50%";  // Circle
    btn.style.width = "50px";
    btn.style.height = "50px";
    btn.style.fontSize = "24px";
    btn.style.color = "black";
    btn.style.backgroundColor = "black";
    btn.style.border = "none";  // Remove border
    btn.style.textAlign = "center";
    btn.style.cursor = "pointer";
    btn.setAttribute("aria-label", "Extract tweet information into YAML.");
    btn.setAttribute("title", "Extract tweet information into YAML.");
    var iconNode = document.createElement("span");
    iconNode.innerHTML = svgIcon;
    btn.appendChild(iconNode);


    // Create a div for the hover text
    var hoverDiv = document.createElement("div");
    hoverDiv.style.position = "fixed";
    hoverDiv.style.top = "33px";
    hoverDiv.style.left = "50%";
    hoverDiv.style.height = "20px";
    hoverDiv.style.width = "120px";
    hoverDiv.style.padding = "5px";
    hoverDiv.style.transform = "translateX(0%)";
    hoverDiv.style.zIndex = "9999";  // Ensure the div is just below the btn
    hoverDiv.style.color = "white";  // White text
    hoverDiv.style.backgroundColor = "black";  // Black background
    hoverDiv.style.textAlign = "center";
    hoverDiv.style.display = "none";  // Initially hidden
    hoverDiv.style.borderRadius = "10px";  // Slightly rounded
    hoverDiv.style.fontFamily = "Courier New, monospace";  // Robotic or old time console font
    hoverDiv.innerHTML = "xtracty";

    // Show the div when the button is hovered
    btn.addEventListener("mouseover", function () {
        hoverDiv.style.display = "block";
    });

    // Hide the div when the button is no longer hovered
    btn.addEventListener("mouseout", function () {
        hoverDiv.style.display = "none";
    });

    document.body.appendChild(btn);
    document.body.appendChild(hoverDiv);

    // Set up the button click event
    btn.addEventListener("click", extractInfo);

})();
