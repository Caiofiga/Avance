document.querySelectorAll(".folder-title").forEach((folderTitle) => {
  folderTitle.addEventListener("click", function () {
    const folder = this.parentElement;
    const content = this.nextElementSibling;

    // Toggle fullscreen mode
    if (!folder.classList.contains("fullscreen")) {
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


// Handle collapsible sections with animation
document.querySelectorAll(".folder").forEach((folder) => {
  folder.addEventListener("click", function () {
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
});



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

var plantTarget = document.getElementById('gauge1'); // your canvas element
var plantGauge = new Gauge(plantTarget,150,300).setOptions(opts); // create sexy plantGauge!
plantGauge.maxValue = 100; // set max plantGauge value
plantGauge.setMinValue(-20);  // Prefer setter over plantGauge.minValue = 0
plantGauge.animationSpeed = 32; // set animation speed (32 is default value)

var birdTarget = document.getElementById('gauge2'); // your canvas element
var birdGauge = new Gauge(birdTarget, 150,300).setOptions(opts); // Correct initialization
birdGauge.maxValue = 100; 
birdGauge.setMinValue(-20);  
birdGauge.animationSpeed = 32;


function adjustSpeedo(value, game) {
  switch (game) {
    case 'plant':
      let movement = value.dx
      plantGauge.set(movement); // Use the Gauge instance directly
      break;
    case 'bird':
      let angle = value.angle
      birdGauge.set(angle); // Use the Gauge instance directly
      break;
    default:
      console.warn('Unknown game type:', game);
  }
}




// Creating the Web Worker for the gauge and other data
const CommsworkerBlob = new Blob([`
  importScripts('https://cdn.socket.io/4.8.0/socket.io.min.js');
  let socket;

self.onmessage = function (event) {
  if (event.data.type === 'openWebSocket') {
    const { url } = event.data.payload;
    socket = io.connect(url);
    console.log('WebSocket connection opened:', url);

    // Generalized handler for all events
    socket.onAny((eventType, data) => {
      self.postMessage(data);
    });
  }
};
`], { type: 'application/javascript' });

// Initialize the worker
const Commworker = new Worker(URL.createObjectURL(CommsworkerBlob));

// Define WebSocket URL
const socketUrl = 'ws://localhost:5000'; // Replace with your WebSocket URL

// Start the WebSocket connection inside the Web Worker
Commworker.postMessage({ type: 'openWebSocket', payload: { url: socketUrl } });

// Receive messages from the Web Worker
Commworker.onmessage = function(event) {
  json_data = JSON.parse(event.data).data;
  console.log(json_data.type)
  switch (json_data.type) {
    case 'start':
    StartGame(json_data.game)
    break;
    case 'movement':
      dx = json_data.displacement;
      adjustSpeedo(dx, json_data.game);
      break;
    case 'plant':
      ShowPlantData(json_data); 
      break;
    case 'bird':
      ShowBirdData(json_data);
      break;
    default:
      console.warn('Unknown message type:', json_data.type);
  }
};

function StartGame(game){
  let gameDiv = document.getElementById(game);
  gameDiv.querySelector('#gameOverlay').style.display = 'none';
  if (game === "game_1") toggleGraph(plantGraph, true);
  else if (game === "game_2") toggleGraph(angleGraph, true);
}

function placeTimer(gameElement, time, id){
  let timeElement = gameElement.querySelector("#Time");
  let timer = document.createElement("p");
  timer.innerHTML = `Nivel ${id}: ${(time / 1000).toFixed(2)}`;
  timeElement.appendChild(timer);
  console.log()

}

function placePlantTimer(gameElement, time, id) {
  let timeElement = gameElement.querySelector("#Time");
  let existingTimer = timeElement.querySelector(`#timer_${id}`);
  if (existingTimer) existingTimer.remove(); // Remove old timer if exists

  let timer = document.createElement("p");
  timer.id = `timer_${id}`;
  timer.innerHTML = `Nivel ${id}: ${(time).toFixed(2)}`;
  timeElement.appendChild(timer);

}

function ShowPlantData(data) {
  let id = parseInt(data.plant, 10);
  let gameElement = document.getElementById('game_1');
  let circles = gameElement.getElementsByClassName('circle');
  circles[id - 1].style.backgroundColor = 'green';
  placePlantTimer(gameElement, data.time, id);

  if (data.completed) {
    toggleGraph(plantGraph, false);
    console.log("complete!");
    gameElement.querySelector("#finished_alert").style.display = 'flex';

    // Ajustando o fundo para algo mais visível
    gameElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Fundo claro
  }
}

function ShowBirdData(data) {
  let id = parseInt(data.level, 10);
  let gameElement = document.getElementById('game_2')
  let circles = gameElement.getElementsByClassName('circle');
  circles[id].style.backgroundColor = 'green';
  placeTimer(gameElement, data.time, id);

  if (data.completed){
    toggleGraph(angleGraph, false);
    console.log("complete!");
    gameElement.querySelector("#finished_alert").style.display = 'flex';
    gameElement.style ='background-color: rgba(0, 0, 0, 0.7)';
  }
}





