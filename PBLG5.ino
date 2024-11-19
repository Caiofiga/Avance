#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

// Wi-Fi credentials
const char* ssid = "SensorAP";
const char* password = "password123";

// WebSocket and server instances
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Dummy sensor data
float sensorData = 0.0;

// Function to broadcast sensor data over WebSocket
void notifyClients() {
  char msg[50];
  snprintf(msg, sizeof(msg), "{\"sensor\":%.2f}", sensorData);
  ws.textAll(msg);
}

// Simulate sensor data
void updateSensorData() {
  sensorData = random(100) / 10.0;  // Random value between 0 and 10
}

// WebSocket events
void onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.println("WebSocket client connected");
    client->ping();
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.println("WebSocket client disconnected");
  }
}

void setup() {
  Serial.begin(115200);

  // Setup Wi-Fi as Access Point
  WiFi.softAP(ssid);
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());

  // Setup WebSocket
  ws.onEvent(onWebSocketEvent);
  server.addHandler(&ws);

  // Allow CORS for all endpoints
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");

  // Start the server
  server.begin();
  Serial.println("WebSocket server started!");
}

void loop() {
  static uint32_t lastSensorUpdate = 0;
  if (millis() - lastSensorUpdate > 1000) { // Update every 1 second
    updateSensorData();
    notifyClients();
    lastSensorUpdate = millis();
  }
}
