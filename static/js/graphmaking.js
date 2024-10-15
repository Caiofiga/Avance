 // Initialize the Dygraph with empty data
 /*
const g = new Dygraph(
    document.getElementById("chart"),
    [], // Initial empty dataset
    {
      title: "Real-time Accelerometer Data",
      labels: ["Elapsed Time (s)", "X-axis", "Y-axis", "Z-axis"],
      ylabel: "Acceleration (m/s²)",
      xlabel: "Time (seconds)",
      colors: ["#FF6F61", "#6ABF69", "#6A9FF2"],
      strokeWidth: 2.5,
      drawPoints: true,
      pointSize: 4,
      showRoller: false,
      legend: "always",
    }
  );
  */
 export const permabuffer = [];
  let dataBuffer = [];
  
  // Inline web worker creation
  const workerCode = `
    onmessage = function (e) {
      let starttime = 0;
      console.log("Worker started and ready to connect");
  
      const socket = new WebSocket(
        "ws://192.168.246.209:8080/sensor/connect?type=android.sensor.accelerometer"
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
    dataBuffer.push([timestamp, x, y, z]);
  
    // Buffer out old data from IRT graph, but keep it stored in permabuffer
    if (dataBuffer.length > 100) {
      permabuffer.push(dataBuffer.shift());
    }
  
    // Update the Dygraph with the new data
    g.updateOptions({
      file: dataBuffer,
    });
  };


  function averages(){
    permabuffer.forEach((point) => {
   //each point is a dict of 4 values 
   //{time, x, y, z}
      let timeavg = permabuffer.reduce((acc, point) => acc + point[0], 0) / permabuffer.length;
      let xavg = permabuffer.reduce((acc, point) => acc + point[1], 0) / permabuffer.length;
      let yavg = permabuffer.reduce((acc, point) => acc + point[2], 0) / permabuffer.length;
      let zavg = permabuffer.reduce((acc, point) => acc + point[3], 0) / permabuffer.length;
      console.log({ time: timeavg, x: xavg, y: yavg, z: zavg });
      return { time: timeavg, x: xavg, y: yavg, z: zavg };
  });}
  function ExportGraph() {


    $.ajax({
        type: "POST",
        url: "http://localhost:5000/savegraph",
        contentType: "application/json",  // Set the content type to JSON
        data: JSON.stringify({ data: points }),  // Serialize the data to JSON
        success: function (response) {
            console.log(response);
        },
        error: function (xhr, status, error) {
            console.error("Error during export:", error);
        }
    });
}
