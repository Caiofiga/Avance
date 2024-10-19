document.querySelectorAll(".folder-title").forEach((folderTitle) => {
    folderTitle.addEventListener("click", function () {
      const folder = this.parentElement;
      const content = this.nextElementSibling;

      // Toggle fullscreen mode
      if (!folder.classList.contains("fullscreen")) {
        // Expand to fullscreen
        folder.classList.add("fullscreen");
        content.style.display = "block";

        // Add a close button
        const closeButton = document.createElement("div");
        closeButton.innerHTML = "&times;";
        closeButton.classList.add("close-button");
        closeButton.addEventListener("click", function () {
          folder.classList.remove("fullscreen");
          content.style.display = "none";
          closeButton.remove();
        });
        folder.appendChild(closeButton);
      }
    });
  });

var coll = document.getElementsByClassName("folder");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
}

let green_counter = 0
function TurnGreen() {
    let circles = document.getElementsByClassName('circle');
    circles[green_counter].style.backgroundColor = 'green';
    green_counter++
}