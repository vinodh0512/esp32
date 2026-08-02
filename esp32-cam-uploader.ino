/*
 * =================================================================================
 * Project     : ESP32-CAM Cloud Image Uploader + Flash Light Remote Control
 * Target Board: AI Thinker ESP32-CAM (OV2640 Camera Module)
 * ESP32 Core  : ESP32 Board Package 3.x / 2.x Compatible
 * Destination : https://esp32-1-5ssj.onrender.com/upload
 * Description : Connects to Wi-Fi, captures JPEG frames from OV2640 camera,
 *               uploads them via HTTP POST to your cloud Render server,
 *               and reads response to turn onboard Flash Light (GPIO 4) ON/OFF remotely!
 * =================================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// =================================================================================
// 1. Wi-Fi Configuration & Cloud Server Endpoint
// =================================================================================
const char* ssid        = "iPhone";                            // Your Wi-Fi SSID
const char* password    = "Inthavechuko";                      // Your Wi-Fi Password
const char* serverUrl   = "https://esp32-1-5ssj.onrender.com/upload"; // Render cloud endpoint

// Upload Interval (in milliseconds): 500ms = ~2 fps stream
const unsigned long uploadInterval = 500; 

// =================================================================================
// 2. AI Thinker ESP32-CAM Pin Configuration
// =================================================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_LED_PIN      4  // Onboard Flash LED (GPIO 4)

// =================================================================================
// 3. Wi-Fi Reconnection Logic
// =================================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("\n[Wi-Fi] Connecting to network: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.print("[Wi-Fi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[Wi-Fi] Connection failed. Will retry automatically...");
  }
}

// =================================================================================
// 4. Camera Hardware Initialization
// =================================================================================
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;

  // ESP32 Board Package 3.x uses pin_sscb_sda / pin_sscb_scl for SIOD / SIOC
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Frame size & quality configuration based on PSRAM presence
  if (psramFound()) {
    Serial.println("[CAM] PSRAM detected! Using VGA resolution (640x480).");
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 12; // Lower number = higher quality (10-63)
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("[CAM] PSRAM not found. Using CIF resolution (400x296).");
    config.frame_size   = FRAMESIZE_CIF;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  // Initialize camera driver
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera init failed with error code: 0x%x\n", err);
    return false;
  }

  // Adjust sensor controls (OV2640)
  sensor_t * s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_vflip(s, 0);       // 1 to flip vertically
    s->set_hmirror(s, 0);     // 1 to mirror horizontally
    s->set_brightness(s, 1);  // -2 to 2
    s->set_contrast(s, 1);    // -2 to 2
  }

  Serial.println("[CAM] OV2640 Camera Hardware Initialized!");
  return true;
}

// =================================================================================
// 5. Capture Frame & POST to Render Server + Remote Flash Light Control
// =================================================================================
void captureAndUploadFrame() {
  // Verify Wi-Fi connection before capturing
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  // Acquire Frame Buffer from camera
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[ERROR] Camera frame capture failed!");
    return;
  }

  // Configure Secure SSL Client (skipping cert validation for render server)
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(10000); // 10 second timeout

  if (http.begin(client, serverUrl)) {
    http.addHeader("Content-Type", "image/jpeg");

    Serial.printf("[HTTP] Uploading frame (%u bytes)... ", fb->len);
    
    // Execute HTTP POST with raw image buffer
    int httpResponseCode = http.POST(fb->buf, fb->len);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("SUCCESS! Code: %d | Response: %s\n", httpResponseCode, response.c_str());

      // --- REMOTE FLASH LIGHT CONTROL FROM RENDER BACKEND ---
      if (response.indexOf("\"flash\":true") >= 0) {
        digitalWrite(FLASH_LED_PIN, HIGH); // Turn Flash LED ON
        Serial.println("[FLASH LED] Turned ON via remote control");
      } else if (response.indexOf("\"flash\":false") >= 0) {
        digitalWrite(FLASH_LED_PIN, LOW);  // Turn Flash LED OFF
        Serial.println("[FLASH LED] Turned OFF via remote control");
      }
    } else {
      Serial.printf("FAILED! Error: %s\n", http.errorToString(httpResponseCode).c_str());
    }

    http.end(); // Free HTTP connection resources
  } else {
    Serial.println("[ERROR] Unable to connect to Render server!");
  }

  // Return frame buffer back to camera driver pool (CRITICAL to avoid memory leaks)
  esp_camera_fb_return(fb);
}

// =================================================================================
// 6. setup()
// =================================================================================
void setup() {
  // Initialize Serial Monitor
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\n==================================================");
  Serial.println("  ESP32-CAM Cloud Streamer + Flash LED Control  ");
  Serial.println("==================================================\n");

  // Onboard Flash LED Setup (GPIO 4)
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW); // Flash OFF by default

  // Initialize Camera Hardware
  if (!initCamera()) {
    Serial.println("[FATAL] Camera hardware fail! Halting.");
    while (true) { delay(1000); }
  }

  // Connect to Wi-Fi Network
  connectWiFi();
}

// =================================================================================
// 7. loop()
// =================================================================================
void loop() {
  static unsigned long lastUploadTime = 0;
  unsigned long now = millis();

  // Control frame upload frequency
  if (now - lastUploadTime >= uploadInterval) {
    lastUploadTime = now;
    captureAndUploadFrame();
  }

  delay(10); // Small yield to FreeRTOS background tasks
}
