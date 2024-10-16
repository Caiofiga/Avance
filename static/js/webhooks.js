import { handleMovement } from './testgamelogic.js';

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
const blob = new Blob([CameraworkerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.postMessage('Start');

worker.onmessage = function(event) {
    if (event.data.type === 'movement') {
        let displacement = event.data.data;
        handleMovement(displacement.dx);  // Trigger the movement in the game logic
    } else if (event.data.type === 'connection') {
        console.log(`[Connection Status] ${event.data.status}`, event.data.reason || '');
    } else if (event.data.type === 'error') {
        console.error('[Worker Error]', event.data.message);
    }
};

// Function to send messages to the server through the worker
function sendToServer(message) {
    worker.postMessage({ type: 'sendMessage', message: message });
}
//endregion

//region Sensor Worker
export const permabuffer = [];

  // Inline web worker creation
  const workerCode = `
    onmessage = function (e) {
      let starttime = 0;
      console.log("Worker started and ready to connect");
  
      const socket = new WebSocket(
        "ws://192.168.234.108:8080/sensor/connect?type=android.sensor.accelerometer"
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
  const workerBlob = new Blob([workerCode], { type: "application/javascript" });
  const workerUrl = URL.createObjectURL(workerBlob);
  
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