import {dragBall, lockModal} from "./estilingue.js"
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

let lastangle = 0;

export function resetLastAngle(){
  lastangle = 0;
}
// Create a blob URL for the worker
const blob = new Blob([CameraworkerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.postMessage('Start');
worker.onmessage = function(event) {
    if (event.data.type === 'movement' && document.getElementById("gameScreen").style.display != "none") { //ingenious move by yours truly
      //I AM A FUCKING GENIUS WOOOOOOOOOOOOOOOOOOO
        let displacement = event.data.data;
        lockModal(displacement.angle);
        if (Math.abs(displacement.angle - lastangle) > 5) {
        let percentMoved = (displacement.angle - lastangle)/180 
        lastangle = displacement.angle;
        if (window.isinanchor) lastangle = 0;
        dragBall(percentMoved);
        }
        let admindata = JSON.stringify(
          { data:{
              game: 'bird',
              type: "movement",
              displacement: displacement
          }
          }
      )
        sendData(admindata);  // this is a shitty solution
    } else if (event.data.type === 'connection') {
        console.log(`[Connection Status] ${event.data.status}`, event.data.reason || '');
    } else if (event.data.type === 'error') {
        console.error('[Worker Error]', event.data.message);
    }
};

//endregion

//region Sensor Worker
export const permabuffer = [];

  // Inline web worker creation
  const sensorWorkerCode = `
    onmessage = function (e) {
      let starttime = 0;
      console.log("Worker started and ready to connect");
  
      const socket = new WebSocket(
        "ws://192.168.50.50:8080/sensor/connect?type=android.sensor.accelerometer"
      );
  
      socket.onopen = function (e) {
        console.log("WebSocket connected in worker");
      };
  
      socket.onerror = function (e) {
        console.log("WebSocket error in worker:", e);
      };
  
      socket.onmessage = function (event) {
        let message = JSON.parse(event.data);
        let data = message.values; // [x, y, z] values
        let timestamp = message.timestamp;
  
        if (starttime === 0) {
          starttime = timestamp;
        }
  
        // Calculate elapsed time in seconds
        let elapsedTime = (timestamp - starttime) / 1000000000;
        let workerresponse = { timestamp: elapsedTime, x: data[0], y: data[1], z: data[2] };
        postMessage(workerresponse);
      };
    };
  `;
  
  // Create a blob URL from the worker code
  const sensorWorkerBlob = new Blob([sensorWorkerCode], { type: "application/javascript" });
  const workerUrl = URL.createObjectURL(sensorWorkerBlob);
  
  // Create the worker
  const sensorWorker = new Worker(workerUrl);
  sensorWorker.postMessage("Start");
  
  // Handle messages from the worker
  sensorWorker.onmessage = function (e) {
    let timestamp = e.data.timestamp;
    let x = e.data.x;
    let y = e.data.y;
    let z = e.data.z;
  
    // Append the new data to the buffer (timestamp, x, y, z)
    permabuffer.push([timestamp, x, y, z]);

  };


//endregion

//region admin-data worker

// Create the Web Worker using a Blob

const adminWorkerBlob = new Blob([`
importScripts('https://cdn.socket.io/4.8.0/socket.io.min.js');
let socket;
self.onmessage = function(event) {
  if (event.data.type === 'openWebSocket') {
    const { url } = event.data.payload;
    socket = io.connect(url); // Use the full URL here
  } else if (event.data.type === 'sendData' && socket) {
    socket.emit('message_from_main', event.data.payload.dataBatch);
    self.postMessage('Admin Data sent to the server');
  }
};


`], { type: 'application/javascript' });




const adminWorker = new Worker(URL.createObjectURL(adminWorkerBlob));

// Function to open the WebSocket by sending a message to the Web Worker
function openWebSocket(url) {
  adminWorker.postMessage({ type: 'openWebSocket', payload: { url: url } });
}

// Function to send a batch of data through the Web Worker
export function sendData(dataBatch) {
    adminWorker.postMessage({ type: 'sendData', payload: { dataBatch: dataBatch } });
}


// Example usage:
openWebSocket('ws://localhost:5000');  // Replace with your WebSocket URL

//endregion


//region video-feed worker

const videoWorkerBlob = new Blob([`
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
`], { type: 'application/javascript' });

const videoWorker = new Worker(URL.createObjectURL(videoWorkerBlob));

// Set up the worker to handle incoming messages
videoWorker.onmessage = function(e) {
  // Extract the frame from the worker's message
  const frame = e.data.frame;

  // Update the image source in the HTML
  const img = document.getElementById("videoFeed");
  img.src = `data:image/jpeg;base64,${frame}`;
};

// Start the WebSocket connection via the worker
videoWorker.postMessage({ type: 'openWebSocket', url: 'http://localhost:5000' });



//endregion