 // Initialize the Dygraph with empty data

const graph1 = new Dygraph(
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
  const graph2 = new Dygraph(
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


let dataBuffer = [];
  
  // Inline web worker creation
  const sensorWorkerCode = `
    onmessage = function (e) {
      let starttime = 0;
      console.log("sensor Worker started and ready to connect");
  
      const socket = new WebSocket(
        "ws://192.168.68.21:8765/"
      );
  
      socket.onopen = function (e) {
        console.log("WebSocket connected in sensor worker");
      };
  
      socket.onerror = function (e) {
        console.log("WebSocket error in sensor worker:", e);
      };
  
      socket.onmessage = function (event) {
        let message = JSON.parse(event.data);
        let data = message.accel; // [x, y, z] values
        let timestamp = message.timestamp;
  
        if (starttime === 0) {
          starttime = timestamp;
        }
  
        // Calculate elapsed time in seconds
        let elapsedTime = timestamp
        let workerresponse = { timestamp: elapsedTime, x: data[0], y: data[1], z: data[2] };
        postMessage(workerresponse);
      };
    };
  `;
  
  // Create a blob URL from the worker code
  const sensorWorkerBlob = new Blob([sensorWorkerCode], { type: "application/javascript" });
  const sensorWorkerUrl = URL.createObjectURL(sensorWorkerBlob);
  
  // Create the worker
  const sensorWorker = new Worker(sensorWorkerUrl);
  sensorWorker.postMessage("Start");
  

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

    function UpdateGraph(game){
      switch (game){
      case 'plant':
        graph1.updateOptions({ file: dataBuffer });
        graph2.updateOptions({ file: null });
        break;
      case 'bird':
        graph2.updateOptions({ file: dataBuffer });
        graph1.updateOptions({ file: null });
        break;
      default:
        graph1.updateOptions({ file: null });
        graph2.updateOptions({ file: null });
        break;
      }
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
