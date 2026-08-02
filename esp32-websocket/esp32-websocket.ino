/*
 * ESP32 WebSocket IoT Client Sketch with pH & DS18B20 Sensors + Light Control
 * 
 * Target: ESP32 Development Board
 * Dependencies (install via Arduino Library Manager):
 *  - WebSockets by Markus Sattler (WebSocketsClient)
 *  - ArduinoJson by Benoit Blanchon (Supports v6 and v7)
 *  - OneWire by Paul Stoffregen
 *  - DallasTemperature by Miles Burton
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- Hardware Pin Definitions ---
#define ONE_WIRE_BUS 4
#define PH_PIN 32
#define LED_PIN 2

// --- Wi-Fi & WebSocket Configuration ---
const char* WIFI_SSID     = "Vinodh";
const char* WIFI_PASSWORD = "05120512";

// Backend Server Configuration (Render wss://)
const char* ws_host   = "esp32-1-5ssj.onrender.com";
const int   ws_port   = 443;
const bool  useSSL    = true;
const char* device_id = "esp32-1";

// --- Global Sensor & Network Objects ---
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
WebSocketsClient webSocket;

// --- Timing Controls ---
unsigned long lastTelemetryTime = 0;
const unsigned long telemetryInterval = 1000; // 1 second interval (reads & sends every second)

// Connection LED signaling states
unsigned long lastBlink = 0;
bool blinkState = false;

// Current Light / LED state
bool currentLedState = false;

// Handle LED indicator signal during connection phase
void handleLEDSignals() {
  if (WiFi.status() != WL_CONNECTED) {
    // WiFi connecting: Slow blink (500ms)
    if (millis() - lastBlink >= 500) {
      blinkState = !blinkState;
      digitalWrite(LED_PIN, blinkState ? HIGH : LOW);
      lastBlink = millis();
    }
  } else if (!webSocket.isConnected()) {
    // WiFi connected, WebSocket connecting: Fast blink (200ms)
    if (millis() - lastBlink >= 200) {
      blinkState = !blinkState;
      digitalWrite(LED_PIN, blinkState ? HIGH : LOW);
      lastBlink = millis();
    }
  }
}

// Wi-Fi Connection Management
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi Connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connection Failed. Retrying...");
  }
}

// Read pH, Temperature, and Send Telemetry over WebSocket
void readSensorsAndSendTelemetry() {
  // Read Temperature Sensor
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);
  bool tempConnected = (temperature != DEVICE_DISCONNECTED_C);

  // Read pH Sensor
  int adcValue = analogRead(PH_PIN);
  float voltage = adcValue * (3.3 / 4095.0);

  // Approximate pH formula (calibration required)
  float pHValue = 7.0 + ((2.5 - voltage) / 0.18);
  bool phConnected = (adcValue > 100);

  // Serial Monitor Output (Matches your exact sensor debug format)
  Serial.println("-----------------------------");

  if (!tempConnected) {
    Serial.println("Temperature Sensor: Not Detected");
  } else {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");
  }

  Serial.print("ADC Value: ");
  Serial.println(adcValue);

  Serial.print("Voltage: ");
  Serial.print(voltage, 3);
  Serial.println(" V");

  Serial.print("pH Value: ");
  Serial.println(pHValue, 2);

  Serial.print("Light/LED State: ");
  Serial.println(currentLedState ? "ON" : "OFF");

  // Transmit telemetry payload over WebSocket if connected
  if (webSocket.isConnected()) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    StaticJsonDocument<384> doc;
#endif

    doc["type"] = "telemetry";
    
    JsonObject data = doc.createNestedObject("data");
    data["status"]        = "online";
    data["temperature"]   = tempConnected ? temperature : 0.0;
    data["pH"]            = pHValue;
    data["voltage"]       = voltage;
    data["raw"]           = adcValue;
    data["tempConnected"] = tempConnected;
    data["phConnected"]   = phConnected;
    data["led"]           = currentLedState;

    String payload;
    serializeJson(doc, payload);
    
    webSocket.sendTXT(payload);
    Serial.print("[WS] Sent Telemetry: ");
    Serial.println(payload);
  }

  lastTelemetryTime = millis();
}

// Toggle or Set Light State
void setLightState(bool turnOn) {
  currentLedState = turnOn;
  digitalWrite(LED_PIN, currentLedState ? HIGH : LOW);
  Serial.print("[WS] LED pin set to: ");
  Serial.println(currentLedState ? "ON" : "OFF");
  
  // Immediately send updated telemetry upon state change
  readSensorsAndSendTelemetry();
}

// WebSocket Event Handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from WebSocket Server.");
      break;
      
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected securely to: %s\n", payload);
      // Turn LED solid ON upon connection ready
      setLightState(true);
      break;
      
    case WStype_TEXT: {
      Serial.printf("[WS] Received payload: %s\n", payload);
      
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
#else
      StaticJsonDocument<384> doc;
#endif
      DeserializationError error = deserializeJson(doc, payload, length);
      
      if (error) {
        Serial.print("[WS] JSON Deserialization failed: ");
        Serial.println(error.c_str());
        return;
      }
      
      const char* msgType = doc["type"];
      if (msgType && strcmp(msgType, "control") == 0) {
        if (doc.containsKey("led")) {
          bool ledState = doc["led"];
          setLightState(ledState);
        }
      }
      break;
    }
    
    case WStype_BIN:
      break;
      
    case WStype_PING:
      Serial.println("[WS] Ping received");
      break;
      
    case WStype_PONG:
      Serial.println("[WS] Pong received");
      break;
      
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Initialize Hardware Pins
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // Default to off
  
  pinMode(PH_PIN, INPUT);
  analogReadResolution(12); // ESP32 12-bit ADC (0 - 4095)

  // Initialize DS18B20 Temperature Sensor
  sensors.begin();
  
  // Connect Wi-Fi
  connectWiFi();
  
  // Create device connection endpoint path
  String path = "/?clientType=device&deviceId=";
  path += device_id;
  
  if (useSSL) {
    // Connect securely (wss://) on port 443
    webSocket.beginSSL(ws_host, ws_port, path.c_str());
  } else {
    // Connect unsecurely (ws://) on port 5000 / 3000
    webSocket.begin(ws_host, ws_port, path.c_str());
  }

  webSocket.onEvent(webSocketEvent);
  
  // Set automatic reconnect interval (5s) if connection is dropped
  webSocket.setReconnectInterval(5000);
}

void loop() {
  // Graceful Wi-Fi reconnection handling
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Lost! Reconnecting...");
    connectWiFi();
  }

  // Handle socket loop events (sends/receives, automatic ping-pong and reconnection)
  webSocket.loop();
  
  // Update status LED (blinks when connecting, solid when fully connected)
  handleLEDSignals();
  
  // Read sensors and transmit telemetry payload every 1 second
  if (millis() - lastTelemetryTime >= telemetryInterval) {
    readSensorsAndSendTelemetry();
  }
}