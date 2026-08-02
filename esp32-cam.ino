/*
 * =================================================================================
 * Project     : ESP32-CAM Step-by-Step Debugger & Web Server
 * Target Board: AI Thinker ESP32-CAM (OV2640 Sensor)
 * Description : Includes step-by-step Serial prints to locate exact boot step,
 *               zero-initialized config struct to prevent Core 3.x crash,
 *               and delay(2000) for clean Serial Monitor initialization.
 * =================================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// =================================================================================
// 1. AI Thinker Pin Definition Mapping
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

#define FLASH_LED_PIN      4

// =================================================================================
// 2. Wi-Fi Configuration
// =================================================================================
const char* ssid     = "iPhone";       // Replace with your Wi-Fi SSID
const char* password = "Inthavechuko"; // Replace with your Wi-Fi Password

// =================================================================================
// 3. Global HTTP Server Instances & Stream Headers
// =================================================================================
httpd_handle_t camera_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY     = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART         = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// =================================================================================
// 4. HTTP Handlers for Camera Web Server
// =================================================================================

static esp_err_t index_handler(httpd_req_t *req) {
  const char* html = 
    "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    "<title>ESP32-CAM Stream</title><style>body{font-family:sans-serif;background:#111;color:#fff;text-align:center;margin:20px;}"
    "img{max-width:100%;height:auto;border-radius:8px;border:2px solid #333;}</style></head>"
    "<body><h1>ESP32-CAM Live Feed</h1><img src=\"/stream\"></body></html>";
  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, html, strlen(html));
}

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[ERROR] Camera capture failed!");
      res = ESP_FAIL;
    } else {
      if (fb->format != PIXFORMAT_JPEG) {
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if (!jpeg_converted) {
          Serial.println("[ERROR] JPEG conversion failed!");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf     = fb->buf;
      }
    }

    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }

    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (_jpg_buf) {
      free(_jpg_buf);
      _jpg_buf = NULL;
    }

    if (res != ESP_OK) break;
  }

  return res;
}

// =================================================================================
// 5. Start Camera Server
// =================================================================================
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
  httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };

  Serial.println("Starting Camera Server...");
  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    Serial.println("Server started on port 80!");
  } else {
    Serial.println("Error starting HTTP Server!");
  }
}

// =================================================================================
// 6. setup() with Step-by-Step Debug Statements
// =================================================================================
void setup() {
  // Step 1: Initialize Serial & Wait for Buffer
  Serial.begin(115200);
  delay(2000); // Allow Serial Monitor time to connect

  Serial.println("\n----------------------------------");
  Serial.println("Step 1: Serial OK");

  Serial.setDebugOutput(true);

  // Step 2: Zero-initialize camera_config_t struct
  Serial.println("Step 2: Creating camera config");

  camera_config_t config = {}; // Clear all fields to 0 to prevent crashes
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

  // Pin mapping for ESP32 Board Package 3.x+
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("PSRAM detected! Using VGA & 2 frame buffers.");
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count     = 2;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("PSRAM not found. Using CIF & 1 frame buffer.");
    config.frame_size   = FRAMESIZE_CIF;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  // Step 3: Before esp_camera_init
  Serial.println("Step 3: Before esp_camera_init");

  esp_err_t err = esp_camera_init(&config);

  // Step 4: After esp_camera_init
  Serial.println("Step 4: After esp_camera_init");

  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }

  // Step 5: Camera initialized
  Serial.println("Step 5: Camera initialized");

  // Step 6: Connecting Wi-Fi
  Serial.println("Step 6: Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: http://");
    Serial.println(WiFi.localIP());

    // Step 7: Starting server
    startCameraServer();
    Serial.print("Camera Ready! Open: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed! Check SSID and password.");
  }
}

// =================================================================================
// 7. loop()
// =================================================================================
void loop() {
  delay(1000);
}
