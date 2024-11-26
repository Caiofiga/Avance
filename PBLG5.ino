#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncWebSocket.h>
#include "FastIMU.h"
#include <Wire.h>
#include <IPAddress.h>

// Wi-Fi and WebSocket Configuration
const char *apSSID = "ESP32_Setup";
const char *apPassword = "12345678";

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");


// IMU Configuration
#define IMU_ADDRESS1 0x68 // Address for the IMU
MPU6500 IMU1;             // IMU instance
calData calib1 = {0};     // Calibration data for IMU
AccelData accelData1;     // Accelerometer data
GyroData gyroData1;       // Gyroscope data
MagData magData1;         // Magnetometer data

// Wi-Fi Credential Storage
bool credentialsReceived = false;
String receivedSSID, receivedPassword;

#define LED_PIN 13

void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_START:
      Serial.println("Wi-Fi started. Attempting to connect...");
      break;
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("Wi-Fi connected!");
      credentialsReceived = true;
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.println("Connected to Wi-Fi!");
      Serial.println("IP address: " + WiFi.localIP().toString());
      ws.onEvent(onEvent);
      server.addHandler(&ws);
      credentialsReceived = true;
      digitalWrite(LED_PIN, HIGH);
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("Wi-Fi disconnected. Reconnecting...");
      credentialsReceived = false;
      WiFi.reconnect();
      break;
    default:
      break;
  }
}

void connectToWiFi() {
  WiFi.onEvent(WiFiEvent);
  WiFi.disconnect(true); // Ensure we're starting fresh
  WiFi.begin(receivedSSID.c_str(), receivedPassword.c_str());
  Serial.println("Connecting to Wi-Fi...");
}

// WebSocket Event Handler
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected\n", client->id());
      client->text("Welcome to the WebSocket server!");
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      break; // We are not handling incoming data for now
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

void handleRoot(AsyncWebServerRequest *request) {
  String html = "<html>"
                "<head><title>Wi-Fi Setup</title></head>"
                "<body>"
                "<h1>Enter Wi-Fi Credentials</h1>"
                "<form action=\"/submit\" method=\"POST\">"
                "SSID: <input type=\"text\" name=\"ssid\"><br>"
                "Password: <input type=\"password\" name=\"password\"><br>"
                "<input type=\"submit\" value=\"Submit\">"
                "</form>"
                "<p>WebSocket server address: ws://" + WiFi.softAPIP().toString() + "/ws</p>"
                "</body></html>";
  request->send(200, "text/html", html);
}

void handleStatus(AsyncWebServerRequest *request) {
  String html = "<html>"
                "<head><title>Wi-Fi Status</title></head>"
                "<body>"
                "<h1>Wi-Fi Status</h1>";

  if (WiFi.status() == WL_CONNECTED) {
    html += "<p>Connected to Wi-Fi!</p>";
    html += "<p>Device IP Address: " + WiFi.localIP().toString() + "</p>";
    html += "<p>WebSocket Server: ws://" + WiFi.localIP().toString() + "/ws</p>";
  } else {
    html += "<p>Not connected to Wi-Fi.</p>";
  }

  html += "</body></html>";
  request->send(200, "text/html", html);
}

void handleSubmit(AsyncWebServerRequest *request) {
  if (request->hasParam("ssid", true) && request->hasParam("password", true)) {
    receivedSSID = request->getParam("ssid", true)->value();
    receivedPassword = request->getParam("password", true)->value();
    connectToWiFi();
    // Show a connecting page
    request->redirect("/connecting");
  } else {
    request->send(400, "text/plain", "Missing SSID or password.");
  }
}

void handleConnecting(AsyncWebServerRequest *request) {
  String html = "<html>"
                "<head>"
                "<title>Connecting...</title>"
                "</head>"
                "<body>"
                "<h1>Connecting to Wi-Fi...</h1>"
                "<p>Please wait while we connect to the network.</p>"
                "<script>"
                "setInterval(function() {"
                "  fetch('/wifi-status')"
                "    .then(response => response.json())"
                "    .then(data => {"
                "      if (data.connected) {"
                "        window.location.href = '/status';"
                "      }"
                "    });"
                "}, 5000);"
                "</script>"
                "</body>"
                "</html>";
  request->send(200, "text/html", html);
}

void handleWiFiStatus(AsyncWebServerRequest *request) {
  String json = "{\"connected\":";
  if (WiFi.status() == WL_CONNECTED) {
    json += "true";
  } else {
    json += "false";
  }
  json += "}";
  Serial.println(json);
  request->send(200, "application/json", json);
}


void setup() {
  Wire.begin();
  Wire.setClock(400000); // 400 kHz clock
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT); // Initialize LED pin
  digitalWrite(LED_PIN, LOW); // Turn off LED initially

  // Initialize IMU1
  if (IMU1.init(calib1, IMU_ADDRESS1) != 0) {
    Serial.println("Error initializing IMU1");
    while (true); // Halt execution if initialization fails
  }

  // Start the SoftAP
  WiFi.softAP(apSSID, apPassword);
  Serial.println("SoftAP started");
  Serial.println("IP address: " + WiFi.softAPIP().toString());

  // Configure AsyncWebServer routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/submit", HTTP_POST, handleSubmit);
  server.on("/connecting", HTTP_GET, handleConnecting);
  server.on("/wifi-status", HTTP_GET, handleWiFiStatus);
  server.on("/status", HTTP_GET, handleStatus);

  server.begin();
  Serial.println("Web server started");


}


void loop() {

  if (!credentialsReceived){
    return;
  }
  // Update IMU data
  IMU1.update();
  IMU1.getAccel(&accelData1);
  IMU1.getGyro(&gyroData1);

  // Create JSON message with IMU data
  String imuData = "{";
  imuData += "\"accelX\":" + String(accelData1.accelX, 2) + ",";
  imuData += "\"accelY\":" + String(accelData1.accelY, 2) + ",";
  imuData += "\"accelZ\":" + String(accelData1.accelZ, 2) + ",";
  imuData += "\"gyroX\":" + String(gyroData1.gyroX, 2) + ",";
  imuData += "\"gyroY\":" + String(gyroData1.gyroY, 2) + ",";
  imuData += "\"gyroZ\":" + String(gyroData1.gyroZ, 2);

  if (IMU1.hasMagnetometer()) {
    IMU1.getMag(&magData1);
    imuData += ",";
    imuData += "\"magX\":" + String(magData1.magX, 2) + ",";
    imuData += "\"magY\":" + String(magData1.magY, 2) + ",";
    imuData += "\"magZ\":" + String(magData1.magZ, 2);
  }

  imuData += "}";

  // Send data to all connected WebSocket clients
  ws.textAll(imuData);

  // Delay before next update
  delay(1000);
}
