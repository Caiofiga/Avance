#include "FastIMU.h"
#include <Wire.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

#define IMU_ADDRESS1 0x68    // Address for the IMU
#define PERFORM_CALIBRATION // Comment to disable startup calibration
#define LED_PIN 2

MPU6500 IMU1;               // IMU instance
calData calib1 = { 0 };     // Calibration data for IMU
AccelData accelData1;       // Accelerometer data
GyroData gyroData1;         // Gyroscope data
MagData magData1;           // Magnetometer data

const char* ssid = "Figa's iPhone 17 Pro Max";
const char* password = "dallas99";

// Serial log buffer
const size_t logBufferSize = 1024;
char logBuffer[logBufferSize];
size_t logWriteIndex = 0;

StaticJsonDocument<512> jsonDoc;

// WebSocket and server instances
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Function to store logs in the buffer
void storeLog(const char* message) {
  size_t len = strlen(message);
  if (len > logBufferSize) return; // Ignore large messages
  for (size_t i = 0; i < len; ++i) {
    logBuffer[logWriteIndex] = message[i];
    logWriteIndex = (logWriteIndex + 1) % logBufferSize;
  }
}

// Function to broadcast serial logs
void sendLogBuffer(AsyncWebSocketClient* client) {
  String logs = "";
  for (size_t i = 0; i < logBufferSize; ++i) {
    logs += logBuffer[(logWriteIndex + i) % logBufferSize];
  }
  client->text(logs);
}

// Override Serial.print and Serial.println
#define SerialPrint(x) { Serial.print(x); storeLog(x); }
#define SerialPrintln(x) { Serial.println(x); storeLog((String(x) + "\n").c_str()); }

// Function to broadcast sensor data over WebSocket
void notifyClients() {
  String output;
  serializeJson(jsonDoc, output);
  ws.textAll(output);
}

// Simulate sensor data
void updateSensorData() {
  // Clear the JSON doc
  jsonDoc.clear();

  // Update IMU1
  IMU1.update();
  IMU1.getAccel(&accelData1);
  IMU1.getGyro(&gyroData1);
  if (IMU1.hasMagnetometer()) IMU1.getMag(&magData1);

  // Populate JSON data for IMU1
  JsonObject imu1 = jsonDoc.createNestedObject("IMU1");
  JsonObject imu1Accel = imu1.createNestedObject("Accel");
  imu1Accel["X"] = accelData1.accelX;
  imu1Accel["Y"] = accelData1.accelY;
  imu1Accel["Z"] = accelData1.accelZ;

  JsonObject imu1Gyro = imu1.createNestedObject("Gyro");
  imu1Gyro["X"] = gyroData1.gyroX;
  imu1Gyro["Y"] = gyroData1.gyroY;
  imu1Gyro["Z"] = gyroData1.gyroZ;

  if (IMU1.hasMagnetometer()) {
    JsonObject imu1Mag = imu1.createNestedObject("Mag");
    imu1Mag["X"] = magData1.magX;
    imu1Mag["Y"] = magData1.magY;
    imu1Mag["Z"] = magData1.magZ;
  }
}

// WebSocket events
void onWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    SerialPrintln("WebSocket client connected");
    client->ping();
  } else if (type == WS_EVT_DISCONNECT) {
    SerialPrintln("WebSocket client disconnected");
  } else if (type == WS_EVT_DATA) {
    String message = String((char*)data).substring(0, len);
    if (message == "getLogs") {
      sendLogBuffer(client);
    } else if (message == "reset") {
      SerialPrintln("Reset command received!");
      ESP.restart();
    }
  }
}

void setup() {
  Wire.begin();
  Wire.setClock(400000); // 400 kHz clock
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT); // Initialize LED pin
  digitalWrite(LED_PIN, LOW); // Turn off LED initially
  while (!Serial);

  // Initialize IMU1
  if (IMU1.init(calib1, IMU_ADDRESS1) != 0) {
    Serial.println("Error initializing IMU1");
    while (true);
  }

#ifdef PERFORM_CALIBRATION
  performCalibration(IMU1, calib1, "IMU1");
  digitalWrite(LED_PIN, HIGH);
#endif

  // Setup Wi-Fi as Access Point
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.print("Connected! IP address: ");
  Serial.println(WiFi.localIP());

  // Setup WebSocket
  ws.onEvent(onWebSocketEvent);
  server.addHandler(&ws);

  // Allow CORS for all endpoints
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");

  // Start the server
  server.begin();
  Serial.println("WebSocket server started!");
}

void performCalibration(MPU6500 &imu, calData &calib, const char *imuName) {
  Serial.print(imuName);
  Serial.println(" calibration & data example");

  if (imu.hasMagnetometer()) {
    delay(1000);
    Serial.println("Move IMU in figure 8 pattern until done.");
    delay(3000);
    imu.calibrateMag(&calib);
    Serial.println("Magnetic calibration done!");
  } else {
    delay(5000);
  }

  delay(5000);
  Serial.println("Keep IMU level.");
  delay(5000);
  imu.calibrateAccelGyro(&calib);
  Serial.println("Calibration done!");
}

void loop() {
  static uint32_t lastSensorUpdate = 0;
  if (millis() - lastSensorUpdate > 1000) { // Update every 1 second
    updateSensorData();
    notifyClients();
    lastSensorUpdate = millis();
  }
  delay(50); // Adjust delay as needed
}
