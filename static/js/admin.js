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

let overlaptimes = {};

let logo = new Image();
logo.src = "../static/img/logo.png";
async function SaveFiles(patientName, physicianName) {
  // Get important data and build a PDF
  /*
  Important data:
  1. Graph of shit
  2. Max angle and max distance moved
  3. Time for each shit
  4. Shaking frequency(?)
  5. One for each game
  */

  // 1. Get the graphs
  let graphs = await GetLatestGraphs(); // Now we have a serialized version of the graphs

  // 2. Get the max stuff
  let max_data = max_values; // Expecting max_data[0] = max_distance, max_data[1] = max_angle

  // 3. Get the times
  let times1 = getTimes(document.getElementById("game_1"));
  let times2 = getTimes(document.getElementById("game_2"));

  // 4. Fuck the shaking frequency for now

  // 5. Already done baby

  console.log("Graphs loaded:", graphs);

  // Now to create the PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const headerHeight = 30; // Height of the header
  const borderThickness = 1; // Thickness of the green border
  const margin = 7; // Space between text and the border

  // Header: Add a colored bar with the logo and project title
  doc.setFillColor(0, 102, 204); // Blue background for the header
  doc.rect(0, 0, pageWidth, headerHeight, "F"); // Filled rectangle for the header bar

  // Add the logo to the header
  const logoWidth = 20;
  const logoHeight = 20;
  doc.addImage(logo, "PNG", 10, 5, logoWidth, logoHeight);

  // Add the project title
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255); // White text for header
  doc.text(
    "Atividade Virtual para Aumento de Coordenação e Equilíbrio",
    40,
    15
  );

  // Add patient and physician names to the header
  doc.setFontSize(10);
  doc.text(`Patient Name: ${patientName || "________________"}`, 40, 22);
  doc.text(`Physician Name: ${physicianName || "________________"}`, 40, 27);

  // Function to add the green border
  function drawPageBorder(doc, isFirstPage = false) {
    doc.setDrawColor(144, 238, 144); // Light green border color
    doc.setLineWidth(borderThickness);

    if (isFirstPage) {
      // Top border (starts below the header)
      doc.line(
        borderThickness / 2,
        headerHeight,
        pageWidth - borderThickness / 2,
        headerHeight
      );
    } else {
      // Top border for subsequent pages
      doc.line(
        borderThickness / 2,
        borderThickness / 2,
        pageWidth - borderThickness / 2,
        borderThickness / 2
      );
    }

    // Bottom border
    doc.line(
      borderThickness / 2,
      pageHeight - borderThickness / 2,
      pageWidth - borderThickness / 2,
      pageHeight - borderThickness / 2
    );

    // Left border
    doc.line(
      borderThickness / 2,
      isFirstPage ? headerHeight : borderThickness / 2,
      borderThickness / 2,
      pageHeight - borderThickness / 2
    );

    // Right border
    doc.line(
      pageWidth - borderThickness / 2,
      isFirstPage ? headerHeight : borderThickness / 2,
      pageWidth - borderThickness / 2,
      pageHeight - borderThickness / 2
    );
  }

  // Draw the green border on the first page
  drawPageBorder(doc, true);

  // Section 1: Game Graphs
  let yOffset = headerHeight + margin; // Leave some space after the header
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0); // Default text color
  doc.text("1. Game Graphs", margin, yOffset);
  yOffset += 10;

  graphs.forEach((graph, index) => {
    if (yOffset + 170 > pageHeight - margin - borderThickness) {
      doc.addPage();
      drawPageBorder(doc, false); // Draw the green border for new pages
      yOffset = margin; // Reset yOffset for pages without a header
    }

    doc.text(`Graph ${index + 1}`, margin, yOffset);
    yOffset += 10;

    doc.addImage(graph, "PNG", margin, yOffset, 180, 160);
    yOffset += 170;
  });

  // Section 2: Maximum Data
  if (yOffset + 30 > pageHeight - margin - borderThickness) {
    doc.addPage();
    drawPageBorder(doc, false); // Draw the green border for new pages
    yOffset = margin; // Reset yOffset for pages without a header
  }

  doc.setFontSize(12);
  doc.setTextColor(0, 102, 204); // Match the blue theme for headings
  doc.text("2. Maximum Data", margin, yOffset);
  yOffset += 10;

  doc.setTextColor(0, 0, 0); // Black for body text
  doc.text(`Maximum Distance: ${max_data[0] || "N/A"}`, margin, yOffset);
  yOffset += 10;
  doc.text(`Maximum Angle: ${max_data[1] || "N/A"}`, margin, yOffset);
  yOffset += 10;

  // Section 3: Timing Data
  if (yOffset + 30 > pageHeight - margin - borderThickness) {
    doc.addPage();
    drawPageBorder(doc, false); // Draw the green border for new pages
    yOffset = margin; // Reset yOffset for pages without a header
  }

  doc.setTextColor(0, 102, 204); // Blue for headings
  doc.text("3. Game Timing Data", margin, yOffset);
  yOffset += 10;

  doc.setTextColor(0, 0, 0); // Black for body text
  doc.text("Game 1 Times:", margin, yOffset);
  yOffset += 10;

  times1.forEach((time, index) => {
    if (yOffset + 10 > pageHeight - margin - borderThickness) {
      doc.addPage();
      drawPageBorder(doc, false); // Draw the green border for new pages
      yOffset = margin; // Reset yOffset for pages without a header
    }
    doc.text(`- ${time}`, margin, yOffset);
    yOffset += 8;
  });

  // Check remaining space for "Game 2 Times" before adding a new page
  if (
    yOffset + 20 + times2.length * 8 >
    pageHeight - margin - borderThickness
  ) {
    doc.addPage();
    drawPageBorder(doc, false); // Draw the green border for new pages
    yOffset = margin; // Reset yOffset for pages without a header
  }

  doc.text("Game 2 Times:", margin, yOffset);
  yOffset += 10;

  times2.forEach((time, index) => {
    if (yOffset + 10 > pageHeight - margin - borderThickness) {
      doc.addPage();
      drawPageBorder(doc, false); // Draw the green border for new pages
      yOffset = margin; // Reset yOffset for pages without a header
    }
    doc.text(`- ${time}`, margin, yOffset);
    yOffset += 8;
  });

  // Add footer with page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Gray text for footer
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - margin / 2,
      { align: "center" }
    );
  }

  // Save the PDF
  doc.save("Game_Performance_Report.pdf");
}

async function GetLatestGraphs() {
  try {
    // Fetch the latest graphs from the server
    const response = await fetch("/latest_graphs");
    const data = await response.json();
    // Assuming data contains 'game1_graphs' and 'game2_graphs'
    return [data.game1_graphs, data.game2_graphs];
  } catch (error) {
    console.error("Error fetching latest graphs:", error);
    return [];
  }
}
function getTimes(gameElement) {
  let timeElement = gameElement.querySelector("#Time");
  //now we get each innerHTML of the children of timeElement
  let children = Array.from(timeElement.children);
  times = [];
  children.forEach((element) => {
    times.push(element.innerHTML);
  });
  return times;
}
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
    color: "#000000", // Fill color
  },
  limitMax: false, // If false, max value increases automatically if value > maxValue
  limitMin: false, // If true, the min value of the gauge will be fixed
  colorStart: "#6F6EA0", // Colors
  colorStop: "#C0C0DB", // just experiment with them
  strokeColor: "#EEEEEE", // to see which ones work best for you
  generateGradient: true,
  highDpiSupport: true, // High resolution support
};

var plantTarget = document.getElementById("gauge1"); // your canvas element
var plantGauge = new Gauge(plantTarget, 150, 300).setOptions(opts); // create sexy plantGauge!
plantGauge.maxValue = 100; // set max plant Gauge value
plantGauge.setMinValue(-20); // Prefer setter over plantGauge.minValue = 0
plantGauge.animationSpeed = 32; // set animation speed (32 is default value)

var birdTarget = document.getElementById("gauge2"); // your canvas element
var birdGauge = new Gauge(birdTarget, 150, 300).setOptions(opts); // Correct initialization
birdGauge.maxValue = 100;
birdGauge.setMinValue(-20);
birdGauge.animationSpeed = 32;
function updateAngleDisplay(angle) {
  const angleDisplay = document.getElementById("angle-display");
  angleDisplay.innerHTML = `Angulação: ${angle.toFixed(2)}°`;
}

let max_values = [0, 0];
function adjustSpeedo(value, game) {
  switch (game) {
    case "plant":
      let movement = value.dx;
      plantGauge.set(movement); // Use the Gauge instance directly
      if (movement > max_values[0]) {
        max_values[0] = movement;
      }
      break;
    case "bird":
      let angle = value.angle;
      birdGauge.set(angle); // Use the Gauge instance directly
      updateAngleDisplay(angle); // Atualiza o valor no display
      if (angle > max_values[1]) {
        max_values[1] = angle;
      }
      break;
    default:
      console.warn("Unknown game type:", game);
  }
}

// Creating the Web Worker for the gauge and other data
const CommsworkerBlob = new Blob(
  [
    `
  importScripts('https://cdn.socket.io/4.8.0/socket.io.min.js');
  let socket;

self.onmessage = function (event) {
  if (event.data.type === 'openWebSocket') {
    const { url } = event.data.payload;
    socket = io.connect(url);
    console.log('Gauge websocket connection opened:', url);

    // Generalized handler for all events
    socket.onAny((eventType, data) => {
      self.postMessage(data);
    });
  }
};
`,
  ],
  { type: "application/javascript" }
);

// Initialize the worker
const Commworker = new Worker(URL.createObjectURL(CommsworkerBlob));

// Define WebSocket URL
const socketUrl = "ws://localhost:5000"; // Replace with your WebSocket URL

// Start the WebSocket connection inside the Web Worker
Commworker.postMessage({ type: "openWebSocket", payload: { url: socketUrl } });

// Receive messages from the Web Worker
Commworker.onmessage = function (event) {
  json_data = JSON.parse(event.data).data;
  switch (json_data.type) {
    case "start":
      StartGame(json_data.game);
      break;
    case "movement":
      dx = json_data.displacement;
      adjustSpeedo(dx, json_data.game);
      break;
    case "plant":
      ShowPlantData(json_data);
      break;
    case "bird":
      ShowBirdData(json_data);
      break;
    default:
      console.warn("Unknown message type:", json_data.type);
  }
};

function StartGame(game) {
  let gameDiv = document.getElementById(game);
  gameDiv.querySelector("#gameOverlay").style.display = "none";
  if (game === "game_1") toggleGraph(plantGraph, true);
  else if (game === "game_2") toggleGraph(angleGraph, true);
}

function placeTimer(gameElement, time, id) {
  let timeElement = gameElement.querySelector("#Time");
  let timer = document.createElement("p");
  timer.innerHTML = `Nivel ${id}: ${(time / 1000).toFixed(2)}`;
  timeElement.appendChild(timer);
}

function placePlantTimer(gameElement, time, id) {
  let timeElement = gameElement.querySelector("#Time");
  let existingTimer = timeElement.querySelector(`#timer_${id}`);
  if (existingTimer) existingTimer.remove(); // Remove old timer if exists

  let timer = document.createElement("p");
  timer.id = `timer_${id}`;
  timer.innerHTML = `Nivel ${id}: ${time.toFixed(2)}`;
  timeElement.appendChild(timer);
}

function ShowPlantData(data) {
  let gameElement = document.getElementById("game_1");
  if (!data.completed) {
    let id = parseInt(data.plant, 10);
    let circles = gameElement.getElementsByClassName("circle");
    circles[id - 1].style.backgroundColor = "green";
    placePlantTimer(gameElement, data.time, id);
  } else if (data.completed) {
    toggleGraph(plantGraph, false);
    console.log("complete!");
    console.log(data.overlaps);
    gameElement.querySelector("#finished_alert").style.display = "flex";
    // Coletar dados do buffer e registrar informações
    let points = permabuffer.map((point) => {
      return { time: point[0], x: point[1], y: point[2], z: point[3] };
    });

    // Enviar dados ao backend via AJAX
    $.ajax({
      type: "POST",
      url: "/save_graph1",
      data: JSON.stringify({
        name: "name", // Nome do jogador (ajuste conforme necessário)
        game: "testgame",
        graph: points,
        overlaps: data.overlaps,
      }),
      contentType: "application/json",
      success: function (data) {
        console.log("Game data saved successfully:", data);
      },
      error: function (err) {
        console.error("Error saving game data:", err);
      },
    });
    permabuffer = []; //reset permabuffer after I sent the data over

    // Ajustando o fundo para algo mais visível
    gameElement.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // Fundo claro
  }
}

function ShowBirdData(data) {
  let gameElement = document.getElementById("game_2");
  let id = parseInt(data.level, 10);
  let circles = gameElement.getElementsByClassName("circle");
  circles[id].style.backgroundColor = "green";
  placeBirdTimer(gameElement, data.time, id);
  if (data.completed) {
    toggleGraph(angleGraph, false);
    console.log("complete!");
    gameElement.querySelector("#finished_alert").style.display = "flex";
    gameElement.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // Fundo claro
    let points = permabuffer.map((point) => {
      return { time: point[0], x: point[1], y: point[2], z: point[3] };
    });

    // Enviar dados ao backend via AJAX
    $.ajax({
      type: "POST",
      url: "/save_graph2",
      data: JSON.stringify({
        name: "name", // Nome do jogador (ajuste conforme necessário)
        game: "birdgame",
        graph: points,
      }),
      contentType: "application/json",
      success: function (data) {
        console.log("Game data saved successfully:", data);
      },
      error: function (err) {
        console.error("Error saving game data:", err);
      },
    });
    permabuffer = []; //reset permabuffer after I sent the data over
  }

  function placeBirdTimer(gameElement, time, id) {
    let timeElement = gameElement.querySelector("#Time");
    let existingTimer = timeElement.querySelector(`#timer_${id}`);
    if (existingTimer) existingTimer.remove(); // Remove old timer if exists

    let timer = document.createElement("p");
    timer.id = `timer_${id}`;
    timer.innerHTML = `Nivel ${id}: ${
      time ? time.toFixed(2) : "Tempo não disponível"
    }`;
    timeElement.appendChild(timer);
  }
}
