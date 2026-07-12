require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let device = {
  deviceId: "esp32-1",
  status: "offline",
  led: true,
  lastSeen: null
};

// Home
app.get("/", (req, res) => {
  res.json({
    message: "ESP32 Backend Running"
  });
});

// ESP32 heartbeat/status
app.post("/status", (req, res) => {

  const { deviceId, status } = req.body;

  device.deviceId = deviceId;
  device.status = status;
  device.lastSeen = Date.now();

  console.log("ESP32:", device);

  res.json({
    success: true
  });

});

// React Dashboard
app.get("/status", (req, res) => {

  if (
    device.lastSeen &&
    Date.now() - device.lastSeen > 15000
  ) {
    device.status = "offline";
  }

  res.json(device);

});

// LED ON
app.post("/led/on", (req, res) => {

  device.led = true;

  res.json({
    success: true
  });

});

// LED OFF
app.post("/led/off", (req, res) => {

  device.led = false;

  res.json({
    success: true
  });

});

// ESP32 checks LED state
app.get("/led", (req, res) => {

  res.json({
    led: device.led
  });

});

app.listen(PORT, () => {

  console.log("Server Running On Port", PORT);

});
