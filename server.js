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

// Helper to conditionally save telemetry (temperature, pH, voltage, raw) log to MongoDB
async function saveTemperatureLogIfNeeded(devId, metrics = {}) {
  const { temperature, pH, voltage, raw, phConnected, tempConnected, led } = metrics;
  if (temperature === undefined && pH === undefined && voltage === undefined) return;
  
  try {
    const lastLog = await TemperatureLog.findOne({ deviceId: devId }).sort({ timestamp: -1 });
    
    let shouldSave = false;
    if (!lastLog) {
      shouldSave = true;
    } else {
      const tempDiff = temperature !== undefined ? Math.abs(temperature - (lastLog.temperature || 0)) : 0;
      const phDiff = pH !== undefined ? Math.abs(pH - (lastLog.pH || 0)) : 0;
      const timeDiff = Date.now() - new Date(lastLog.timestamp).getTime();
      
      if (tempDiff >= 0.1 || phDiff >= 0.05 || timeDiff >= 10000) {
        shouldSave = true;
      }
    }
    
    if (shouldSave) {
      await TemperatureLog.create({
        deviceId: devId,
        temperature,
        pH,
        voltage,
        raw,
        phConnected,
        tempConnected,
        led
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
          const { led, tempEnabled, calibrationOffset, fermentation } = parsedMessage;
          const targetDeviceId = parsedMessage.deviceId || devId;

          // Handle Fermentation Batch Start/Stop over WebSockets
          if (fermentation === "start") {
            const { batch, name, initialPH, initialTemp } = parsedMessage;
            await FermentationBatch.updateMany({ deviceId: targetDeviceId, status: "RUNNING" }, { status: "COMPLETED", endTime: new Date() });
            
            const newBatch = await FermentationBatch.create({
              name: (batch && batch.name) || name || "Yeast Sugar Test",
              deviceId: targetDeviceId,
              startTime: new Date(),
              initialPH: (batch && batch.initialPH !== undefined) ? batch.initialPH : (initialPH !== undefined ? initialPH : 6.82),
              initialTemp: (batch && batch.initialTemp !== undefined) ? batch.initialTemp : (initialTemp !== undefined ? initialTemp : 28.4),
              status: "RUNNING",
              dataPoints: [{
                time: new Date(),
                pH: (batch && batch.initialPH !== undefined) ? batch.initialPH : (initialPH !== undefined ? initialPH : 6.82),
                temperature: (batch && batch.initialTemp !== undefined) ? batch.initialTemp : (initialTemp !== undefined ? initialTemp : 28.4)
              }]
            });
            broadcastToDashboards({ type: "fermentationStart", batch: newBatch, activeBatch: newBatch });
          } else if (fermentation === "stop") {
            const activeBatch = await FermentationBatch.findOne({ deviceId: targetDeviceId, status: "RUNNING" });
            if (activeBatch) {
              activeBatch.status = "COMPLETED";
              activeBatch.endTime = new Date();
              if (parsedMessage.finalPH !== undefined) activeBatch.finalPH = parsedMessage.finalPH;
              await activeBatch.save();
              broadcastToDashboards({ type: "fermentationStop", batch: activeBatch, activeBatch: null });
            }
          }

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

          await saveTemperatureLogIfNeeded(devId, { temperature, pH, voltage, raw, phConnected, tempConnected, led });
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
const cameraStreamClients = new Set();

// HTTP POST endpoint for ESP32-CAM frame upload
app.post("/upload", (req, res) => {
  if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
    return res.status(400).json({ error: "Empty image payload" });
  }

  latestCameraFrame = req.body;
  latestCameraTimestamp = Date.now();

  if (Buffer.isBuffer(req.body)) {
    // 1. Broadcast to WebSockets
    const base64Frame = req.body.toString("base64");
    broadcastToDashboards({
      type: "cameraFrame",
      timestamp: latestCameraTimestamp,
      frame: `data:image/jpeg;base64,${base64Frame}`
    });

    // 2. Broadcast to MJPEG HTTP Stream subscribers
    const header = `--myboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${req.body.length}\r\n\r\n`;
    for (const clientRes of cameraStreamClients) {
      try {
        clientRes.write(header);
        clientRes.write(req.body);
        clientRes.write("\r\n");
      } catch (err) {
        cameraStreamClients.delete(clientRes);
      }
    }
  }

  // Return flash state so ESP32-CAM turns onboard flash LED ON/OFF
  res.status(200).json({ success: true, timestamp: latestCameraTimestamp, flash: cameraFlashLed });
});

// Real-time MJPEG Stream endpoint for Web Browsers & React frontend
app.get("/api/camera/stream", (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache'
  });

  // Write initial frame if available
  if (latestCameraFrame && Buffer.isBuffer(latestCameraFrame)) {
    const header = `--myboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestCameraFrame.length}\r\n\r\n`;
    res.write(header);
    res.write(latestCameraFrame);
    res.write("\r\n");
  }

  cameraStreamClients.add(res);

  req.on("close", () => {
    cameraStreamClients.delete(res);
  });
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

// Get Currently Active Fermentation Batch from MongoDB
app.get("/api/batches/active", async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    const batch = await FermentationBatch.findOne({ deviceId: devId, status: "RUNNING" });
    res.json({ success: true, activeBatch: batch || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    broadcastToDashboards({ type: "fermentationStart", batch, activeBatch: batch });
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
    broadcastToDashboards({ type: "fermentationStop", batch, activeBatch: null });
    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SENSOR READINGS & TELEMETRY API ENDPOINTS ---

// 1. GET Device Status (MongoDB Device model query)
const getDeviceStatus = async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    const dev = await Device.findOne({ deviceId: devId });
    if (!dev) {
      return res.status(404).json({
        deviceId: devId,
        status: "offline",
        temperature: null,
        pH: null,
        voltage: null,
        raw: null,
        phConnected: false,
        tempConnected: false,
        led: false,
        tempEnabled: true,
        lastSeen: null
      });
    }
    res.json(dev);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.get("/status", getDeviceStatus);
app.get("/api/status", getDeviceStatus);
app.get("/api/readings/latest", getDeviceStatus);

// 2. GET Historical Telemetry Logs from MongoDB (pH & Temperature)
const getTelemetryHistory = async (req, res) => {
  try {
    const devId = req.query.deviceId || "esp32-1";
    const hours = parseFloat(req.query.hours);
    const limit = parseInt(req.query.limit) || 100;

    let filter = { deviceId: devId };
    if (!isNaN(hours) && hours > 0) {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      filter.timestamp = { $gte: startTime };
    }

    const logs = await TemperatureLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit);

    // Return in chronological order for frontend charts
    res.json(logs.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.get("/temp/history", getTelemetryHistory);
app.get("/api/temp/history", getTelemetryHistory);
app.get("/api/readings", getTelemetryHistory);

// 3. POST HTTP Telemetry from ESP32 (saves to MongoDB)
const postTelemetry = async (req, res) => {
  try {
    const payload = req.body.data || req.body;
    const devId = req.body.deviceId || payload.deviceId || "esp32-1";
    const { temperature, pH, voltage, raw, phConnected, tempConnected, led } = payload;

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

    await saveTemperatureLogIfNeeded(devId, { temperature, pH, voltage, raw, phConnected, tempConnected, led });
    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    res.json({ success: true, device: dev });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
app.post("/api/telemetry", postTelemetry);
app.post("/api/readings", postTelemetry);

// 4. HTTP Device Control (LED & Sensor Polling)
const handleControlCommand = async (req, res, forceLedState, forceTempState) => {
  try {
    const devId = req.body.deviceId || req.query.deviceId || "esp32-1";
    const updateObj = { lastSeen: new Date(), status: "online" };
    
    if (forceLedState !== undefined) updateObj.led = forceLedState;
    else if (req.body.led !== undefined) updateObj.led = req.body.led;

    if (forceTempState !== undefined) updateObj.tempEnabled = forceTempState;
    else if (req.body.tempEnabled !== undefined) updateObj.tempEnabled = req.body.tempEnabled;

    const dev = await Device.findOneAndUpdate(
      { deviceId: devId },
      updateObj,
      { returnDocument: "after", upsert: true }
    );

    broadcastToDashboards({ type: "deviceUpdate", data: dev });

    const deviceWs = deviceClients.get(devId);
    if (deviceWs && deviceWs.readyState === 1) {
      const forwardPayload = { type: "control" };
      if (dev.led !== undefined) forwardPayload.led = dev.led;
      if (dev.tempEnabled !== undefined) forwardPayload.tempEnabled = dev.tempEnabled;
      deviceWs.send(JSON.stringify(forwardPayload));
    }

    res.json({ success: true, device: dev });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post("/led/on", (req, res) => handleControlCommand(req, res, true, undefined));
app.post("/led/off", (req, res) => handleControlCommand(req, res, false, undefined));
app.post("/temp/on", (req, res) => handleControlCommand(req, res, undefined, true));
app.post("/temp/off", (req, res) => handleControlCommand(req, res, undefined, false));
app.post("/api/control", (req, res) => handleControlCommand(req, res, undefined, undefined));

// Start Server
server.listen(PORT, () => {
  console.log(`[Backend] Server listening on http://localhost:${PORT}`);
});
