 // Initialize the Dygraph with empty data

const plantGraph = new Dygraph(
    document.getElementById("chart1"),
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
  const angleGraph = new Dygraph(
    document.getElementById("chart2"),
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

  $(document).on( 'shown.bs.tab', function (e) {
    plantGraph.resize(); // resize the dygraph
  });
  $(document).on( 'shown.bs.tab', function (e) {
    angleGraph.resize(); // resize the dygraph
  });

let dataBuffer = [];
  // Inline web worker creation
  const sensorWorkerCode = `
    let socket;
    onmessage = function (e) {
      if (e.data.type === "start") {
        let starttime = 0;
        console.log("sensor Worker started and ready to connect");

      // Ensure the URL is a full WebSocket URL
      let wsUrl;
      try {
        let url = e.data.url;
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          url = 'ws://' + url;
        }
        if (!url.endsWith('/ws')) {
          url += '/ws';
        }
        wsUrl = new URL(url);
      } catch (error) {
        console.error("Invalid URL provided:", e.data.url);
        return;
      }
      socket = new WebSocket(wsUrl.toString());


        socket.onopen = function (e) {
          console.log("WebSocket connected in sensor worker");
        };

        socket.onerror = function (e) {
          console.log("WebSocket error in sensor worker:", e);
        };

      socket.onmessage = function (event) {
      let message = JSON.parse(event.data);
      let accelData = { X: message.accelX, Y: message.accelY, Z: message.accelZ }; // {X, Y, Z} values
      let timestamp = message.timestamp;

      if (starttime === 0) {
        starttime = Date.now();
      }
      // Generate a timestamp based on elapsed time
      let elapsedTime = (Date.now() - starttime) / 1000; // Convert to seconds

        let workerresponse = { 
          timestamp: elapsedTime, 
          x: accelData.X, 
          y: accelData.Y, 
          z: accelData.Z 
        };
        postMessage(workerresponse);
        };
      } else if (e.data.type === "stop") {
        if (socket) {
          socket.close();
          console.log("WebSocket closed in sensor worker");
        }
      }
    };
  `;

  // Create a blob URL from the worker code
  const sensorWorkerBlob = new Blob([sensorWorkerCode], { type: "application/javascript" });
  const sensorWorkerUrl = URL.createObjectURL(sensorWorkerBlob);

  // Create the worker
  const sensorWorker = new Worker(sensorWorkerUrl);

  // Function to start the worker with the WebSocket URL
  function startSensorWorker(url) {
    sensorWorker.postMessage({ type: "start", url: url });
  }

  // Function to stop the worker
  function stopWorker() {
    sensorWorker.postMessage({ type: "stop" });
  }

  document.addEventListener("DOMContentLoaded", function() {
    // Attach the event handler after the DOM is fully loaded
    document.getElementById("wifi-form").addEventListener("submit", function(event) {
      event.preventDefault(); // Prevent the default form submission behavior
  
      // Get the value from the input field
      let ip = document.getElementById("wifi-text").value;  
      // Call your function with the IP
      startSensorWorker(ip);
    });
  });
  
    // shittyly calculated averages:
    // { time: 1.261, x: 0.0375, y: 0.0177, z: 9.864 }
    function is_shaking(x, y, z) {
      let thresholds = [0.0375, 0.0177, 9.864];
      return x > thresholds[0] || y > thresholds[1] || z > thresholds[2];
    }

  // Handle messages from the worker
  sensorWorker.onmessage = function (e) {
    let timestamp = e.data.timestamp;
    let x = e.data.x;
    let y = e.data.y;
    let z = e.data.z;
  
    if (is_shaking(x, y, z)) {
      $("#shaking").html("Shaking");
      $("#shaking").removeClass("normal");
      $("#shaking").addClass("shaking");

    } else {
      $("#shaking").html("Not Shaking");
      $("#shaking").removeClass("shaking");
      $("#shaking").addClass("normal");
    }
    
    // Append the new data to the buffer (timestamp, x, y, z)
    dataBuffer.push([timestamp, x, y, z]);

    // Buffer out old data from IRT graph, but keep it stored in permabuffer
    averages = null
    if (dataBuffer.length > 100) {

      dataBuffer.shift();
    }
  
    }
    // Update the Dygraph with the new data

  function toggleGraph(graph, enable){
     if (enable) graph.updateOptions({ file: dataBuffer });
     else graph.updateOptions({ file: null });
     console.log(graph);
  } 

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
