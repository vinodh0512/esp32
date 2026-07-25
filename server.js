require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

// Import Database and Models
const connectDB = require("./config/db");
const Device = require("./models/Device");
const TemperatureLog = require("./models/TemperatureLog");
const FermentationBatch = require("./models/FermentationBatch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: ["image/jpeg", "application/octet-stream"], limit: "10mb" }));

// Initialize Database connection
connectDB().catch((err) => {
  console.error("[Backend] Mongoose Connection Failed at Startup:", err);
});

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// WebSocket Connection Tracking
const dashboardClients = new Set();
const deviceClients = new Map(); // deviceId -> ws socket

// Helper to broadcast state changes to all dashboards
function broadcastToDashboards(messageObj) {
  const messageStr = JSON.stringify(messageObj);
  for (const client of dashboardClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  }
}

// Helper to conditionally save temperature & pH log to MongoDB
async function saveTemperatureLogIfNeeded(devId, temperature, pH) {
  if (temperature === undefined && pH === undefined) return;
  
  try {
    const lastLog = await TemperatureLog.findOne({ deviceId: devId }).sort({ timestamp: -1 });
    
    let shouldSave = false;
    if (!lastLog) {
      shouldSave = true;
    } else {
      const tempDiff = temperature !== undefined ? Math.abs(temperature - lastLog.temperature) : 0;
      const timeDiff = Date.now() - new Date(lastLog.timestamp).getTime();
      
      if (tempDiff >= 0.2 || timeDiff >= 10000) {
        shouldSave = true;
      }
    }
    
    if (shouldSave) {
      await TemperatureLog.create({
        deviceId: devId,
        temperature,
        pH
      });
    }

    // Append to active fermentation batch data points if running
    const activeBatch = await FermentationBatch.findOne({ deviceId: devId, status: "RUNNING" });
    if (activeBatch) {
      activeBatch.dataPoints.push({
        time: new Date(),
        pH: pH !== undefined ? pH : activeBatch.initialPH,
        temperature: temperature !== undefined ? temperature : activeBatch.initialTemp
      });

      if (temperature && (!activeBatch.maxTemp || temperature > activeBatch.maxTemp)) {
        activeBatch.maxTemp = temperature;
      }

      await activeBatch.save();
      broadcastToDashboards({ type: "fermentationUpdate", data: activeBatch });
    }
  } catch (err) {
    console.error("[Database] Error saving telemetry log:", err);
  }
}

// WebSocket Event Handlers
wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const { clientType, deviceId } = parsedUrl.query;
  const devId = deviceId || "esp32-1";

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  console.log(`[WS] Connection opened: clientType=${clientType}, deviceId=${devId}`);

  if (clientType === "dashboard") {
    dashboardClients.add(ws);

    // Fetch initial device state & active batch to send to dashboard
    Promise.all([
      Device.findOne({ deviceId: devId }),
      FermentationBatch.findOne({ deviceId: devId, status: "RUNNING" })
    ])
      .then(([dev, activeBatch]) => {
        const payload = dev
          ? { deviceId: dev.deviceId, status: dev.status, led: dev.led, tempEnabled: dev.tempEnabled, temperature: dev.temperature, pH: dev.pH, voltage: dev.voltage, raw: dev.raw, phConnected: dev.phConnected, tempConnected: dev.tempConnected, lastSeen: dev.lastSeen }
          : { deviceId: devId, status: "offline", led: false, tempEnabled: true, lastSeen: null };
        
        ws.send(JSON.stringify({ type: "deviceUpdate", data: payload, activeBatch }));
      })
      .catch((err) => console.error("[WS] Error sending initial status to dashboard:", err));

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Dashboard Msg:", parsedMessage);

        if (parsedMessage.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: parsedMessage.timestamp }));
        } else if (parsedMessage.type === "control") {
          const { led, tempEnabled, calibrationOffset } = parsedMessage;
          const targetDeviceId = parsedMessage.deviceId || devId;

          const updateObj = { lastSeen: new Date(), status: "online" };
          if (led !== undefined) updateObj.led = led;
          if (tempEnabled !== undefined) updateObj.tempEnabled = tempEnabled;

          const dev = await Device.findOneAndUpdate(
            { deviceId: targetDeviceId },
            updateObj,
            { returnDocument: "after", upsert: true }
          );

          broadcastToDashboards({ type: "deviceUpdate", data: dev });

          const deviceWs = deviceClients.get(targetDeviceId);
          if (deviceWs && deviceWs.readyState === 1) {
            const forwardPayload = { type: "control" };
            if (led !== undefined) forwardPayload.led = led;
            if (tempEnabled !== undefined) forwardPayload.tempEnabled = tempEnabled;
            if (calibrationOffset !== undefined) forwardPayload.calibrationOffset = calibrationOffset;
            deviceWs.send(JSON.stringify(forwardPayload));
          }
        }
      } catch (err) {
        console.error("[WS] Error parsing dashboard message:", err);
      }
    });

    ws.on("close", () => {
      dashboardClients.delete(ws);
      console.log("[WS] Dashboard client disconnected");
    });

  } else if (clientType === "device") {
    deviceClients.set(devId, ws);

    Device.findOneAndUpdate(
      { deviceId: devId },
      { status: "online", lastSeen: new Date() },
      { returnDocument: "after", upsert: true }
    )
      .then((dev) => {
        broadcastToDashboards({ type: "deviceUpdate", data: dev });
      })
      .catch((err) => console.error("[WS] Error marking device online in DB:", err));

    ws.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        console.log("[WS] Device Telemetry Msg:", parsedMessage);

        if (parsedMessage.type === "telemetry" || parsedMessage.type === "status" || parsedMessage.type === "heartbeat") {
          const metrics = parsedMessage.data || parsedMessage;
          const { temperature, pH, voltage, raw, phConnected, tempConnected, led } = metrics;
          
          const updateData = {
            status: "online",
            lastSeen: new Date()
          };
          if (temperature !== undefined) updateData.temperature = temperature;
          if (pH !== undefined) updateData.pH = pH;
          if (voltage !== undefined) updateData.voltage = voltage;
          if (raw !== undefined) updateData.raw = raw;
          if (phConnected !== undefined) updateData.phConnected = phConnected;
          if (tempConnected !== undefined) updateData.tempConnected = tempConnected;
          if (led !== undefined) updateData.led = led;

          const dev = await Device.findOneAndUpdate(
            { deviceId: devId },
            updateData,
            { returnDocument: "after", upsert: true }
          );

          await saveTemperatureLogIfNeeded(devId, temperature, pH);
          broadcastToDashboards({ type: "deviceUpdate", data: dev });
        }
      } catch (err) {
        console.error("[WS] Error parsing device message:", err);
      }
    });

    ws.on("close", async () => {
      deviceClients.delete(devId);
      console.log(`[WS] Device disconnected: ${devId}`);

      try {
        const dev = await Device.findOneAndUpdate(
          { deviceId: devId },
          { status: "offline", lastSeen: new Date() },
          { returnDocument: "after" }
        );
        if (dev) {
          broadcastToDashboards({ type: "deviceUpdate", data: dev });
        }
      } catch (err) {
        console.error("[WS] Error setting device offline on close:", err);
      }
    });
  } else {
    ws.close();
  }
});

// Periodic offline sweep
setInterval(async () => {
  try {
    const cutoffTime = new Date(Date.now() - 15000);
    const staleDevices = await Device.find({
      status: "online",
      lastSeen: { $lt: cutoffTime }
    });

    for (const dev of staleDevices) {
      dev.status = "offline";
      await dev.save();
      broadcastToDashboards({ type: "deviceUpdate", data: dev });
    }
  } catch (err) {
    console.error("[Sweep] Error in offline check interval:", err);
  }
}, 5000);

// --- CAMERA RELAY ENDPOINTS ---
let latestCameraFrame = null;
let latestCameraTimestamp = null;
let cameraFlashLed = false;

// HTTP POST endpoint for ESP32-CAM frame upload
app.post("/upload", (req, res) => {
  if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
    return res.status(400).json({ error: "Empty image payload" });
  }

  latestCameraFrame = req.body;
  latestCameraTimestamp = Date.now();

  // Broadcast to WebSockets
  if (Buffer.isBuffer(req.body)) {
    const base64Frame = req.body.toString("base64");
    broadcastToDashboards({
      type: "cameraFrame",
      timestamp: latestCameraTimestamp,
      frame: `data:image/jpeg;base64,${base64Frame}`
    });
  }

  // Return flash state so ESP32-CAM turns onboard flash LED ON/OFF
  res.status(200).json({ success: true, timestamp: latestCameraTimestamp, flash: cameraFlashLed });
});

// Toggle or set Camera Flash LED state from frontend
app.post("/api/camera/flash", (req, res) => {
  const { flash } = req.body;
  if (flash !== undefined) {
    cameraFlashLed = Boolean(flash);
  } else {
    cameraFlashLed = !cameraFlashLed;
  }
  
  broadcastToDashboards({ type: "cameraFlashUpdate", flash: cameraFlashLed });
  res.json({ success: true, flash: cameraFlashLed });
});

// Get current Camera Flash LED state
app.get("/api/camera/flash", (req, res) => {
  res.json({ flash: cameraFlashLed });
});

// Endpoint for React Frontend to fetch the latest camera frame
app.get("/api/camera/latest", (req, res) => {
  if (!latestCameraFrame) {
    return res.status(404).send("No camera frame available yet");
  }

  res.set("Content-Type", "image/jpeg");
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(latestCameraFrame);
});

// Home route
app.get("/", (req, res) => {
  res.json({ message: "ESP32 Backend Server with Camera Relay & WebSockets Active" });
});

// Get Fermentation Batches History
app.get("/api/batches", async (req, res) => {
  try {
    const batches = await FermentationBatch.find().sort({ startTime: -1 });
    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start New Fermentation Batch
app.post("/api/batches/start", async (req, res) => {
  try {
    const { name, deviceId, initialPH, initialTemp } = req.body;
    const devId = deviceId || "esp32-1";

    // Mark previous running batch as COMPLETED
    await FermentationBatch.updateMany({ deviceId: devId, status: "RUNNING" }, { status: "COMPLETED", endTime: new Date() });

    const batch = await FermentationBatch.create({
      name: name || "Yeast Sugar Test",
      deviceId: devId,
      startTime: new Date(),
      initialPH: initialPH !== undefined ? initialPH : 6.82,
      initialTemp: initialTemp !== undefined ? initialTemp : 28.4,
      status: "RUNNING",
      dataPoints: [{
        time: new Date(),
        pH: initialPH !== undefined ? initialPH : 6.82,
        temperature: initialTemp !== undefined ? initialTemp : 28.4
      }]
    });

    broadcastToDashboards({ type: "fermentationStart", batch });
    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End Fermentation Batch
app.post("/api/batches/stop", async (req, res) => {
  try {
    const { deviceId, finalPH } = req.body;
    const devId = deviceId || "esp32-1";

    const batch = await FermentationBatch.findOne({ deviceId: devId, status: "RUNNING" });
    if (!batch) {
      return res.status(404).json({ error: "No active fermentation batch found" });
    }

    batch.status = "COMPLETED";
    batch.endTime = new Date();
    if (finalPH !== undefined) batch.finalPH = finalPH;

    await batch.save();
    broadcastToDashboards({ type: "fermentationStop", batch });
    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`[Backend] Server listening on http://localhost:${PORT}`);
});
