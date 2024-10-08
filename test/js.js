// Initialize the Dygraph with empty data
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
  
  const permabuffer = [];
  let dataBuffer = [];
  
  // Inline web worker creation
  const workerCode = `
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
        console.log("Message received in worker:", event.data);
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
  
  // SVG Export Function
  function exportAsSVG() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const maxWidth = 800; // Max width before wrapping
    const rowHeight = 100; // Height per row of the graph
    
    let currentRow = 0; // Track the current row number
    let currentXOffset = 0; // X-offset for the current row
  
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("width", maxWidth);
    svg.setAttribute("height", rowHeight); // Start with one row's height
    
    // Combine permabuffer and dataBuffer
    const fullData = permabuffer.concat(dataBuffer);
    const labels = g.getLabels();
  
    // Create title for the SVG
    const title = document.createElementNS(svgNamespace, "text");
    title.setAttribute("x", maxWidth / 2);
    title.setAttribute("y", 30);
    title.setAttribute("text-anchor", "middle");
    title.textContent = "Real-time Accelerometer Data";
    svg.appendChild(title);
  
    // Generate line paths based on fullData
    for (let i = 1; i < labels.length; i++) {
      const path = document.createElementNS(svgNamespace, "path");
      let pathData = "";
      let xOffset = 0;
  
      for (let j = 0; j < fullData.length; j++) {
        // Scale x and y for visualization, adjust based on current row
        const x = (fullData[j][0] * 10) + currentXOffset; 
        const y = (rowHeight * (currentRow + 1)) - (fullData[j][i] * 10);
  
        // Check if the X value exceeds the maximum width
        if (x >= maxWidth) {
          // Move to the next row by adjusting Y and resetting X
          currentRow++;
          currentXOffset -= maxWidth;
          pathData += `M 0,${rowHeight * (currentRow + 1) - (fullData[j][i] * 10)} `;
          svg.setAttribute("height", rowHeight * (currentRow + 2)); // Adjust SVG height
        }
  
        if (j === 0 || currentXOffset > 0) {
          pathData += `M ${x},${y} `;
        } else {
          pathData += `L ${x},${y} `;
        }
      }
  
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", i === 1 ? "#FF6F61" : i === 2 ? "#6ABF69" : "#6A9FF2");
      path.setAttribute("stroke-width", "2");
      svg.appendChild(path);
    }
  
    // Add points to SVG
    for (let i = 1; i < labels.length; i++) {
      for (let j = 0; j < fullData.length; j++) {
        const x = (fullData[j][0] * 10) + currentXOffset;
        const y = (rowHeight * (currentRow + 1)) - (fullData[j][i] * 10);
  
        // Check for line wrapping
        if (x >= maxWidth) {
          currentRow++;
          currentXOffset -= maxWidth;
          svg.setAttribute("height", rowHeight * (currentRow + 2));
        }
  
        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 3);
        circle.setAttribute("fill", i === 1 ? "#FF6F61" : i === 2 ? "#6ABF69" : "#6A9FF2");
        svg.appendChild(circle);
      }
    }
  
    // Convert the SVG to a string and download it
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
  
    // Create a link and trigger the download
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "dygraph-export.svg";
    downloadLink.click();
  }
  
  // Bind export button to exportAsSVG function
  document.getElementById("exportBtn").addEventListener("click", exportAsSVG);
  