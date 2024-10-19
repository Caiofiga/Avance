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


var opts = {
  angle: -0.2, // The span of the gauge arc
  lineWidth: 0.2, // The line thickness
  radiusScale: 1, // Relative radius
  pointer: {
    length: 0.6, // // Relative to gauge radius
    strokeWidth: 0.035, // The thickness
    color: '#000000' // Fill color
  },
  limitMax: false,     // If false, max value increases automatically if value > maxValue
  limitMin: false,     // If true, the min value of the gauge will be fixed
  colorStart: '#6F6EA0',   // Colors
  colorStop: '#C0C0DB',    // just experiment with them
  strokeColor: '#EEEEEE',  // to see which ones work best for you
  generateGradient: true,
  highDpiSupport: true,     // High resolution support
  
};

var target = document.getElementById('foo'); // your canvas element
var gauge = new Gauge(target).setOptions(opts); // create sexy gauge!
gauge.maxValue = 100; // set max gauge value
gauge.setMinValue(-20);  // Prefer setter over gauge.minValue = 0
gauge.animationSpeed = 32; // set animation speed (32 is default value)


function adjustSpeedo(value) {
  gauge.set(value);
}
function Shake(){
  var elem = document.getElementById('shaking');
  if (elem.classList.contains('shaking')) { //kid is normal in his boots
    elem.classList.remove('shaking');
    elem.classList.add('normal');
    elem.innerHTML = "Normal";
  }
  else if (elem.classList.contains('normal')) { //kid is shaking in his boots
    elem.classList.remove('normal');
    elem.classList.add('shaking');
    elem.innerHTML = "Shaking";
  }
}
// Creating the Web Worker
const workerBlob = new Blob([`
  importScripts('https://cdn.socket.io/4.8.0/socket.io.min.js');
  let socket;

  self.onmessage = function(event) {
    if (event.data.type === 'openWebSocket') {
      const { url } = event.data.payload;
      socket = io.connect(url);
      console.log('WebSocket connection opened:', url);

      // Handle messages from the server
      socket.on('plant', (data) => {
        self.postMessage(data);  // Include type 'plant'
      });

      // Handle displacement messages from the server
      socket.on('movement', (data) => {
        self.postMessage(data);  // Include type 'displacement'
      });
    }
  };
`], { type: 'application/javascript' });

// Initialize the worker
const worker = new Worker(URL.createObjectURL(workerBlob));

// Define WebSocket URL
const socketUrl = 'ws://localhost:5000'; // Replace with your WebSocket URL

// Start the WebSocket connection inside the Web Worker
worker.postMessage({ type: 'openWebSocket', payload: { url: socketUrl } });

// Receive messages from the Web Worker
worker.onmessage = function(event) {
  json_data = JSON.parse(event.data).data;
  switch (json_data.type) {
    case 'movement':
      dx = json_data.displacement.dx;
      adjustSpeedo(dx); // Use the correct property from data if needed
      break;
    case 'plant':
      processData(json_data);  // Assuming data is JSON-parsed correctly
      break;
    default:
      console.log('Unknown message type:', json_data.type);
  }
};

function processData(data) {
  let id = parseInt(data.plant, 10);

  let circles = document.getElementsByClassName('circle');
  circles[id-1].style.backgroundColor = 'green';
}
