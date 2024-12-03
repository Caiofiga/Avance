let calibratingDistance = false;
let calibratingAngle = false;
let calibratedDistance = false;
let calibratedAngle = false;
//region Camera Worker
const CameraworkerCode = `
    self.onmessage = function(event) {
        const socket = new WebSocket('ws://localhost:6789');

        socket.onopen = function(e) {
            postMessage({ type: 'connection', status: 'open' });
        };

        socket.onmessage = function(event) {
            try {
                let displacement = JSON.parse(event.data);  // Receive and parse {dx, dy} from the server
                postMessage({ type: 'movement', data: displacement });  // Send data back to the main thread
            } catch (err) {
                postMessage({ type: 'error', message: 'Error parsing message data: ' + err });
            }
        };

        socket.onclose = function(event) {
            if (event.wasClean) {
                postMessage({ type: 'connection', status: 'closed', reason: event.reason });
            } else {
                postMessage({ type: 'connection', status: 'closed', reason: 'Connection died' });
            }
        };

        socket.onerror = function(event) {
            postMessage({ type: 'error', message: 'WebSocket error observed: ' + event });
        };

        // Listen for messages from the main thread
        self.onmessage = function(event) {
            if (event.data.type === 'sendMessage' && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(event.data.message));
            }
        };
    };
`;

// Create a blob URL for the worker
const blob = new Blob([CameraworkerCode], { type: "application/javascript" });
const worker = new Worker(URL.createObjectURL(blob));
worker.postMessage("Start");
worker.onmessage = function (event) {
  if (
    event.data.type == "movement" &&
    document.getElementById("mainScreen").style.display != "none" &&
    event.data.data.dx != undefined
  ) {
    adjustSpeedo(event.data.data);
  }
};
//endregion

//region video-feed worker

const videoWorkerBlob = new Blob(
  [
    `
    importScripts('https://cdn.socket.io/4.8.0/socket.io.min.js');
    let socket;
  
    self.onmessage = function(event) {
      if (event.data.type === 'openWebSocket') {
        // Initialize WebSocket connection
        socket = io(event.data.url);
  
        // Handle incoming video feed from the server
        socket.on("video_feed", function(data) {
          // Send the frame to the main thread
          self.postMessage({ frame: data.frame });
        });
      }
    };
  `,
  ],
  { type: "application/javascript" }
);

const videoWorker = new Worker(URL.createObjectURL(videoWorkerBlob));

// Set up the worker to handle incoming messages
videoWorker.onmessage = function (e) {
  // Extract the frame from the worker's message
  const frame = e.data.frame;

  // Update the image source in the HTML
  const img = document.getElementById("videoFeed");
  img.src = `data:image/jpeg;base64,${frame}`;
};

// Start the WebSocket connection via the worker
videoWorker.postMessage({
  type: "openWebSocket",
  url: "http://localhost:5000/camera",
});

//endregion

document.getElementById("startButton").addEventListener("click", () => {
  document.getElementById("startScreen").style.display = "none";
  document.getElementById("mainScreen").style.display = "flex";
  document.getElementById("video_feed").style.display = "flex";
});

var opts = {
  angle: 0.15, // The span of the gauge arc
  lineWidth: 0.44, // The line thickness
  radiusScale: 1, // Relative radius
  pointer: {
    length: 0.6, // // Relative to gauge radius
    strokeWidth: 0.035, // The thickness
    color: "#000000", // Fill color
  },
  limitMax: false, // If false, max value increases automatically if value > maxValue
  limitMin: false, // If true, the min value of the gauge will be fixed
  colorStart: "#6FADCF", // Colors
  colorStop: "#8FC0DA", // just experiment with them
  strokeColor: "#E0E0E0", // to see which ones work best for you
  generateGradient: true,
  highDpiSupport: true, // High resolution support
  gaugeColor: "#ff0000",
};

//region gauge updating stuff
let max_values = [0, 0];
var distanceHTML = document.getElementById("gauge1"); // your canvas element
var DisplacementGauge = new Gauge(distanceHTML, 150, 300).setOptions(opts); // create sexy DisplacementGauge!
DisplacementGauge.maxValue = 300; // set max plant Gauge value
DisplacementGauge.setMinValue(0); // Prefer setter over DisplacementGauge.minValue = 0
DisplacementGauge.animationSpeed = 32; // set animation speed (32 is default value)

var angleHTML = document.getElementById("gauge2"); // your canvas element
var angleGauge = new Gauge(angleHTML, 150, 300).setOptions(opts); // create sexy angleGauge!
angleGauge.maxValue = 300; // set max plant Gauge value
angleGauge.setMinValue(0); // Prefer setter over angleGauge.minValue = 0
angleGauge.animationSpeed = 32; // set animation speed (32 is default value)

let maxdisplacement = document.getElementById("maxDisplacement");
let maxAngle = document.getElementById("maxAngle");

function adjustSpeedo(value) {
  if (calibratingDistance && !calibratedDistance) {
    let movement = value.dx;
    DisplacementGauge.set(Math.abs(movement));
    if (movement > max_values[0]) {
      max_values[0] = movement;
      updateMaxValueMarker(
        movement,
        DisplacementGauge,
        maxdisplacement,
        "Distancia Maxima"
      );
    }
  } else if (calibratingAngle && !calibratedAngle) {
    let movement = value.angle;
    angleGauge.set(movement);
    if (movement > max_values[1]) {
      max_values[1] = movement;
      updateMaxValueMarker(movement, angleGauge, maxAngle, "Angulo Maximo");
    }
  }
}
function updateMaxValueMarker(maxValue, gauge, displacement, words) {
  // Define a small range around the max value to highlight
  const markerWidth = 1; // Adjust as needed
  const minMarker = maxValue - markerWidth / 2;
  const maxMarker = maxValue + markerWidth / 2;
  // Update the staticZones to include the new max value marker
  gauge.options.staticZones = [
    {
      strokeStyle: "#ADD8E6",
      min: 0,
      max: maxMarker,
    },
    {
      strokeStyle: "#FFCCCB",
      min: maxMarker,
      max: 300,
    },
  ];

  gauge.set(gauge.value);
  displacement.innerHTML = `${words}: ${maxValue.toFixed(2)}`;
}
//endregion

function submitCalibration() {
  fetch("/calibration", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDistance: max_values[0],
      maxAngle: max_values[1],
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Calibration data submitted successfully:", data);
      calibratedDistance = true;
      calibratedAngle = true;
      window.location.href = "/";
    })
    .catch((error) => {
      console.error("Error submitting calibration data:", error);
    });
}

document.getElementById("regadorCard").addEventListener("click", function () {
  calibratingDistance = true;
  calibratingAngle = false;
  document.getElementById("regadorCalibration").style.display = "flex";
  document.getElementById("EstilingueCalibration").style.display = "none";
  // Set the position of the calibration to that of the card
  const cardPosition = this.getBoundingClientRect();
  const calibrationElement = document.getElementById("regadorCalibration");
  calibrationElement.style.top = `${cardPosition.top}px`;
  calibrationElement.style.left = `${cardPosition.left}px`;
  document.getElementById("regadorCard").classList.add("invisible");
  document.getElementById("estilingueCard").classList.remove("invisible");
});

document
  .getElementById("estilingueCard")
  .addEventListener("click", function () {
    calibratingDistance = false;
    calibratingAngle = true;
    document.getElementById("regadorCalibration").style.display = "none";
    document.getElementById("EstilingueCalibration").style.display = "flex";
    // Set the position of the calibration to that of the card
    const cardPosition = this.getBoundingClientRect();
    const calibrationElement = document.getElementById("EstilingueCalibration");
    calibrationElement.style.top = `${cardPosition.top}px`;
    calibrationElement.style.left = `${cardPosition.left}px`;
    document.getElementById("regadorCard").classList.remove("invisible");
    document.getElementById("estilingueCard").classList.add("invisible");
  });
