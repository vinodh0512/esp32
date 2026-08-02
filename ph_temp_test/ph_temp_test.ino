/*
 * ESP32 pH and Temperature (DS18B20) Sensor Test Sketch (GPIO 32 with Two-Point Calibration)
 * 
 * Target: ESP32 Dev Module
 * 
 * Hardware Connections:
 *   ESP32:
 *     - pH Sensor V+ -> 5V
 *     - pH Sensor GND -> GND
 *     - pH Sensor PO (Analog Output) -> GPIO 32 (ADC1_CH4)
 *     - DS18B20 VCC -> 3.3V
 *     - DS18B20 GND -> GND
 *     - DS18B20 DATA -> GPIO 4 (Pull-up 4.7kΩ to 3.3V)
 * 
 * Dependencies:
 *   - OneWire (by Paul Stoffregen)
 *   - DallasTemperature (by Miles Burton)
 */

#include <OneWire.h>
#include <DallasTemperature.h>

// --- Configuration & Calibration ---
const int PH_PIN = 32;            // GPIO Pin connected to pH Sensor PO (Analog Output)
const int ONE_WIRE_BUS = 4;       // GPIO Pin connected to DS18B20 DATA line

/*
 * Two-Point Calibration Formula:
 * 1. Measure voltage at pH 7.00 (V7)
 * 2. Measure voltage at pH 4.00 (V4)
 * 3. Calculate Slope:  Slope = (V4 - V7) / (4.00 - 7.00)
 * 4. Calculate Offset: Offset = 7.00 - (Slope * V7)
 */
float slope = -5.56;              // Example slope: (V4 - V7) / (4.00 - 7.00)
float offset = 20.80;             // Example offset: 7.00 - (slope * V7)

// --- Global Objects ---
// Setup a oneWire instance to communicate with any OneWire devices
OneWire oneWire(ONE_WIRE_BUS);

// Pass our oneWire reference to Dallas Temperature sensor 
DallasTemperature sensors(&oneWire);

// Timer variable to track intervals
unsigned long lastReadTime = 0;
const unsigned long readInterval = 1000; // 1 second interval (1000 milliseconds)

void setup() {
  // Initialize Serial Monitor at 115200 baud rate
  Serial.begin(115200);
  
  // Wait for serial port to connect (needed for native USB boards)
  delay(1000); 
  
  Serial.println("Initializing sensors...");

  // Start up the Dallas Temperature library for DS18B20
  sensors.begin();
  
  // Configure the ESP32 ADC resolution to 12-bit (0 - 4095 range)
  analogReadResolution(12);
  
  // Set the pH sensor pin as an INPUT
  pinMode(PH_PIN, INPUT);
  
  Serial.println("Initialization complete. Reading sensors every 1 second...");
}

void loop() {
  unsigned long currentMillis = millis();

  // Non-blocking timer: execute sensor reading every 1 second
  if (currentMillis - lastReadTime >= readInterval) {
    lastReadTime = currentMillis;

    // --- DS18B20 Temperature Measurement ---
    // Request temperature reading from all devices on the bus
    sensors.requestTemperatures(); 
    
    // Get temperature in Celsius for the first sensor on the bus (index 0)
    float tempC = sensors.getTempCByIndex(0);

    // --- pH Sensor Measurement ---
    // Read the raw 12-bit analog value from GPIO 32
    int rawADC = analogRead(PH_PIN);
    
    // Convert the raw ADC value to voltage
    // ESP32 ADC reads 0-3.3V represented across 4095 steps
    float voltage = rawADC * (3.3 / 4095.0);

    // Calculate pH value using the slope and offset from calibration
    float pHValue = slope * voltage + offset;

    // --- Output to Serial Monitor ---
    Serial.println("=========================");
    
    // Check if the DS18B20 temperature sensor is connected
    if (tempC == DEVICE_DISCONNECTED_C) {
      Serial.println("Temperature sensor not detected!");
    } else {
      Serial.print("Temperature : ");
      Serial.print(tempC, 2);
      Serial.println(" °C");
    }
    
    Serial.print("Raw ADC     : ");
    Serial.println(rawADC);
    
    Serial.print("Voltage     : ");
    Serial.print(voltage, 3);
    Serial.println(" V");
    
    Serial.print("pH Value    : ");
    Serial.print(pHValue, 2);
    Serial.println("");
    
    Serial.println("=========================");
  }
}
